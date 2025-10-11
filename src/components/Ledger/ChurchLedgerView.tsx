'use client';

import { useMemo, useState, type JSX } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useChurches } from '@/hooks/useChurches';
import { useAdminFunds, useAdminTransactions, type AdminTransactionsFilters } from '@/hooks/useAdminData';
import { LoadingState } from '@/components/Shared/LoadingState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { EmptyState } from '@/components/Shared/EmptyState';
import { DataTable, type DataTableColumn } from '@/components/Shared/DataTable';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

const monthLabels = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const currentYear = new Date().getFullYear();
const selectableYears = Array.from({ length: 6 }).map((_, index) => currentYear - index);

type TransactionRow = {
  id: number;
  date: string;
  concept: string;
  amount_in: number;
  amount_out: number;
  balance: number;
  fund_name: string;
  church_name: string;
  created_by: string;
};

type FilterState = {
  churchId: string;
  month: string;
  year: string;
  fundId: string;
};

const defaultFilters: FilterState = {
  churchId: 'all',
  month: 'all',
  year: String(currentYear),
  fundId: 'all'
};

const formatCurrency = (value: number): string => formatCurrencyDisplay(value);

export default function ChurchLedgerView(): JSX.Element {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const { data: churches = [], isLoading: churchesLoading } = useChurches();
  const fundsQuery = useAdminFunds();

  const ledgerFilters = useMemo<AdminTransactionsFilters>(() => {
    const params: AdminTransactionsFilters = { limit: 100 };

    if (filters.churchId !== 'all') {
      params.church_id = filters.churchId;
    }

    if (filters.fundId !== 'all') {
      params.fund_id = filters.fundId;
    }

    // Note: AdminTransactionsFilters doesn't support month/year filtering
    // These would need to be added to the API or filtered client-side

    return params;
  }, [filters.churchId, filters.fundId]);

  const transactionsQuery = useAdminTransactions(ledgerFilters);

  const transactionsCollection = useMemo(() => {
    if (!transactionsQuery.data) {
      return null;
    }

    // AdminTransactionsResponse doesn't include totals, so we return raw data
    // and calculate totals separately
    return transactionsQuery.data;
  }, [transactionsQuery.data]);

  const transactions = useMemo<TransactionRow[]>(() => {
    if (!transactionsCollection) {
      return [];
    }

    // AdminTransactionsResponse returns raw data as Record<string, unknown>[]
    return transactionsCollection.data.map((record) => ({
      id: typeof record['id'] === 'number' ? record['id'] : 0,
      date: typeof record['date'] === 'string' ? record['date'] : new Date().toISOString(),
      concept: typeof record['concept'] === 'string' ? record['concept'] : '',
      amount_in: typeof record['amount_in'] === 'number' ? record['amount_in'] : 0,
      amount_out: typeof record['amount_out'] === 'number' ? record['amount_out'] : 0,
      balance: typeof record['balance'] === 'number' ? record['balance'] : 0,
      fund_name: typeof record['fund_name'] === 'string' ? record['fund_name'] : 'N/D',
      church_name: typeof record['church_name'] === 'string' ? record['church_name'] : 'N/D',
      created_by: typeof record['created_by'] === 'string' ? record['created_by'] : 'unknown',
    } satisfies TransactionRow));
  }, [transactionsCollection]);

  const funds = useMemo(
    () =>
      fundsQuery.data
        .filter((fund) => fund.id > 0)
        .map((fund) => ({ id: String(fund.id), name: fund.name })),
    [fundsQuery.data]
  );

  const totals = useMemo(() => {
    // Calculate totals from transaction data since AdminTransactionsResponse doesn't include them
    const calculated = transactions.reduce(
      (acc, tx) => ({
        totalIn: acc.totalIn + tx.amount_in,
        totalOut: acc.totalOut + tx.amount_out,
        balance: tx.balance, // Use the last transaction's balance
      }),
      { totalIn: 0, totalOut: 0, balance: 0 }
    );

    return calculated;
  }, [transactions]);

  const columns = useMemo<DataTableColumn<TransactionRow>[]>(
    () => [
      {
        id: 'date',
        header: 'Fecha',
        render: (row) => (
          <span className="text-sm font-medium text-slate-700">
            {format(new Date(row.date), 'dd MMM yyyy', { locale: es })}
          </span>
        ),
      },
      {
        id: 'concept',
        header: 'Concepto',
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-700">{row.concept}</span>
            <span className="text-xs text-slate-500">Fondo: {row.fund_name}</span>
            <span className="text-xs text-slate-400">Iglesia: {row.church_name}</span>
          </div>
        ),
      },
      {
        id: 'debit',
        header: 'Débito',
        align: 'right',
        render: (row) => (
          row.amount_out > 0 ? (
            <span className="text-sm font-medium text-rose-600">
              {formatCurrency(row.amount_out)}
            </span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )
        ),
      },
      {
        id: 'credit',
        header: 'Crédito',
        align: 'right',
        render: (row) => (
          row.amount_in > 0 ? (
            <span className="text-sm font-medium text-emerald-600">
              {formatCurrency(row.amount_in)}
            </span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )
        ),
      },
      {
        id: 'balance',
        header: 'Saldo',
        align: 'right',
        render: (row) => (
          <span className={`text-sm font-bold ${row.balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {formatCurrency(row.balance)}
          </span>
        ),
      },
      {
        id: 'source',
        header: 'Origen',
        render: (row) => (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              row.created_by === 'system'
                ? 'bg-indigo-50 text-indigo-600'
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            {row.created_by === 'system' ? 'Automático' : 'Manual'}
          </span>
        ),
      },
    ],
    []
  );

  const applyFilters = (partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  if (transactionsQuery.isLoading || fundsQuery.isLoading || churchesLoading) {
    return <LoadingState description="Cargando libro mayor..." fullHeight />;
  }

  if (transactionsQuery.isError || fundsQuery.isError) {
    const message = transactionsQuery.error?.message ?? fundsQuery.error?.message ?? 'No se pudo cargar el libro mayor.';
    return (
      <ErrorState
        title="Error al cargar"
        description={message}
        onRetry={async () => {
          await Promise.all([transactionsQuery.refetch(), fundsQuery.refetch()]);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Sistema de Tesorería Nacional
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Libro Mayor de Transacciones</h1>
        <p className="text-sm text-slate-600">
          Registro completo de movimientos financieros del sistema nacional de tesorería.
        </p>
      </header>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>
          <button
            type="button"
            onClick={() => setFilters(defaultFilters)}
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            Restablecer
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Iglesia
            <select
              value={filters.churchId}
              onChange={(e) => applyFilters({ churchId: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={churchesLoading}
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
            Fondo
            <select
              value={filters.fundId}
              onChange={(e) => applyFilters({ fundId: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={fundsQuery.isLoading}
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
            Mes
            <select
              value={filters.month}
              onChange={(e) => applyFilters({ month: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos los meses</option>
              {monthLabels.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Año
            <select
              value={filters.year}
              onChange={(e) => applyFilters({ year: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos los años</option>
              {selectableYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Entradas</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(totals.totalIn)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Salidas</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">{formatCurrency(totals.totalOut)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo Actual</p>
          <p className={`mt-2 text-2xl font-semibold ${totals.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {formatCurrency(totals.balance)}
          </p>
        </div>
      </section>

      {/* Transactions Table */}
      <section>
        {transactions.length === 0 ? (
          <EmptyState
            title="No hay transacciones"
            description="No se encontraron transacciones con los filtros seleccionados."
            icon={<span>📘</span>}
            fullHeight
          />
        ) : (
          <DataTable
            data={transactions}
            columns={columns}
            getRowId={(row) => row.id}
          />
        )}
      </section>
    </div>
  );
}
