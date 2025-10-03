'use client';

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useChurches } from '@/hooks/useChurches';
import { useReports } from '@/hooks/useReports';
import { ReportForm } from '@/components/Reports/ReportForm';
import { ReportsDashboard } from '@/components/Reports/ReportsDashboard';
import { ReportDetailsDrawer } from '@/components/Reports/ReportDetailsDrawer';
import { formatCurrencyDisplay } from '@/lib/utils/currency';
import type { ReportFilters, ReportRecord } from '@/types/api';
import {
  DataTable,
  ErrorState,
  FilterBar,
  FormField,
  PageHeader,
  SectionCard,
  StatusPill,
} from '@/components/Shared';
import { Button } from '@/components/ui/button';

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

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'new', label: 'Registrar informe' },
  { id: 'history', label: 'Historial' },
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
  month: 'all',
};

const FILTER_STORAGE_KEY = 'reports::filters';
const TAB_STORAGE_KEY = 'reports::tab';

const buildFilters = (state: FilterState): ReportFilters => {
  const result: ReportFilters = { limit: 50 };
  if (state.churchId !== 'all') {
    result.churchId = Number(state.churchId);
  }
  if (state.year !== 'all') {
    result.year = Number(state.year);
  }
  if (state.month !== 'all') {
    result.month = Number(state.month);
  }
  return result;
};

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
        month: monthParam && monthParam !== '' ? monthParam : 'all',
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
            month: parsed.month ?? 'all',
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
  const reports = useMemo(() => (historyQuery.data ?? []) as ReportRecord[], [historyQuery.data]);

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

  const historyColumns = useMemo(() => {
    return [
      {
        id: 'church',
        header: 'Iglesia',
        render: (report: ReportRecord) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-[var(--absd-ink)]">{report.churchName}</span>
            <span className="text-xs text-[rgba(15,23,42,0.55)]">{report.metadata.city ?? 'Ciudad no registrada'}</span>
          </div>
        ),
      },
      {
        id: 'period',
        header: 'Periodo',
        render: (report: ReportRecord) => (
          <span className="text-[var(--absd-ink)]">{`${monthLabels[report.month - 1] ?? report.month}/${report.year}`}</span>
        ),
      },
      {
        id: 'entries',
        header: 'Entradas',
        align: 'right' as const,
        render: (report: ReportRecord) => (
          <span className="font-semibold text-[var(--absd-ink)]">
            {formatCurrencyDisplay(report.totals.entries)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Estado',
        render: (report: ReportRecord) => (
          <StatusPill tone={report.status.toLowerCase() === 'procesado' ? 'success' : 'warning'}>
            {report.status}
          </StatusPill>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Centro de reportes"
        subtitle="Gestiona los informes mensuales, revisa métricas nacionales y mantiene actualizado el directorio congregacional."
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Informes" },
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                variant={isActive ? 'primary' : 'ghost'}
                size="sm"
                density="compact"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </PageHeader>

      {activeTab === 'dashboard' && (
        <ReportsDashboard reports={summaryReports} churches={churches} />
      )}

      {activeTab === 'new' && <ReportForm />}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <FilterBar
            actions={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Limpiar filtros
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => historyQuery.refetch()}
                  loading={historyQuery.isFetching}
                >
                  Refrescar
                </Button>
              </div>
            }
          >
            <FormField htmlFor="filter-church" label="Iglesia">
              <select
                id="filter-church"
                value={filters.churchId}
                onChange={handleSelectChange('churchId')}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]"
                disabled={churchesLoading}
              >
                <option value="all">Todas</option>
                {churches.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField htmlFor="filter-year" label="Año">
              <select
                id="filter-year"
                value={filters.year}
                onChange={handleSelectChange('year')}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]"
              >
                <option value="all">Todos</option>
                {(availableYears.length === 0
                  ? Array.from({ length: 5 }, (_, index) => currentYear - index)
                  : availableYears
                ).map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField htmlFor="filter-month" label="Mes">
              <select
                id="filter-month"
                value={filters.month}
                onChange={handleSelectChange('month')}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]"
              >
                <option value="all">Todos</option>
                {monthLabels.map((label, index) => (
                  <option key={label} value={String(index + 1)}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          </FilterBar>

          <SectionCard
            title="Resultados"
            description={
              historyQuery.isLoading
                ? 'Cargando informes congregacionales…'
                : `${reports.length} informe${reports.length === 1 ? '' : 's'} visibles`
            }
          >
            {historyQuery.isError ? (
              <ErrorState
                title="Error al cargar informes"
                description={(historyQuery.error as Error)?.message || 'No se pudieron cargar los informes históricos'}
                onRetry={() => historyQuery.refetch()}
                retryLabel="Reintentar"
              />
            ) : (
              <DataTable
                data={reports}
                columns={historyColumns}
                loading={historyQuery.isLoading || historyQuery.isFetching}
                skeletonRows={6}
                onRowClick={setSelectedReport}
                emptyContent="No se encontraron reportes con los filtros seleccionados."
              />
            )}
          </SectionCard>
        </div>
      )}

      <ReportDetailsDrawer report={selectedReport} onClose={() => setSelectedReport(null)} />
    </div>
  );
}
