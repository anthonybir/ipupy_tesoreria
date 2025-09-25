'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  { value: 'other', label: 'Otro' }
];

const blankDonor = (id: number) => ({
  id,
  firstName: '',
  lastName: '',
  document: '',
  amount: ''
});

type DonorRow = ReturnType<typeof blankDonor>;

type DonorPayload = {
  first_name: string;
  last_name: string;
  document: string;
  amount: number;
};

const amountPattern = /^\d*(?:[\.,]\d{0,2})?$/;

const parseAmount = (value: string) => {
  if (!value) return 0;
  const normalized = value.replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ManualReportForm({ churches, onSuccess, onCancel }: ManualReportFormProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState({
    church_id: '',
    month: currentMonth,
    year: currentYear,
    // Financial fields
    diezmos: 0,
    ofrendas: 0,
    anexos: 0,
    otros: 0,
    // Designated offerings
    misiones: 0,
    lazos_amor: 0,
    mision_posible: 0,
    apy: 0,
    iba: 0,
    caballeros: 0,
    damas: 0,
    jovenes: 0,
    ninos: 0,
    // Expenses
    servicios: 0,
    energia_electrica: 0,
    agua: 0,
    recoleccion_basura: 0,
    mantenimiento: 0,
    materiales: 0,
    otros_gastos: 0,
    // Bank deposit info
    numero_deposito: '',
    fecha_deposito: '',
    // Manual report tracking
    manual_report_source: 'paper',
    manual_report_notes: '',
    observaciones: '',
    // Baptisms and attendance
    asistencia_visitas: 0,
    bautismos_agua: 0,
    bautismos_espiritu: 0
  });

  const [totals, setTotals] = useState({
    totalEntradas: 0,
    fondoNacional: 0,
    totalDesignados: 0,
    gastosOperativos: 0,
    honorariosPastoral: 0,
    totalSalidas: 0,
    saldoMes: 0
  });
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [donorSequence, setDonorSequence] = useState(1);

  // Calculate totals whenever form data changes
  useEffect(() => {
    const congregacional = formData.diezmos + formData.ofrendas;
    const designados =
      formData.misiones + formData.lazos_amor + formData.mision_posible +
      formData.apy + formData.iba + formData.caballeros + formData.damas +
      formData.jovenes + formData.ninos;
    const gastos =
      formData.servicios + formData.energia_electrica + formData.agua +
      formData.recoleccion_basura + formData.mantenimiento +
      formData.materiales + formData.otros_gastos;

    const totalIn = congregacional + formData.anexos + formData.otros + designados;
    const fondoNac = Math.round(congregacional * 0.1);
    const honorarios = Math.max(0, totalIn - (designados + gastos + fondoNac));
    const totalOut = designados + gastos + fondoNac + honorarios;

    setTotals({
      totalEntradas: totalIn,
      fondoNacional: fondoNac,
      totalDesignados: designados,
      gastosOperativos: gastos,
      honorariosPastoral: honorarios,
      totalSalidas: totalOut,
      saldoMes: totalIn - totalOut
    });
  }, [formData]);

  const donorsTotal = useMemo(
    () => donors.reduce((sum, donor) => sum + parseAmount(donor.amount), 0),
    [donors]
  );
  const donorsDifference = useMemo(
    () => Math.abs(donorsTotal - formData.diezmos),
    [donorsTotal, formData.diezmos]
  );

  const createReport = useMutation({
    mutationFn: async (payload: typeof formData & { aportantes: DonorPayload[] }) => {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          submission_source: 'pastor_manual',
          estado: 'pendiente_admin' // Ready for immediate approval
        })
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
    }
  });

  const addDonor = () => {
    setDonors(prev => [...prev, blankDonor(donorSequence)]);
    setDonorSequence(prev => prev + 1);
  };

  const removeDonor = (id: number) => {
    setDonors(prev => prev.filter(donor => donor.id !== id));
  };

  const handleDonorChange = (id: number, field: keyof DonorRow) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDonors(prev =>
      prev.map(donor => {
        if (donor.id !== id) return donor;
        if (field === 'amount') {
          if (value === '' || amountPattern.test(value)) {
            return { ...donor, amount: value };
          }
          return donor;
        }
        return { ...donor, [field]: value };
      })
    );
  };

  useEffect(() => {
    if (formData.diezmos > 0 && donors.length === 0) {
      setDonors([blankDonor(donorSequence)]);
      setDonorSequence(prev => prev + 1);
    }
  }, [formData.diezmos, donors.length, donorSequence]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.church_id) {
      alert('Por favor seleccione una iglesia');
      return;
    }

    const donorsWithAmount = formData.diezmos > 0
      ? donors.filter(donor => parseAmount(donor.amount) > 0)
      : [];
    if (formData.diezmos > 0) {
      if (donorsWithAmount.length === 0) {
        alert('Registra al menos un aportante con monto mayor a cero.');
        return;
      }
      const missingIdentity = donorsWithAmount.some(donor => {
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

    const donorPayload: DonorPayload[] = donorsWithAmount.map(donor => ({
      first_name: donor.firstName.trim(),
      last_name: donor.lastName.trim(),
      document: donor.document.trim(),
      amount: parseAmount(donor.amount)
    }));

    await createReport.mutateAsync({
      ...formData,
      aportantes: donorPayload
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto px-1">
      {/* Church Selection and Period */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Información del Informe</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Iglesia *
            </label>
            <select
              value={formData.church_id}
              onChange={(e) => setFormData(prev => ({ ...prev, church_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">Seleccionar iglesia...</option>
              {churches.map(church => (
                <option key={church.id} value={church.id}>
                  {church.name} - {church.city}
                  {church.pastor ? ` (${church.pastor})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mes *
            </label>
            <select
              value={formData.month}
              onChange={(e) => setFormData(prev => ({ ...prev, month: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2024, month - 1).toLocaleDateString('es', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Año *
            </label>
            <select
              value={formData.year}
              onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              {[currentYear, currentYear - 1].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Manual Report Source */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fuente del Informe *
            </label>
            <select
              value={formData.manual_report_source}
              onChange={(e) => setFormData(prev => ({ ...prev, manual_report_source: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              {MANUAL_SOURCES.map(source => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notas sobre la recepción
            </label>
            <input
              type="text"
              value={formData.manual_report_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, manual_report_notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ej: Pastor Juan entregó en persona"
            />
          </div>
        </div>
      </div>

      {/* Income Section */}
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-green-900 mb-3">Ingresos Congregacionales</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Diezmos</label>
            <input
              type="number"
              value={formData.diezmos}
              onChange={(e) => setFormData(prev => ({ ...prev, diezmos: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ofrendas</label>
            <input
              type="number"
              value={formData.ofrendas}
              onChange={(e) => setFormData(prev => ({ ...prev, ofrendas: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Anexos</label>
            <input
              type="number"
              value={formData.anexos}
              onChange={(e) => setFormData(prev => ({ ...prev, anexos: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Otros</label>
            <input
              type="number"
              value={formData.otros}
              onChange={(e) => setFormData(prev => ({ ...prev, otros: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Donor Details */}
      <div className="bg-white border border-gray-200 p-4 rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Detalle de aportantes de diezmo</h3>
            <p className="text-xs text-gray-600">
              Registra a cada aportante cuando haya diezmos. Los montos deben coincidir con el total de diezmos declarado.
            </p>
          </div>
          <button
            type="button"
            onClick={addDonor}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Agregar aportante
          </button>
        </div>
        {donors.length === 0 ? (
          <p className="text-sm text-gray-600">
            No hay aportantes cargados. Agrega al menos uno si hay diezmos en el informe.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Apellido</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Documento</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Monto</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {donors.map((donor) => (
                    <tr key={donor.id}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={donor.firstName}
                          onChange={handleDonorChange(donor.id, 'firstName')}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Nombre"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={donor.lastName}
                          onChange={handleDonorChange(donor.id, 'lastName')}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Apellido"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={donor.document}
                          onChange={handleDonorChange(donor.id, 'document')}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          placeholder="RUC / C.I."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={donor.amount}
                          onChange={handleDonorChange(donor.id, 'amount')}
                          className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeDonor(donor.id)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="font-semibold text-gray-700">
                Total aportantes: {formatCurrency(donorsTotal)}
              </div>
              <div className={donorsDifference === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                Diferencia vs diezmos declarados: {formatCurrency(donorsTotal - formData.diezmos)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Designated Offerings */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-purple-900 mb-3">Ofrendas Designadas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Misiones</label>
            <input
              type="number"
              value={formData.misiones}
              onChange={(e) => setFormData(prev => ({ ...prev, misiones: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Lazos de Amor</label>
            <input
              type="number"
              value={formData.lazos_amor}
              onChange={(e) => setFormData(prev => ({ ...prev, lazos_amor: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Misión Posible</label>
            <input
              type="number"
              value={formData.mision_posible}
              onChange={(e) => setFormData(prev => ({ ...prev, mision_posible: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">APY</label>
            <input
              type="number"
              value={formData.apy}
              onChange={(e) => setFormData(prev => ({ ...prev, apy: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">IBA</label>
            <input
              type="number"
              value={formData.iba}
              onChange={(e) => setFormData(prev => ({ ...prev, iba: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Caballeros</label>
            <input
              type="number"
              value={formData.caballeros}
              onChange={(e) => setFormData(prev => ({ ...prev, caballeros: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Damas</label>
            <input
              type="number"
              value={formData.damas}
              onChange={(e) => setFormData(prev => ({ ...prev, damas: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Jóvenes</label>
            <input
              type="number"
              value={formData.jovenes}
              onChange={(e) => setFormData(prev => ({ ...prev, jovenes: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Niños</label>
            <input
              type="number"
              value={formData.ninos}
              onChange={(e) => setFormData(prev => ({ ...prev, ninos: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-red-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-red-900 mb-3">Gastos Operativos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Servicios</label>
            <input
              type="number"
              value={formData.servicios}
              onChange={(e) => setFormData(prev => ({ ...prev, servicios: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Energía Eléctrica</label>
            <input
              type="number"
              value={formData.energia_electrica}
              onChange={(e) => setFormData(prev => ({ ...prev, energia_electrica: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Agua</label>
            <input
              type="number"
              value={formData.agua}
              onChange={(e) => setFormData(prev => ({ ...prev, agua: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Recolección Basura</label>
            <input
              type="number"
              value={formData.recoleccion_basura}
              onChange={(e) => setFormData(prev => ({ ...prev, recoleccion_basura: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mantenimiento</label>
            <input
              type="number"
              value={formData.mantenimiento}
              onChange={(e) => setFormData(prev => ({ ...prev, mantenimiento: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Materiales</label>
            <input
              type="number"
              value={formData.materiales}
              onChange={(e) => setFormData(prev => ({ ...prev, materiales: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Otros Gastos</label>
            <input
              type="number"
              value={formData.otros_gastos}
              onChange={(e) => setFormData(prev => ({ ...prev, otros_gastos: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Bank Deposit Info */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-yellow-900 mb-3">Información del Depósito</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Número de Depósito
            </label>
            <input
              type="text"
              value={formData.numero_deposito}
              onChange={(e) => setFormData(prev => ({ ...prev, numero_deposito: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Número de comprobante"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fecha de Depósito
            </label>
            <input
              type="date"
              value={formData.fecha_deposito}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_deposito: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Estadísticas</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Asistencia/Visitas</label>
            <input
              type="number"
              value={formData.asistencia_visitas}
              onChange={(e) => setFormData(prev => ({ ...prev, asistencia_visitas: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Bautismos en Agua</label>
            <input
              type="number"
              value={formData.bautismos_agua}
              onChange={(e) => setFormData(prev => ({ ...prev, bautismos_agua: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Bautismos del Espíritu</label>
            <input
              type="number"
              value={formData.bautismos_espiritu}
              onChange={(e) => setFormData(prev => ({ ...prev, bautismos_espiritu: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Observaciones
          </label>
          <textarea
            value={formData.observaciones}
            onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows={2}
            placeholder="Notas adicionales sobre el informe..."
          />
        </div>
      </div>

      {/* Calculated Summary */}
      <div className="bg-indigo-100 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-indigo-900 mb-3">Resumen Calculado</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-gray-600">Total Entradas:</span>
            <div className="font-semibold text-green-700">{formatCurrency(totals.totalEntradas)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-600">Fondo Nacional (10%):</span>
            <div className="font-semibold text-blue-700">{formatCurrency(totals.fondoNacional)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-600">Honorarios Pastoral:</span>
            <div className="font-semibold text-purple-700">{formatCurrency(totals.honorariosPastoral)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-600">Saldo del Mes:</span>
            <div className={`font-semibold ${totals.saldoMes === 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(totals.saldoMes)}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createReport.isPending}
          className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {createReport.isPending ? 'Creando...' : 'Crear Informe Manual'}
        </button>
      </div>

      {createReport.isError && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
          Error: {(createReport.error as Error).message}
        </div>
      )}
    </form>
  );
}