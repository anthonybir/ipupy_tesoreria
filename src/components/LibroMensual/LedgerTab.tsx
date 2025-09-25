'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { EmptyState } from '@/components/Shared/EmptyState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { LoadingState } from '@/components/Shared/LoadingState';
import { useAdminTransactions } from '@/hooks/useAdminData';

const currencyFormatter = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
});

type LedgerTabProps = {
  filters: { year: string; month: string };
  funds: Array<{ id: number; name: string }>;
};

type LedgerTransaction = {
  id: number;
  date: string | null;
  concept: string;
  fund_name?: string | null;
  church_name?: string | null;
  amount_in: number;
  amount_out: number;
  created_by?: string | null;
};

const monthNames = [
  '',
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
  'Diciembre'
];

const buildDateRange = (filters: { year: string; month: string }) => {
  if (filters.month === 'all') {
    const start = `${filters.year}-01-01`;
    const end = `${filters.year}-12-31`;
    return { start, end };
  }

  const month = Number(filters.month);
  const start = `${filters.year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Number(filters.year), month, 0).getDate();
  const end = `${filters.year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

export function LedgerTab({ filters, funds }: LedgerTabProps) {
  const [selectedFund, setSelectedFund] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const dateRange = useMemo(() => buildDateRange(filters), [filters]);

  const queryFilters = useMemo(() => {
    const params: Record<string, string | number> = {
      start_date: dateRange.start,
      end_date: dateRange.end,
      limit: 500
    };

    if (selectedFund !== 'all') {
      params.fund_id = selectedFund;
    }

    if (typeFilter !== 'all') {
      params.type = typeFilter;
    }

    return params;
  }, [dateRange.end, dateRange.start, selectedFund, typeFilter]);

  const ledgerQuery = useAdminTransactions(queryFilters);

  const rawTransactions = ledgerQuery.data?.data as Array<Record<string, unknown>> | undefined;
  const transactions = useMemo<LedgerTransaction[]>(() => {
    if (!rawTransactions) {
      return [];
    }
    return rawTransactions.map((row) => ({
      id: Number(row.id),
      date: row.date ? String(row.date) : null,
      concept: String(row.concept ?? ''),
      fund_name: row.fund_name ? String(row.fund_name) : undefined,
      church_name: row.church_name ? String(row.church_name) : undefined,
      amount_in: Number(row.amount_in ?? 0),
      amount_out: Number(row.amount_out ?? 0),
      created_by: row.created_by ? String(row.created_by) : undefined,
    }));
  }, [rawTransactions]);

  const aggregates = useMemo(() => {
    return transactions.reduce(
      (acc: { income: number; expense: number }, txn) => {
        acc.income += txn.amount_in;
        acc.expense += txn.amount_out;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  if (ledgerQuery.isLoading) {
    return <LoadingState title="Cargando libro diario..." fullHeight />;
  }

  if (ledgerQuery.isError) {
    return <ErrorState title="No se pudo cargar el libro diario" />;
  }

  if (!transactions.length) {
    return (
      <EmptyState
        title="No hay movimientos registrados"
        description="Ajusta los filtros para visualizar movimientos de otro fondo o periodo."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-500">Fondo</span>
            <select
              value={selectedFund}
              onChange={(event) => setSelectedFund(event.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="all">Todos</option>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-500">Origen</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="automatic">Automáticos</option>
              <option value="manual">Manual tesorería</option>
              <option value="reconciliation">Reconciliación</option>
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Resumen {filters.month === 'all' ? filters.year : `${monthNames[Number(filters.month)]} ${filters.year}`}
          </p>
          <p className="text-sm font-semibold text-emerald-600">
            Entradas: {currencyFormatter.format(aggregates.income)}
          </p>
          <p className="text-sm font-semibold text-rose-600">
            Salidas: {currencyFormatter.format(aggregates.expense)}
          </p>
          <p className="text-sm font-semibold text-slate-900">
            Neto: {currencyFormatter.format(aggregates.income - aggregates.expense)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Concepto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fondo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Iglesia</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Entrada</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Salida</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Registrado por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-indigo-50/30">
                <td className="px-4 py-3 text-sm text-slate-600">
                  {txn.date ? format(new Date(txn.date), 'dd MMM yyyy', { locale: es }) : '—'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                  {txn.concept}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{txn.fund_name ?? 'N/D'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{txn.church_name ?? '—'}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                  {txn.amount_in > 0 ? currencyFormatter.format(Number(txn.amount_in)) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-rose-600">
                  {txn.amount_out > 0 ? currencyFormatter.format(Number(txn.amount_out)) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{txn.created_by ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
