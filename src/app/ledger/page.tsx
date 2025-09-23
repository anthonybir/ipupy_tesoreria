import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Libro Mensual • IPU PY Tesorería',
  description: 'Registro contable mensual de la tesorería nacional'
};

export default function LedgerPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Contabilidad
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Libro Mensual
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Esta funcionalidad está siendo migrada a Next.js. Pronto podrás acceder al registro
            contable mensual completo con todas las transacciones y movimientos de fondos.
          </p>
        </header>

        <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-6xl">📚</div>
            <h2 className="mb-2 text-xl font-semibold text-slate-900">
              Página en construcción
            </h2>
            <p className="text-sm text-slate-600">
              Estamos trabajando en migrar el libro mensual a la nueva arquitectura.
              Mientras tanto, puedes usar el sistema actual para consultar los registros contables.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}