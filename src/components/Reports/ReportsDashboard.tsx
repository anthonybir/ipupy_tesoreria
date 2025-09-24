import type { ChurchRecord, ReportRecord } from '@/types/api';

const currency = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
});

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

type ReportsDashboardProps = {
  reports: ReportRecord[];
  churches: ChurchRecord[];
};

const formatPeriod = (report: ReportRecord) => `${monthLabels[report.month - 1] ?? report.month}/${report.year}`;

export function ReportsDashboard({ reports, churches }: ReportsDashboardProps) {
  const currentDate = new Date();
  const currentPeriod = {
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear()
  };

  const reportsThisMonth = reports.filter(
    (report) => report.month === currentPeriod.month && report.year === currentPeriod.year
  );

  const totalEntries = reportsThisMonth.reduce((sum, report) => sum + report.totals.entries, 0);
  const totalNationalFund = reportsThisMonth.reduce((sum, report) => sum + report.totals.nationalFund, 0);
  const processed = reportsThisMonth.filter((report) => report.status.toLowerCase() === 'procesado').length;
  const pending = Math.max(churches.length - reportsThisMonth.length, 0);

  const recentReports = [...reports]
    .sort((a, b) => (new Date(b.metadata.createdAt ?? '').getTime() || 0) - (new Date(a.metadata.createdAt ?? '').getTime() || 0))
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      <section className="dashboard-grid">
        {[
          {
            label: 'Iglesias activas',
            value: churches.length,
            badge: `${processed} procesadas`
          },
          {
            label: 'Entradas del mes',
            value: currency.format(totalEntries),
            badge: `${reportsThisMonth.length} informes`
          },
          {
            label: 'Fondo nacional (10%)',
            value: currency.format(totalNationalFund),
            badge: 'Calculado automáticamente'
          },
          {
            label: 'Informes pendientes',
            value: pending,
            badge: pending === 0 ? 'Al día' : 'Requiere seguimiento',
            tone: pending === 0 ? 'success' : 'warning'
          }
        ].map((card) => (
          <article
            key={card.label}
            className="dashboard-card dashboard-span-minimal p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{card.value}</p>
            <span
              className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                card.tone === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : card.tone === 'warning'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {card.badge}
            </span>
          </article>
        ))}
      </section>

      <section className="dashboard-card overflow-hidden">
        <header className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Últimos informes</h3>
            <p className="text-sm text-slate-600">Seguimiento rápido de los reportes más recientes</p>
          </div>
        </header>

        <div className="overflow-x-auto px-6 pb-6">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Iglesia</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Periodo</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-slate-500">Entradas</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentReports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Todavía no hay reportes migrados.
                  </td>
                </tr>
              ) : (
                recentReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">
                      <div className="font-semibold">{report.churchName}</div>
                      <div className="text-xs text-slate-500">{report.metadata.city ?? 'Ciudad no registrada'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatPeriod(report)}</td>
                    <td className="px-4 py-3 text-right text-slate-900 font-semibold">
                      {currency.format(report.totals.entries)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
