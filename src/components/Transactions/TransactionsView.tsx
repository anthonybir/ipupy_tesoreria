'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/api-client';
import { useFunds } from '@/hooks/useFunds';
import { useTransactions } from '@/hooks/useTransactions';
import { useChurches } from '@/hooks/useChurches';
import { useProfile } from '@/hooks/useProfile';
import { DataTable } from '@/components/Shared/DataTable';
import { LoadingState } from '@/components/Shared/LoadingState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { EmptyState } from '@/components/Shared/EmptyState';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCurrencyDisplay, rawValueToNumber } from '@/lib/utils/currency';
import {
  type FundRecord,
  type TransactionFilters,
  type TransactionRecord,
} from '@/types/financial';

const monthLabels = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const currentYear = new Date().getFullYear();
const selectableYears = Array.from({ length: 6 }).map((_, index) => currentYear - index);

type FilterState = {
  fundId: string;
  churchId: string;
  month: string;
  year: string;
  limit: number;
};

type FormMode = 'create' | 'edit';

type TransactionFormData = {
  id?: number;
  date: string;
  fundId: string;
  churchId: string;
  concept: string;
  provider: string;
  documentNumber: string;
  type: 'income' | 'expense';
  amount: string;
};

const formatCurrency = (value: number): string => formatCurrencyDisplay(value);

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
const defaultFormState = (): TransactionFormData => ({
  date: new Date().toISOString().slice(0, 10),
  fundId: 'all',
  churchId: 'all',
  concept: '',
  provider: '',
  documentNumber: '',
  type: 'income',
  amount: '',
});

const defaultFilters: FilterState = {
  fundId: 'all',
  churchId: 'all',
  month: 'all',
  year: String(currentYear),
  limit: 25,
};

const buildTransactionFilters = (
  state: FilterState,
  offset: number,
): TransactionFilters => {
  const filters: TransactionFilters = {
    limit: state.limit,
    offset,
  };

  if (state.fundId !== 'all') {
    filters.fundId = Number(state.fundId);
  }

  if (state.churchId !== 'all') {
    filters.churchId = Number(state.churchId);
  }

  if (state.month !== 'all') {
    filters.month = Number(state.month);
  }

  if (state.year !== 'all') {
    filters.year = Number(state.year);
  }

  return filters;
};
export default function TransactionsView() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [offset, setOffset] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formData, setFormData] = useState<TransactionFormData>(() => defaultFormState());

  const { isReadOnly } = useProfile();
  const queryFilters = useMemo(
    () => buildTransactionFilters(filters, offset),
    [filters, offset],
  );

  const transactionsQuery = useTransactions(queryFilters, {
    staleTime: 45 * 1000,
    placeholderData: (previous) => previous ?? undefined,
  });
  const fundsQuery = useFunds({ includeInactive: true }, { staleTime: 5 * 60 * 1000 });
  const churchesQuery = useChurches();

  const funds = fundsQuery.data?.records ?? [];
  const churches = churchesQuery.data ?? [];

  useEffect(() => {
    setOffset(0);
  }, [filters.fundId, filters.churchId, filters.month, filters.year, filters.limit]);

  const totals = transactionsQuery.data?.totals;
  const pagination = transactionsQuery.data?.pagination;
  const transactions = transactionsQuery.data?.records ?? [];

  const handleOpenCreate = () => {
    setFormMode('create');
    setFormData(defaultFormState());
    setIsFormOpen(true);
  };

  const handleOpenEdit = (transaction: TransactionRecord) => {
    setFormMode('edit');
    setFormData({
      id: transaction.id,
      date: transaction.date.slice(0, 10),
      fundId: String(transaction.fund.id),
      churchId: transaction.church.id ? String(transaction.church.id) : 'all',
      concept: transaction.concept,
      provider: transaction.provider ?? '',
      documentNumber: transaction.documentNumber ?? '',
      type: transaction.amounts.out > 0 ? 'expense' : 'income',
      amount: String(Math.abs(transaction.amounts.out > 0 ? transaction.amounts.out : transaction.amounts.in)),
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  const applyFilters = useCallback(
    (partial: Partial<FilterState>) => {
      setFilters((prev) => ({
        ...prev,
        ...partial,
      }));
    },
    [],
  );

  const changePage = (direction: 'previous' | 'next') => {
    if (!pagination) {
      return;
    }

    const { limit, offset: currentOffset, total } = pagination;

    if (direction === 'previous') {
      setOffset(Math.max(0, currentOffset - limit));
    } else if (direction === 'next') {
      const nextOffset = currentOffset + limit;
      if (nextOffset < total) {
        setOffset(nextOffset);
      }
    }
  };
  const refetchTransactions = useCallback(() => {
    void transactionsQuery.refetch();
  }, [transactionsQuery]);

  const handleSubmitTransaction = async (payload: TransactionFormData) => {
    if (payload.fundId === 'all') {
      toast.error('Selecciona un fondo para registrar la transacción.');
      return;
    }

    const amountValue = rawValueToNumber(payload.amount);

    if (amountValue <= 0) {
      toast.error('El monto debe ser mayor a cero.');
      return;
    }

    const body = {
      date: payload.date,
      fund_id: Number(payload.fundId),
      church_id: payload.churchId !== 'all' ? Number(payload.churchId) : undefined,
      concept: payload.concept,
      provider: payload.provider || undefined,
      document_number: payload.documentNumber || undefined,
      amount_in: payload.type === 'income' ? amountValue : 0,
      amount_out: payload.type === 'expense' ? amountValue : 0,
    };

    try {
      if (payload.id && formMode === 'edit') {
        await fetchJson(`/api/financial/transactions?id=${payload.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        toast.success('Transacción actualizada correctamente');
      } else {
        await fetchJson('/api/financial/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        toast.success('Transacción registrada correctamente');
      }
      handleCloseForm();
      refetchTransactions();
    } catch (error) {
      console.error('Error submitting transaction', error);
      toast.error('No fue posible guardar la transacción. Intenta nuevamente.');
    }
  };

  const handleDeleteTransaction = async (transaction: TransactionRecord) => {
    const confirmed = window.confirm('¿Deseas eliminar esta transacción? Esta acción no se puede revertir.');
    if (!confirmed) {
      return;
    }

    try {
      await fetchJson(`/api/financial/transactions?id=${transaction.id}`, {
        method: 'DELETE',
      });
      toast.success('Transacción eliminada');
      setSelectedTransaction(null);
      refetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction', error);
      toast.error('No se pudo eliminar la transacción.');
    }
  };
  const columns = useMemo(() => {
    return [
      {
        id: 'date',
        header: 'Fecha',
        render: (transaction: TransactionRecord) => (
          <span className="font-medium text-slate-700">{formatDate(transaction.date)}</span>
        ),
      },
      {
        id: 'concept',
        header: 'Concepto',
        render: (transaction: TransactionRecord) => (
          <div className="flex flex-col text-sm text-slate-700">
            <span className="font-medium">{transaction.concept}</span>
            {transaction.provider ? (
              <span className="text-xs text-slate-500">Proveedor: {transaction.provider}</span>
            ) : null}
          </div>
        ),
        className: 'max-w-xs',
      },
      {
        id: 'fund',
        header: 'Fondo',
        render: (transaction: TransactionRecord) => (
          <span className="text-sm text-slate-600">{transaction.fund.name ?? 'N/D'}</span>
        ),
      },
      {
        id: 'income',
        header: 'Entradas',
        align: 'right' as const,
        render: (transaction: TransactionRecord) => (
          <span className="font-semibold text-emerald-600">
            {transaction.amounts.in > 0 ? formatCurrency(transaction.amounts.in) : '—'}
          </span>
        ),
      },
      {
        id: 'expense',
        header: 'Salidas',
        align: 'right' as const,
        render: (transaction: TransactionRecord) => (
          <span className="font-semibold text-rose-600">
            {transaction.amounts.out > 0 ? formatCurrency(transaction.amounts.out) : '—'}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Balance',
        align: 'right' as const,
        render: (transaction: TransactionRecord) => (
          <span
            className={`font-semibold ${
              transaction.amounts.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatCurrency(transaction.amounts.balance)}
          </span>
        ),
      },
      {
        id: 'createdBy',
        header: 'Registrado por',
        render: (transaction: TransactionRecord) => (
          <div className="text-xs text-slate-500">
            <div>{transaction.audit.createdBy}</div>
            <div>{formatDate(transaction.audit.createdAt)}</div>
          </div>
        ),
      },
    ];
  }, []);
  const isLoading = transactionsQuery.isLoading || transactionsQuery.isPending;
  const isError = transactionsQuery.isError;

  const hasPreviousPage = Boolean(pagination && pagination.offset > 0);
  const hasNextPage = Boolean(
    pagination && pagination.offset + pagination.limit < pagination.total,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Finanzas IPU PY
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">Transacciones</h1>
            <p className="text-sm text-slate-600">
              Registra y analiza los movimientos financieros de la Tesorería Nacional en un
              solo lugar.
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Registrar transacción
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>
          <button
            type="button"
            onClick={() => {
              setFilters(defaultFilters);
              setOffset(0);
            }}
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            Restablecer
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Fondo
            <select
              value={filters.fundId}
              onChange={(event) => applyFilters({ fundId: event.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos los fondos</option>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Iglesia
            <select
              value={filters.churchId}
              onChange={(event) => applyFilters({ churchId: event.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todas las iglesias</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Mes
            <select
              value={filters.month}
              onChange={(event) => applyFilters({ month: event.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos los meses</option>
              {monthLabels.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Año
            <select
              value={filters.year}
              onChange={(event) => applyFilters({ year: event.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos los años</option>
              {selectableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Resultados por página
            <select
              value={filters.limit}
              onChange={(event) =>
                applyFilters({ limit: Number.parseInt(event.target.value, 10) || defaultFilters.limit })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {[25, 50, 100].map((limit) => (
                <option key={limit} value={limit}>
                  {limit} registros
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total entradas"
          value={formatCurrency(totals?.totalIn ?? 0)}
          subtitle={`${totals?.count ?? 0} transacciones`}
          tone="positive"
        />
        <StatCard
          title="Total salidas"
          value={formatCurrency(totals?.totalOut ?? 0)}
          subtitle={`Balance actual ${formatCurrency((totals?.totalIn ?? 0) - (totals?.totalOut ?? 0))}`}
          tone="negative"
        />
        <StatCard
          title="Balance neto"
          value={formatCurrency(totals?.balance ?? 0)}
          subtitle="Ingresos - Egresos"
          tone={totals && totals.balance >= 0 ? 'positive' : 'negative'}
        />
      </section>

      <section className="space-y-4">
        {isLoading ? (
          <LoadingState description="Obteniendo las transacciones registradas" fullHeight />
        ) : isError ? (
          <ErrorState
            description={(transactionsQuery.error as Error)?.message ?? 'Error inesperado'}
            onRetry={refetchTransactions}
          />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="Todavía no hay transacciones para los filtros seleccionados"
            description="Ajusta los filtros o registra una nueva transacción para comenzar."
            icon={<span>💳</span>}
            action={
              !isReadOnly ? (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Registrar transacción
                </button>
              ) : undefined
            }
            fullHeight
          />
        ) : (
          <div className="space-y-4">
            <DataTable
              data={transactions}
              columns={columns}
              getRowId={(transaction) => transaction.id}
              onRowClick={(transaction) => setSelectedTransaction(transaction)}
            />

            {pagination ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                <span>
                  Mostrando
                  {' '}
                  <strong>
                    {pagination.total === 0
                      ? 0
                      : Math.min(pagination.total, pagination.offset + 1)}
                  </strong>
                  {' '}
                  a
                  {' '}
                  <strong>
                    {Math.min(pagination.total, pagination.offset + pagination.limit)}
                  </strong>
                  {' '}
                  de
                  {' '}
                  <strong>{pagination.total}</strong>
                  {' '}
                  transacciones
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => changePage('previous')}
                    disabled={!hasPreviousPage}
                    className={`rounded-full border border-slate-200 px-3 py-1 font-semibold transition ${
                      hasPreviousPage
                        ? 'text-slate-600 hover:border-indigo-500 hover:text-indigo-600'
                        : 'cursor-not-allowed text-slate-400'
                    }`}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage('next')}
                    disabled={!hasNextPage}
                    className={`rounded-full border border-slate-200 px-3 py-1 font-semibold transition ${
                      hasNextPage
                        ? 'text-slate-600 hover:border-indigo-500 hover:text-indigo-600'
                        : 'cursor-not-allowed text-slate-400'
                    }`}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <TransactionFormModal
        open={isFormOpen}
        mode={formMode}
        data={formData}
        onChange={setFormData}
        onClose={handleCloseForm}
        onSubmit={handleSubmitTransaction}
        funds={funds}
        churches={churches.map((church) => ({ id: church.id, name: church.name }))}
      />

      <TransactionDetailsSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        {...(!isReadOnly
          ? {
              onEdit: (transaction: TransactionRecord | null) => {
                if (!transaction) {
                  return;
                }
                setSelectedTransaction(null);
                handleOpenEdit(transaction);
              },
              onDelete: (transaction: TransactionRecord) => handleDeleteTransaction(transaction),
            }
          : {})}
      />
    </div>
  );
}
type StatTone = 'positive' | 'negative' | 'neutral';

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  tone?: StatTone;
};

function StatCard({ title, value, subtitle, tone = 'neutral' }: StatCardProps) {
  const toneClasses = {
    positive: 'bg-emerald-50 text-emerald-600',
    negative: 'bg-rose-50 text-rose-600',
    neutral: 'bg-slate-50 text-slate-600',
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? (
        <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
type TransactionFormModalProps = {
  open: boolean;
  mode: FormMode;
  data: TransactionFormData;
  onChange: (data: TransactionFormData) => void;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => Promise<void> | void;
  funds: FundRecord[];
  churches: Array<{ id: number; name: string }>;
};

function TransactionFormModal({
  open,
  mode,
  data,
  onChange,
  onClose,
  onSubmit,
  funds,
  churches,
}: TransactionFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const handleFieldChange = <Key extends keyof TransactionFormData>(field: Key) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({
        ...data,
        [field]: event.target.value,
      });
    };

  const handleAmountChange = (rawValue: string) => {
    onChange({
      ...data,
      amount: rawValue,
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title className="text-lg font-semibold text-slate-900">
                  {mode === 'create' ? 'Registrar nueva transacción' : 'Editar transacción'}
                </Dialog.Title>
                <p className="mt-1 text-sm text-slate-500">
                  Completa la información para registrar movimientos de ingresos o egresos.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      Fecha
                      <input
                        type="date"
                        value={data.date}
                        onChange={handleFieldChange('date')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      Fondo
                      <select
                        value={data.fundId}
                        onChange={handleFieldChange('fundId')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        required
                      >
                        <option value="all" disabled>
                          Selecciona un fondo
                        </option>
                        {funds.map((fund) => (
                          <option key={fund.id} value={fund.id}>
                            {fund.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      Iglesia (opcional)
                      <select
                        value={data.churchId}
                        onChange={handleFieldChange('churchId')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="all">Seleccionar iglesia</option>
                        {churches.map((church) => (
                          <option key={church.id} value={church.id}>
                            {church.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      Monto
                      <CurrencyInput
                        value={data.amount}
                        onValueChange={handleAmountChange}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="0"
                        required
                      />
                    </label>
                  </div>

                  <fieldset className="flex gap-4">
                    <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tipo de movimiento
                    </legend>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <input
                        type="radio"
                        name="type"
                        value="income"
                        checked={data.type === 'income'}
                        onChange={handleFieldChange('type')}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Ingreso
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <input
                        type="radio"
                        name="type"
                        value="expense"
                        checked={data.type === 'expense'}
                        onChange={handleFieldChange('type')}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Egreso
                    </label>
                  </fieldset>

                  <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                    Concepto
                    <input
                      type="text"
                      value={data.concept}
                      onChange={handleFieldChange('concept')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Detalle del movimiento"
                      required
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      Proveedor / Referencia
                      <input
                        type="text"
                        value={data.provider}
                        onChange={handleFieldChange('provider')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="Proveedor, entidad o referencia"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                      Documento
                      <input
                        type="text"
                        value={data.documentNumber}
                        onChange={handleFieldChange('documentNumber')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="Factura o comprobante"
                      />
                    </label>
                  </div>

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
                      {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Registrar' : 'Guardar cambios'}
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
type TransactionDetailsSheetProps = {
  transaction: TransactionRecord | null;
  onClose: () => void;
  onEdit?: (transaction: TransactionRecord | null) => void;
  onDelete?: (transaction: TransactionRecord) => void;
};

function TransactionDetailsSheet({
  transaction,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailsSheetProps) {
  const open = Boolean(transaction);

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
                        Detalle de transacción
                      </Dialog.Title>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
                      >
                        Cerrar
                      </button>
                    </div>

                    {transaction ? (
                      <div className="space-y-6 px-6 py-6 text-sm text-slate-700">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Concepto
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-900">
                            {transaction.concept}
                          </p>
                        </div>

                        <dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-600">
                          <div className="flex justify-between">
                            <dt>Fecha</dt>
                            <dd className="font-semibold text-slate-800">
                              {formatDate(transaction.date)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Fondo</dt>
                            <dd className="font-semibold text-slate-800">
                              {transaction.fund.name ?? 'N/D'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Iglesia</dt>
                            <dd className="font-semibold text-slate-800">
                              {transaction.church.name ?? 'No especificada'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Ingreso</dt>
                            <dd className="font-semibold text-emerald-600">
                              {transaction.amounts.in > 0
                                ? formatCurrency(transaction.amounts.in)
                                : '—'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Egreso</dt>
                            <dd className="font-semibold text-rose-600">
                              {transaction.amounts.out > 0
                                ? formatCurrency(transaction.amounts.out)
                                : '—'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Balance</dt>
                            <dd
                              className={`font-semibold ${
                                transaction.amounts.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {formatCurrency(transaction.amounts.balance)}
                            </dd>
                          </div>
                        </dl>

                        <dl className="grid gap-3 text-xs text-slate-500">
                          {transaction.provider ? (
                            <div>
                              <dt className="font-semibold uppercase tracking-wide">Proveedor</dt>
                              <dd className="text-slate-700">{transaction.provider}</dd>
                            </div>
                          ) : null}
                          {transaction.documentNumber ? (
                            <div>
                              <dt className="font-semibold uppercase tracking-wide">Documento</dt>
                              <dd className="text-slate-700">{transaction.documentNumber}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="font-semibold uppercase tracking-wide">Registrado por</dt>
                            <dd className="text-slate-700">{transaction.audit.createdBy}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold uppercase tracking-wide">Fecha de registro</dt>
                            <dd className="text-slate-700">
                              {formatDate(transaction.audit.createdAt)}
                            </dd>
                          </div>
                          {transaction.audit.updatedAt ? (
                            <div>
                              <dt className="font-semibold uppercase tracking-wide">Última actualización</dt>
                              <dd className="text-slate-700">
                                {formatDate(transaction.audit.updatedAt)}
                              </dd>
                            </div>
                          ) : null}
                        </dl>

                        {(onEdit || onDelete) && (
                          <div className="flex justify-between gap-3 pt-4">
                            {onEdit && (
                              <button
                                type="button"
                                onClick={() => onEdit(transaction)}
                                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-500 hover:text-indigo-600"
                              >
                                Editar
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() => onDelete(transaction)}
                                className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        )}
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
