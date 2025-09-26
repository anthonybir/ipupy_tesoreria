import Link from "next/link";

import { execute } from "@/lib/db";
import { getUserProfile } from "@/lib/supabase/server";
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusPill,
} from "@/components/Shared";

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

  const row = summary.rows[0] ?? { total_reports: "0", total_churches: "0", processed: "0" };
  return {
    totalReports: Number(row.total_reports ?? 0),
    totalChurches: Number(row.total_churches ?? 0),
    processedThisMonth: Number(row.processed ?? 0),
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
    total_entradas: Number(row.total_entradas ?? 0),
  }));
};

export default async function DashboardLanding() {
  const user = await getUserProfile();
  const [summary, recentReports] = await Promise.all([loadDashboardSummary(), loadRecentReports()]);

  const statCards = [
    {
      label: "Informes totales",
      value: summary.totalReports.toLocaleString("es-PY"),
      description: "Histórico general de reportes almacenados",
    },
    {
      label: "Iglesias activas",
      value: summary.totalChurches.toLocaleString("es-PY"),
      description: "Congregaciones con credenciales vigentes",
    },
    {
      label: "Procesados este mes",
      value: summary.processedThisMonth.toLocaleString("es-PY"),
      description: "Reportes revisados y validados en el periodo",
      badge:
        summary.processedThisMonth === 0
          ? { label: "Revisar", tone: "warning" as const }
          : { label: "En curso", tone: "success" as const },
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Panel de administración"
        subtitle="Seguimos migrando la Tesorería IPU PY a la arquitectura Next.js. Este panel provisional ya valida la autenticación y los agregados principales."
        badge={{ label: "Migración Next.js" }}
      />

      <div className="absd-grid">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <SectionCard
        title="Estado de sesión"
        description="Comprueba tus permisos y la iglesia asignada antes de operar."
        actions={
          !user && (
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[var(--absd-authority)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
              href="/login"
            >
              Ingresar con Google
            </Link>
          )
        }
      >
        {user ? (
          <dl className="grid gap-3 text-sm text-[rgba(15,23,42,0.7)] sm:grid-cols-3">
            <div className="rounded-2xl bg-[var(--absd-subtle)] px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">Usuario</dt>
              <dd className="font-medium text-[var(--absd-ink)]">{user.email}</dd>
            </div>
            <div className="rounded-2xl bg-[var(--absd-subtle)] px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">Rol</dt>
              <dd className="font-medium capitalize text-[var(--absd-ink)]">{user.role ?? "sin definir"}</dd>
            </div>
            <div className="rounded-2xl bg-[var(--absd-subtle)] px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">Iglesia asignada</dt>
              <dd className="font-medium text-[var(--absd-ink)]">
                {user.churchName || (user.churchId ? `#${user.churchId}` : "N/A")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[rgba(15,23,42,0.65)]">
            Inicia sesión para acceder a los reportes congregacionales y paneles nacionales.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Próximos pasos"
        description="Estas son las tareas pendientes antes del corte a producción."
      >
        <ol className="space-y-3 text-sm text-[rgba(15,23,42,0.7)]">
          <li>
            1. Conectar los nuevos endpoints de
            <code className="mx-1 rounded bg-[var(--absd-subtle)] px-1 py-0.5">/api/reports</code>,
            <code className="mx-1 rounded bg-[var(--absd-subtle)] px-1 py-0.5">/api/churches</code> y
            recursos adicionales con la vista React.
          </li>
          <li>
            2. Migrar los componentes ABSD (dashboards, tablas, formularios) a implementaciones
            compatibles con React/Next.js.
          </li>
          <li>
            3. Reaplicar estilos responsivos y estados offline para replicar la experiencia del modo
            sin conexión actual.
          </li>
        </ol>
      </SectionCard>

      <SectionCard title="Últimos informes registrados" description="Monitorea el flujo más reciente de reportes nacionales.">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--absd-border)] text-sm" role="grid">
            <thead className="bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Iglesia
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Periodo
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Total
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--absd-border)] bg-white">
              {recentReports.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-[rgba(15,23,42,0.65)]" colSpan={4}>
                    Aún no existen informes migrados.
                  </td>
                </tr>
              ) : (
                recentReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-3 py-2 text-[var(--absd-ink)]">{report.church_name}</td>
                    <td className="px-3 py-2 text-[var(--absd-ink)]">{`${report.month}/${report.year}`}</td>
                    <td className="px-3 py-2 text-[var(--absd-ink)]">
                      ₲ {report.total_entradas.toLocaleString('es-PY')}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        tone={report.estado === 'procesado' ? 'success' : 'warning'}
                      >
                        {report.estado}
                      </StatusPill>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Referencia de migración"
        description="Mientras completamos los módulos ABSD, conserva la versión offline como respaldo."
      >
        <p className="text-sm text-[rgba(15,23,42,0.7)]">
          ¿Necesitas seguir usando la interfaz actual? Mantén la versión offline mientras completamos la
          migración. Este entorno Next.js servirá como base para integrar el tablero completo, los reportes
          congregacionales y los flujos autenticados.
        </p>
      </SectionCard>
    </div>
  );
}
