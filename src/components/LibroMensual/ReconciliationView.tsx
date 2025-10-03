'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionCard,
  StatusPill,
  Toolbar,
} from '@/components/Shared';
import { useAdminFunds, useAdminReconciliation } from '@/hooks/useAdminData';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

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
    return <StatusPill tone="success">Conciliado</StatusPill>;
  }
  return <StatusPill tone="warning">Revisar</StatusPill>;
};

const readString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const readNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function ReconciliationView() {
  const [selectedFund, setSelectedFund] = useState<string>('all');

  const fundsQuery = useAdminFunds();
  const reconciliationQuery = useAdminReconciliation(
    selectedFund === 'all' ? undefined : Number(selectedFund)
  );

  const funds = fundsQuery.data ?? [];
  const rawReconciliation = (reconciliationQuery.data as { data?: Array<Record<string, unknown>> })?.data;
  const reconciliation: ReconciliationRow[] = useMemo(() => {
    if (!rawReconciliation) {
      return [];
    }
    return rawReconciliation.map<ReconciliationRow>((row) => {
      const idValue = Number(row['id']);
      const base: ReconciliationRow = {
        id: Number.isFinite(idValue) ? idValue : 0,
        name: readString(row['name']) ?? 'Fondo sin nombre',
        stored_balance: readNumber(row['stored_balance']),
        calculated_balance: readNumber(row['calculated_balance']),
        difference: readNumber(row['difference']),
        last_transaction: (() => {
          const rawDate = row['last_transaction'];
          if (rawDate instanceof Date) {
            return rawDate.toISOString();
          }
          return readString(rawDate);
        })(),
      };

      const transactionCountValue = row['transaction_count'];
      if (transactionCountValue !== undefined && transactionCountValue !== null) {
        base.transaction_count = readNumber(transactionCountValue);
      }

      const statusValue = readString(row['status']);
      if (statusValue) {
        base.status = statusValue;
      }

      return base;
    });
  }, [rawReconciliation]);
  const summary = (reconciliationQuery.data as { summary?: Record<string, unknown> })?.summary ?? {};

  const discrepancyTotal = useMemo(() => {
    return reconciliation.reduce((sum, row) => sum + row.difference, 0);
  }, [reconciliation]);

  const balancedCount = readNumber(summary['balanced']);
  const totalFundsCount = readNumber(summary['totalFunds']) || reconciliation.length;

  const metrics = [
    {
      label: 'Diferencia total',
      value: formatCurrencyDisplay(discrepancyTotal),
      description: 'Saldo almacenado vs. calculado',
      tone: discrepancyTotal === 0 ? ('success' as const) : ('danger' as const),
    },
    {
      label: 'Fondos conciliados',
      value: `${balancedCount}/${totalFundsCount}`,
      description: 'Fondos conciliados / totales',
      tone: 'info' as const,
    },
  ];

  const filterSelectClasses =
    'rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';

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
    <div className="space-y-8">
      <PageHeader
        title="Resumen de saldos por fondo"
        subtitle="Conciliación del tesoro nacional"
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Libro Mensual", href: "/ledger" },
          { label: "Conciliación" },
        ]}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            description={metric.description}
            tone={metric.tone}
          />
        ))}
      </div>

      <Toolbar variant="filters">
        <FormField htmlFor="reconciliation-fund" label="Fondo">
          <select
            id="reconciliation-fund"
            value={selectedFund}
            onChange={(event) => setSelectedFund(event.target.value)}
            className={filterSelectClasses}
          >
            <option value="all">Todos</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </FormField>
      </Toolbar>

      <SectionCard
        title="Detalle de conciliación"
        description={`Fondos conciliados: ${balancedCount} / ${totalFundsCount}`}
        padding="lg"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--absd-border)]">
            <thead className="bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">Fondo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Saldo almacenado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Saldo calculado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Diferencia
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Movimientos
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--absd-border)] bg-[var(--absd-surface)]">
              {reconciliation.map((row) => (
                <tr key={row.id} className="transition hover:bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--absd-ink)]">{row.name}</td>
                  <td className="px-4 py-3 text-right text-sm text-[rgba(15,23,42,0.7)]">
                    {formatCurrencyDisplay(row.stored_balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-[rgba(15,23,42,0.7)]">
                    {formatCurrencyDisplay(row.calculated_balance)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-semibold ${
                      row.difference === 0 ? 'text-[var(--absd-success)]' : 'text-[var(--absd-error)]'
                    }`}
                  >
                    {formatCurrencyDisplay(row.difference)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[rgba(15,23,42,0.55)]">
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
      </SectionCard>
    </div>
  );
}
