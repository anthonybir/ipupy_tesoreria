'use client';

import { useMemo, useState } from 'react';

import { ErrorState, FormField, LoadingState, MetricCard, PageHeader, Toolbar } from '@/components/Shared';
import { useAdminFunds, useAdminFundsSummary } from '@/hooks/useAdminData';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

import { ExternalTransactionsTab } from './ExternalTransactionsTab';
import { LedgerTab } from './LedgerTab';
import { PendingReportsTab } from './PendingReportsTab';

const monthLabels = [
  'Todos',
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

type ActiveTab = 'pending' | 'external' | 'ledger';

type FilterState = {
  year: string;
  month: string;
};

const currentYear = new Date().getFullYear();
const selectableYears = Array.from({ length: 5 }).map((_, index) => String(currentYear - index));

export function LibroMensualTabs(): JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');
  const [filters, setFilters] = useState<FilterState>({
    year: String(currentYear),
    month: 'all'
  });

  const fundsQuery = useAdminFunds();
  const fundsSummary = useAdminFundsSummary();

  const availableFunds = useMemo(
    () => fundsQuery.data?.map((fund) => ({ id: fund.id, name: fund.name })) ?? [],
    [fundsQuery.data]
  );

  const metrics = [
    {
      label: 'Saldo total fondos',
      value: formatCurrencyDisplay(fundsSummary.totalBalance),
      description: `${fundsSummary.fundCount} fondos activos`,
      tone: 'neutral' as const,
    },
    {
      label: 'Fondos disponibles',
      value: availableFunds.length.toString(),
      description: 'Fondos visibles según permisos',
      tone: 'info' as const,
    },
  ];

  const filterSelectClasses =
    'rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';

  const handleMonthChange = (value: string) => {
    setFilters((prev) => ({ ...prev, month: value }));
  };

  const handleYearChange = (value: string) => {
    setFilters((prev) => ({ ...prev, year: value }));
  };

  if (fundsQuery.isLoading) {
    return <LoadingState title="Cargando fondos nacionales..." fullHeight />;
  }

  if (fundsQuery.isError) {
    return <ErrorState title="No se pudieron cargar los fondos" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Centro de control IPU Paraguay"
        subtitle="Libro mensual del tesorero"
        badge={{ label: 'Libro mensual' }}
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Libro Mensual" },
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
        <FormField htmlFor="ledger-year" label="Año">
          <select
            id="ledger-year"
            value={filters.year}
            onChange={(event) => handleYearChange(event.target.value)}
            className={filterSelectClasses}
          >
            {selectableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="ledger-month" label="Mes">
          <select
            id="ledger-month"
            value={filters.month}
            onChange={(event) => handleMonthChange(event.target.value)}
            className={filterSelectClasses}
          >
            <option value="all">Todos</option>
            {monthLabels.slice(1).map((label, index) => (
              <option key={label} value={String(index + 1)}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      </Toolbar>

      <nav className="flex flex-wrap gap-2">
        {[
          { id: 'pending', label: 'Informes pendientes' },
          { id: 'external', label: 'Transacciones externas' },
          { id: 'ledger', label: 'Libro diario' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)] ${
              activeTab === tab.id
                ? 'bg-[var(--absd-authority)] text-white shadow'
                : 'border border-[var(--absd-border)] text-[rgba(15,23,42,0.7)] hover:bg-[color-mix(in_oklab,var(--absd-authority) 8%,white)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section>
        {activeTab === 'pending' ? <PendingReportsTab filters={filters} /> : null}
        {activeTab === 'external' ? <ExternalTransactionsTab funds={availableFunds} /> : null}
        {activeTab === 'ledger' ? <LedgerTab filters={filters} funds={availableFunds} /> : null}
      </section>
    </div>
  );
}
