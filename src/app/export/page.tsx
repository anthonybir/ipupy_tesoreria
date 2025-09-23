import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Exportar • IPU PY Tesorería',
  description: 'Exportación de datos y generación de reportes del sistema nacional'
};

export default function ExportPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Herramientas
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Exportar Datos
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Esta funcionalidad está siendo migrada a Next.js. Pronto podrás exportar
            informes y datos en formato Excel, PDF y otros formatos.
          </p>
        </header>

        <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-6xl">📊</div>
            <h2 className="mb-2 text-xl font-semibold text-slate-900">
              Página en construcción
            </h2>
            <p className="text-sm text-slate-600">
              Estamos trabajando en migrar las herramientas de exportación a la nueva arquitectura.
              Mientras tanto, puedes usar el sistema actual para generar y descargar reportes.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}