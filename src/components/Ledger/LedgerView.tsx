'use client';

import { useMemo, useState } from 'react';

import { useLedger } from '@/hooks/useLedger';
import { useFunds } from '@/hooks/useFunds';
import { useChurches } from '@/hooks/useChurches';
import { DataTable } from '@/components/Shared/DataTable';
import { LoadingState } from '@/components/Shared/LoadingState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { EmptyState } from '@/components/Shared/EmptyState';
import type { FundMovementCollection, FundMovementFilters, FundMovementRecord } from '@/types/financial';

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

const defaultFilters: FilterState = {
  fundId: 'all',
  churchId: 'all',
  month: 'all',
  year: String(currentYear),
  limit: 50,
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
export default function LedgerView() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const queryFilters: FundMovementFilters = useMemo(() => {
    const nextFilters: FundMovementFilters = {
      limit: filters.limit,
      offset: 0,
    };

    if (filters.fundId !== 'all') {
      nextFilters.fundId = Number(filters.fundId);
    }

    if (filters.churchId !== 'all') {
      nextFilters.churchId = Number(filters.churchId);
    }

    if (filters.month !== 'all') {
      nextFilters.month = Number(filters.month);
    }

    if (filters.year !== 'all') {
      nextFilters.year = Number(filters.year);
    }

    return nextFilters;
  }, [filters]);

  const ledgerQuery = useLedger(queryFilters);
  const fundsQuery = useFunds({ includeInactive: false }, { staleTime: 5 * 60 * 1000 });
  const churchesQuery = useChurches();

  const collection: FundMovementCollection | undefined = ledgerQuery.data;
  const movements = collection?.records ?? [];

  const totalAmount = collection?.totals.totalAmount ?? 0;
  const automaticAmount = movements
    .filter((movement) => movement.type === 'automatic')
    .reduce((sum, movement) => sum + movement.amount, 0);
  const manualAmount = movements
    .filter((movement) => movement.type === 'manual')
    .reduce((sum, movement) => sum + movement.amount, 0);

  const columns = useMemo(
    () => [
      {
        id: 'createdAt',
        header: 'Fecha',
        render: (movement: FundMovementRecord) => (
          <span className="text-sm font-semibold text-slate-700">
            {formatDateTime(movement.createdAt)}
          </span>
        ),
      },
      {
        id: 'description',
        header: 'Descripción',
        render: (movement: FundMovementRecord) => (
          <div className="flex flex-col text-sm text-slate-700">
            <span className="font-semibold">{movement.description || 'Movimiento automático'}</span>
            <span className="text-xs text-slate-500">
              Reporte #{movement.report.id} • {movement.report.month ?? '—'}/
              {movement.report.year ?? '—'}
            </span>
          </div>
        ),
      },
      {
        id: 'fund',
        header: 'Fondo',
        render: (movement: FundMovementRecord) => (
          <span className="text-sm text-slate-600">{movement.fund.name ?? 'N/D'}</span>
        ),
      },
      {
        id: 'church',
        header: 'Iglesia',
        render: (movement: FundMovementRecord) => (
          <span className="text-sm text-slate-600">{movement.church.name ?? 'No asignada'}</span>
        ),
      },
      {
        id: 'amount',
        header: 'Monto',
        align: 'right' as const,
        render: (movement: FundMovementRecord) => (
          <span className="text-sm font-semibold text-slate-800">
            {formatCurrency(movement.amount)}
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Tipo',
        render: (movement: FundMovementRecord) => (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              movement.type === 'automatic'
                ? 'bg-indigo-50 text-indigo-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {movement.type === 'automatic' ? 'Automático' : 'Manual'}
          </span>
        ),
      },
      {
        id: 'createdBy',
        header: 'Registrado por',
        render: (movement: FundMovementRecord) => (
          <span className="text-xs text-slate-500">{movement.createdBy}</span>
        ),
      },
    ],
    [],
  );

  const applyFilters = (partial: Partial<FilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Libro mensual
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Movimientos por fondo</h1>
        <p className="text-sm text-slate-600">
          Analiza la distribución automática y manual de recursos por reporte e iglesia.
        </p>
      </header>

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Fondo
            <select
              value={filters.fundId}
              onChange={(event) => applyFilters({ fundId: event.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos los fondos</option>
              {(fundsQuery.data?.records ?? []).map((fund) => (
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
              {(churchesQuery.data ?? []).map((church) => (
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
            Registros por página
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
        <LedgerStatCard
          title="Monto total"
          value={formatCurrency(totalAmount)}
          subtitle="Movimientos registrados"
        />
        <LedgerStatCard
          title="Automáticos"
          value={formatCurrency(automaticAmount)}
          subtitle="Procesados desde informes"
        />
        <LedgerStatCard
          title="Manuales"
          value={formatCurrency(manualAmount)}
          subtitle="Ajustes manuales"
        />
      </section>

      <section>
        {ledgerQuery.isLoading || ledgerQuery.isPending ? (
          <LoadingState description="Consultando movimientos de fondos" fullHeight />
        ) : ledgerQuery.isError ? (
          <ErrorState
            description={(ledgerQuery.error as Error)?.message ?? 'Error inesperado'}
            onRetry={() => ledgerQuery.refetch()}
          />
        ) : movements.length === 0 ? (
          <EmptyState
            title="No hay movimientos para mostrar"
            description="Ajusta los filtros o procesa un informe para generar movimientos automáticos."
            icon={<span>📘</span>}
            fullHeight
          />
        ) : (
          <DataTable
            data={movements}
            columns={columns}
            getRowId={(movement) => movement.id}
          />
        )}
      </section>
    </div>
  );
}
type LedgerStatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

function LedgerStatCard({ title, value, subtitle }: LedgerStatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
