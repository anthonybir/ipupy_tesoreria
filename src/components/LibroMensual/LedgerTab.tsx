'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  SectionCard,
  Toolbar,
  FormField,
} from '@/components/Shared';
import type { DataTableColumn } from '@/components/Shared/DataTable';
import { useAdminTransactions } from '@/hooks/useAdminData';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

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
  'Diciembre',
];

const buildDateRange = (filters: { year: string; month: string }) => {
  if (filters.month === 'all') {
    return {
      start: `${filters.year}-01-01`,
      end: `${filters.year}-12-31`,
    };
  }

  const month = Number(filters.month);
  const start = `${filters.year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Number(filters.year), month, 0).getDate();
  const end = `${filters.year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};
export function LedgerTab({ filters, funds }: LedgerTabProps): JSX.Element {
  const [selectedFund, setSelectedFund] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const dateRange = useMemo(() => buildDateRange(filters), [filters]);

  const queryFilters = useMemo(() => {
    const params: Record<string, string | number> = {
      start_date: dateRange.start,
      end_date: dateRange.end,
      limit: 500,
    };

    if (selectedFund !== 'all') {
      params['fund_id'] = selectedFund;
    }

    if (typeFilter !== 'all') {
      params['type'] = typeFilter;
    }

    return params;
  }, [dateRange.end, dateRange.start, selectedFund, typeFilter]);

  const ledgerQuery = useAdminTransactions(queryFilters);
  const rawTransactions = ledgerQuery.data?.data as Array<Record<string, unknown>> | undefined;
  const transactions: LedgerTransaction[] = useMemo(() => {
    if (!rawTransactions) {
      return [];
    }

    return rawTransactions.map<LedgerTransaction>((row) => {
      const idValue = Number(row['id']);
      const dateValue = (() => {
        const candidate = row['date'];
        if (candidate instanceof Date) {
          return candidate.toISOString();
        }
        return readString(candidate);
      })();

      return {
        id: Number.isFinite(idValue) ? idValue : 0,
        date: dateValue,
        concept: readString(row['concept']) ?? '',
        fund_name: readString(row['fund_name']),
        church_name: readString(row['church_name']),
        amount_in: readNumber(row['amount_in']),
        amount_out: readNumber(row['amount_out']),
        created_by: readString(row['created_by']),
      };
    });
  }, [rawTransactions]);

  const aggregates = useMemo(() => {
    return transactions.reduce(
      (acc: { income: number; expense: number }, txn) => {
        acc.income += txn.amount_in;
        acc.expense += txn.amount_out;
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions]);

  const selectClassName =
    'rounded-xl border border-[var(--absd-border)] bg-[var(--absd-surface)] px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';
  const columns = useMemo<DataTableColumn<LedgerTransaction>[]>(
    () => [
      {
        id: 'date',
        header: 'Fecha',
        render: (txn) => (
          <span className="text-sm text-[rgba(15,23,42,0.7)]">
            {txn.date ? format(new Date(txn.date), 'dd MMM yyyy', { locale: es }) : '—'}
          </span>
        ),
      },
      {
        id: 'concept',
        header: 'Concepto',
        render: (txn) => (
          <span className="text-sm font-semibold text-[var(--absd-ink)]">{txn.concept}</span>
        ),
      },
      {
        id: 'fund',
        header: 'Fondo',
        render: (txn) => (
          <span className="text-sm text-[rgba(15,23,42,0.7)]">{txn.fund_name ?? 'N/D'}</span>
        ),
      },
      {
        id: 'church',
        header: 'Iglesia',
        render: (txn) => (
          <span className="text-sm text-[rgba(15,23,42,0.7)]">{txn.church_name ?? '—'}</span>
        ),
      },
      {
        id: 'income',
        header: 'Entrada',
        align: 'right',
        render: (txn) => (
          <span className="text-sm font-semibold text-[var(--absd-success)]">
            {txn.amount_in > 0 ? formatCurrencyDisplay(txn.amount_in) : '—'}
          </span>
        ),
      },
      {
        id: 'expense',
        header: 'Salida',
        align: 'right',
        render: (txn) => (
          <span className="text-sm font-semibold text-[var(--absd-error)]">
            {txn.amount_out > 0 ? formatCurrencyDisplay(txn.amount_out) : '—'}
          </span>
        ),
      },
      {
        id: 'createdBy',
        header: 'Registrado por',
        render: (txn) => (
          <span className="text-xs text-[rgba(15,23,42,0.55)]">{txn.created_by ?? '—'}</span>
        ),
      },
    ],
    [],
  );

  const summaryMetrics = useMemo(
    () => [
      {
        label: 'Entradas registradas',
        value: formatCurrencyDisplay(aggregates.income),
        description: 'Total de movimientos ingresados',
        tone: 'success' as const,
      },
      {
        label: 'Salidas registradas',
        value: formatCurrencyDisplay(aggregates.expense),
        description: 'Total de egresos ejecutados',
        tone: 'danger' as const,
      },
      {
        label: 'Saldo neto',
        value: formatCurrencyDisplay(aggregates.income - aggregates.expense),
        description: 'Resultado del periodo',
        tone: aggregates.income - aggregates.expense >= 0 ? ('success' as const) : ('warning' as const),
      },
    ],
    [aggregates.expense, aggregates.income],
  );

  if (ledgerQuery.isLoading) {
    return <LoadingState title="Cargando libro diario..." fullHeight />;
  }

  if (ledgerQuery.isError) {
    return <ErrorState title="No se pudo cargar el libro diario" />;
  }
  if (!transactions.length) {
    return (
      <SectionCard
        title="Libro diario"
        description="Ajusta los filtros para visualizar movimientos de otro fondo o periodo."
      >
        <EmptyState
          title="No hay movimientos registrados"
          description="No se encontraron transacciones con los filtros seleccionados."
          tone="info"
          fullHeight
        />
      </SectionCard>
    );
  }

  const periodLabel =
    filters.month === 'all'
      ? filters.year
      : `${monthNames[Number(filters.month)] ?? filters.month} ${filters.year}`;

  return (
    <div className="space-y-6">
      <Toolbar variant="filters">
        <FormField htmlFor="ledger-fund" label="Fondo">
          <select
            id="ledger-fund"
            value={selectedFund}
            onChange={(event) => setSelectedFund(event.target.value)}
            className={selectClassName}
          >
            <option value="all">Todos</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="ledger-type" label="Origen">
          <select
            id="ledger-type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className={selectClassName}
          >
            <option value="all">Todos</option>
            <option value="automatic">Automáticos</option>
            <option value="manual">Manual tesorería</option>
            <option value="reconciliation">Reconciliación</option>
          </select>
        </FormField>
      </Toolbar>

      <SectionCard
        title="Resumen del periodo"
        description={`Movimientos registrados para ${periodLabel}`}
      >
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {summaryMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              description={metric.description}
              tone={metric.tone}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Movimientos"
        description={`${transactions.length} registro${transactions.length === 1 ? '' : 's'} encontrados`}
        padding="lg"
      >
        <DataTable
          data={transactions}
          columns={columns}
          virtualized
          maxHeight={520}
        />
      </SectionCard>
    </div>
  );
}
