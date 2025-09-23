import Link from "next/link";

import { execute } from "@/lib/db";
import { getUserProfile } from "@/lib/supabase/server";

type DashboardSummary = {
  totalReports: number;
  totalChurches: number;
  processedThisMonth: number;
};

type RecentReport = {
  id: number;
  church_name: string;
  month: number;
  year: number;
  total_entradas: number;
  estado: string;
};

const loadDashboardSummary = async (): Promise<DashboardSummary> => {
  const summary = await execute<{ total_reports: string; total_churches: string; processed: string }>(
    `
      SELECT
        (SELECT COUNT(*) FROM reports) AS total_reports,
        (SELECT COUNT(*) FROM churches WHERE active = true) AS total_churches,
        (
          SELECT COUNT(*)
          FROM reports
          WHERE estado = 'procesado'
            AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
        ) AS processed
    `
  );

  const row = summary.rows[0] ?? { total_reports: '0', total_churches: '0', processed: '0' };
  return {
    totalReports: Number(row.total_reports ?? 0),
    totalChurches: Number(row.total_churches ?? 0),
    processedThisMonth: Number(row.processed ?? 0)
  };
};

const loadRecentReports = async (): Promise<RecentReport[]> => {
  const result = await execute<RecentReport>(
    `
      SELECT r.id, c.name as church_name, r.month, r.year, r.total_entradas, r.estado
      FROM reports r
      JOIN churches c ON r.church_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 5
    `
  );
  return result.rows.map((row) => ({
    ...row,
    total_entradas: Number(row.total_entradas ?? 0)
  }));
};

export default async function DashboardLanding() {
  const user = await getUserProfile();
  const [summary, recentReports] = await Promise.all([
    loadDashboardSummary(),
    loadRecentReports()
  ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            IPUPY Tesorería
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Panel de administración en migración a Next.js
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Estamos trasladando el panel de tesorería a la nueva arquitectura de Next.js. Este
            tablero provisional ya se conecta con NextAuth y los endpoints migrados para comenzar a
            validar la experiencia autenticada.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Informes totales</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalReports}</p>
            <p className="mt-1 text-xs text-slate-500">Histórico general en la base de datos</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Iglesias activas</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalChurches}</p>
            <p className="mt-1 text-xs text-slate-500">Con credenciales vigentes</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Procesados este mes</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.processedThisMonth}</p>
            <p className="mt-1 text-xs text-slate-500">Reportes marcados como procesados</p>
          </article>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Estado de sesión</h2>
            {user ? (
              <dl className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Usuario</dt>
                  <dd>{user.email}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Rol</dt>
                  <dd className="capitalize">{user.role ?? "sin definir"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Iglesia asignada</dt>
                  <dd>
                    {user.churchName || (user.churchId ? `#${user.churchId}` : "N/A")}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Inicia sesión para acceder a los reportes y paneles congregacionales.</p>
                <Link
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  href="/login"
                >
                  Ingresar con Google
                </Link>
              </div>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Próximos pasos</h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li>
                1. Conectar los nuevos endpoints de <code className="rounded bg-slate-100 px-1 py-0.5">/api/reports</code>
                , <code className="rounded bg-slate-100 px-1 py-0.5">/api/churches</code> y futuros recursos con la vista React.
              </li>
              <li>
                2. Migrar los componentes ABSD (dashboards, tablas y formularios) a versiones compatibles con React/Next.js.
              </li>
              <li>
                3. Reaplicar estilos y comportamientos responsivos para replicar la experiencia offline actual.
              </li>
            </ol>
          </article>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Últimos informes registrados</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Iglesia</th>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Periodo</th>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentReports.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500" colSpan={4}>
                      Aún no existen informes migrados.
                    </td>
                  </tr>
                ) : (
                  recentReports.map((report) => (
                    <tr key={report.id}>
                      <td className="px-3 py-2 text-slate-700">{report.church_name}</td>
                      <td className="px-3 py-2 text-slate-700">{`${report.month}/${report.year}`}</td>
                      <td className="px-3 py-2 text-slate-700">Gs. {report.total_entradas.toLocaleString('es-PY')}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">
                          {report.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600">
          <p>
            ¿Necesitas seguir usando la interfaz actual? Mantén a mano la versión offline mientras completamos la migración. Este entorno Next.js servirá como base para integrar gradualmente el tablero completo, reportes congregacionales y flujos de autenticación con NextAuth.
          </p>
        </section>
      </div>
    </main>
  );
}
