'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/components/Shared/EmptyState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { LoadingState } from '@/components/Shared/LoadingState';
import ExternalTransactionForm from '@/components/Treasury/ExternalTransactionForm';
import { useAdminTransactions } from '@/hooks/useAdminData';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

type ExternalTransactionsTabProps = {
  funds: Array<{ id: number; name: string }>;
};

type AdminTransaction = {
  id: number;
  date: string | null;
  concept: string;
  fund_name?: string | null;
  amount_in: number;
  amount_out: number;
  created_by?: string | null;
  provider?: string | null;
  provider_name?: string | null;
  provider_ruc?: string | null;
  provider_categoria?: string | null;
  document_number?: string | null;
};

export function ExternalTransactionsTab({ funds }: ExternalTransactionsTabProps) {
  const queryClient = useQueryClient();

  const transactionsQuery = useAdminTransactions({ type: 'manual', limit: 100 });

  const createTransaction = useMutation({
    mutationFn: async (payload: {
      fund_id: number;
      concept: string;
      amount_in: number;
      amount_out: number;
      date: string;
      provider?: string;
      document_number?: string;
    }) => {
      const response = await fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'No se pudo registrar la transacción');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-funds'] });
    }
  });

  const rawTransactions = transactionsQuery.data?.data as Array<Record<string, unknown>> | undefined;
  const transactions = useMemo<AdminTransaction[]>(() => {
    if (!rawTransactions) {
      return [];
    }
    return rawTransactions.map((row) => ({
      id: Number(row.id),
      date: row.date ? String(row.date) : null,
      concept: String(row.concept ?? ''),
      fund_name: row.fund_name ? String(row.fund_name) : undefined,
      amount_in: Number(row.amount_in ?? 0),
      amount_out: Number(row.amount_out ?? 0),
      created_by: row.created_by ? String(row.created_by) : undefined,
      provider: row.provider ? String(row.provider) : undefined,
      provider_name: row.provider_name ? String(row.provider_name) : undefined,
      provider_ruc: row.provider_ruc ? String(row.provider_ruc) : undefined,
      provider_categoria: row.provider_categoria ? String(row.provider_categoria) : undefined,
      document_number: row.document_number ? String(row.document_number) : undefined,
    }));
  }, [rawTransactions]);

  if (transactionsQuery.isLoading) {
    return <LoadingState title="Cargando transacciones externas..." fullHeight />;
  }

  if (transactionsQuery.isError) {
    return <ErrorState title="No se pudieron cargar las transacciones externas" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Registrar movimiento externo</h2>
          <p className="text-xs text-slate-500">Usa este formulario para registrar pagos a proveedores, eventos o transferencias entre fondos.</p>
        </header>
        <div className="px-5 py-4">
          <ExternalTransactionForm
            funds={funds}
            onSubmit={async (data) => {
              await createTransaction.mutateAsync(data);
            }}
            onCancel={() => undefined}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historial reciente</p>
            <h2 className="text-lg font-semibold text-slate-900">Transacciones externas registradas</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">{transactions.length} movimientos</span>
        </header>
        {transactions.length === 0 ? (
          <EmptyState
            title="Sin movimientos registrados"
            description="Aún no cargaste pagos o ingresos externos en el periodo reciente."
          />
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Concepto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fondo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Entrada</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Salida</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-indigo-50/30">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {txn.date ? format(new Date(txn.date), 'dd MMM yyyy', { locale: es }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">
                      <div className="flex flex-col">
                        <span>{txn.concept}</span>
                        {(txn.provider_name || txn.provider) ? (
                          <span className="text-xs text-slate-500">
                            Proveedor: {txn.provider_name || txn.provider}
                            {txn.provider_ruc && ` (RUC: ${txn.provider_ruc})`}
                          </span>
                        ) : null}
                        {txn.document_number ? (
                          <span className="text-xs text-slate-400">Comprobante: {txn.document_number}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{txn.fund_name ?? 'N/D'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                      {txn.amount_in > 0 ? formatCurrencyDisplay(Number(txn.amount_in)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-rose-600">
                      {txn.amount_out > 0 ? formatCurrencyDisplay(Number(txn.amount_out)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {txn.created_by ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
