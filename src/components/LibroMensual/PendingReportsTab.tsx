'use client';

import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

import { EmptyState } from '@/components/Shared/EmptyState';
import { ErrorState } from '@/components/Shared/ErrorState';
import { LoadingState } from '@/components/Shared/LoadingState';
import ManualReportForm from '@/components/Admin/ManualReportForm';
import {
  AdminReportRecord,
  useAdminReports,
  useApproveReport,
  useUpdateReport
} from '@/hooks/useAdminData';

const currencyFormatter = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
});

type PendingReportsTabProps = {
  filters: { year: string; month: string };
};

type ModalState = {
  report: AdminReportRecord | null;
  observations: string;
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
  'Diciembre'
];

export function PendingReportsTab({ filters }: PendingReportsTabProps) {
  const [modalState, setModalState] = useState<ModalState>({ report: null, observations: '' });
  const [showManualForm, setShowManualForm] = useState(false);
  const [churches, setChurches] = useState<Array<{ id: number; name: string; city: string; pastor?: string }>>([]);

  const queryFilters = useMemo(() => {
    const params: Record<string, string> = { status: 'pending' };
    if (filters.year) {
      params.year = filters.year;
    }
    if (filters.month !== 'all') {
      params.month = filters.month;
    }
    return params;
  }, [filters]);

  const reportsQuery = useAdminReports(queryFilters);
  const approveReport = useApproveReport();
  const updateReport = useUpdateReport();

  // Fetch churches for manual report form
  useEffect(() => {
    const fetchChurches = async () => {
      try {
        const response = await fetch('/api/churches');
        if (response.ok) {
          const data = await response.json();
          setChurches(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching churches:', error);
      }
    };
    fetchChurches();
  }, []);

  const reports = reportsQuery.data?.reports ?? [];
  const summary = reportsQuery.data?.summary ?? {};

  const openModal = (report: AdminReportRecord) => {
    setModalState({ report, observations: report.observations ?? '' });
  };

  const closeModal = () => {
    setModalState({ report: null, observations: '' });
  };

  const handleApprove = async () => {
    if (!modalState.report) {
      return;
    }
    try {
      await approveReport.mutateAsync({
        reportId: modalState.report.id
      });
      closeModal();
    } catch (error) {
      console.error('Error approving report', error);
    }
  };

  const handleReject = async () => {
    if (!modalState.report) {
      return;
    }
    try {
      await updateReport.mutateAsync({
        reportId: modalState.report.id,
        estado: 'rechazado_admin',
        observations: modalState.observations,
        transactionsCreated: false
      });
      closeModal();
    } catch (error) {
      console.error('Error rejecting report', error);
    }
  };

  if (reportsQuery.isLoading) {
    return <LoadingState title="Cargando informes pendientes..." fullHeight />;
  }

  if (reportsQuery.isError) {
    return <ErrorState title="No se pudieron cargar los informes pendientes" />;
  }

  if (reports.length === 0 && !showManualForm) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Registrar Informe Manual
          </button>
        </div>
        <EmptyState
          title="No hay informes pendientes"
          description="Todas las congregaciones están al día o no se registraron nuevos informes en el periodo seleccionado."
        />
      </div>
    );
  }

  // Show manual report form if toggled
  if (showManualForm) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Registrar Informe Manual de Pastor
        </h2>
        <ManualReportForm
          churches={churches}
          onSuccess={() => {
            setShowManualForm(false);
            reportsQuery.refetch();
          }}
          onCancel={() => setShowManualForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen</p>
          <p className="text-base font-semibold text-slate-900">
            {reports.length} informes pendientes — {currencyFormatter.format(summary.totalEntradas ?? 0)} en ingresos reportados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Informe Manual
          </button>
          <p className="text-xs text-slate-500">
            {summary.totalDesignado
              ? `Fondos designados por aprobar: ${currencyFormatter.format(summary.totalDesignado)}`
              : ''}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Iglesia</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Entradas</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Designados</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Operativos</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.map((report) => {
              const periodLabel = `${monthNames[Number(report.month)] ?? 'Mes'} ${report.year}`;
              return (
                <tr key={report.id} className="hover:bg-indigo-50/30">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{report.churchName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{periodLabel}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                    {currencyFormatter.format(report.totals.totalEntradas ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">
                    {currencyFormatter.format(report.totals.totalDesignado ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">
                    {currencyFormatter.format(report.totals.totalOperativo ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openModal(report)}
                        className="rounded-lg border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
                      >
                        Revisar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await approveReport.mutateAsync({ reportId: report.id });
                          } catch (error) {
                            console.error('Error approving report', error);
                          }
                        }}
                        disabled={approveReport.isPending}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Aprobar rápido
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalState.report ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Revisión de informe</p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {modalState.report.churchName} — {monthNames[Number(modalState.report.month)] ?? modalState.report.month}/{
                    modalState.report.year
                  }
                </h2>
                <p className="text-xs text-slate-500">
                  Ingresado el{' '}
                  {modalState.report.submittedAt
                    ? format(new Date(modalState.report.submittedAt), "dd 'de' MMMM yyyy", { locale: es })
                    : 'sin fecha registrada'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
              >
                Cerrar
              </button>
            </header>

            <div className="space-y-6 px-6 py-6">
              <section className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Total entradas', value: modalState.report.totals.totalEntradas ?? 0 },
                  { label: 'Fondo nacional', value: modalState.report.totals.fondoNacional ?? 0 },
                  { label: 'Fondos designados', value: modalState.report.totals.totalDesignado ?? 0 },
                  { label: 'Gastos operativos', value: modalState.report.totals.totalOperativo ?? 0 },
                  { label: 'Honorario pastoral', value: modalState.report.expenses.honorariosPastoral ?? 0 },
                  { label: 'Saldo estimado', value: modalState.report.totals.saldoCalculado ?? 0 }
                ].map((card) => (
                  <article key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{currencyFormatter.format(card.value)}</p>
                  </article>
                ))}
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200">
                  <header className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingresos congregacionales</h3>
                  </header>
                  <dl className="divide-y divide-slate-100">
                    {Object.entries(modalState.report.incomes).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between px-4 py-2 text-sm text-slate-600">
                        <dt className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</dt>
                        <dd className="font-semibold text-slate-900">{currencyFormatter.format(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200">
                  <header className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gastos y designados</h3>
                  </header>
                  <dl className="divide-y divide-slate-100">
                    {Object.entries(modalState.report.expenses).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between px-4 py-2 text-sm text-slate-600">
                        <dt className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</dt>
                        <dd className="font-semibold text-slate-900">{currencyFormatter.format(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <section className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notas para la congregación (opcional)
                </label>
                <textarea
                  value={modalState.observations}
                  onChange={(event) => setModalState((prev) => ({ ...prev, observations: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none"
                  rows={3}
                  placeholder="Comentarios u observaciones para la congregación"
                />
              </section>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={handleReject}
                disabled={updateReport.isPending}
                className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Solicitar corrección
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approveReport.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Aprobar y generar movimientos
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
