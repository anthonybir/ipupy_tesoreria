'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useCreateReport } from '@/hooks/useReportMutations';
import { useChurches } from '@/hooks/useChurches';
import type { CreateReportPayload } from '@/hooks/useReportMutations';

const initialNumericState = {
  diezmos: '',
  ofrendas: '',
  anexos: '',
  caballeros: '',
  damas: '',
  jovenes: '',
  ninos: '',
  otros: '',
  honorarios_pastoral: '',
  servicios: '',
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

const toNumberOrUndefined = (value: string): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

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
  const createReport = useCreateReport();
  const { data: churches = [], isLoading: churchesLoading } = useChurches();

  const filteredChurches = useMemo(
    () => [...churches].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [churches]
  );

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
    if (!form.diezmos && !form.ofrendas) {
      toast.error('Registra al menos diezmós u ofrendas.');
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

    const numericFields: NumericField[] = ['anexos', 'caballeros', 'damas', 'jovenes', 'ninos', 'otros', 'honorarios_pastoral', 'servicios', 'monto_depositado'];

    const optionalNumeric = numericFields.reduce<Partial<CreateReportPayload>>((acc, field) => {
      const value = toNumberOrUndefined(form[field]);
      if (typeof value === 'number') {
        (acc as Record<string, number>)[field] = value;
      }
      return acc;
    }, {});

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

    return {
      ...payload,
      ...optionalNumeric,
      ...optionalStrings,
      ...attachmentsPayload
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

        <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50/60 p-6 md:grid-cols-3">
          <header className="md:col-span-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Entradas congregacionales
            </h3>
          </header>

          {(['diezmos', 'ofrendas', 'anexos', 'caballeros', 'damas', 'jovenes', 'ninos', 'otros'] as NumericField[]).map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`field-${field}`}>
                {field.replace('_', ' ')}
              </label>
              <input
                id={`field-${field}`}
                type="text"
                inputMode="decimal"
                value={form[field]}
                onChange={handleNumericChange(field)}
                placeholder="0"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                disabled={createReport.isPending}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-6 shadow-inner shadow-slate-900/[0.04] md:grid-cols-3">
          <header className="md:col-span-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Salidas y referencias bancarias
            </h3>
          </header>

          {(['honorarios_pastoral', 'servicios', 'monto_depositado'] as NumericField[]).map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`field-${field}`}>
                {field.replace('_', ' ')}
              </label>
              <input
                id={`field-${field}`}
                type="text"
                inputMode="decimal"
                value={form[field]}
                onChange={handleNumericChange(field)}
                placeholder="0"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                disabled={createReport.isPending}
              />
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="deposit-number">
              Nº de depósito / comprobante
            </label>
            <input
              id="deposit-number"
              type="text"
              value={form.numero_deposito}
              onChange={handleChange('numero_deposito')}
              placeholder="000123456"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={createReport.isPending}
            />
          </div>

          <div className="md:col-span-3 flex flex-col gap-2">
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
        </div>

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
