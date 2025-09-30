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
import type { FundEvent, RawEventActual } from '@/types/financial';
import { toNumber } from '@/types/api';
import { useEventMutations, useFundEventActuals } from '@/hooks/useFundEvents';

const LINE_TYPE_LABEL: Record<'income' | 'expense', { label: string; tone: 'success' | 'critical' }> = {
  income: { label: 'Ingreso', tone: 'success' },
  expense: { label: 'Gasto', tone: 'critical' },
};

type ActualFormData = {
  line_type: 'income' | 'expense';
  description: string;
  amount: number;
  receipt_url?: string;
  notes?: string;
};

type ActualsManagerProps = {
  event: FundEvent;
  canEdit: boolean;
};

const INITIAL_FORM_STATE: ActualFormData = {
  line_type: 'expense',
  description: '',
  amount: 0,
  receipt_url: '',
  notes: '',
};

type DialogMode = 'create' | 'edit';

export function ActualsManager({ event, canEdit }: ActualsManagerProps) {
  const { data: actualsData = [] } = useFundEventActuals(event.id);
  const { addActual, updateActual, deleteActual } = useEventMutations();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [editingActual, setEditingActual] = useState<RawEventActual | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ActualFormData>(INITIAL_FORM_STATE);
  const [deleteTarget, setDeleteTarget] = useState<RawEventActual | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const actuals: RawEventActual[] = useMemo(
    () => (actualsData as RawEventActual[]) || [],
    [actualsData]
  );

  const closeFormDialog = () => {
    setIsDialogOpen(false);
    setDialogMode('create');
    setEditingActual(null);
    setFormData(INITIAL_FORM_STATE);
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingActual(null);
    setFormData(INITIAL_FORM_STATE);
    setIsDialogOpen(true);
  };

  const handleEdit = (actual: RawEventActual) => {
    setEditingActual(actual);
    setDialogMode('edit');
    setFormData({
      line_type: actual.line_type,
      description: actual.description,
      amount: toNumber(actual.amount, 0),
      receipt_url: actual.receipt_url || '',
      notes: actual.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!formData.description.trim() || formData.amount <= 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingActual) {
        await updateActual.mutateAsync({
          eventId: event.id,
          actualId: editingActual.id,
          data: {
            line_type: formData.line_type,
            description: formData.description.trim(),
            amount: formData.amount,
            receipt_url: formData.receipt_url?.trim() || '',
            notes: formData.notes?.trim() || '',
          },
        });
      } else {
        await addActual.mutateAsync({
          eventId: event.id,
          data: {
            line_type: formData.line_type,
            description: formData.description.trim(),
            amount: formData.amount,
            receipt_url: formData.receipt_url?.trim() || '',
            notes: formData.notes?.trim() || '',
          },
        });
      }
      closeFormDialog();
    } catch (error) {
      console.error('Error saving actual entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDelete = (actual: RawEventActual) => {
    if (!canEdit) return;
    setDeleteTarget(actual);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteActual.mutateAsync({ eventId: event.id, actualId: deleteTarget.id });
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting actual entry:', error);
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

  const totalIncome = useMemo(
    () =>
      actuals
        .filter((actual) => actual.line_type === 'income')
        .reduce((sum, actual) => sum + toNumber(actual.amount, 0), 0),
    [actuals]
  );

  const totalExpense = useMemo(
    () =>
      actuals
        .filter((actual) => actual.line_type === 'expense')
        .reduce((sum, actual) => sum + toNumber(actual.amount, 0), 0),
    [actuals]
  );

  const netAmount = totalIncome - totalExpense;

  const lastUpdatedAt = useMemo(() => {
    if (actuals.length === 0) return null;
    return actuals.reduce((latest, actual) => {
      const timestamp = new Date(actual.recorded_at).getTime();
      return timestamp > latest ? timestamp : latest;
    }, 0);
  }, [actuals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Ingresos y Gastos Reales</h3>
        {canEdit ? (
          <Button size="sm" onClick={openCreateDialog} disabled={isDialogOpen}>
            + Registrar línea
          </Button>
        ) : null}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Resumen financiero</p>
            <p className="text-xs text-gray-500">
              {lastUpdatedAt
                ? `Última actualización ${new Date(lastUpdatedAt).toLocaleString('es-PY')}`
                : 'Todavía no se registraron movimientos reales.'}
            </p>
          </div>
          <div className="text-xs text-gray-500">
            {actuals.length > 0 ? `${actuals.length} registros` : 'Sin registros'}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 px-4 py-3 text-sm font-semibold md:grid-cols-3">
          <div className="flex items-center justify-between md:block">
            <span className="text-gray-600">Total ingresos</span>
            <span className="text-green-700">₲ {totalIncome.toLocaleString('es-PY')}</span>
          </div>
          <div className="flex items-center justify-between md:block">
            <span className="text-gray-600">Total gastos</span>
            <span className="text-red-700">₲ {totalExpense.toLocaleString('es-PY')}</span>
          </div>
          <div className="flex items-center justify-between md:block">
            <span className="text-gray-600 md:text-right">Neto</span>
            <span className={netAmount >= 0 ? 'text-green-700 md:text-right' : 'text-red-700 md:text-right'}>
              ₲ {netAmount.toLocaleString('es-PY')}
            </span>
          </div>
        </div>
      </div>

      {actuals.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-8 text-center text-gray-500">
          No se han registrado ingresos ni gastos
        </div>
      ) : (
        <ul role="list" className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {actuals.map((actual) => {
            const amount = toNumber(actual.amount, 0);
            const status = LINE_TYPE_LABEL[actual.line_type];

            return (
              <li key={actual.id} className="px-4 py-3">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    <p className="mt-1 text-sm font-medium text-gray-900">{actual.description}</p>
                    {actual.notes ? <p className="mt-1 text-xs text-gray-600">{actual.notes}</p> : null}
                    {actual.receipt_url ? (
                      <p className="mt-1 text-xs">
                        <a
                          href={actual.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          Ver comprobante
                        </a>
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-500">
                      Registrado el {new Date(actual.recorded_at).toLocaleString('es-PY')}
                      {((actual as { recorded_by_name?: string | null }).recorded_by_name ?? null) && (
                        <>
                          {' '}
                          por {(actual as { recorded_by_name?: string | null }).recorded_by_name}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${status.tone === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                      ₲ {amount.toLocaleString('es-PY')}
                    </p>
                  </div>
                </div>

                {canEdit ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(actual)}>
                      Editar línea
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => requestDelete(actual)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleFormDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Registrar ingreso o gasto' : 'Editar ingreso o gasto'}
            </DialogTitle>
            <DialogDescription>
              Captura los movimientos reales del evento para mantener el control financiero al día.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Tipo" htmlFor="dialog-actual-type" required>
                <select
                  id="dialog-actual-type"
                  value={formData.line_type}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      line_type: event.target.value as 'income' | 'expense',
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="income">Ingreso</option>
                  <option value="expense">Gasto</option>
                </select>
              </FormField>

              <FormField label="Monto (₲)" htmlFor="dialog-actual-amount" required>
                <input
                  id="dialog-actual-amount"
                  type="number"
                  value={formData.amount}
                  min={0}
                  step={1000}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, amount: parseFloat(event.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </FormField>
            </div>

            <FormField label="Descripción" htmlFor="dialog-actual-description" required>
              <input
                id="dialog-actual-description"
                type="text"
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Detalle del ingreso o gasto..."
                required
              />
            </FormField>

            <FormField label="URL del comprobante (opcional)" htmlFor="dialog-actual-receipt">
              <input
                id="dialog-actual-receipt"
                type="url"
                value={formData.receipt_url || ''}
                onChange={(event) => setFormData((prev) => ({ ...prev, receipt_url: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </FormField>

            <FormField label="Notas (opcional)" htmlFor="dialog-actual-notes">
              <textarea
                id="dialog-actual-notes"
                value={formData.notes || ''}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Información adicional..."
              />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeFormDialog} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={formData.amount <= 0 || isSubmitting}
              >
                {dialogMode === 'create' ? 'Guardar movimiento' : 'Actualizar movimiento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={handleDeleteDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar registro</DialogTitle>
            <DialogDescription>
              Esta acción quitará el movimiento registrado del evento. Revisa que el balance continúe siendo correcto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-gray-700">
            <p className="font-medium text-gray-900">{deleteTarget?.description}</p>
            {deleteTarget?.notes ? <p className="text-gray-600">{deleteTarget.notes}</p> : null}
            <p className="text-gray-500">
              Monto: ₲ {deleteTarget ? toNumber(deleteTarget.amount, 0).toLocaleString('es-PY') : 0}
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={isDeleting}>
              Eliminar registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}