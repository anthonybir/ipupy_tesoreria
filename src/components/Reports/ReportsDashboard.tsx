import type { JSX } from 'react';
import type { ChurchRecord, ReportRecord } from '@/types/api';
import { SectionCard, StatCard, StatusPill } from '@/components/Shared';
import { formatCurrencyDisplay } from '@/lib/utils/currency';

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

type ReportsDashboardProps = {
  reports: ReportRecord[];
  churches: ChurchRecord[];
};

const formatPeriod = (report: ReportRecord) => `${monthLabels[report.month - 1] ?? report.month}/${report.year}`;

export function ReportsDashboard({ reports, churches }: ReportsDashboardProps): JSX.Element {
  const currentDate = new Date();
  const currentPeriod = {
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
  };

  const reportsThisMonth = reports.filter(
    (report) => report.month === currentPeriod.month && report.year === currentPeriod.year
  );

  const totalEntries = reportsThisMonth.reduce((sum, report) => sum + report.totals.entries, 0);
  const totalNationalFund = reportsThisMonth.reduce((sum, report) => sum + report.totals.nationalFund, 0);
  const processed = reportsThisMonth.filter((report) => report.status.toLowerCase() === 'procesado').length;
  const pending = Math.max(churches.length - reportsThisMonth.length, 0);

  const recentReports = [...reports]
    .sort(
      (a, b) =>
        (new Date(b.metadata.createdAt ?? '').getTime() || 0) -
        (new Date(a.metadata.createdAt ?? '').getTime() || 0)
    )
    .slice(0, 6);

  const statCards = [
    {
      label: 'Iglesias activas',
      value: churches.length.toLocaleString('es-PY'),
      description: `${processed} procesadas`,
      tone: processed === churches.length ? 'success' : 'default',
    },
    {
      label: 'Entradas del mes',
      value: formatCurrencyDisplay(totalEntries),
      description: `${reportsThisMonth.length} informes registrados`,
    },
    {
      label: 'Fondo nacional (10 %)',
      value: formatCurrencyDisplay(totalNationalFund),
      description: 'Calculado automáticamente',
    },
    {
      label: 'Informes pendientes',
      value: pending.toLocaleString('es-PY'),
      description: pending === 0 ? 'Al día' : 'Requiere seguimiento',
      tone: pending === 0 ? 'success' : 'warning',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="absd-grid">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            description={card.description}
            tone={(card.tone ?? 'default') as 'default' | 'success' | 'warning' | 'critical'}
          />
        ))}
      </div>

      <SectionCard
        title="Últimos informes"
        description="Seguimiento rápido de los reportes más recientes"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--absd-border)] text-sm">
            <thead className="bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Iglesia
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Periodo
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Entradas
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--absd-border)] bg-white">
              {recentReports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[rgba(15,23,42,0.6)]">
                    Todavía no hay reportes migrados.
                  </td>
                </tr>
              ) : (
                recentReports.map((report) => (
                  <tr key={report.id} className="hover:bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
                    <td className="px-4 py-3 text-[var(--absd-ink)]">
                      <div className="font-semibold">{report.churchName}</div>
                      <div className="text-xs text-[rgba(15,23,42,0.55)]">
                        {report.metadata.city ?? 'Ciudad no registrada'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--absd-ink)]">{formatPeriod(report)}</td>
                    <td className="px-4 py-3 text-right text-[var(--absd-ink)] font-semibold">
                      {formatCurrencyDisplay(report.totals.entries)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={report.status.toLowerCase() === 'procesado' ? 'success' : 'warning'}>
                        {report.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
