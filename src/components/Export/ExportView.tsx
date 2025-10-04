'use client';

import { useMemo, useState, type JSX } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

import { useExport } from '@/hooks/useExport';
import {
  FormField,
  PageHeader,
  SectionCard,
  Toolbar,
  ErrorState,
} from '@/components/Shared';
import { Button } from '@/components/ui/button';
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

const selectClasses =
  'rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';

export default function ExportView(): JSX.Element {
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
      toast.error((error as Error).message);
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
    <div className="space-y-8">
      <PageHeader
        title="Descarga de reportes"
        subtitle="Genera archivos Excel con la información consolidada para respaldos y reportes oficiales."
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Exportar" },
        ]}
      />

      <SectionCard title="Generar exportación" description={helperText} padding="lg">
        <form id="export-form" className="space-y-6" onSubmit={handleSubmit}>
          <Toolbar
            actions={
              <Button
                type="submit"
                form="export-form"
                loading={exportMutation.isPending}
                icon={<ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />}
                iconPosition="left"
              >
                {exportMutation.isPending ? 'Generando archivo…' : 'Descargar archivo'}
              </Button>
            }
          >
            <FormField htmlFor="export-type" label="Tipo de exportación">
              <select
                id="export-type"
                value={formState.type}
                onChange={handleFieldChange('type')}
                className={selectClasses}
              >
                <option value="monthly">Informe mensual (Iglesia x Mes)</option>
                <option value="yearly">Resumen anual</option>
                <option value="churches">Directorio de iglesias</option>
              </select>
            </FormField>
            <FormField htmlFor="export-year" label="Año">
              <select
                id="export-year"
                value={formState.year}
                onChange={handleFieldChange('year')}
                className={selectClasses}
              >
                {selectableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </FormField>
            {isMonthly ? (
              <FormField htmlFor="export-month" label="Mes">
                <select
                  id="export-month"
                  value={formState.month}
                  onChange={handleFieldChange('month')}
                  className={selectClasses}
                >
                  {monthLabels.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
          </Toolbar>

          <p className="rounded-2xl bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)] px-4 py-3 text-xs text-[rgba(15,23,42,0.7)]">
            Los archivos se generan en formato XLSX con compresión habilitada.
          </p>
        </form>

        {exportMutation.isError ? (
          <ErrorState
            className="mt-6"
            title="No se pudo completar la exportación"
            description={(exportMutation.error as Error).message}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}
