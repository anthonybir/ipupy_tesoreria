'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useCreateReport } from '@/hooks/useReportMutations';
import { useChurches } from '@/hooks/useChurches';
import type { CreateReportPayload } from '@/hooks/useReportMutations';

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
  monto_depositado: ''
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
  'Diciembre'
];

const currencyFormatter = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0
});

const designatedIncomeFields: NumericField[] = [
  'misiones',
  'lazos_amor',
  'mision_posible',
  'apy',
  'iba',
  'caballeros',
  'damas',
  'jovenes',
  'ninos'
];

const baseIncomeFields: NumericField[] = ['diezmos', 'ofrendas', 'otros', 'anexos'];

const expenseFields: NumericField[] = [
  'energia_electrica',
  'agua',
  'recoleccion_basura',
  'servicios',
  'mantenimiento',
  'materiales',
  'otros_gastos'
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
  monto_depositado: 'Monto depositado'
};

const toNumberOrUndefined = (value: string): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toNumber = (value: string): number => toNumberOrUndefined(value) ?? 0;

const roundTwo = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const formatCurrency = (value: number): string => currencyFormatter.format(roundTwo(value));

export function ReportForm() {
  const currentDate = new Date();
  const buildDefaultState = (): FormState => ({
    church_id: '',
    month: String(currentDate.getMonth() + 1),
    year: String(currentDate.getFullYear()),
    numero_deposito: '',
    fecha_deposito: '',
    observaciones: '',
    ...initialNumericState
  });

  const [form, setForm] = useState<FormState>(() => buildDefaultState());
  const [attachments, setAttachments] = useState<AttachmentState>({});
  const [inputKeys, setInputKeys] = useState<Record<AttachmentKey, number>>({
    summary: 0,
    deposit: 0
  });
  const [isReadingAttachment, setIsReadingAttachment] = useState(false);
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [donorSequence, setDonorSequence] = useState(1);
  const createReport = useCreateReport();
  const { data: churches = [], isLoading: churchesLoading } = useChurches();

  const filteredChurches = useMemo(
    () => [...churches].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [churches]
  );

  const totals = useMemo<ComputedTotals>(() => {
    const totalIngresos = [...baseIncomeFields, ...designatedIncomeFields].reduce((sum, field) => sum + toNumber(form[field]), 0);
    const totalDesignados = designatedIncomeFields.reduce((sum, field) => sum + toNumber(form[field]), 0);
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
      saldo
    };
  }, [form]);

  const donorsTotal = useMemo(() => donors.reduce((sum, donor) => sum + toNumber(donor.amount), 0), [donors]);

  const addDonorRow = () => {
    setDonors((prev) => [
      ...prev,
      {
        id: donorSequence,
        firstName: '',
        lastName: '',
        document: '',
        amount: ''
      }
    ]);
    setDonorSequence((prev) => prev + 1);
  };

  const updateDonor = (id: number, field: keyof DonorRow, value: string) => {
    setDonors((prev) =>
      prev.map((donor) => (donor.id === id ? { ...donor, [field]: value } : donor))
    );
  };

  const removeDonor = (id: number) => {
    setDonors((prev) => prev.filter((donor) => donor.id !== id));
  };

  const renderNumericInput = (
    field: NumericField,
    options: { readOnly?: boolean; valueOverride?: string; helperText?: string } = {}
  ) => {
    const { readOnly = false, valueOverride, helperText } = options;
    const commonProps = {
      id: `field-${field}`,
      inputMode: 'decimal' as const,
      className:
        'rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200',
      placeholder: '0',
      disabled: createReport.isPending
    };

    return (
      <div key={field} className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`field-${field}`}>
          {fieldLabels[field] ?? field.replace('_', ' ')}
        </label>
        {readOnly ? (
          <input
            {...commonProps}
            value={valueOverride ?? ''}
            readOnly
            disabled
          />
        ) : (
          <input
            {...commonProps}
            value={form[field]}
            onChange={handleNumericChange(field)}
          />
        )}
        {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
      </div>
    );
  };

  const handleDonorField = (id: number, field: keyof DonorRow) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (field === 'amount') {
        if (value === '' || /^\d*(?:[\.,]\d{0,2})?$/.test(value)) {
          updateDonor(id, field, value);
        }
        return;
      }
      updateDonor(id, field, value);
    };

  const handleChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleNumericChange = (field: NumericField) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (value === '' || /^\d*(?:[\.,]\d{0,2})?$/.test(value)) {
        setForm((prev) => ({ ...prev, [field]: value }));
      }
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
            dataUrl
          }
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
      [key]: undefined
    }));
    setInputKeys((prev) => ({
      ...prev,
      [key]: prev[key] + 1
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
      ofrendas: numericPayload('ofrendas')
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
      'monto_depositado'
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
      saldo_calculado: totals.saldo
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

    const attachmentsPayload =
      attachments.summary?.dataUrl || attachments.deposit?.dataUrl
        ? {
            attachments: {
              summary: attachments.summary?.dataUrl,
              deposit: attachments.deposit?.dataUrl
            }
          }
        : {};

    const donorPayload = donors
      .map((donor) => ({
        first_name: donor.firstName.trim(),
        last_name: donor.lastName.trim(),
        document: donor.document.trim(),
        amount: toNumber(donor.amount)
      }))
      .filter((donor) => donor.amount > 0 && (donor.first_name || donor.last_name || donor.document));

    return {
      ...payload,
      ...optionalNumericWithComputed,
      ...optionalStrings,
      ...attachmentsPayload,
      aportantes: donorPayload
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
        deposit: prev.deposit + 1
      }));
      setDonors([]);
      setDonorSequence(1);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.06]">
      <header className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/60 px-6 py-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevo informe</span>
        <h2 className="text-xl font-semibold text-slate-900">Registrar reporte mensual</h2>
        <p className="text-sm text-slate-600">
          Captura los ingresos del mes, adjunta la información bancaria y deja observaciones relevantes. Los totales se calcularán automáticamente en el backend.
        </p>
      </header>

      <form className="space-y-8 px-6 py-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="report-church">
              Iglesia
            </label>
            <select
              id="report-church"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="report-year">
              Año
            </label>
            <input
              id="report-year"
              type="number"
              inputMode="numeric"
              min={2020}
              max={currentDate.getFullYear() + 1}
              value={form.year}
              onChange={handleChange('year')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={createReport.isPending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="report-month">
              Mes
            </label>
            <select
              id="report-month"
              value={form.month}
              onChange={handleChange('month')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={createReport.isPending}
            >
              {monthOptions.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="deposit-date">
              Fecha de depósito
            </label>
            <input
              id="deposit-date"
              type="date"
              value={form.fecha_deposito}
              onChange={handleChange('fecha_deposito')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={createReport.isPending}
            />
          </div>
        </div>

        <section className="space-y-6 rounded-2xl bg-slate-50/60 p-6">
          <header>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Entradas congregacionales
            </h3>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...baseIncomeFields].map((field) => renderNumericInput(field))}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ofrecimientos designados (100 % al fondo nacional)
            </h4>
            <p className="text-xs text-slate-500">
              Estos montos se registran como ingreso de la iglesia y se descargan inmediatamente en las salidas del mes.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {designatedIncomeFields.map((field) => renderNumericInput(field))}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Registro de aportantes
              </h3>
              <p className="text-xs text-slate-500">
                Carga cada persona que entregó diezmos. Se solicitará nombre, apellido y RUC o cédula.
              </p>
            </div>
            <button
              type="button"
              onClick={addDonorRow}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
              disabled={createReport.isPending}
            >
              Agregar aportante
            </button>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Nombre</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Apellido</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">RUC / Cédula</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Monto diezmo</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donors.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-sm text-slate-500" colSpan={5}>
                      Todavía no hay aportantes registrados para este mes.
                    </td>
                  </tr>
                ) : (
                  donors.map((donor) => (
                    <tr key={donor.id} className="bg-white">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={donor.firstName}
                          onChange={handleDonorField(donor.id, 'firstName')}
                          placeholder="Nombre"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          disabled={createReport.isPending}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={donor.lastName}
                          onChange={handleDonorField(donor.id, 'lastName')}
                          placeholder="Apellido"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          disabled={createReport.isPending}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={donor.document}
                          onChange={handleDonorField(donor.id, 'document')}
                          placeholder="RUC o C.I."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          disabled={createReport.isPending}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={donor.amount}
                          onChange={handleDonorField(donor.id, 'amount')}
                          placeholder="0"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          disabled={createReport.isPending}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeDonor(donor.id)}
                          className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                          disabled={createReport.isPending}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <span className="text-xs text-slate-500">
              Total aportado por los donantes registrados este mes.
            </span>
            <span className="font-semibold">{formatCurrency(donorsTotal)}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Resumen del mes</h3>
          </header>
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl bg-slate-50/80 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total ingresos</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(totals.totalIngresos)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fondo general (10 %)</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(totals.diezmoNacional)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fondos designados</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(totals.totalDesignados)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gastos operativos</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(totals.gastosOperativos)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Honorario pastoral</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(totals.honorarioCalculado)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salidas totales</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(totals.totalSalidas)}</dd>
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo final del mes</dt>
              <dd className={`text-lg font-semibold ${totals.saldo < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatCurrency(totals.saldo)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-6 rounded-2xl bg-white p-6 shadow-inner shadow-slate-900/[0.04]">
          <header>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Salidas operativas y referencias bancarias
            </h3>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {expenseFields.map((field) => renderNumericInput(field))}
            {renderNumericInput('monto_depositado')}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="field-fondo-general">
                Aporte fondo general (10 %)
              </label>
              <input
                id="field-fondo-general"
                value={formatCurrency(totals.diezmoNacional)}
                readOnly
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              />
              <p className="text-xs text-slate-500">Se descuenta automáticamente de Diezmos + Ofrendas.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="field-honorario-auto">
                Honorarios pastorales (automático)
              </label>
              <input
                id="field-honorario-auto"
                value={formatCurrency(totals.honorarioCalculado)}
                readOnly
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              />
              <p className="text-xs text-slate-500">
                Diferencia entre ingresos y salidas (diezmo nacional + fondos designados + gastos operativos).
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="observaciones">
              Observaciones
            </label>
            <textarea
              id="observaciones"
              value={form.observaciones}
              onChange={handleChange('observaciones')}
              rows={3}
              placeholder="Notas internas, aclaraciones o incidencias del mes"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={createReport.isPending}
            />
          </div>
        </section>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6">
          <header className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Adjuntos opcionales</h3>
              <p className="text-xs text-slate-500">Agrega evidencias del informe y del depósito. Se admiten imágenes o PDF de hasta 5 MB.</p>
            </div>
            {isReadingAttachment && (
              <span className="text-xs font-semibold text-indigo-600">Procesando archivo…</span>
            )}
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            {([
              {
                key: 'summary' as AttachmentKey,
                label: 'Resumen del informe (foto o PDF)',
                description: 'Cartilla o formulario firmado por la iglesia.'
              },
              {
                key: 'deposit' as AttachmentKey,
                label: 'Comprobante de depósito',
                description: 'Imagen del comprobante bancario.'
              }
            ]).map(({ key, label, description }) => {
              const attachment = attachments[key];
              return (
                <div key={key} className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`attachment-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`attachment-${key}`}
                    key={`${key}-${inputKeys[key]}`}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleAttachmentChange(key)}
                    className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    disabled={createReport.isPending || isReadingAttachment}
                  />
                  <p className="text-xs text-slate-500">{description}</p>
                  {attachment ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <span className="truncate" title={attachment.name}>{attachment.name}</span>
                      <button
                        type="button"
                        className="text-rose-600 hover:text-rose-500"
                        onClick={handleRemoveAttachment(key)}
                        disabled={createReport.isPending || isReadingAttachment}
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      Sin archivo adjunto
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Los totales y el 10% del fondo nacional se calculan automáticamente al guardar el informe.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setForm(buildDefaultState());
                setAttachments({});
                setInputKeys((prev) => ({
                  summary: prev.summary + 1,
                  deposit: prev.deposit + 1
                }));
                setDonors([]);
                setDonorSequence(1);
              }}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              disabled={createReport.isPending || isReadingAttachment}
            >
              Limpiar formulario
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createReport.isPending || isReadingAttachment}
            >
              {createReport.isPending ? 'Guardando…' : 'Guardar informe'}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
