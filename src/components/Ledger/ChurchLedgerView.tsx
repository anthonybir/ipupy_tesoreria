'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useChurches } from '@/hooks/useChurches';
import { LoadingState } from '@/components/Shared/LoadingState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { EmptyState } from '@/components/Shared/EmptyState';
import { DataTable } from '@/components/Shared/DataTable';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

const monthLabels = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const currentYear = new Date().getFullYear();
const selectableYears = Array.from({ length: 6 }).map((_, index) => currentYear - index);

type TransactionRecord = {
  id: number;
  date: string;
  concept: string;
  amount_in: number;
  amount_out: number;
  balance: number;
  fund_name: string;
  created_by: string;
  report_id: number | null;
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

export default function ChurchLedgerView() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const { data: churches = [], isLoading: churchesLoading } = useChurches();
  const supabase = createClient();

  // Fetch transactions from church_transactions table
  const transactionsQuery = useQuery({
    queryKey: ['church-transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          funds!inner(name),
          churches!inner(name)
        `)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .limit(100);

      // Apply filters
      if (filters.churchId !== 'all') {
        query = query.eq('church_id', filters.churchId);
      }

      if (filters.year !== 'all') {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query.gte('date', startDate).lte('date', endDate);
      }

      if (filters.month !== 'all' && filters.year !== 'all') {
        const monthPadded = filters.month.padStart(2, '0');
        const startDate = `${filters.year}-${monthPadded}-01`;
        const lastDay = new Date(Number(filters.year), Number(filters.month), 0).getDate();
        const endDate = `${filters.year}-${monthPadded}-${lastDay}`;
        query = query.gte('date', startDate).lte('date', endDate);
      }

      if (filters.fundId !== 'all') {
        query = query.eq('fund_id', filters.fundId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate running balance
      let runningBalance = 0;
      const dataWithBalance = (data || []).reverse().map((txn) => {
        runningBalance += (txn.amount_in || 0) - (txn.amount_out || 0);
        return {
          ...txn,
          balance: runningBalance,
          fund_name: txn.funds?.name || 'N/A',
          church_name: txn.churches?.name || 'N/A'
        };
      }).reverse();

      return dataWithBalance;
    },
    staleTime: 30 * 1000 // 30 seconds
  });

  // Fetch funds for filter
  const fundsQuery = useQuery({
    queryKey: ['funds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funds')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const transactions = useMemo(() => transactionsQuery.data || [], [transactionsQuery.data]);
  const funds = useMemo(() => fundsQuery.data || [], [fundsQuery.data]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalIn = transactions.reduce((sum: number, t: TransactionRecord) => sum + (t.amount_in || 0), 0);
    const totalOut = transactions.reduce((sum: number, t: TransactionRecord) => sum + (t.amount_out || 0), 0);
    const balance = totalIn - totalOut;
    return { totalIn, totalOut, balance };
  }, [transactions]);

  const columns = useMemo(
    () => [
      {
        id: 'date',
        header: 'Fecha',
        render: (row: TransactionRecord) => (
          <span className="text-sm font-medium text-slate-700">
            {format(new Date(row.date), 'dd MMM yyyy', { locale: es })}
          </span>
        )
      },
      {
        id: 'concept',
        header: 'Concepto',
        render: (row: TransactionRecord) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-700">{row.concept}</span>
            <span className="text-xs text-slate-500">Fondo: {row.fund_name}</span>
          </div>
        )
      },
      {
        id: 'debit',
        header: 'Débito',
        align: 'right' as const,
        render: (row: TransactionRecord) => (
          row.amount_out > 0 ? (
            <span className="text-sm font-medium text-rose-600">
              {formatCurrency(row.amount_out)}
            </span>
          ) : <span className="text-sm text-slate-400">—</span>
        )
      },
      {
        id: 'credit',
        header: 'Crédito',
        align: 'right' as const,
        render: (row: TransactionRecord) => (
          row.amount_in > 0 ? (
            <span className="text-sm font-medium text-emerald-600">
              {formatCurrency(row.amount_in)}
            </span>
          ) : <span className="text-sm text-slate-400">—</span>
        )
      },
      {
        id: 'balance',
        header: 'Saldo',
        align: 'right' as const,
        render: (row: TransactionRecord) => (
          <span className={`text-sm font-bold ${row.balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {formatCurrency(row.balance)}
          </span>
        )
      },
      {
        id: 'source',
        header: 'Origen',
        render: (row: TransactionRecord) => (
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
            row.created_by === 'system'
              ? 'bg-indigo-50 text-indigo-600'
              : 'bg-slate-50 text-slate-600'
          }`}>
            {row.created_by === 'system' ? 'Automático' : 'Manual'}
          </span>
        )
      }
    ],
    []
  );

  const applyFilters = (partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

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
              onChange={(e) => applyFilters({ year: e.target.value })}
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
        {transactionsQuery.isLoading ? (
          <LoadingState description="Cargando transacciones..." fullHeight />
        ) : transactionsQuery.isError ? (
          <ErrorState
            description={transactionsQuery.error?.message || 'Error al cargar transacciones'}
            onRetry={() => transactionsQuery.refetch()}
          />
        ) : transactions.length === 0 ? (
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