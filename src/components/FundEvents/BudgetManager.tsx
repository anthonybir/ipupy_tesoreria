'use client';

import { useMemo, useState } from 'react';

import { FormField, StatusPill } from '@/components/Shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EventBudgetItem } from '@/types/financial';
import { useEventMutations, useFundEventBudgetItems } from '@/hooks/useFundEvents';
import type { EventCategory } from '@/types/financial';
import { toNumber } from '@/types/api';

const CATEGORY_LABELS: Record<EventCategory, string> = {
  venue: 'Local/Sede',
  materials: 'Materiales',
  food: 'Alimentación',
  transport: 'Transporte',
  honoraria: 'Honorarios',
  marketing: 'Marketing/Difusión',
  other: 'Otro',
};

type BudgetFormState = {
  category: EventCategory;
  description: string;
  projected_amount: number;
  notes?: string;
};

type BudgetManagerProps = {
  eventId: string;
  canEdit: boolean;
};

const INITIAL_FORM_STATE: BudgetFormState = {
  category: 'materials',
  description: '',
  projected_amount: 0,
  notes: '',
};

type DialogMode = 'create' | 'edit';

export function BudgetManager({ eventId, canEdit }: BudgetManagerProps) {
  const {
    data: items = [],
    isLoading,
    isFetching,
    isError,
    error,
  } = useFundEventBudgetItems(eventId);
  const { addBudgetItem, updateBudgetItem, deleteBudgetItem } = useEventMutations();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [editingItem, setEditingItem] = useState<EventBudgetItem | null>(null);
  const [formState, setFormState] = useState<BudgetFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventBudgetItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const closeFormDialog = () => {
    setIsDialogOpen(false);
    setDialogMode('create');
    setEditingItem(null);
    setFormState(INITIAL_FORM_STATE);
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingItem(null);
    setFormState(INITIAL_FORM_STATE);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: EventBudgetItem) => {
    setEditingItem(item);
    setDialogMode('edit');
    setFormState({
      category: item.category,
      description: item.description,
      projected_amount: item.projectedAmount,
      notes: item.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.description.trim() || formState.projected_amount <= 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateBudgetItem.mutateAsync({
          eventId,
          budgetItemId: editingItem.id,
          data: {
            category: formState.category,
            description: formState.description.trim(),
            projected_amount: formState.projected_amount,
            notes: formState.notes?.trim() || '',
          },
        });
      } else {
        await addBudgetItem.mutateAsync({
          eventId,
          data: {
            category: formState.category,
            description: formState.description.trim(),
            projected_amount: formState.projected_amount,
            notes: formState.notes?.trim() || '',
          },
        });
      }
      closeFormDialog();
    } catch (error) {
      console.error('Error saving budget item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDelete = (item: EventBudgetItem) => {
    if (!canEdit) return;
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteBudgetItem.mutateAsync({ eventId, budgetItemId: deleteTarget.id });
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting budget item:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormDialogChange = (open: boolean) => {
    if (!open) {
      if (isSubmitting) return;
      closeFormDialog();
      return;
    }
    setIsDialogOpen(true);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open && !isDeleting) {
      setDeleteTarget(null);
    }
  };

  const totalProjected = useMemo(
    () => items.reduce((sum, item) => sum + toNumber(item.projectedAmount, 0), 0),
    [items]
  );

  const lastUpdatedAt = useMemo(() => {
    if (items.length === 0) return null;
    return items.reduce((latest, item) => {
      const timestamp = new Date(item.updatedAt).getTime();
      return timestamp > latest ? timestamp : latest;
    }, 0);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Presupuesto Proyectado</h3>
        {canEdit ? (
          <Button size="sm" onClick={openCreateDialog} disabled={isDialogOpen || isLoading}>
            + Agregar partida
          </Button>
        ) : null}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Total proyectado</p>
            <p className="text-xs text-gray-500">
              {lastUpdatedAt
                ? `Última actualización ${new Date(lastUpdatedAt).toLocaleString('es-PY')}`
                : 'Agrega las partidas planificadas para este evento'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-indigo-600">
              ₲ {totalProjected.toLocaleString('es-PY')}
            </p>
            {isFetching ? <p className="text-xs text-gray-400">Actualizando...</p> : null}
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-500">Cargando partidas...</div>
        ) : isError ? (
          <div className="py-8 text-center text-red-600">
            {error instanceof Error ? error.message : 'No se pudieron cargar las partidas.'}
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            {canEdit
              ? 'No se registraron partidas. Usa "Agregar partida" para empezar.'
              : 'No se registraron partidas presupuestarias.'}
          </div>
        ) : (
          <ul role="list" className="divide-y divide-gray-200">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <StatusPill tone="info">{CATEGORY_LABELS[item.category]}</StatusPill>
                    <p className="text-sm font-medium text-gray-900">{item.description}</p>
                    {item.notes ? <p className="text-xs text-gray-600">{item.notes}</p> : null}
                    <p className="text-xs text-gray-500">
                      Actualizado el {new Date(item.updatedAt).toLocaleString('es-PY')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      ₲ {item.projectedAmount.toLocaleString('es-PY')}
                    </p>
                  </div>
                </div>

                {canEdit ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(item)}>
                      Editar partida
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => requestDelete(item)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleFormDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Agregar partida presupuestaria' : 'Editar partida presupuestaria'}
            </DialogTitle>
            <DialogDescription>
              Define el detalle y monto proyectado de cada partida para mantener el presupuesto del evento actualizado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Categoría" htmlFor="dialog-budget-category" required>
                <select
                  id="dialog-budget-category"
                  value={formState.category}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, category: event.target.value as EventCategory }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Monto (₲)" htmlFor="dialog-budget-amount" required>
                <input
                  id="dialog-budget-amount"
                  type="number"
                  value={formState.projected_amount}
                  min={0}
                  step={1000}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, projected_amount: parseFloat(event.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </FormField>
            </div>

            <FormField label="Descripción" htmlFor="dialog-budget-description" required>
              <input
                id="dialog-budget-description"
                type="text"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Detalle de la partida presupuestaria..."
                required
              />
            </FormField>

            <FormField label="Notas" htmlFor="dialog-budget-notes">
              <textarea
                id="dialog-budget-notes"
                value={formState.notes || ''}
                onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Información adicional (opcional)"
              />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeFormDialog} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={formState.projected_amount <= 0 || isSubmitting}
              >
                {dialogMode === 'create' ? 'Guardar partida' : 'Actualizar partida'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={handleDeleteDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar partida</DialogTitle>
            <DialogDescription>
              Esta acción quitará la partida del presupuesto proyectado. Podrás volver a cargarla más adelante si es necesario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-gray-700">
            <p className="font-medium text-gray-900">{deleteTarget?.description}</p>
            {deleteTarget?.notes ? <p className="text-gray-600">{deleteTarget.notes}</p> : null}
            <p className="text-gray-500">
              Monto proyectado: ₲{' '}
              {deleteTarget ? deleteTarget.projectedAmount.toLocaleString('es-PY') : 0}
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={isDeleting}>
              Eliminar partida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
