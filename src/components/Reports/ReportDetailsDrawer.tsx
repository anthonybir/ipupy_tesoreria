"use client";

import { useMemo } from "react";

import { Drawer } from "@/components/Shared";
import { formatCurrencyDisplay } from "@/lib/utils/currency";
import type { ReportRecord } from "@/types/api";

const congregationalLabels: Record<keyof ReportRecord["breakdown"]["congregational"], string> = {
  diezmos: "Diezmos",
  ofrendas: "Ofrendas",
  anexos: "Anexos",
  otros: "Otros ingresos",
};

const designatedLabels: Record<keyof ReportRecord["breakdown"]["designated"], string> = {
  misiones: "Misiones",
  lazosAmor: "Lazos de Amor",
  misionPosible: "Misión Posible",
  apy: "APY",
  iba: "IBA",
  caballeros: "Caballeros",
  damas: "Damas",
  jovenes: "Jóvenes",
  ninos: "Niños",
};

const expenseLabels: Record<keyof ReportRecord["expenses"], string> = {
  energiaElectrica: "Energía eléctrica (ANDE)",
  agua: "Agua",
  recoleccionBasura: "Recolección de basura",
  servicios: "Servicios (internet, telefonía, etc.)",
  mantenimiento: "Mantenimiento",
  materiales: "Materiales",
  otrosGastos: "Otros gastos",
};

type ReportDetailsDrawerProps = {
  report: ReportRecord | null;
  onClose: () => void;
};

const makeAttachmentHref = (path?: string | null) => {
  if (!path) {
    return null;
  }
  if (path.startsWith("http")) {
    return path;
  }
  return `/${path.replace(/^\/+/, "")}`;
};

export function ReportDetailsDrawer({ report, onClose }: ReportDetailsDrawerProps): JSX.Element {
  const attachments = useMemo(() => {
    if (!report) {
      return [] as Array<{ label: string; href: string | null }>;
    }

    return [
      { label: "Resumen del informe", href: makeAttachmentHref(report.submission.attachments.summary) },
      { label: "Comprobante del depósito", href: makeAttachmentHref(report.submission.attachments.deposit) },
    ];
  }, [report]);

  const congregationalEntries = (report
    ? Object.entries(report.breakdown.congregational)
    : []) as Array<[keyof ReportRecord["breakdown"]["congregational"], number]>;
  const designatedEntries = (report
    ? Object.entries(report.breakdown.designated)
    : []) as Array<[keyof ReportRecord["breakdown"]["designated"], number]>;
  const expenseEntries = (report
    ? Object.entries(report.expenses)
    : []) as Array<[keyof ReportRecord["expenses"], number]>;

  const metricCards = report
    ? [
        { label: "Total entradas", value: report.totals.entries },
        { label: "Fondo nacional (10%)", value: report.totals.nationalFund },
        { label: "Fondos designados", value: report.totals.designated },
        { label: "Gastos operativos", value: report.totals.operational },
        { label: "Honorario pastoral", value: report.totals.pastoralHonorarium },
        { label: "Saldo del mes", value: report.totals.balance },
      ]
    : [];

  return (
    <Drawer
      open={Boolean(report)}
      onClose={onClose}
      title={report ? `${report.churchName} — ${report.month}/${report.year}` : "Detalle de informe"}
      description={report?.metadata.city ? `Ubicación: ${report.metadata.city}` : undefined}
      size="lg"
    >
      {!report ? null : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            {metricCards.map((card) => (
              <article
                key={card.label}
                className="rounded-2xl border border-[var(--absd-border)] bg-[color-mix(in_oklab,var(--absd-authority) 4%,white)] px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  {card.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--absd-ink)]">
                  {formatCurrencyDisplay(card.value)}
                </p>
              </article>
            ))}
          </section>

          <section className="space-y-6 rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
            <header className="border-b border-[var(--absd-border)] px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                Desglose de ingresos
              </h3>
            </header>
            <div className="grid gap-6 px-5 pb-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Ingresos congregacionales
                </h4>
                <div className="mt-2 grid gap-px rounded-2xl bg-[var(--absd-muted)] sm:grid-cols-2">
                  {congregationalEntries.map(([key, amount]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-[var(--absd-surface)] px-4 py-3 text-sm text-[rgba(15,23,42,0.7)]"
                    >
                      <span>{congregationalLabels[key]}</span>
                      <span className="font-semibold text-[var(--absd-ink)]">{formatCurrencyDisplay(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Ofrecimientos designados (100 % nacional)
                </h4>
                <div className="mt-2 grid gap-px rounded-2xl bg-[var(--absd-muted)] sm:grid-cols-2">
                  {designatedEntries.map(([key, amount]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-[var(--absd-surface)] px-4 py-3 text-sm text-[rgba(15,23,42,0.7)]"
                    >
                      <span>{designatedLabels[key]}</span>
                      <span className="font-semibold text-[var(--absd-ink)]">{formatCurrencyDisplay(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
            <header className="border-b border-[var(--absd-border)] px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                Gastos operativos
              </h3>
            </header>
            <div className="grid gap-px bg-[var(--absd-muted)] sm:grid-cols-2">
              {expenseEntries.map(([key, amount]) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-[var(--absd-surface)] px-5 py-3 text-sm text-[rgba(15,23,42,0.7)]"
                >
                  <span>{expenseLabels[key]}</span>
                  <span className="font-semibold text-[var(--absd-ink)]">{formatCurrencyDisplay(amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
            <header className="border-b border-[var(--absd-border)] px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                Detalle de envío
              </h3>
            </header>
            <dl className="grid gap-4 px-5 py-4 text-sm text-[rgba(15,23,42,0.7)] md:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Tipo de envío
                </dt>
                <dd className="capitalize">{report.submission.submissionType ?? "No especificado"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Enviado por
                </dt>
                <dd>{report.submission.submittedBy ?? "N/A"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Fecha envío
                </dt>
                <dd>
                  {report.submission.submittedAt
                    ? new Date(report.submission.submittedAt).toLocaleString("es-PY")
                    : "N/A"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Fecha depósito
                </dt>
                <dd>{report.submission.depositDate ?? "N/A"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Nº Depósito
                </dt>
                <dd>{report.submission.depositNumber ?? "N/A"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Monto depositado
                </dt>
                <dd>{formatCurrencyDisplay(report.submission.depositAmount)}</dd>
              </div>
              <div className="space-y-1 md:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                  Observaciones
                </dt>
                <dd>{report.submission.notes || "Sin observaciones registradas."}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
            <header className="border-b border-[var(--absd-border)] px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                Archivos adjuntos
              </h3>
            </header>
            <ul className="divide-y divide-[var(--absd-border)] text-sm text-[rgba(15,23,42,0.7)]">
              {attachments.map(({ label, href }) => (
                <li key={label} className="flex items-center justify-between px-5 py-3">
                  <span>{label}</span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full border border-[var(--absd-border)] px-3 py-1 text-xs font-semibold text-[var(--absd-authority)] transition hover:border-[var(--absd-authority)] hover:text-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
                    >
                      Ver archivo
                    </a>
                  ) : (
                    <span className="text-xs text-[rgba(15,23,42,0.45)]">Sin adjunto</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Drawer>
  );
}
