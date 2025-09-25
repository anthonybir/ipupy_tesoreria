'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { EmptyState } from '@/components/Shared/EmptyState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { LoadingState } from '@/components/Shared/LoadingState';
import { useAdminFunds, useAdminReconciliation } from '@/hooks/useAdminData';

const currencyFormatter = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
});

type ReconciliationRow = {
  id: number;
  name: string;
  stored_balance: number;
  calculated_balance: number;
  difference: number;
  transaction_count?: number;
  last_transaction?: string | null;
  status?: string;
};

const statusTag = (status: string) => {
  if (status === 'balanced') {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
        Conciliado
      </span>
    );
  }
  return (
    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
      Revisar
    </span>
  );
};

export function ReconciliationView() {
  const [selectedFund, setSelectedFund] = useState<string>('all');

  const fundsQuery = useAdminFunds();
  const reconciliationQuery = useAdminReconciliation(
    selectedFund === 'all' ? undefined : Number(selectedFund)
  );

  const funds = fundsQuery.data ?? [];
  const rawReconciliation = reconciliationQuery.data?.data as Array<Record<string, unknown>> | undefined;
  const reconciliation = useMemo<ReconciliationRow[]>(() => {
    if (!rawReconciliation) {
      return [];
    }
    return rawReconciliation.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      stored_balance: Number(row.stored_balance ?? 0),
      calculated_balance: Number(row.calculated_balance ?? 0),
      difference: Number(row.difference ?? 0),
      transaction_count: row.transaction_count !== undefined ? Number(row.transaction_count) : undefined,
      last_transaction: row.last_transaction ? String(row.last_transaction) : null,
      status: row.status ? String(row.status) : undefined,
    }));
  }, [rawReconciliation]);
  const summary = reconciliationQuery.data?.summary ?? {};

  const discrepancyTotal = useMemo(() => {
    return reconciliation.reduce((sum, row) => sum + row.difference, 0);
  }, [reconciliation]);

  if (reconciliationQuery.isLoading || fundsQuery.isLoading) {
    return <LoadingState title="Generando conciliación..." fullHeight />;
  }

  if (reconciliationQuery.isError) {
    return <ErrorState title="No se pudo generar la conciliación" />;
  }

  if (!reconciliation.length) {
    return (
      <EmptyState
        title="No hay información de conciliación"
        description="Aún no se registran movimientos suficientes para comparar saldos almacenados y calculados."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
            Conciliación del tesoro nacional
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Resumen de saldos por fondo</h1>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Diferencia total</p>
          <p className={`text-lg font-semibold ${discrepancyTotal === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {currencyFormatter.format(discrepancyTotal)}
          </p>
          <p className="text-[11px] text-slate-500">
            Fondos conciliados: {summary.balanced ?? 0} / {summary.totalFunds ?? reconciliation.length}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-indigo-500">Fondo</span>
          <select
            value={selectedFund}
            onChange={(event) => setSelectedFund(event.target.value)}
            className="rounded-lg border border-indigo-200 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
          >
            <option value="all">Todos</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fondo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Saldo almacenado
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Saldo calculado
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Diferencia
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Movimientos
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reconciliation.map((row) => (
              <tr key={row.id} className="hover:bg-indigo-50/30">
                <td className="px-4 py-3 text-sm font-semibold text-slate-800">{row.name}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-600">
                  {currencyFormatter.format(Number(row.stored_balance ?? 0))}
                </td>
                <td className="px-4 py-3 text-right text-sm text-slate-600">
                  {currencyFormatter.format(Number(row.calculated_balance ?? 0))}
                </td>
                <td
                  className={`px-4 py-3 text-right text-sm font-semibold ${
                    Number(row.difference ?? 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {currencyFormatter.format(Number(row.difference ?? 0))}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {row.transaction_count ?? 0} movimientos — último{' '}
                  {row.last_transaction
                    ? format(new Date(row.last_transaction), 'dd MMM yyyy', { locale: es })
                    : 'sin registros'}
                </td>
                <td className="px-4 py-3">{statusTag(String(row.status ?? 'desconocido'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
