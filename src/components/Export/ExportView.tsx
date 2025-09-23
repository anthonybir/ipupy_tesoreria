'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

import { useExport } from '@/hooks/useExport';
import type { DataExportParams, ExportType } from '@/types/financial';

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

const currentYear = new Date().getFullYear();
const selectableYears = Array.from({ length: 8 }).map((_, index) => currentYear - index);

type ExportFormState = {
  type: ExportType;
  year: string;
  month: string;
};

const defaultState: ExportFormState = {
  type: 'monthly',
  year: String(currentYear),
  month: String(new Date().getMonth() + 1),
};

export default function ExportView() {
  const [formState, setFormState] = useState<ExportFormState>(defaultState);
  const exportMutation = useExport();

  const handleFieldChange = (field: keyof ExportFormState) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      setFormState((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params: DataExportParams = {
      type: formState.type,
      year: Number(formState.year),
    };

    if (formState.type === 'monthly') {
      params.month = Number(formState.month);
      if (!params.month) {
        toast.error('Selecciona un mes para la exportación mensual.');
        return;
      }
    }

    try {
      const result = await exportMutation.mutateAsync(params);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success('Archivo exportado correctamente');
    } catch (error) {
      console.error('Error exporting data', error);
      toast.error((error as Error)?.message ?? 'No se pudo generar la exportación.');
    }
  };

  const isMonthly = formState.type === 'monthly';

  const helperText = useMemo(() => {
    if (formState.type === 'monthly') {
      return 'Exporta el consolidado mensual de ingresos, salidas y depósitos presentados por iglesia.';
    }
    if (formState.type === 'yearly') {
      return 'Genera un resumen anual con los totales presentados por cada iglesia en el año seleccionado.';
    }
    return 'Obtén el padrón detallado de iglesias con datos pastorales vigentes.';
  }, [formState.type]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Exportaciones oficiales
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Descarga de reportes</h1>
        <p className="text-sm text-slate-600">
          Genera archivos Excel con la información consolidada para respaldos y reportes oficiales.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Tipo de exportación
              <select
                value={formState.type}
                onChange={handleFieldChange('type')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="monthly">Informe mensual (Iglesia x Mes)</option>
                <option value="yearly">Resumen anual</option>
                <option value="churches">Directorio de iglesias</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Año
              <select
                value={formState.year}
                onChange={handleFieldChange('year')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {selectableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            {isMonthly ? (
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Mes
                <select
                  value={formState.month}
                  onChange={handleFieldChange('month')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {monthLabels.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">{helperText}</p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={exportMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
              {exportMutation.isPending ? 'Generando archivo...' : 'Descargar archivo'}
            </button>
            <span className="text-xs text-slate-500">
              Los archivos se generan en formato XLSX con compresión habilitada.
            </span>
          </div>
        </form>
      </section>

      {exportMutation.isError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          {(exportMutation.error as Error)?.message ?? 'No se pudo completar la exportación.'}
        </p>
      ) : null}
    </div>
  );
}
