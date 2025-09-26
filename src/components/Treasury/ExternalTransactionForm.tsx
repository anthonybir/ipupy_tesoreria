'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';

import { CurrencyInput } from '@/components/ui/currency-input';
import { rawValueToNumber } from '@/lib/utils/currency';

interface ExternalTransactionFormProps {
  funds: Array<{ id: number; name: string }>;
  onSubmit: (data: TransactionData) => Promise<void>;
  onCancel: () => void;
}

interface TransactionData {
  fund_id: number;
  concept: string;
  amount_in: number;
  amount_out: number;
  date: string;
  provider?: string;
  document_number?: string;
}

export default function ExternalTransactionForm({
  funds,
  onSubmit,
  onCancel
}: ExternalTransactionFormProps) {
  const [isIncome, setIsIncome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<TransactionData>({
    fund_id: funds[0]?.id || 1,
    concept: '',
    amount_in: 0,
    amount_out: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    provider: '',
    document_number: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ensure only one amount is set
      const data = {
        ...formData,
        amount_in: isIncome ? Math.abs(formData.amount_in) : 0,
        amount_out: !isIncome ? Math.abs(formData.amount_out) : 0
      };

      await onSubmit({
        ...data,
        provider: formData.provider?.trim() || undefined,
        document_number: formData.document_number?.trim() || undefined
      });

      // Reset form
      setFormData({
        fund_id: funds[0]?.id || 1,
        concept: '',
        amount_in: 0,
        amount_out: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        provider: '',
        document_number: ''
      });
    } catch (error) {
      console.error('Error submitting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (rawValue: string) => {
    const amount = rawValueToNumber(rawValue);
    if (isIncome) {
      setFormData((prev) => ({ ...prev, amount_in: amount, amount_out: 0 }));
    } else {
      setFormData((prev) => ({ ...prev, amount_out: amount, amount_in: 0 }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Transaction Type Toggle */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setIsIncome(false)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            !isIncome
              ? 'bg-rose-100 text-rose-700 border-2 border-rose-300'
              : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
          }`}
        >
          <MinusIcon className="w-5 h-5" />
          Salida
        </button>
        <button
          type="button"
          onClick={() => setIsIncome(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isIncome
              ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
              : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
          }`}
        >
          <PlusIcon className="w-5 h-5" />
          Entrada
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fund Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fondo
          </label>
          <select
            value={formData.fund_id}
            onChange={(e) => setFormData(prev => ({ ...prev, fund_id: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          >
            {funds.map(fund => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monto (₲)
          </label>
          <CurrencyInput
            value={String(isIncome ? formData.amount_in : formData.amount_out)}
            onValueChange={handleAmountChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${
              isIncome
                ? 'border-emerald-300 focus:ring-emerald-500'
                : 'border-rose-300 focus:ring-rose-500'
            }`}
            placeholder="0"
            required
          />
        </div>

        {/* Concept */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Concepto
          </label>
          <input
            type="text"
            value={formData.concept}
            onChange={(e) => setFormData(prev => ({ ...prev, concept: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Descripción de la transacción"
            required
          />
        </div>

        {/* Provider Name (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proveedor/Beneficiario (opcional)
          </label>
          <input
            type="text"
            value={formData.provider}
            onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Nombre del proveedor o beneficiario"
          />
        </div>

        {/* Reference Number (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comprobante / Referencia (opcional)
          </label>
          <input
            type="text"
            value={formData.document_number}
            onChange={(e) => setFormData(prev => ({ ...prev, document_number: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Factura, recibo, boleta..."
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-white rounded-lg transition-colors ${
            isIncome
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-rose-600 hover:bg-rose-700'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Guardando...' : `Registrar ${isIncome ? 'Entrada' : 'Salida'}`}
        </button>
      </div>
    </form>
  );
}