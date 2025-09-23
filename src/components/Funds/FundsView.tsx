'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/api-client';
import { useFunds } from '@/hooks/useFunds';
import { DataTable } from '@/components/Shared/DataTable';
import { LoadingState } from '@/components/Shared/LoadingState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { EmptyState } from '@/components/Shared/EmptyState';
import type { FundCollection, FundRecord } from '@/types/financial';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

type FundFormState = {
  id?: number;
  name: string;
  description: string;
  category: string;
  initialBalance: string;
  targetAmount: string;
  active: boolean;
};

const defaultFormState: FundFormState = {
  name: '',
  description: '',
  category: 'general',
  initialBalance: '0',
  targetAmount: '',
  active: true,
};
export default function FundsView() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<FundFormState>(defaultFormState);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const fundsQuery = useFunds({ includeInactive });
  const fundCollection: FundCollection | undefined = fundsQuery.data;
  const funds = fundCollection?.records ?? [];
  const totals = fundCollection?.totals;

  useEffect(() => {
    setSelectedFund((current) => {
      if (!current) {
        return current;
      }
      if (!includeInactive && !current.status.active) {
        return null;
      }
      return current;
    });
  }, [includeInactive]);

  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Fondo',
        render: (fund: FundRecord) => (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-800">{fund.name}</span>
            <span className="text-xs text-slate-500">{fund.description || 'Sin descripción'}</span>
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Categoría',
        render: (fund: FundRecord) => (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {fund.category}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Saldo actual',
        align: 'right' as const,
        render: (fund: FundRecord) => (
          <span className="text-sm font-semibold text-slate-800">
            {formatCurrency(fund.balances.current)}
          </span>
        ),
      },
      {
        id: 'target',
        header: 'Meta',
        align: 'right' as const,
        render: (fund: FundRecord) => (
          <span className="text-sm text-slate-600">
            {fund.balances.target ? formatCurrency(fund.balances.target) : '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Estado',
        render: (fund: FundRecord) => (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              fund.status.active
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {fund.status.active ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
      {
        id: 'updated',
        header: 'Actualizado',
        render: (fund: FundRecord) => (
          <span className="text-xs text-slate-500">{formatDate(fund.status.updatedAt)}</span>
        ),
      },
    ],
    [],
  );

  const openCreateForm = () => {
    setFormMode('create');
    setFormState(defaultFormState);
    setIsFormOpen(true);
  };

  const openEditForm = (fund: FundRecord) => {
    setFormMode('edit');
    setFormState({
      id: fund.id,
      name: fund.name,
      description: fund.description,
      category: fund.category,
      initialBalance: String(fund.balances.initial),
      targetAmount: fund.balances.target ? String(fund.balances.target) : '',
      active: fund.status.active,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => setIsFormOpen(false);

  const refreshFunds = () => {
    void fundsQuery.refetch();
  };
  const handleSubmitFund = async (state: FundFormState) => {
    if (!state.name.trim()) {
      toast.error('El nombre del fondo es obligatorio.');
      return;
    }

    const targetAmount = state.targetAmount ? Number(state.targetAmount) : undefined;

    try {
      if (formMode === 'create') {
        await fetchJson('/api/financial/funds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: state.name,
            description: state.description,
            category: state.category,
            initial_balance: Number(state.initialBalance) || 0,
            target_amount: targetAmount ?? null,
            active: state.active,
          }),
        });
        toast.success('Fondo creado correctamente');
      } else if (state.id) {
        await fetchJson(`/api/financial/funds?id=${state.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: state.name,
            description: state.description,
            category: state.category,
            current_balance: Number(state.initialBalance) || 0,
            target_amount: targetAmount ?? null,
            active: state.active,
          }),
        });
        toast.success('Fondo actualizado');
      }
      closeForm();
      refreshFunds();
    } catch (error) {
      console.error('Error saving fund', error);
      toast.error('No se pudo guardar el fondo.');
    }
  };

  const handleToggleActive = async (fund: FundRecord) => {
    try {
      await fetchJson(`/api/financial/funds?id=${fund.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: !fund.status.active,
        }),
      });
      toast.success(
        fund.status.active ? 'Fondo desactivado' : 'Fondo activado',
      );
      refreshFunds();
    } catch (error) {
      console.error('Error toggling fund', error);
      toast.error('No se pudo actualizar el estado del fondo.');
    }
  };

  const handleDeleteFund = async (fund: FundRecord) => {
    const confirmed = window.confirm(
      '¿Deseas eliminar este fondo? Si tiene transacciones registradas, se desactivará en lugar de eliminarse.',
    );
    if (!confirmed) {
      return;
    }

    try {
      await fetchJson(`/api/financial/funds?id=${fund.id}`, {
        method: 'DELETE',
      });
      toast.success('El fondo se actualizó correctamente');
      setSelectedFund(null);
      refreshFunds();
    } catch (error) {
      console.error('Error deleting fund', error);
      toast.error('No se pudo eliminar el fondo.');
    }
  };
  const isLoading = fundsQuery.isLoading || fundsQuery.isPending;
  const isError = fundsQuery.isError;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Administración de fondos
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Fondos nacionales</h1>
          <p className="text-sm text-slate-600">
            Gestiona los fondos disponibles, sus saldos y metas financieras.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Crear fondo
        </button>
      </div>

      <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <input
            id="include-inactive"
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="include-inactive" className="text-sm font-medium text-slate-600">
            Mostrar fondos inactivos
          </label>
        </div>
        <div className="text-xs text-slate-500">
          Última actualización:
          {' '}
          <strong>
            {fundsQuery.dataUpdatedAt
              ? new Intl.DateTimeFormat('es-PY', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: 'short',
                }).format(fundsQuery.dataUpdatedAt)
              : '—'}
          </strong>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FundStatCard
          title="Fondos activos"
          value={totals ? `${totals.activeFunds}/${totals.totalFunds}` : '0/0'}
          subtitle="Fondos disponibles"
        />
        <FundStatCard
          title="Saldo consolidado"
          value={formatCurrency(totals?.totalBalance ?? 0)}
          subtitle="Saldo actual sumado"
        />
        <FundStatCard
          title="Meta total"
          value={formatCurrency(totals?.totalTarget ?? 0)}
          subtitle="Objetivos establecidos"
        />
      </section>

      <section>
        {isLoading ? (
          <LoadingState description="Obteniendo información de fondos" fullHeight />
        ) : isError ? (
          <ErrorState
            description={(fundsQuery.error as Error)?.message ?? 'Error inesperado'}
            onRetry={refreshFunds}
          />
        ) : funds.length === 0 ? (
          <EmptyState
            title="Aún no se registraron fondos"
            description="Crea un fondo para comenzar a administrar recursos."
            icon={<span>💰</span>}
            action={
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Crear fondo
              </button>
            }
            fullHeight
          />
        ) : (
          <DataTable
            data={funds}
            columns={columns}
            getRowId={(fund) => fund.id}
            onRowClick={(fund) => setSelectedFund(fund)}
          />
        )}
      </section>

      <FundFormModal
        open={isFormOpen}
        mode={formMode}
        data={formState}
        onChange={setFormState}
        onClose={closeForm}
        onSubmit={handleSubmitFund}
      />

      <FundDetailsSheet
        fund={selectedFund}
        onClose={() => setSelectedFund(null)}
        onEdit={(fund) => {
          if (!fund) {
            return;
          }
          openEditForm(fund);
        }}
        onToggleActive={handleToggleActive}
        onDelete={handleDeleteFund}
      />
    </div>
  );
}
type FundStatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

function FundStatCard({ title, value, subtitle }: FundStatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? (
        <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

type FundFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  data: FundFormState;
  onChange: (state: FundFormState) => void;
  onClose: () => void;
  onSubmit: (state: FundFormState) => Promise<void> | void;
};

function FundFormModal({ open, mode, data, onChange, onClose, onSubmit }: FundFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const handleFieldChange = <Key extends keyof FundFormState>(field: Key) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value =
        event.target.type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : event.target.value;
      onChange({
        ...data,
        [field]: value,
      });
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const balanceLabel = mode === 'create' ? 'Saldo inicial' : 'Saldo actual';

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title className="text-lg font-semibold text-slate-900">
                  {mode === 'create' ? 'Crear fondo' : 'Editar fondo'}
                </Dialog.Title>
                <p className="mt-1 text-sm text-slate-500">
                  Define la información principal del fondo y su estado operativo.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                    Nombre del fondo
                    <input
                      type="text"
                      value={data.name}
                      onChange={handleFieldChange('name')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Ej. Fondo Nacional"
                      required
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                    Descripción
                    <textarea
                      value={data.description}
                      onChange={handleFieldChange('description')}
                      rows={3}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Detalle del destino del fondo"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      Categoría
                      <select
                        value={data.category}
                        onChange={handleFieldChange('category')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="general">General</option>
                        <option value="automatic">Automático</option>
                        <option value="proyecto">Proyecto</option>
                        <option value="mision">Misión</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      {balanceLabel}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={data.initialBalance}
                        onChange={handleFieldChange('initialBalance')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                    Meta económica (opcional)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={data.targetAmount}
                      onChange={handleFieldChange('targetAmount')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="0"
                    />
                  </label>

                  <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={data.active}
                      onChange={handleFieldChange('active')}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Fondo activo
                  </label>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear fondo' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

type FundDetailsSheetProps = {
  fund: FundRecord | null;
  onClose: () => void;
  onEdit: (fund: FundRecord | null) => void;
  onToggleActive: (fund: FundRecord) => void;
  onDelete: (fund: FundRecord) => void;
};

function FundDetailsSheet({ fund, onClose, onEdit, onToggleActive, onDelete }: FundDetailsSheetProps) {
  const open = Boolean(fund);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-200"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-150"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-auto bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                      <Dialog.Title className="text-lg font-semibold text-slate-900">
                        Detalle del fondo
                      </Dialog.Title>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>

                    {fund ? (
                      <div className="space-y-5 px-6 py-6 text-sm text-slate-700">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Nombre
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{fund.name}</p>
                        </div>

                        <dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-600">
                          <div className="flex justify-between">
                            <dt>Categoría</dt>
                            <dd className="font-semibold text-slate-800">{fund.category}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Saldo actual</dt>
                            <dd className="font-semibold text-slate-800">
                              {formatCurrency(fund.balances.current)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Saldo inicial</dt>
                            <dd className="font-semibold text-slate-800">
                              {formatCurrency(fund.balances.initial)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Meta</dt>
                            <dd className="font-semibold text-slate-800">
                              {fund.balances.target ? formatCurrency(fund.balances.target) : 'Sin definir'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Estado</dt>
                            <dd className="font-semibold text-slate-800">
                              {fund.status.active ? 'Activo' : 'Inactivo'}
                            </dd>
                          </div>
                        </dl>

                        {fund.description ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Descripción
                            </p>
                            <p className="mt-1 text-sm text-slate-700">{fund.description}</p>
                          </div>
                        ) : null}

                        <div className="flex flex-col gap-2 text-xs text-slate-500">
                          <span>Creado: {formatDate(fund.status.createdAt)}</span>
                          <span>Actualizado: {formatDate(fund.status.updatedAt)}</span>
                        </div>

                        <div className="flex flex-col gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => onEdit(fund)}
                            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-500 hover:text-indigo-600"
                          >
                            Editar fondo
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleActive(fund)}
                            className="w-full rounded-full border border-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                          >
                            {fund.status.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(fund)}
                            className="w-full rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
