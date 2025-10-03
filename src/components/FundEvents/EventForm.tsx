'use client';

import { useState } from 'react';
import { useFunds } from '@/hooks/useFunds';
import { useChurches } from '@/hooks/useChurches';
import { useEventMutations } from '@/hooks/useFundEvents';
import { FormField, SectionCard } from '@/components/Shared';
import { Button } from '@/components/ui/button';
import type { EventCategory, CreateEventInput, FundRecord } from '@/types/financial';
import type { ChurchRecord } from '@/types/api';

type BudgetItemInput = {
  category: EventCategory;
  description: string;
  projected_amount: number;
  notes: string;
};

type EventFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  venue: 'Local/Sede',
  materials: 'Materiales',
  food: 'Alimentación',
  transport: 'Transporte',
  honoraria: 'Honorarios',
  marketing: 'Marketing/Difusión',
  other: 'Otro',
};

export function EventForm({ onSuccess, onCancel }: EventFormProps) {
  const [formData, setFormData] = useState<CreateEventInput>({
    fund_id: 0,
    church_id: null,
    name: '',
    description: '',
    event_date: '',
    budget_items: [],
  });

  const [budgetItems, setBudgetItems] = useState<BudgetItemInput[]>([
    { category: 'venue', description: '', projected_amount: 0, notes: '' },
  ]);

  const fundsQuery = useFunds();
  const churchesQuery = useChurches();
  const { createEvent } = useEventMutations();

  const funds: FundRecord[] = fundsQuery.data?.records ?? [];
  const churches: ChurchRecord[] = churchesQuery.data ?? [];

  const handleAddBudgetItem = () => {
    setBudgetItems([
      ...budgetItems,
      { category: 'materials', description: '', projected_amount: 0, notes: '' },
    ]);
  };

  const handleRemoveBudgetItem = (index: number) => {
    setBudgetItems(budgetItems.filter((_, i) => i !== index));
  };

  const updateBudgetItem = (index: number, patch: Partial<BudgetItemInput>) => {
    setBudgetItems((items) =>
      items.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const calculateTotal = () => {
    return budgetItems.reduce((sum, item) => sum + item.projected_amount, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validBudgetItems = budgetItems.filter(
      (item) => item.description.trim() !== '' && item.projected_amount > 0
    );

    const payload: CreateEventInput = {
      ...formData,
      budget_items: validBudgetItems,
    };

    try {
      await createEvent.mutateAsync(payload);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const isValid =
    formData.fund_id > 0 &&
    formData.name.trim() !== '' &&
    formData.event_date !== '' &&
    budgetItems.some((item) => item.description.trim() !== '' && item.projected_amount > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SectionCard title="Información del Evento">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Fondo" htmlFor="fund_id" required>
            <select
              id="fund_id"
              value={formData.fund_id}
              onChange={(e) =>
                setFormData({ ...formData, fund_id: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Seleccionar fondo</option>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Iglesia (opcional)" htmlFor="church_id">
            <select
              id="church_id"
              value={formData.church_id ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  church_id: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Ninguna / Nacional</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name} - {church.city}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Nombre del Evento" htmlFor="event_name" required>
            <input
              id="event_name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Conferencia Nacional 2025"
              required
            />
          </FormField>

          <FormField label="Fecha del Evento" htmlFor="event_date" required>
            <input
              id="event_date"
              type="date"
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </FormField>
        </div>

        <FormField label="Descripción" htmlFor="description">
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder="Descripción detallada del evento..."
          />
        </FormField>
      </SectionCard>

      <SectionCard title="Presupuesto Proyectado">
        <div className="space-y-4">
          {budgetItems.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-lg"
            >
              <div className="md:col-span-3">
                <FormField label="Categoría" htmlFor={`category_${index}`}>
                  <select
                    id={`category_${index}`}
                    value={item.category}
                    onChange={(e) =>
                      updateBudgetItem(index, {
                        category: e.target.value as EventCategory,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="md:col-span-4">
                <FormField label="Descripción" htmlFor={`budget_description_${index}`}>
                  <input
                    id={`budget_description_${index}`}
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateBudgetItem(index, { description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Detalle del gasto..."
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField label="Monto (₲)" htmlFor={`projected_amount_${index}`}>
                  <input
                    id={`projected_amount_${index}`}
                    type="number"
                    value={item.projected_amount}
                    onChange={(e) => {
                      const parsed = Number.parseFloat(e.target.value);
                      updateBudgetItem(index, {
                        projected_amount: Number.isFinite(parsed) ? parsed : 0,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    min="0"
                    step="1000"
                  />
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField label="Notas" htmlFor={`notes_${index}`}>
                  <input
                    id={`notes_${index}`}
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateBudgetItem(index, { notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Opcional"
                  />
                </FormField>
              </div>

              <div className="md:col-span-1 flex items-end">
                {budgetItems.length > 1 && (
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveBudgetItem(index);
                    }}
                    className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition"
                    title="Eliminar línea"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={handleAddBudgetItem}>
              + Agregar Línea Presupuestaria
            </Button>

            <div className="text-right">
              <div className="text-sm text-gray-600">Total Proyectado</div>
              <div className="text-2xl font-bold text-indigo-600">
                ₲ {calculateTotal().toLocaleString('es-PY')}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={!isValid || createEvent.isPending}>
          {createEvent.isPending ? 'Creando...' : 'Crear Evento'}
        </Button>
      </div>

      {createEvent.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">
            {createEvent.error instanceof Error
              ? createEvent.error.message
              : 'Error al crear el evento'}
          </p>
        </div>
      )}
    </form>
  );
}