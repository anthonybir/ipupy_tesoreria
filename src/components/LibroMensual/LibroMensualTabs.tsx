'use client';

import { useMemo, useState } from 'react';

import { LoadingState } from '@/components/Shared/LoadingState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { useAdminFunds, useAdminFundsSummary } from '@/hooks/useAdminData';

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

const currencyFormatter = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
});

type ActiveTab = 'pending' | 'external' | 'ledger';

type FilterState = {
  year: string;
  month: string;
};

const currentYear = new Date().getFullYear();
const selectableYears = Array.from({ length: 5 }).map((_, index) => String(currentYear - index));

export function LibroMensualTabs() {
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
    <div className="space-y-6">
      <header className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Libro mensual del tesorero</p>
            <h1 className="text-2xl font-semibold text-slate-900">Centro de control IPU Paraguay</h1>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Saldo total fondos</p>
            <p className="text-lg font-semibold text-slate-900">
              {currencyFormatter.format(fundsSummary.totalBalance)}
            </p>
            <p className="text-[11px] text-slate-500">{fundsSummary.fundCount} fondos activos</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <span className="font-semibold text-indigo-500">Año</span>
            <select
              value={filters.year}
              onChange={(event) => handleYearChange(event.target.value)}
              className="rounded-lg border border-indigo-200 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
            >
              {selectableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <span className="font-semibold text-indigo-500">Mes</span>
            <select
              value={filters.month}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="rounded-lg border border-indigo-200 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="all">Todos</option>
              {monthLabels.slice(1).map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {[
          { id: 'pending', label: 'Informes pendientes' },
          { id: 'external', label: 'Transacciones externas' },
          { id: 'ledger', label: 'Libro diario' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section>
        {activeTab === 'pending' ? (
          <PendingReportsTab filters={filters} />
        ) : null}
        {activeTab === 'external' ? (
          <ExternalTransactionsTab funds={availableFunds} />
        ) : null}
        {activeTab === 'ledger' ? (
          <LedgerTab filters={filters} funds={availableFunds} />
        ) : null}
      </section>
    </div>
  );
}
