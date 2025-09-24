"use client";

import { useMemo } from "react";

import type { ReportRecord } from "@/types/api";

const currencyFormatter = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0
});

const congregationalLabels: Record<keyof ReportRecord['breakdown']['congregational'], string> = {
  diezmos: 'Diezmos',
  ofrendas: 'Ofrendas',
  anexos: 'Anexos',
  otros: 'Otros ingresos'
};

const designatedLabels: Record<keyof ReportRecord['breakdown']['designated'], string> = {
  misiones: 'Misiones',
  lazosAmor: 'Lazos de Amor',
  misionPosible: 'Misión Posible',
  apy: 'APY',
  iba: 'IBA',
  caballeros: 'Caballeros',
  damas: 'Damas',
  jovenes: 'Jóvenes',
  ninos: 'Niños'
};

const expenseLabels: Record<keyof ReportRecord['expenses'], string> = {
  energiaElectrica: 'Energía eléctrica (ANDE)',
  agua: 'Agua',
  recoleccionBasura: 'Recolección de basura',
  servicios: 'Servicios (internet, telefonía, etc.)',
  mantenimiento: 'Mantenimiento',
  materiales: 'Materiales',
  otrosGastos: 'Otros gastos'
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

export function ReportDetailsDrawer({ report, onClose }: ReportDetailsDrawerProps) {
  const attachments = useMemo(() => {
    if (!report) {
      return [] as Array<{ label: string; href: string | null }>;
    }

    return [
      { label: "Resumen del informe", href: makeAttachmentHref(report.submission.attachments.summary) },
      { label: "Comprobante del depósito", href: makeAttachmentHref(report.submission.attachments.deposit) }
    ];
  }, [report]);

  if (!report) {
    return null;
  }

  const congregationalEntries = Object.entries(report.breakdown.congregational) as Array<[
    keyof ReportRecord['breakdown']['congregational'],
    number
  ]>;
  const designatedEntries = Object.entries(report.breakdown.designated) as Array<[
    keyof ReportRecord['breakdown']['designated'],
    number
  ]>;
  const expenseEntries = Object.entries(report.expenses) as Array<[
    keyof ReportRecord['expenses'],
    number
  ]>;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle de informe</p>
            <h2 className="text-xl font-semibold text-slate-900">
              {report.churchName} — {report.month}/{report.year}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Cerrar
          </button>
        </header>

        <div className="space-y-8 px-6 py-6">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: 'Total entradas',
                value: report.totals.entries
              },
              {
                label: 'Fondo nacional (10%)',
                value: report.totals.nationalFund
              },
              {
                label: 'Fondos designados',
                value: report.totals.designated
              },
              {
                label: 'Gastos operativos',
                value: report.totals.operational
              },
              {
                label: 'Honorario pastoral',
                value: report.totals.pastoralHonorarium
              },
              {
                label: 'Saldo del mes',
                value: report.totals.balance
              }
            ].map((card) => (
              <article key={card.label} className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{currencyFormatter.format(card.value)}</p>
              </article>
            ))}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Desglose de ingresos</h3>
            </header>
            <div className="space-y-6 px-5 py-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingresos congregacionales</h4>
                <div className="mt-2 grid gap-px rounded-xl bg-slate-100 sm:grid-cols-2">
                  {congregationalEntries.map(([key, amount]) => (
                    <div key={key} className="flex items-center justify-between bg-white px-4 py-3 text-sm text-slate-600">
                      <span>{congregationalLabels[key]}</span>
                      <span className="font-semibold text-slate-900">{currencyFormatter.format(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ofrecimientos designados (100 % nacional)</h4>
                <div className="mt-2 grid gap-px rounded-xl bg-slate-100 sm:grid-cols-2">
                  {designatedEntries.map(([key, amount]) => (
                    <div key={key} className="flex items-center justify-between bg-white px-4 py-3 text-sm text-slate-600">
                      <span>{designatedLabels[key]}</span>
                      <span className="font-semibold text-slate-900">{currencyFormatter.format(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Gastos operativos</h3>
            </header>
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
              {expenseEntries.map(([key, amount]) => (
                <div key={key} className="flex items-center justify-between bg-white px-5 py-3 text-sm text-slate-600">
                  <span>{expenseLabels[key]}</span>
                  <span className="font-semibold text-slate-900">{currencyFormatter.format(amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalle de envío</h3>
            </header>
            <dl className="grid gap-4 px-5 py-4 text-sm text-slate-600 md:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de envío</dt>
                <dd className="capitalize">{report.submission.submissionType ?? 'No especificado'}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enviado por</dt>
                <dd>{report.submission.submittedBy ?? 'N/A'}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha envío</dt>
                <dd>{report.submission.submittedAt ? new Date(report.submission.submittedAt).toLocaleString('es-PY') : 'N/A'}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha depósito</dt>
                <dd>{report.submission.depositDate ?? 'N/A'}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nº Depósito</dt>
                <dd>{report.submission.depositNumber ?? 'N/A'}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto depositado</dt>
                <dd>{currencyFormatter.format(report.submission.depositAmount)}</dd>
              </div>
              <div className="space-y-1 md:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</dt>
                <dd>{report.submission.notes || 'Sin observaciones registradas.'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Archivos adjuntos</h3>
            </header>
            <ul className="divide-y divide-slate-200 text-sm text-slate-600">
              {attachments.map(({ label, href }) => (
                <li key={label} className="flex items-center justify-between px-5 py-3">
                  <span>{label}</span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
                    >
                      Ver archivo
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Sin adjunto</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
