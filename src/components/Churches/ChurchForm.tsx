'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { useCreateChurch } from '@/hooks/useChurchMutations';
import { FormField, FormSection } from '@/components/Shared';

const initialState = {
  name: '',
  city: '',
  pastor: '',
  phone: '',
  email: '',
  ruc: '',
  cedula: '',
  grado: '',
  posicion: '',
};

type Field = keyof typeof initialState;

const inputClasses =
  'rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';

export function ChurchForm() {
  const [form, setForm] = useState(initialState);
  const createChurch = useCreateChurch();

  const handleChange = (field: Field) => (event: React.ChangeEvent<HTMLInputElement>) => {
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
    <form onSubmit={handleSubmit} className="space-y-8">
      <FormSection
        title="Nuevo registro"
        description="Completa los datos principales de la congregación para habilitar sus reportes en el sistema nacional."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {([
            { field: 'name', label: 'Nombre de la iglesia', placeholder: 'Iglesia Central Asunción', required: true },
            { field: 'city', label: 'Ciudad', placeholder: 'Asunción', required: true },
            { field: 'pastor', label: 'Pastor/a responsable', placeholder: 'Pr. Juan Pérez', required: true },
            { field: 'phone', label: 'Teléfono de contacto', placeholder: '+595 971 123 456' },
            { field: 'email', label: 'Correo institucional', placeholder: 'tesoreria@iglesia.org.py' },
            { field: 'ruc', label: 'RUC', placeholder: '80017726-6' },
            { field: 'cedula', label: 'Cédula pastor/a', placeholder: '1234567' },
            { field: 'grado', label: 'Grado ministerial', placeholder: 'Presbítero' },
            { field: 'posicion', label: 'Posición', placeholder: 'Supervisor regional' },
          ] as Array<{ field: Field; label: string; placeholder?: string; required?: boolean }>).map(
            ({ field, label, placeholder, required }) => (
              <FormField key={field} htmlFor={`church-${field}`} label={label} required={required}>
                <input
                  id={`church-${field}`}
                  type={field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={handleChange(field)}
                  placeholder={placeholder}
                  className={inputClasses}
                  disabled={createChurch.isPending}
                  required={required}
                />
              </FormField>
            )
          )}
        </div>
      </FormSection>

      <footer className="flex flex-col gap-3 border-t border-[var(--absd-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[rgba(15,23,42,0.65)]">
          El equipo de tesorería puede actualizar estos datos en cualquier momento desde el directorio.
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setForm(initialState)}
            disabled={createChurch.isPending}
          >
            Limpiar
          </Button>
          <Button type="submit" loading={createChurch.isPending}>
            Registrar iglesia
          </Button>
        </div>
      </footer>
    </form>
  );
}
