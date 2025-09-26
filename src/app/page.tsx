import Link from "next/link";

import { execute } from "@/lib/db";
import { getUserProfile } from "@/lib/supabase/server";
import { formatCurrencyDisplay } from "@/lib/utils/currency";
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

type PipelineHealth = {
  pendingAdmin: number;
  awaitingDeposits: number;
  awaitingTransactions: number;
  rejected: number;
};

type FinancialSnapshot = {
  currentTotal: number;
  previousTotal: number;
  reportingChurches: number;
  pendingChurches: number;
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

const loadPipelineHealth = async (): Promise<PipelineHealth> => {
  const result = await execute<{
    pending_admin: string | null;
    awaiting_deposits: string | null;
    awaiting_transactions: string | null;
    rejected: string | null;
  }>(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE estado IN ('pendiente', 'pendiente_admin', 'en_revision')
            AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
        ) AS pending_admin,
        COUNT(*) FILTER (
          WHERE estado IN ('pendiente', 'pendiente_admin')
            AND (numero_deposito IS NULL OR monto_depositado IS NULL OR monto_depositado = 0)
            AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
        ) AS awaiting_deposits,
        COUNT(*) FILTER (
          WHERE estado IN ('aprobado_admin', 'procesado')
            AND COALESCE(transactions_created, FALSE) = FALSE
            AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
        ) AS awaiting_transactions,
        COUNT(*) FILTER (
          WHERE estado IN ('rechazado', 'rechazado_admin')
            AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
        ) AS rejected
      FROM reports
    `
  );

  const row =
    result.rows[0] ?? {
      pending_admin: "0",
      awaiting_deposits: "0",
      awaiting_transactions: "0",
      rejected: "0",
    };

  return {
    pendingAdmin: Number(row.pending_admin ?? 0),
    awaitingDeposits: Number(row.awaiting_deposits ?? 0),
    awaitingTransactions: Number(row.awaiting_transactions ?? 0),
    rejected: Number(row.rejected ?? 0),
  };
};

const loadFinancialSnapshot = async (): Promise<FinancialSnapshot> => {
  const result = await execute<{
    current_total: string | null;
    previous_total: string | null;
    reporting_churches: string | null;
    pending_churches: string | null;
  }>(
    `
      SELECT
        COALESCE(SUM(CASE
          WHEN date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
            THEN total_entradas
        END), 0) AS current_total,
        COALESCE(SUM(CASE
          WHEN date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            THEN total_entradas
        END), 0) AS previous_total,
        COUNT(DISTINCT CASE
          WHEN date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
            AND estado NOT IN ('rechazado', 'rechazado_admin')
            THEN church_id
        END) AS reporting_churches,
        COUNT(DISTINCT CASE
          WHEN date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
            AND estado IN ('pendiente', 'pendiente_admin', 'en_revision')
            THEN church_id
        END) AS pending_churches
      FROM reports
    `
  );

  const row =
    result.rows[0] ?? {
      current_total: "0",
      previous_total: "0",
      reporting_churches: "0",
      pending_churches: "0",
    };

  return {
    currentTotal: Number(row.current_total ?? 0),
    previousTotal: Number(row.previous_total ?? 0),
    reportingChurches: Number(row.reporting_churches ?? 0),
    pendingChurches: Number(row.pending_churches ?? 0),
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
  const [summary, recentReports, pipeline, financial] = await Promise.all([
    loadDashboardSummary(),
    loadRecentReports(),
    loadPipelineHealth(),
    loadFinancialSnapshot(),
  ]);

  const averageTicket =
    financial.reportingChurches > 0 ? financial.currentTotal / financial.reportingChurches : 0;

  const growth =
    financial.previousTotal > 0
      ? ((financial.currentTotal - financial.previousTotal) / financial.previousTotal) * 100
      : null;
  const growthTone = growth === null ? "neutral" : growth >= 0 ? "success" : "warning";
  const growthLabel =
    growth === null
      ? "Sin datos comparativos"
      : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs mes anterior`;

  const statCards = [
    {
      label: "Aportes del mes",
      value: formatCurrencyDisplay(financial.currentTotal),
      description: "Ingresos congregacionales reportados en el periodo actual",
    },
    {
      label: "Informes totales",
      value: summary.totalReports.toLocaleString("es-PY"),
      description: "Histórico general de reportes almacenados",
    },
    {
      label: "Iglesias activas",
      value: summary.totalChurches.toLocaleString("es-PY"),
      description: `${financial.reportingChurches.toLocaleString("es-PY")} reportaron este mes`,
    },
    {
      label: "Procesados este mes",
      value: summary.processedThisMonth.toLocaleString("es-PY"),
      description: "Reportes aprobados y con movimientos nacionales",
      badge:
        pipeline.awaitingTransactions > 0
          ? { label: `${pipeline.awaitingTransactions} por aplicar`, tone: "warning" as const }
          : summary.processedThisMonth === 0
            ? { label: "Revisar", tone: "warning" as const }
            : { label: "Al día", tone: "success" as const },
    },
  ];

  const pipelineHighlights = [
    {
      label: "Pendientes por validar",
      value: pipeline.pendingAdmin,
      helper: "Informes enviados que requieren revisión nacional.",
      tone: pipeline.pendingAdmin > 0 ? "warning" : "success",
      toneLabel: pipeline.pendingAdmin > 0 ? "Atención" : "Sin pendientes",
    },
    {
      label: "Depósitos por confirmar",
      value: pipeline.awaitingDeposits,
      helper: "Reportes sin comprobante bancario cargado.",
      tone: pipeline.awaitingDeposits > 0 ? "warning" : "success",
      toneLabel: pipeline.awaitingDeposits > 0 ? "Revisar" : "Cerrado",
    },
    {
      label: "Movimientos pendientes",
      value: pipeline.awaitingTransactions,
      helper: "Faltan generar asientos automáticos en fondos.",
      tone: pipeline.awaitingTransactions > 0 ? "warning" : "success",
      toneLabel: pipeline.awaitingTransactions > 0 ? "Procesar" : "Al día",
    },
    {
      label: "Rechazados este mes",
      value: pipeline.rejected,
      helper: "Informes con observaciones devueltas a la iglesia.",
      tone: pipeline.rejected > 0 ? "critical" : "neutral",
      toneLabel: pipeline.rejected > 0 ? "Dar seguimiento" : "Sin rechazos",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Panel de administración"
        subtitle="Monitorea el pulso financiero nacional y los pendientes críticos de la migración Next.js en un solo lugar."
        badge={{ label: "Migración Next.js" }}
      />

      <div className="absd-grid">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Resumen financiero del mes"
          description="Visualiza los aportes consolidados y la participación congregacional."
          actions={
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--absd-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--absd-authority)] transition hover:border-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
              href="/funds"
            >
              Revisar fondos
            </Link>
          }
        >
          <dl className="grid gap-4 text-sm text-[rgba(15,23,42,0.7)] sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--absd-subtle)] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                Total recaudado
              </dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--absd-ink)]">
                {formatCurrencyDisplay(financial.currentTotal)}
              </dd>
              <dd className="mt-3">
                {growth !== null ? (
                  <StatusPill tone={growthTone}>{growthLabel}</StatusPill>
                ) : (
                  <span className="text-xs text-[rgba(15,23,42,0.65)]">{growthLabel}</span>
                )}
              </dd>
            </div>

            <div className="rounded-2xl bg-[var(--absd-subtle)] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                Ticket promedio por iglesia
              </dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--absd-ink)]">
                {formatCurrencyDisplay(averageTicket)}
              </dd>
              <dd className="mt-2 text-xs text-[rgba(15,23,42,0.65)]">
                Basado en {financial.reportingChurches.toLocaleString("es-PY")} congregaciones con remisión vigente.
              </dd>
            </div>

            <div className="rounded-2xl bg-[var(--absd-subtle)] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                Participación congregacional
              </dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--absd-ink)]">
                {financial.reportingChurches.toLocaleString("es-PY")} / {summary.totalChurches.toLocaleString("es-PY")}
              </dd>
              <dd className="mt-3">
                {financial.pendingChurches > 0 ? (
                  <StatusPill tone="warning">
                    {`${financial.pendingChurches.toLocaleString("es-PY")} pendientes de enviar`}
                  </StatusPill>
                ) : (
                  <StatusPill tone="success">Cobertura completa</StatusPill>
                )}
              </dd>
            </div>

            <div className="rounded-2xl bg-[var(--absd-subtle)] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                Depósitos verificados
              </dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--absd-ink)]">
                {pipeline.awaitingDeposits > 0
                  ? `${pipeline.awaitingDeposits.toLocaleString("es-PY")} por confirmar`
                  : "Al día"}
              </dd>
              <dd className="mt-3">
                <StatusPill tone={pipeline.awaitingDeposits > 0 ? "warning" : "success"}>
                  {pipeline.awaitingDeposits > 0 ? "Actualizar comprobantes" : "Completo"}
                </StatusPill>
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Salud del pipeline"
          description="Sigue el flujo de aprobación y conciliación de los informes."
          actions={
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--absd-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--absd-authority)] transition hover:border-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
              href="/reports"
            >
              Ir al módulo de reportes
            </Link>
          }
        >
          <ul className="space-y-3">
            {pipelineHighlights.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--absd-subtle)] p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--absd-ink)]">{item.label}</p>
                  <p className="text-xs text-[rgba(15,23,42,0.65)]">{item.helper}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-[var(--absd-ink)]">
                    {item.value.toLocaleString("es-PY")}
                  </p>
                  <div className="mt-2">
                    <StatusPill tone={item.tone}>{item.toneLabel}</StatusPill>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
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
            1. Publicar el portal congregacional con RLS activa y firma federada para los perfiles de pastor y tesorero.
          </li>
          <li>
            2. Automatizar la generación de movimientos nacionales durante la aprobación en
            <code className="mx-1 rounded bg-[var(--absd-subtle)] px-1 py-0.5">/api/admin/reports/approve</code>
            y cerrar el checklist de conciliación bancaria.
          </li>
          <li>
            3. Documentar el procedimiento de cierre mensual (cierres distritales, conciliaciones y exportaciones offline) para el equipo nacional.
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
                      {formatCurrencyDisplay(report.total_entradas)}
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
        description="Sigue disponible la experiencia legacy mientras consolidamos los módulos React."
      >
        <p className="text-sm text-[rgba(15,23,42,0.7)]">
          La versión offline (`index.html` y `mobile.html`) continúa accesible desde
          <code className="mx-1 rounded bg-[var(--absd-subtle)] px-1 py-0.5">start.sh</code>. Úsala como
          respaldo en viajes o cortes de conectividad y sincroniza los archivos de `uploads/` antes de
          compartir nuevos paquetes con los distritos.
        </p>
      </SectionCard>
    </div>
  );
}
