'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

import {
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  SectionCard,
  StatusPill,
  Toolbar,
  FormSection,
  FormField,
} from '@/components/Shared';
import ManualReportForm from '@/components/Admin/ManualReportForm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { DataTableColumn } from '@/components/Shared/DataTable';
import {
  type AdminReportRecord,
  useAdminReports,
  useApproveReport,
  useUpdateReport,
} from '@/hooks/useAdminData';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

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

type PendingReportsTabProps = {
  filters: { year: string; month: string };
};

type ChurchOption = {
  id: number;
  name: string;
  city: string;
  pastor?: string;
};
const formatCurrency = (value: number | null | undefined) =>
  formatCurrencyDisplay(value ?? 0);

const friendlyLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[a-z]/, (char) => char.toUpperCase());

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
export function PendingReportsTab({ filters }: PendingReportsTabProps) {
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AdminReportRecord | null>(null);
  const [observations, setObservations] = useState('');
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [quickApproveId, setQuickApproveId] = useState<number | null>(null);

  const queryFilters = useMemo(() => {
    const params: Record<string, string> = { status: 'pending' };
    if (filters.year) {
      params['year'] = filters.year;
    }
    if (filters.month !== 'all') {
      params['month'] = filters.month;
    }
    return params;
  }, [filters]);

  const reportsQuery = useAdminReports(queryFilters);
  const approveReport = useApproveReport();
  const updateReport = useUpdateReport();
  useEffect(() => {
    const fetchChurches = async () => {
      try {
        const response = await fetch('/api/churches');
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setChurches((data?.data as ChurchOption[] | undefined) ?? []);
      } catch (error) {
        console.error('Error fetching churches:', error);
      }
    };

    fetchChurches();
  }, []);
  const reports = reportsQuery.data?.reports ?? [];
  const summary = reportsQuery.data?.summary ?? {};
  const pendingCount = reports.length;
  const selectedReportRaw = (selectedReport?.raw ?? {}) as Record<string, unknown>;

  const handleOpenReview = useCallback((report: AdminReportRecord) => {
    setSelectedReport(report);
    setObservations(report.observations ?? '');
  }, []);

  const handleCloseReview = useCallback(() => {
    setSelectedReport(null);
    setObservations('');
  }, []);
  const handleQuickApprove = useCallback(
    async (report: AdminReportRecord) => {
      try {
        setQuickApproveId(report.id);
        await approveReport.mutateAsync({ reportId: report.id });
        await reportsQuery.refetch();
      } catch (error) {
        console.error('Error approving report', error);
      } finally {
        setQuickApproveId(null);
      }
    },
    [approveReport, reportsQuery],
  );
  const handleApproveDetailed = useCallback(async () => {
    if (!selectedReport) {
      return;
    }
    try {
      await approveReport.mutateAsync({ reportId: selectedReport.id });
      await reportsQuery.refetch();
      handleCloseReview();
    } catch (error) {
      console.error('Error approving report', error);
    }
  }, [approveReport, handleCloseReview, reportsQuery, selectedReport]);
  const handleReject = useCallback(async () => {
    if (!selectedReport) {
      return;
    }
    try {
      await updateReport.mutateAsync({
        reportId: selectedReport.id,
        estado: 'rechazado_admin',
        observations,
        transactionsCreated: false,
      });
      await reportsQuery.refetch();
      handleCloseReview();
    } catch (error) {
      console.error('Error rejecting report', error);
    }
  }, [handleCloseReview, observations, reportsQuery, selectedReport, updateReport]);
  const columns = useMemo<DataTableColumn<AdminReportRecord>[]>(
    () => [
      {
        id: 'church',
        header: 'Iglesia',
        render: (report) => (
          <span className="text-sm font-semibold text-[var(--absd-ink)]">{report.churchName}</span>
        ),
      },
      {
        id: 'period',
        header: 'Periodo',
        render: (report) => (
          <span className="text-sm text-[rgba(15,23,42,0.7)]">
            {`${monthNames[Number(report.month)] ?? report.month}/${report.year}`}
          </span>
        ),
      },
      {
        id: 'entries',
        header: 'Entradas',
        align: 'right',
        render: (report) => (
          <span className="text-sm font-semibold text-[var(--absd-ink)]">
            {formatCurrency(report.totals?.totalEntradas)}
          </span>
        ),
      },
      {
        id: 'designated',
        header: 'Designados',
        align: 'right',
        render: (report) => (
          <span className="text-sm text-[rgba(15,23,42,0.7)]">
            {formatCurrency(report.totals?.totalDesignado)}
          </span>
        ),
      },
      {
        id: 'operational',
        header: 'Operativos',
        align: 'right',
        render: (report) => (
          <span className="text-sm text-[rgba(15,23,42,0.7)]">
            {formatCurrency(report.totals?.totalOperativo)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Estado',
        render: (report) => (
          <StatusPill tone={report.status?.includes('rechazado') ? 'critical' : 'warning'}>
            {friendlyLabel(report.status ?? 'pendiente')}
          </StatusPill>
        ),
      },
      {
        id: 'actions',
        header: 'Acciones',
        render: (report) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              density="compact"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenReview(report);
              }}
            >
              Revisar
            </Button>
            <Button
              type="button"
              variant="success"
              size="sm"
              density="compact"
              loading={approveReport.isPending && quickApproveId === report.id}
              onClick={async (event) => {
                event.stopPropagation();
                await handleQuickApprove(report);
              }}
            >
              Aprobar rápido
            </Button>
          </div>
        ),
      },
    ],
    [approveReport.isPending, handleOpenReview, handleQuickApprove, quickApproveId],
  );
  const summaryMetrics = useMemo(
    () => [
      {
        label: 'Informes pendientes',
        value: pendingCount.toString(),
        description: 'Listos para revisión',
        tone: pendingCount > 0 ? 'warning' : 'neutral',
      },
      {
        label: 'Ingresos reportados',
        value: formatCurrency(summary.totalEntradas),
        description: 'Monto total informado por congregaciones',
        tone: 'neutral',
      },
      {
        label: 'Fondos designados',
        value: formatCurrency(summary.totalDesignado),
        description: 'Requieren aprobación nacional',
        tone: 'info',
      },
    ],
    [pendingCount, summary.totalDesignado, summary.totalEntradas],
  );
  if (reportsQuery.isLoading) {
    return <LoadingState title="Cargando informes pendientes..." fullHeight />;
  }

  if (reportsQuery.isError) {
    return <ErrorState title="No se pudieron cargar los informes pendientes" />;
  }
  if (showManualForm) {
    return (
      <SectionCard
        title="Registrar informe manual de pastor"
        description="Integra un informe recibido fuera del flujo digital y mantén la auditoría al día."
        padding="lg"
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            density="compact"
            onClick={() => setShowManualForm(false)}
          >
            Volver a pendientes
          </Button>
        }
      >
        <ManualReportForm
          churches={churches}
          onSuccess={() => {
            setShowManualForm(false);
            void reportsQuery.refetch();
          }}
          onCancel={() => setShowManualForm(false)}
        />
      </SectionCard>
    );
  }
  const manualActionButton = (
    <Button
      type="button"
      size="sm"
      density="compact"
      icon={<PlusCircleIcon className="h-4 w-4" aria-hidden />}
      onClick={() => setShowManualForm(true)}
    >
      Registrar informe manual
    </Button>
  );

  if (pendingCount === 0) {
    return (
      <div className="space-y-6">
        <Toolbar actions={manualActionButton} variant="filters">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--absd-ink)]">
              No hay informes pendientes para el periodo seleccionado.
            </p>
            <p className="text-xs text-[rgba(15,23,42,0.6)]">
              Puedes registrar manualmente un informe recibido por otros canales o esperar nuevos envíos.
            </p>
          </div>
        </Toolbar>

        <SectionCard title="Resumen general">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {summaryMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                description={metric.description}
                tone={metric.tone as never}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Informes pendientes"
          description="Todas las congregaciones están al día."
          actions={manualActionButton}
        >
          <EmptyState
            title="No hay informes pendientes"
            description="Cuando llegue un nuevo informe, aparecerá aquí para su aprobación."
            action={manualActionButton}
            tone="info"
            fullHeight
          />
        </SectionCard>
      </div>
    );
  }
  const incomeEntries = selectedReport
    ? (Object.entries(selectedReport.incomes ?? {}) as Array<[string, number]>)
    : [];
  const expenseEntries = selectedReport
    ? (Object.entries(selectedReport.expenses ?? {}) as Array<[string, number]>)
    : [];
  const detailMetrics = selectedReport
    ? [
        {
          label: 'Total entradas',
          value: formatCurrency(selectedReport.totals?.totalEntradas),
          description: 'Suma de ingresos congregacionales y designados',
          tone: 'info' as const,
        },
        {
          label: 'Fondo nacional (10%)',
          value: formatCurrency(selectedReport.totals?.fondoNacional),
          description: 'Transferencia a tesorería nacional',
          tone: 'neutral' as const,
        },
        {
          label: 'Fondos designados',
          value: formatCurrency(selectedReport.totals?.totalDesignado),
          description: 'Distribución 100% nacional',
          tone: 'info' as const,
        },
        {
          label: 'Gastos operativos',
          value: formatCurrency(selectedReport.totals?.totalOperativo),
          description: 'Servicios y mantenimiento',
          tone: 'warning' as const,
        },
        {
          label: 'Honorario pastoral',
          value: formatCurrency(selectedReport.expenses?.honorariosPastoral),
          description: 'Monto sugerido según entradas',
          tone: 'success' as const,
        },
        {
          label: 'Saldo estimado',
          value: formatCurrency(selectedReport.totals?.saldoCalculado),
          description: 'Resultados tras designados y gastos',
          tone:
            (selectedReport.totals?.saldoCalculado ?? 0) >= 0 ? ('success' as const) : ('danger' as const),
        },
      ]
    : [];

  return (
    <>
      <div className="space-y-6">
        <Toolbar actions={manualActionButton} variant="filters">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--absd-ink)]">
              {pendingCount} informe{pendingCount === 1 ? '' : 's'} pendientes para aprobación.
            </p>
            <p className="text-xs text-[rgba(15,23,42,0.6)]">
              Fondos designados por aprobar: {formatCurrency(summary.totalDesignado)}
            </p>
          </div>
        </Toolbar>

        <SectionCard title="Resumen general" padding="md">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {summaryMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                description={metric.description}
                tone={metric.tone as never}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Informes pendientes"
          description={`${pendingCount} informe${pendingCount === 1 ? '' : 's'} listos para revisión.`}
          padding="lg"
        >
          <DataTable
            data={reports}
            columns={columns}
            loading={reportsQuery.isFetching || approveReport.isPending || updateReport.isPending}
            skeletonRows={6}
            onRowClick={handleOpenReview}
          />
        </SectionCard>
      </div>

      <Drawer
        open={Boolean(selectedReport)}
        onClose={handleCloseReview}
        title={
          selectedReport
            ? `${selectedReport.churchName} — ${
                monthNames[Number(selectedReport.month)] ?? selectedReport.month
              }/${selectedReport.year}`
            : 'Detalle de informe'
        }
        description={
          selectedReport?.submittedAt
            ? `Enviado el ${format(new Date(selectedReport.submittedAt), "dd 'de' MMMM yyyy", {
                locale: es,
              })}`
            : undefined
        }
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              density="compact"
              onClick={handleReject}
              loading={updateReport.isPending}
              disabled={approveReport.isPending}
            >
              Solicitar corrección
            </Button>
            <Button
              type="button"
              variant="success"
              size="sm"
              density="compact"
              onClick={handleApproveDetailed}
              loading={approveReport.isPending}
              disabled={updateReport.isPending}
            >
              Aprobar y generar movimientos
            </Button>
          </div>
        }
      >
        {selectedReport ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <StatusPill tone={selectedReport.status?.includes('rechazado') ? 'critical' : 'warning'}>
                {friendlyLabel(selectedReport.status ?? 'pendiente')}
              </StatusPill>
              <span className="text-xs text-[rgba(15,23,42,0.55)]">
                Depósito: {readString(selectedReportRaw['numero_deposito']) ?? 'No registrado'}
              </span>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {detailMetrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  description={metric.description}
                  tone={metric.tone}
                />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
                <header className="border-b border-[var(--absd-border)] px-4 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                    Ingresos congregacionales
                  </h3>
                </header>
                <dl className="divide-y divide-[var(--absd-border)]">
                  {incomeEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-4 py-2 text-sm text-[rgba(15,23,42,0.7)]"
                    >
                      <dt>{friendlyLabel(key)}</dt>
                      <dd className="font-semibold text-[var(--absd-ink)]">{formatCurrency(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-2xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
                <header className="border-b border-[var(--absd-border)] px-4 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                    Designados y gastos
                  </h3>
                </header>
                <dl className="divide-y divide-[var(--absd-border)]">
                  {expenseEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-4 py-2 text-sm text-[rgba(15,23,42,0.7)]"
                    >
                      <dt>{friendlyLabel(key)}</dt>
                      <dd className="font-semibold text-[var(--absd-ink)]">{formatCurrency(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
              <header className="border-b border-[var(--absd-border)] px-4 py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                  Detalle de envío
                </h3>
              </header>
              <dl className="grid gap-4 px-4 py-4 text-sm text-[rgba(15,23,42,0.7)] md:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                    Tipo de envío
                  </dt>
                  <dd className="text-[var(--absd-ink)]">
                    {friendlyLabel('normal')}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                    Enviado por
                  </dt>
                  <dd className="text-[var(--absd-ink)]">{selectedReport.processedBy ?? 'N/A'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                    Fecha envío
                  </dt>
                  <dd className="text-[var(--absd-ink)]">
                    {selectedReport.submittedAt
                      ? format(new Date(selectedReport.submittedAt), "dd 'de' MMMM yyyy", { locale: es })
                      : 'N/A'}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                    Fecha depósito
                  </dt>
                  <dd className="text-[var(--absd-ink)]">{readString(selectedReportRaw['fecha_deposito']) ?? 'N/A'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                    Nº de depósito
                  </dt>
                  <dd className="text-[var(--absd-ink)]">{readString(selectedReportRaw['numero_deposito']) ?? 'N/A'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                    Monto depositado
                  </dt>
                  <dd className="text-[var(--absd-ink)]">
                    {formatCurrency(readNumber(selectedReportRaw['monto_depositado']))}
                  </dd>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                    Observaciones del envío
                  </dt>
                  <dd className="text-[rgba(15,23,42,0.7)]">
                    {selectedReport.observations?.trim() || 'Sin observaciones registradas.'}
                  </dd>
                </div>
              </dl>
            </div>

            <FormSection
              title="Notas para la congregación"
              description="Comparte hallazgos o ajustes solicitados antes de aprobar el informe."
            >
              <FormField
                htmlFor="report-observations"
                label="Observaciones"
                hint="Estas notas se compartirán con la congregación para que realicen las correcciones necesarias."
              >
                <Textarea
                  id="report-observations"
                  rows={4}
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
                  placeholder="Comentarios u observaciones para la congregación"
                />
              </FormField>
            </FormSection>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
