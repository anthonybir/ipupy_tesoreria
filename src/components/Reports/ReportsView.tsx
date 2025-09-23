'use client';

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useChurches } from '@/hooks/useChurches';
import { useReports } from '@/hooks/useReports';
import { ReportForm } from '@/components/Reports/ReportForm';
import { ReportsDashboard } from '@/components/Reports/ReportsDashboard';
import { ReportDetailsDrawer } from '@/components/Reports/ReportDetailsDrawer';
import { ReportRow } from '@/components/Reports/ReportRow';
import type { ReportFilters, ReportRecord } from '@/types/api';

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
  'Diciembre'
];


const currentYear = new Date().getFullYear();

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'new', label: 'Registrar informe' },
  { id: 'history', label: 'Historial' }
] as const;

type TabId = (typeof tabs)[number]['id'];

type FilterState = {
  churchId: string;
  year: string;
  month: string;
};

const defaultFilterState: FilterState = {
  churchId: 'all',
  year: 'all',
  month: 'all'
};

const FILTER_STORAGE_KEY = 'reports::filters';
const TAB_STORAGE_KEY = 'reports::tab';

const buildFilters = (state: FilterState): ReportFilters => ({
  churchId: state.churchId !== 'all' ? Number(state.churchId) : undefined,
  year: state.year !== 'all' ? Number(state.year) : undefined,
  month: state.month !== 'all' ? Number(state.month) : undefined,
  limit: 50
});


export default function ReportsView() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initializedFromQueryRef = useRef(false);

  useEffect(() => {
    if (initializedFromQueryRef.current) {
      return;
    }

    const churchParam = searchParams.get('churchId');
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const tabParam = searchParams.get('tab');

    const hasQueryState = Boolean(churchParam || yearParam || monthParam || tabParam);

    if (hasQueryState) {
      setFilters({
        churchId: churchParam && churchParam !== '' ? churchParam : 'all',
        year: yearParam && yearParam !== '' ? yearParam : 'all',
        month: monthParam && monthParam !== '' ? monthParam : 'all'
      });

      if (tabParam === 'history') {
        setActiveTab('history');
      }

      initializedFromQueryRef.current = true;
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const storedFilters = window.localStorage.getItem(FILTER_STORAGE_KEY);
        if (storedFilters) {
          const parsed = JSON.parse(storedFilters) as FilterState;
          setFilters({
            churchId: parsed.churchId ?? 'all',
            year: parsed.year ?? 'all',
            month: parsed.month ?? 'all'
          });
        }
      } catch (error) {
        console.warn('No se pudieron restaurar los filtros almacenados', error);
      }

      const storedTabRaw = window.localStorage.getItem(TAB_STORAGE_KEY);
      const isKnownTab = tabs.some((tab) => tab.id === storedTabRaw);
      if (storedTabRaw && isKnownTab) {
        const nextTab = storedTabRaw as TabId;
        if (nextTab !== activeTab) {
          setActiveTab(nextTab);
        }
      }
    }

    initializedFromQueryRef.current = true;
  }, [searchParams, activeTab]);

  useEffect(() => {
    if (!initializedFromQueryRef.current || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (!initializedFromQueryRef.current || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!initializedFromQueryRef.current) {
      return;
    }
    const params = new URLSearchParams();
    if (filters.churchId !== 'all') {
      params.set('churchId', filters.churchId);
    }
    if (filters.year !== 'all') {
      params.set('year', filters.year);
    }
    if (filters.month !== 'all') {
      params.set('month', filters.month);
    }
    if (activeTab === 'history') {
      params.set('tab', 'history');
    }

    const queryString = params.toString();
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [filters, activeTab, pathname, router]);

  const queryFilters = useMemo(() => buildFilters(filters), [filters]);
  const historyQuery = useReports(queryFilters);
  const reports = useMemo(
    () => (historyQuery.data ?? []) as ReportRecord[],
    [historyQuery.data]
  );

  const summaryQuery = useReports({ limit: 200, year: currentYear });
  const summaryReports = useMemo(
    () => (summaryQuery.data ?? reports) as ReportRecord[],
    [summaryQuery.data, reports]
  );

  const { data: churches = [], isLoading: churchesLoading } = useChurches();

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    reports.forEach((report) => years.add(report.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [reports]);

  const handleSelectChange = (field: keyof FilterState) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setFilters((prev) => ({ ...prev, [field]: value }));
    };

  const handleResetFilters = () => {
    setFilters({ churchId: 'all', year: 'all', month: 'all' });
    historyQuery.refetch();
  };

  const HistorySection = () => (
    <div className="space-y-6">
      <section className="dashboard-card p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-[190px] flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-church">
              Iglesia
            </label>
            <select
              id="filter-church"
              value={filters.churchId}
              onChange={handleSelectChange('churchId')}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={churchesLoading}
            >
              <option value="all">Todas</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-[150px] flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-year">
              Año
            </label>
            <select
              id="filter-year"
              value={filters.year}
              onChange={handleSelectChange('year')}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos</option>
              {availableYears.length === 0
                ? Array.from({ length: 5 }, (_, index) => (
                    <option key={index} value={String(currentYear - index)}>
                      {currentYear - index}
                    </option>
                  ))
                : availableYears.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
            </select>
          </div>

          <div className="flex min-w-[170px] flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-month">
              Mes
            </label>
            <select
              id="filter-month"
              value={filters.month}
              onChange={handleSelectChange('month')}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">Todos</option>
              {monthLabels.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              onClick={handleResetFilters}
            >
              Limpiar filtros
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
              onClick={() => historyQuery.refetch()}
              disabled={historyQuery.isFetching}
            >
              {historyQuery.isFetching ? 'Actualizando…' : 'Refrescar'}
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard-card overflow-hidden">
        <header className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resultados</h2>
            <p className="text-sm text-slate-600">
              {historyQuery.isLoading
                ? 'Cargando informes…'
                : `${reports.length} informe${reports.length === 1 ? '' : 's'} encontrados`}
            </p>
          </div>
        </header>

        <div className="overflow-x-auto px-6 pb-6">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Iglesia</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Periodo</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-slate-500">Entradas</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-slate-500">Salidas</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-slate-500">Saldo</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Estado</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {historyQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Cargando información…
                  </td>
                </tr>
              ) : historyQuery.isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-red-600">
                    {historyQuery.error?.message ?? 'No se pudieron cargar los informes.'}
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No se encontraron reportes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <ReportRow key={report.id} report={report} onView={setSelectedReport} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Informes congregacionales</span>
        <h1 className="text-3xl font-semibold text-slate-900">Centro de reportes</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Gestiona los informes mensuales, revisa métricas nacionales y mantiene actualizado el directorio congregacional desde un solo lugar.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 focus-visible:outline-indigo-500'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:outline-slate-400'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === 'dashboard' && (
        <ReportsDashboard reports={summaryReports} churches={churches} />
      )}

      {activeTab === 'new' && <ReportForm />}

      {activeTab === 'history' && <HistorySection />}

      <ReportDetailsDrawer report={selectedReport} onClose={() => setSelectedReport(null)} />
    </div>
  );
}
