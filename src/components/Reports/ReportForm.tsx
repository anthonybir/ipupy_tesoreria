'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useCreateReport } from '@/hooks/useReportMutations';
import { useChurches } from '@/hooks/useChurches';
import { useLastReport } from '@/hooks/useReports';
import type { CreateReportPayload } from '@/hooks/useReportMutations';
import { FormField, FormSection } from '@/components/Shared';
import { formatCurrencyDisplay, rawValueToNumber } from '@/lib/utils/currency';

const initialNumericState = {
  diezmos: '',
  ofrendas: '',
  misiones: '',
  lazos_amor: '',
  mision_posible: '',
  apy: '',
  iba: '',
  caballeros: '',
  damas: '',
  jovenes: '',
  ninos: '',
  otros: '',
  anexos: '',
  energia_electrica: '',
  agua: '',
  recoleccion_basura: '',
  servicios: '',
  mantenimiento: '',
  materiales: '',
  otros_gastos: '',
  monto_depositado: '',
};

type NumericField = keyof typeof initialNumericState;

type FormState = typeof initialNumericState & {
  church_id: string;
  month: string;
  year: string;
  numero_deposito: string;
  fecha_deposito: string;
  observaciones: string;
};

type AttachmentKey = 'summary' | 'deposit';
type AttachmentState = Partial<Record<AttachmentKey, { name: string; dataUrl: string }>>;

type DonorRow = {
  id: number;
  firstName: string;
  lastName: string;
  document: string;
  amount: string;
};

type ComputedTotals = {
  totalIngresos: number;
  totalDesignados: number;
  diezmoNacional: number;
  gastosOperativos: number;
  honorarioCalculado: number;
  totalSalidas: number;
  saldo: number;
};

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB

const monthOptions = [
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


const designatedIncomeFields: NumericField[] = [
  'misiones',
  'lazos_amor',
  'mision_posible',
  'apy',
  'iba',
  'caballeros',
  'damas',
  'jovenes',
  'ninos',
];

const baseIncomeFields: NumericField[] = ['diezmos', 'ofrendas', 'otros', 'anexos'];

const expenseFields: NumericField[] = [
  'energia_electrica',
  'agua',
  'recoleccion_basura',
  'servicios',
  'mantenimiento',
  'materiales',
  'otros_gastos',
];

const fieldLabels: Record<NumericField, string> = {
  diezmos: 'Diezmos',
  ofrendas: 'Ofrendas',
  misiones: 'Misiones',
  lazos_amor: 'Lazos de Amor',
  mision_posible: 'Misión Posible',
  apy: 'APY',
  iba: 'IBA',
  caballeros: 'Caballeros',
  damas: 'Damas',
  jovenes: 'Jóvenes',
  ninos: 'Niños',
  otros: 'Otros ingresos',
  anexos: 'Anexos',
  energia_electrica: 'Energía eléctrica (ANDE)',
  agua: 'Agua',
  recoleccion_basura: 'Recolección de basura',
  servicios: 'Servicios (internet, telefonía, etc.)',
  mantenimiento: 'Mantenimiento',
  materiales: 'Materiales',
  otros_gastos: 'Otros gastos',
  monto_depositado: 'Monto depositado',
};

const toNumberOrUndefined = (value: string): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = rawValueToNumber(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toNumber = (value: string): number => rawValueToNumber(value);

const roundTwo = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const formatCurrency = (value: number): string => formatCurrencyDisplay(roundTwo(value));

const InputBaseClasses =
  'rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';

export function ReportForm(): JSX.Element {
  const currentDate = new Date();
  const buildDefaultState = (): FormState => ({
    church_id: '',
    month: String(currentDate.getMonth() + 1),
    year: String(currentDate.getFullYear()),
    numero_deposito: '',
    fecha_deposito: '',
    observaciones: '',
    ...initialNumericState,
  });

  const [form, setForm] = useState<FormState>(() => buildDefaultState());
  const [attachments, setAttachments] = useState<AttachmentState>({});
  const [inputKeys, setInputKeys] = useState<Record<AttachmentKey, number>>({
    summary: 0,
    deposit: 0,
  });
  const [isReadingAttachment, setIsReadingAttachment] = useState(false);
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [donorSequence, setDonorSequence] = useState(1);
  const createReport = useCreateReport();
  const { data: churches = [], isLoading: churchesLoading } = useChurches();

  const selectedChurchId = form.church_id ? Number(form.church_id) : null;
  const { data: lastReportData } = useLastReport(selectedChurchId);

  const filteredChurches = useMemo(
    () => [...churches].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [churches]
  );

  useEffect(() => {
    if (!selectedChurchId) {
      return;
    }

    if (!lastReportData) {
      return;
    }

    if (!lastReportData.lastReport) {
      const now = new Date();
      const fallbackMonth = String(now.getMonth() + 1);
      const fallbackYear = String(now.getFullYear());

      setForm((prev) => {
        if (prev.month === fallbackMonth && prev.year === fallbackYear) {
          return prev;
        }
        return {
          ...prev,
          month: fallbackMonth,
          year: fallbackYear,
        };
      });
      return;
    }

    const { year, month } = lastReportData.lastReport;

    let nextMonth = month + 1;
    let nextYear = year;

    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }

    const nextMonthValue = String(nextMonth);
    const nextYearValue = String(nextYear);

    setForm((prev) => {
      if (prev.month === nextMonthValue && prev.year === nextYearValue) {
        return prev;
      }
      return {
        ...prev,
        month: nextMonthValue,
        year: nextYearValue,
      };
    });
  }, [selectedChurchId, lastReportData]);

  const totals = useMemo<ComputedTotals>(() => {
    const totalIngresos = [...baseIncomeFields, ...designatedIncomeFields].reduce(
      (sum, field) => sum + toNumber(form[field]),
      0
    );
    const totalDesignados = designatedIncomeFields.reduce(
      (sum, field) => sum + toNumber(form[field]),
      0
    );
    const baseCongregational = toNumber(form.diezmos) + toNumber(form.ofrendas);
    const diezmoNacional = roundTwo(baseCongregational * 0.1);
    const gastosOperativos = expenseFields.reduce((sum, field) => sum + toNumber(form[field]), 0);
    const posibleHonorario = totalIngresos - (totalDesignados + gastosOperativos + diezmoNacional);
    const honorarioCalculado = roundTwo(Math.max(0, posibleHonorario));
    const totalSalidas = roundTwo(totalDesignados + gastosOperativos + diezmoNacional + honorarioCalculado);
    const saldo = roundTwo(totalIngresos - totalSalidas);

    return {
      totalIngresos: roundTwo(totalIngresos),
      totalDesignados: roundTwo(totalDesignados),
      diezmoNacional,
      gastosOperativos: roundTwo(gastosOperativos),
      honorarioCalculado,
      totalSalidas,
      saldo,
    };
  }, [form]);

  const donorsTotal = useMemo(
    () => donors.reduce((sum, donor) => sum + toNumber(donor.amount), 0),
    [donors]
  );

  const addDonorRow = () => {
    setDonors((prev) => [
      ...prev,
      {
        id: donorSequence,
        firstName: '',
        lastName: '',
        document: '',
        amount: '',
      },
    ]);
    setDonorSequence((prev) => prev + 1);
  };

  const updateDonor = (id: number, field: keyof DonorRow, value: string) => {
    setDonors((prev) => prev.map((donor) => (donor.id === id ? { ...donor, [field]: value } : donor)));
  };

  const removeDonor = (id: number) => {
    setDonors((prev) => prev.filter((donor) => donor.id !== id));
  };

  const handleChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleCurrencyChange = (field: NumericField) => (rawValue: string) => {
    setForm((prev) => ({ ...prev, [field]: rawValue }));
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });

  const handleAttachmentChange = (key: AttachmentKey) =>
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target;
      const file = files?.[0];
      if (!file) {
        return;
      }

      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error('El archivo debe pesar menos de 5 MB.');
        event.target.value = '';
        return;
      }

      try {
        setIsReadingAttachment(true);
        const dataUrl = await readFileAsDataUrl(file);
        setAttachments((prev) => ({
          ...prev,
          [key]: {
            name: file.name,
            dataUrl,
          },
        }));
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
        }
      } finally {
        setIsReadingAttachment(false);
        event.target.value = '';
      }
    };

  const handleRemoveAttachment = (key: AttachmentKey) => () => {
    setAttachments((prev) => ({
      ...prev,
      [key]: undefined,
    }));
    setInputKeys((prev) => ({
      ...prev,
      [key]: prev[key] + 1,
    }));
  };

  const buildPayload = (): CreateReportPayload | null => {
    if (!form.church_id) {
      toast.error('Selecciona una iglesia.');
      return null;
    }
    if (totals.totalIngresos <= 0) {
      toast.error('Registra al menos un ingreso en el mes.');
      return null;
    }

    const numericPayload = (field: NumericField) => toNumberOrUndefined(form[field]) ?? 0;

    const payload: CreateReportPayload = {
      church_id: Number(form.church_id),
      month: Number(form.month),
      year: Number(form.year),
      diezmos: numericPayload('diezmos'),
      ofrendas: numericPayload('ofrendas'),
    };

    const numericFields: NumericField[] = [
      'otros',
      'anexos',
      'misiones',
      'lazos_amor',
      'mision_posible',
      'apy',
      'iba',
      'caballeros',
      'damas',
      'jovenes',
      'ninos',
      'energia_electrica',
      'agua',
      'recoleccion_basura',
      'servicios',
      'mantenimiento',
      'materiales',
      'otros_gastos',
      'monto_depositado',
    ];

    const optionalNumeric = numericFields.reduce<Partial<CreateReportPayload>>((acc, field) => {
      const value = toNumberOrUndefined(form[field]);
      if (typeof value === 'number') {
        (acc as Record<string, number>)[field] = value;
      }
      return acc;
    }, {});

    const optionalNumericWithComputed: Partial<CreateReportPayload> = {
      ...optionalNumeric,
      honorarios_pastoral: totals.honorarioCalculado,
      diezmo_nacional_calculado: totals.diezmoNacional,
      total_designado: totals.totalDesignados,
      total_operativo: totals.gastosOperativos,
      total_salidas_calculadas: totals.totalSalidas,
      saldo_calculado: totals.saldo,
    };

    const optionalStrings: Partial<CreateReportPayload> = {};
    if (form.numero_deposito) {
      optionalStrings.numero_deposito = form.numero_deposito;
    }
    if (form.fecha_deposito) {
      optionalStrings.fecha_deposito = form.fecha_deposito;
    }
    if (form.observaciones) {
      optionalStrings.observaciones = form.observaciones;
    }

    const attachmentEntries: NonNullable<CreateReportPayload['attachments']> = {};
    if (attachments.summary?.dataUrl) {
      attachmentEntries.summary = attachments.summary.dataUrl;
    }
    if (attachments.deposit?.dataUrl) {
      attachmentEntries.deposit = attachments.deposit.dataUrl;
    }

    const attachmentsPayload =
      Object.keys(attachmentEntries).length > 0
        ? {
            attachments: attachmentEntries,
          }
        : {};

    const donorPayload = donors
      .map((donor) => ({
        first_name: donor.firstName.trim(),
        last_name: donor.lastName.trim(),
        document: donor.document.trim(),
        amount: toNumber(donor.amount),
      }))
      .filter((donor) => donor.amount > 0 && (donor.first_name || donor.last_name || donor.document));

    return {
      ...payload,
      ...optionalNumericWithComputed,
      ...optionalStrings,
      ...attachmentsPayload,
      aportantes: donorPayload,
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const totalDiezmos = toNumber(form.diezmos);
    if (totalDiezmos > 0 && donors.length === 0) {
      toast.error('Registra al menos un aportante para los diezmos declarados.');
      return;
    }
    if (totalDiezmos > 0) {
      const diferenciaDiezmos = Math.abs(donorsTotal - totalDiezmos);
      if (diferenciaDiezmos > 1) {
        toast.error('La suma de los aportantes debe coincidir con el total de diezmos.');
        return;
      }
    }

    if (totals.saldo < 0) {
      toast.error('Las salidas superan a las entradas. Revisa los montos antes de enviar.');
      return;
    }

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    try {
      await createReport.mutateAsync({ ...payload });
      setForm(buildDefaultState());
      setAttachments({});
      setInputKeys((prev) => ({
        summary: prev.summary + 1,
        deposit: prev.deposit + 1,
      }));
      setDonors([]);
      setDonorSequence(1);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const renderNumericInput = (
    field: NumericField,
    options: { readOnly?: boolean; helperText?: string } = {}
  ) => {
    const { readOnly = false, helperText } = options;
    const fieldId = `field-${field}`;

    if (readOnly) {
      return (
        <FormField
          key={field}
          htmlFor={fieldId}
          label={fieldLabels[field]}
          {...(helperText ? { hint: helperText } : {})}
        >
          <input
            id={fieldId}
            type="text"
            value={formatCurrency(toNumber(form[field]))}
            readOnly
            disabled
            className={`${InputBaseClasses} bg-[var(--absd-subtle)]`}
          />
        </FormField>
      );
    }

    return (
      <FormField
        key={field}
        htmlFor={fieldId}
        label={fieldLabels[field]}
        {...(helperText ? { hint: helperText } : {})}
      >
        <CurrencyInput
          id={fieldId}
          value={form[field]}
          onValueChange={handleCurrencyChange(field)}
          disabled={createReport.isPending}
          className={InputBaseClasses}
          placeholder="0"
        />
      </FormField>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <FormSection
        title="Datos generales"
        description="Selecciona la iglesia y el periodo para iniciar el registro."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField htmlFor="report-church" label="Iglesia" required>
            <select
              id="report-church"
              className={InputBaseClasses}
              value={form.church_id}
              onChange={handleChange('church_id')}
              disabled={churchesLoading || createReport.isPending}
            >
              <option value="">Seleccionar iglesia…</option>
              {filteredChurches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name} — {church.city}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="report-year" label="Año" required>
            <input
              id="report-year"
              type="number"
              inputMode="numeric"
              min={2020}
              max={currentDate.getFullYear() + 1}
              value={form.year}
              onChange={handleChange('year')}
              className={InputBaseClasses}
              disabled={createReport.isPending}
            />
          </FormField>

          <FormField htmlFor="report-month" label="Mes" required>
            <select
              id="report-month"
              value={form.month}
              onChange={handleChange('month')}
              className={InputBaseClasses}
              disabled={createReport.isPending}
            >
              {monthOptions.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="deposit-date" label="Fecha de depósito">
            <input
              id="deposit-date"
              type="date"
              value={form.fecha_deposito}
              onChange={handleChange('fecha_deposito')}
              className={InputBaseClasses}
              disabled={createReport.isPending}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Entradas congregacionales"
        description="Registra los diezmos, ofrendas y otros ingresos percibidos en el mes."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {baseIncomeFields.map((field) => renderNumericInput(field))}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
            Ofrecimientos designados (100 % al fondo nacional)
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {designatedIncomeFields.map((field) => renderNumericInput(field))}
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Registro de aportantes"
        description="Detalla las personas que entregaron diezmos para respaldar los montos declarados."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[rgba(15,23,42,0.6)]">
            Registra nombre, documento y monto para cada aportante con diezmo declarado.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addDonorRow}
            disabled={createReport.isPending}
          >
            Agregar aportante
          </Button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[var(--absd-border)]">
          <table className="min-w-full divide-y divide-[var(--absd-border)] text-sm">
            <thead className="bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Nombre
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Apellido
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  RUC / Cédula
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
                  Monto diezmo
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--absd-border)]">
              {donors.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-[rgba(15,23,42,0.6)]" colSpan={5}>
                    Todavía no hay aportantes registrados para este mes.
                  </td>
                </tr>
              ) : (
                donors.map((donor) => (
                  <tr key={donor.id}>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={donor.firstName}
                        onChange={(event) => updateDonor(donor.id, 'firstName', event.target.value)}
                        placeholder="Nombre"
                        className={InputBaseClasses}
                        disabled={createReport.isPending}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={donor.lastName}
                        onChange={(event) => updateDonor(donor.id, 'lastName', event.target.value)}
                        placeholder="Apellido"
                        className={InputBaseClasses}
                        disabled={createReport.isPending}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={donor.document}
                        onChange={(event) => updateDonor(donor.id, 'document', event.target.value)}
                        placeholder="RUC o C.I."
                        className={InputBaseClasses}
                        disabled={createReport.isPending}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CurrencyInput
                        value={donor.amount}
                        onValueChange={(rawValue) => updateDonor(donor.id, 'amount', rawValue)}
                        placeholder="0"
                        className={`${InputBaseClasses} text-right`}
                        disabled={createReport.isPending}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeDonor(donor.id);
                        }}
                        disabled={createReport.isPending}
                      >
                        Quitar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-1 text-sm text-[rgba(15,23,42,0.65)] sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[rgba(15,23,42,0.55)]">
            Total registrado por aportantes este mes.
          </span>
          <span className="font-semibold text-[var(--absd-ink)]">{formatCurrency(donorsTotal)}</span>
        </div>
      </FormSection>

      <FormSection
        title="Resumen del mes"
        description="Estos totales se recalculan automáticamente según los datos ingresados."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryItem label="Total ingresos" value={formatCurrency(totals.totalIngresos)} />
          <SummaryItem label="Fondo general (10 %)" value={formatCurrency(totals.diezmoNacional)} />
          <SummaryItem label="Fondos designados" value={formatCurrency(totals.totalDesignados)} />
          <SummaryItem label="Gastos operativos" value={formatCurrency(totals.gastosOperativos)} />
          <SummaryItem label="Honorario pastoral" value={formatCurrency(totals.honorarioCalculado)} />
          <SummaryItem label="Salidas totales" value={formatCurrency(totals.totalSalidas)} />
          <SummaryItem
            label="Saldo final"
            value={formatCurrency(totals.saldo)}
            tone={totals.saldo < 0 ? 'critical' : 'success'}
          />
        </div>
      </FormSection>

      <FormSection
        title="Salidas operativas y referencias bancarias"
        description="Completa los egresos del mes y los datos del depósito."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {expenseFields.map((field) => renderNumericInput(field))}
          {renderNumericInput('monto_depositado', {
            helperText: 'Monto que figura en el comprobante depositado.',
          })}
        </div>
        <FormField htmlFor="observaciones" label="Observaciones">
          <textarea
            id="observaciones"
            value={form.observaciones}
            onChange={handleChange('observaciones')}
            rows={3}
            placeholder="Notas internas, aclaraciones o incidencias del mes"
            className={`${InputBaseClasses} min-h-[120px]`}
            disabled={createReport.isPending}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Adjuntos opcionales"
        description="Agrega evidencias del informe y del depósito. Se admiten imágenes o PDF de hasta 5 MB."
        badge={
          isReadingAttachment && (
            <span className="absd-pill" data-tone="info">
              Procesando archivo…
            </span>
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {([
            {
              key: 'summary' as AttachmentKey,
              label: 'Resumen del informe (foto o PDF)',
              description: 'Cartilla o formulario firmado por la iglesia.',
            },
            {
              key: 'deposit' as AttachmentKey,
              label: 'Comprobante de depósito',
              description: 'Imagen del comprobante bancario.',
            },
          ]).map(({ key, label, description }) => {
            const attachment = attachments[key];
            return (
              <div key={key} className="space-y-2">
                <FormField
                  htmlFor={`attachment-${key}`}
                  label={label}
                  {...(description ? { hint: description } : {})}
                >
                  <input
                    id={`attachment-${key}`}
                    key={`${key}-${inputKeys[key]}`}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleAttachmentChange(key)}
                    className={InputBaseClasses}
                    disabled={createReport.isPending || isReadingAttachment}
                  />
                </FormField>
                {attachment ? (
                  <div className="flex items-center justify-between rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-xs text-[rgba(15,23,42,0.65)]">
                    <span className="truncate" title={attachment.name}>
                      {attachment.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAttachment(key)}
                      disabled={createReport.isPending || isReadingAttachment}
                    >
                      Quitar
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--absd-border)] bg-[var(--absd-subtle)] px-3 py-2 text-xs text-[rgba(15,23,42,0.55)]">
                    Sin archivo adjunto
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </FormSection>

      <footer className="flex flex-col gap-3 border-t border-[var(--absd-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[rgba(15,23,42,0.65)]">
          Los totales y el 10 % del fondo nacional se calculan automáticamente al guardar el informe.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setForm(buildDefaultState());
              setAttachments({});
              setInputKeys((prev) => ({
                summary: prev.summary + 1,
                deposit: prev.deposit + 1,
              }));
              setDonors([]);
              setDonorSequence(1);
            }}
            disabled={createReport.isPending || isReadingAttachment}
          >
            Limpiar formulario
          </Button>
          <Button
            type="submit"
            loading={createReport.isPending || isReadingAttachment}
            disabled={isReadingAttachment}
          >
            Guardar informe
          </Button>
        </div>
      </footer>
    </form>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'critical';
};

function SummaryItem({ label, value, tone = 'default' }: SummaryItemProps) {
  const toneClasses = tone === 'critical'
    ? 'text-[var(--absd-error)]'
    : tone === 'success'
    ? 'text-[var(--absd-success)]'
    : 'text-[var(--absd-ink)]';
  return (
    <div className="rounded-2xl bg-[var(--absd-subtle)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${toneClasses}`}>{value}</p>
    </div>
  );
}
