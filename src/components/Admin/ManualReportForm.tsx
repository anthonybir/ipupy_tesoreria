'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type JSX } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FormField, FormSection, SectionCard } from '@/components/Shared';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrencyDisplay, rawValueToNumber } from '@/lib/utils/currency';
interface Church {
  id: number;
  name: string;
  city: string;
  pastor?: string;
}

interface ManualReportFormProps {
  churches: Church[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MANUAL_SOURCES = [
  { value: 'paper', label: 'Informe en papel' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Llamada telefónica' },
  { value: 'in_person', label: 'En persona' },
  { value: 'other', label: 'Otro' },
] as const;

const formatCurrency = (value: number) => formatCurrencyDisplay(value);
const blankDonor = (id: number) => ({
  id,
  firstName: '',
  lastName: '',
  document: '',
  amount: '',
});

type DonorRow = ReturnType<typeof blankDonor>;

type DonorPayload = {
  first_name: string;
  last_name: string;
  document: string;
  amount: number;
};
const congregationalFields = [
  { key: 'diezmos', label: 'Diezmos' },
  { key: 'ofrendas', label: 'Ofrendas' },
  { key: 'anexos', label: 'Anexos' },
  { key: 'otros', label: 'Otros ingresos' },
] as const;

const designatedFields = [
  { key: 'misiones', label: 'Misiones' },
  { key: 'lazos_amor', label: 'Lazos de Amor' },
  { key: 'mision_posible', label: 'Misión Posible' },
  { key: 'apy', label: 'APY' },
  { key: 'iba', label: 'IBA' },
  { key: 'caballeros', label: 'Caballeros' },
  { key: 'damas', label: 'Damas' },
  { key: 'jovenes', label: 'Jóvenes' },
  { key: 'ninos', label: 'Niños' },
] as const;

const expenseFields = [
  { key: 'servicios', label: 'Servicios' },
  { key: 'energia_electrica', label: 'Energía eléctrica' },
  { key: 'agua', label: 'Agua' },
  { key: 'recoleccion_basura', label: 'Recolección de basura' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'materiales', label: 'Materiales' },
  { key: 'otros_gastos', label: 'Otros gastos' },
] as const;

const statsFields = [
  { key: 'asistencia_visitas', label: 'Asistencia / Visitas' },
  { key: 'bautismos_agua', label: 'Bautismos en agua' },
  { key: 'bautismos_espiritu', label: 'Bautismos del Espíritu' },
] as const;
export default function ManualReportForm({ churches, onSuccess, onCancel }: ManualReportFormProps): JSX.Element {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState(() => ({
    church_id: '',
    month: currentMonth,
    year: currentYear,
    diezmos: 0,
    ofrendas: 0,
    anexos: 0,
    otros: 0,
    misiones: 0,
    lazos_amor: 0,
    mision_posible: 0,
    apy: 0,
    iba: 0,
    caballeros: 0,
    damas: 0,
    jovenes: 0,
    ninos: 0,
    servicios: 0,
    energia_electrica: 0,
    agua: 0,
    recoleccion_basura: 0,
    mantenimiento: 0,
    materiales: 0,
    otros_gastos: 0,
    numero_deposito: '',
    fecha_deposito: '',
    manual_report_source: 'paper',
    manual_report_notes: '',
    observaciones: '',
    asistencia_visitas: 0,
    bautismos_agua: 0,
    bautismos_espiritu: 0,
  }));
  const [totals, setTotals] = useState({
    totalEntradas: 0,
    fondoNacional: 0,
    totalDesignados: 0,
    gastosOperativos: 0,
    honorariosPastoral: 0,
    totalSalidas: 0,
    saldoMes: 0,
  });
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [donorSequence, setDonorSequence] = useState(1);
  useEffect(() => {
    const congregacional = formData.diezmos + formData.ofrendas + formData.anexos + formData.otros;
    const designados =
      formData.misiones +
      formData.lazos_amor +
      formData.mision_posible +
      formData.apy +
      formData.iba +
      formData.caballeros +
      formData.damas +
      formData.jovenes +
      formData.ninos;
    const gastos =
      formData.servicios +
      formData.energia_electrica +
      formData.agua +
      formData.recoleccion_basura +
      formData.mantenimiento +
      formData.materiales +
      formData.otros_gastos;

    const totalEntradas = congregacional + designados;
    const fondoNacional = Math.round((formData.diezmos + formData.ofrendas) * 0.1);
    const honorariosPastoral = Math.max(0, totalEntradas - (designados + gastos + fondoNacional));
    const totalSalidas = designados + gastos + fondoNacional + honorariosPastoral;

    setTotals({
      totalEntradas,
      fondoNacional,
      totalDesignados: designados,
      gastosOperativos: gastos,
      honorariosPastoral,
      totalSalidas,
      saldoMes: totalEntradas - totalSalidas,
    });
  }, [formData]);
  const donorsTotal = useMemo(
    () => donors.reduce((sum, donor) => sum + rawValueToNumber(donor.amount), 0),
    [donors],
  );

  const donorsDifference = useMemo(
    () => Math.abs(donorsTotal - formData.diezmos),
    [donorsTotal, formData.diezmos],
  );
  const addDonor = () => {
    setDonors((prev) => [...prev, blankDonor(donorSequence)]);
    setDonorSequence((prev) => prev + 1);
  };

  const removeDonor = (id: number) => {
    setDonors((prev) => prev.filter((donor) => donor.id !== id));
  };

  const handleDonorChange = (id: number, field: keyof DonorRow) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setDonors((prev) =>
      prev.map((donor) => (donor.id === id ? { ...donor, [field]: value } : donor)),
    );
  };

  const handleDonorAmountChange = (id: number) => (rawValue: string) => {
    setDonors((prev) =>
      prev.map((donor) => (donor.id === id ? { ...donor, amount: rawValue } : donor)),
    );
  };
  const handleNumberChange = (field: keyof typeof formData) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(event.target.value);
    setFormData((prev) => ({
      ...prev,
      [field]: Number.isFinite(value) ? value : 0,
    }));
  };

  const handleCurrencyFieldChange = (field: keyof typeof formData) => (rawValue: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: rawValueToNumber(rawValue),
    }));
  };

  const handleSelectChange = (field: keyof typeof formData) => (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'month' || field === 'year' ? Number.parseInt(value, 10) || prev[field] : value,
    }));
  };

  const handleTextChange = (field: keyof typeof formData) => (event: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleTextareaChange = (field: keyof typeof formData) => (event: ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };
  useEffect(() => {
    if (formData.diezmos > 0 && donors.length === 0) {
      setDonors([blankDonor(donorSequence)]);
      setDonorSequence((prev) => prev + 1);
    }
  }, [donorSequence, donors.length, formData.diezmos]);
  const createReport = useMutation({
    mutationFn: async (payload: typeof formData & { aportantes: DonorPayload[] }) => {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          submission_source: 'pastor_manual',
          estado: 'pendiente_admin',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'No se pudo crear el informe');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      onSuccess?.();
    },
  });
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.church_id) {
      alert('Por favor selecciona una iglesia');
      return;
    }

    const donorsWithAmount =
      formData.diezmos > 0 ? donors.filter((donor) => rawValueToNumber(donor.amount) > 0) : [];

    if (formData.diezmos > 0) {
      if (donorsWithAmount.length === 0) {
        alert('Registra al menos un aportante con monto mayor a cero.');
        return;
      }
      const missingIdentity = donorsWithAmount.some((donor) => {
        const first = donor.firstName.trim();
        const last = donor.lastName.trim();
        const doc = donor.document.trim();
        return !first && !last && !doc;
      });
      if (missingIdentity) {
        alert('Completa nombre, apellido o documento para cada aportante con diezmo.');
        return;
      }
      if (Math.abs(donorsTotal - formData.diezmos) > 1) {
        alert('La suma de aportantes debe coincidir con el total de diezmos.');
        return;
      }
    }

    const donorPayload: DonorPayload[] = donorsWithAmount.map((donor) => ({
      first_name: donor.firstName.trim(),
      last_name: donor.lastName.trim(),
      document: donor.document.trim(),
      amount: rawValueToNumber(donor.amount),
    }));

    await createReport.mutateAsync({
      ...formData,
      aportantes: donorPayload,
    });
  };
  const selectClassName =
    'rounded-xl border border-[var(--absd-border)] bg-[var(--absd-surface)] px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection
        title="Información del informe"
        description="Completa los datos básicos antes de cargar montos."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <FormField htmlFor="manual-church" label="Iglesia" required>
            <select
              id="manual-church"
              value={formData.church_id}
              onChange={handleSelectChange('church_id')}
              className={selectClassName}
              required
            >
              <option value="">Seleccionar iglesia...</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name} — {church.city}
                  {church.pastor ? ` (${church.pastor})` : ''}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="manual-month" label="Mes" required>
            <select
              id="manual-month"
              value={formData.month}
              onChange={handleSelectChange('month')}
              className={selectClassName}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2024, month - 1).toLocaleDateString('es', { month: 'long' })}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="manual-year" label="Año" required>
            <select
              id="manual-year"
              value={formData.year}
              onChange={handleSelectChange('year')}
              className={selectClassName}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField htmlFor="manual-source" label="Fuente del informe" required>
            <select
              id="manual-source"
              value={formData.manual_report_source}
              onChange={handleSelectChange('manual_report_source')}
              className={selectClassName}
            >
              {MANUAL_SOURCES.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            htmlFor="manual-notes"
            label="Notas sobre la recepción"
            hint="Ej: Pastor Juan entregó en persona"
          >
            <Input
              id="manual-notes"
              value={formData.manual_report_notes}
              onChange={handleTextChange('manual_report_notes')}
              placeholder="Detalles sobre cómo se recibió el informe"
            />
          </FormField>
        </div>
      </FormSection>
      <FormSection
        title="Ingresos congregacionales"
        description="Registra los montos reportados por la congregación."
      >
        <div className="grid gap-4 md:grid-cols-4">
          {congregationalFields.map(({ key, label }) => (
            <FormField key={key} htmlFor={`income-${key}`} label={label}>
              <CurrencyInput
                id={`income-${key}`}
                value={String(formData[key])}
                onValueChange={handleCurrencyFieldChange(key)}
                placeholder="0"
              />
            </FormField>
          ))}
        </div>
      </FormSection>
      <FormSection
        title="Ofrendas designadas"
        description="Distribuciones nacionales que requieren registro individual."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {designatedFields.map(({ key, label }) => (
            <FormField key={key} htmlFor={`designated-${key}`} label={label}>
              <CurrencyInput
                id={`designated-${key}`}
                value={String(formData[key])}
                onValueChange={handleCurrencyFieldChange(key)}
                placeholder="0"
              />
            </FormField>
          ))}
        </div>
      </FormSection>
      <FormSection
        title="Gastos operativos"
        description="Detalla los gastos mensuales cubiertos por la congregación."
      >
        <div className="grid gap-4 md:grid-cols-4">
          {expenseFields.map(({ key, label }) => (
            <FormField key={key} htmlFor={`expense-${key}`} label={label}>
              <CurrencyInput
                id={`expense-${key}`}
                value={String(formData[key])}
                onValueChange={handleCurrencyFieldChange(key)}
                placeholder="0"
              />
            </FormField>
          ))}
        </div>
      </FormSection>
      <SectionCard
        title="Detalle de aportantes de diezmo"
        description="Cuando existan diezmos declarados, registra a cada aportante para sostener la trazabilidad."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            density="compact"
            onClick={addDonor}
          >
            Agregar aportante
          </Button>
        }
      >
        {donors.length === 0 ? (
          <p className="text-sm text-[rgba(15,23,42,0.65)]">
            No hay aportantes cargados. Agrega al menos uno si existen diezmos en el informe.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-[var(--absd-border)]">
              <table className="min-w-full divide-y divide-[var(--absd-border)] text-sm">
                <thead className="bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                      Apellido
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                      Documento
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--absd-border)] bg-[var(--absd-surface)]">
                  {donors.map((donor) => (
                    <tr key={donor.id}>
                      <td className="px-4 py-3">
                        <Input
                          value={donor.firstName}
                          onChange={handleDonorChange(donor.id, 'firstName')}
                          placeholder="Nombre"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={donor.lastName}
                          onChange={handleDonorChange(donor.id, 'lastName')}
                          placeholder="Apellido"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={donor.document}
                          onChange={handleDonorChange(donor.id, 'document')}
                          placeholder="RUC / C.I."
                        />
                      </td>
                      <td className="px-4 py-3">
                        <CurrencyInput
                          value={donor.amount}
                          onValueChange={handleDonorAmountChange(donor.id)}
                          placeholder="0"
                          className="text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          density="compact"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeDonor(donor.id);
                          }}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-[var(--absd-ink)]">
                Total aportantes: {formatCurrency(donorsTotal)}
              </span>
              <span
                className={
                  donorsDifference === 0
                    ? 'font-semibold text-[var(--absd-success)]'
                    : 'font-semibold text-[var(--absd-error)]'
                }
              >
                Diferencia vs diezmos declarados: {formatCurrency(donorsTotal - formData.diezmos)}
              </span>
            </div>
          </div>
        )}
      </SectionCard>
      <FormSection
        title="Información del depósito"
        description="Completa los datos bancarios cuando exista comprobante."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField htmlFor="manual-deposit-number" label="Número de depósito">
            <Input
              id="manual-deposit-number"
              value={formData.numero_deposito}
              onChange={handleTextChange('numero_deposito')}
              placeholder="Número del comprobante"
            />
          </FormField>
          <FormField htmlFor="manual-deposit-date" label="Fecha de depósito">
            <Input
              id="manual-deposit-date"
              type="date"
              value={formData.fecha_deposito}
              onChange={handleTextChange('fecha_deposito')}
            />
          </FormField>
        </div>
      </FormSection>
      <FormSection
        title="Estadísticas congregacionales"
        description="Datos pastorales adicionales para seguimiento nacional."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {statsFields.map(({ key, label }) => (
            <FormField key={key} htmlFor={`stat-${key}`} label={label}>
              <Input
                id={`stat-${key}`}
                type="number"
                min={0}
                value={formData[key] as number}
                onChange={handleNumberChange(key)}
              />
            </FormField>
          ))}
        </div>
        <FormField htmlFor="manual-observaciones" label="Observaciones">
          <Textarea
            id="manual-observaciones"
            rows={3}
            value={formData.observaciones}
            onChange={handleTextareaChange('observaciones')}
            placeholder="Notas adicionales sobre el informe"
          />
        </FormField>
      </FormSection>
      <SectionCard
        title="Resumen calculado"
        description="Estos valores se actualizan automáticamente con los montos ingresados."
      >
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Total entradas',
              value: formatCurrency(totals.totalEntradas),
              toneClass: 'text-[var(--absd-ink)]',
            },
            {
              label: 'Fondo nacional (10%)',
              value: formatCurrency(totals.fondoNacional),
              toneClass: 'text-[var(--absd-ink)]',
            },
            {
              label: 'Honorarios pastoral',
              value: formatCurrency(totals.honorariosPastoral),
              toneClass: 'text-[var(--absd-ink)]',
            },
            {
              label: 'Saldo del mes',
              value: formatCurrency(totals.saldoMes),
              toneClass:
                totals.saldoMes >= 0 ? 'text-[var(--absd-success)]' : 'text-[var(--absd-error)]',
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-[var(--absd-border)] bg-[var(--absd-surface)] px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                {metric.label}
              </p>
              <p className={`text-lg font-semibold ${metric.toneClass}`}>{metric.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="md"
          density="compact"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          density="compact"
          loading={createReport.isPending}
        >
          {createReport.isPending ? 'Creando…' : 'Crear informe manual'}
        </Button>
      </div>

      {createReport.isError && (
        <Alert variant="danger">
          <AlertTitle>Error al crear el informe</AlertTitle>
          <AlertDescription>{(createReport.error as Error).message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
