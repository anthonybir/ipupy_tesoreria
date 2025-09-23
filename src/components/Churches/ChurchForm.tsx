'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

import { useCreateChurch } from '@/hooks/useChurchMutations';

const initialState = {
  name: '',
  city: '',
  pastor: '',
  phone: '',
  email: '',
  ruc: '',
  cedula: '',
  grado: '',
  posicion: ''
};

type Field = keyof typeof initialState;

export function ChurchForm() {
  const [form, setForm] = useState(initialState);
  const createChurch = useCreateChurch();

  const handleChange = (field: Field) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name || !form.city || !form.pastor) {
      toast.error('Los campos de nombre, ciudad y pastor son obligatorios.');
      return;
    }

    try {
      await createChurch.mutateAsync({ ...form });
      setForm(initialState);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.06]">
      <header className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-6 py-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevo registro</span>
        <h2 className="text-xl font-semibold text-slate-900">Agregar iglesia</h2>
        <p className="text-sm text-slate-600">
          Completa los datos principales de la congregación para habilitar sus reportes en el sistema nacional.
        </p>
      </header>

      <form className="space-y-6 px-6 py-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {([
            { field: 'name', label: 'Nombre de la iglesia', placeholder: 'Iglesia Central Asunción', required: true },
            { field: 'city', label: 'Ciudad', placeholder: 'Asunción', required: true },
            { field: 'pastor', label: 'Pastor/a responsable', placeholder: 'Pr. Juan Pérez', required: true },
            { field: 'phone', label: 'Teléfono de contacto', placeholder: '+595 971 123 456' },
            { field: 'email', label: 'Correo institucional', placeholder: 'tesoreria@iglesia.org.py' },
            { field: 'ruc', label: 'RUC', placeholder: '80017726-6' },
            { field: 'cedula', label: 'Cédula pastor/a', placeholder: '1234567' },
            { field: 'grado', label: 'Grado ministerial', placeholder: 'Presbítero' },
            { field: 'posicion', label: 'Posición', placeholder: 'Supervisor regional' }
          ] as Array<{ field: Field; label: string; placeholder?: string; required?: boolean }>).map((input) => (
            <div key={input.field} className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`church-${input.field}`}>
                {input.label}
                {input.required && <span className="ml-1 text-rose-500">*</span>}
              </label>
              <input
                id={`church-${input.field}`}
                type={input.field === 'email' ? 'email' : 'text'}
                value={form[input.field]}
                onChange={handleChange(input.field)}
                placeholder={input.placeholder}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                disabled={createChurch.isPending}
                required={input.required}
              />
            </div>
          ))}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            El equipo de tesorería puede actualizar estos datos en cualquier momento desde el directorio.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm(initialState)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              disabled={createChurch.isPending}
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createChurch.isPending}
            >
              {createChurch.isPending ? 'Registrando…' : 'Registrar iglesia'}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
