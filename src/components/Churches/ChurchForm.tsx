'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { useCreateChurch } from '@/hooks/useChurchMutations';
import { FormField, FormSection } from '@/components/Shared';

const inputClasses =
  'rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';

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
  pastorPreferredName: '',
  pastorEmail: '',
  pastorPhone: '',
  pastorWhatsapp: '',
  pastorStartDate: '',
  pastorNotes: ''
};

type Field = keyof typeof initialState;

const asOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function ChurchForm() {
  const [form, setForm] = useState(initialState);
  const createChurch = useCreateChurch();

  const handleChange = (field: Field) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.city.trim() || !form.pastor.trim()) {
      toast.error('Los campos de nombre, ciudad y pastor son obligatorios.');
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        pastor: form.pastor.trim(),
        phone: asOptional(form.phone),
        email: asOptional(form.email),
        ruc: asOptional(form.ruc),
        cedula: asOptional(form.cedula),
        grado: asOptional(form.grado),
        posicion: asOptional(form.posicion),
        primaryPastor: {
          fullName: form.pastor.trim(),
          preferredName: asNullable(form.pastorPreferredName),
          email: asNullable(form.pastorEmail) ?? asNullable(form.email) ?? null,
          phone: asNullable(form.pastorPhone) ?? asNullable(form.phone) ?? null,
          whatsapp: asNullable(form.pastorWhatsapp),
          nationalId: asNullable(form.cedula),
          taxId: asNullable(form.ruc),
          grado: asNullable(form.grado),
          roleTitle: asNullable(form.posicion),
          startDate: asOptional(form.pastorStartDate) ?? null,
          notes: asNullable(form.pastorNotes)
        }
      } as const;

      await createChurch.mutateAsync(payload);
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
          <FormField htmlFor="church-name" label="Nombre de la iglesia" required>
            <input
              id="church-name"
              type="text"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="Iglesia Central Asunción"
              className={inputClasses}
              required
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="church-city" label="Ciudad" required>
            <input
              id="church-city"
              type="text"
              value={form.city}
              onChange={handleChange('city')}
              placeholder="Asunción"
              className={inputClasses}
              required
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="church-phone" label="Teléfono de contacto">
            <input
              id="church-phone"
              type="text"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="+595 971 123 456"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="church-email" label="Correo institucional">
            <input
              id="church-email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="tesoreria@iglesia.org.py"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="church-ruc" label="RUC">
            <input
              id="church-ruc"
              type="text"
              value={form.ruc}
              onChange={handleChange('ruc')}
              placeholder="80017726-6"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="church-cedula" label="Cédula pastor/a">
            <input
              id="church-cedula"
              type="text"
              value={form.cedula}
              onChange={handleChange('cedula')}
              placeholder="1234567"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Pastor/a principal"
        description="Registra los datos del liderazgo pastoral para contacto directo y auditoría histórica."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField htmlFor="pastor-name" label="Nombre completo" required>
            <input
              id="pastor-name"
              type="text"
              value={form.pastor}
              onChange={handleChange('pastor')}
              placeholder="Pr. Juan Pérez"
              className={inputClasses}
              required
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="pastor-preferred" label="Nombre preferido">
            <input
              id="pastor-preferred"
              type="text"
              value={form.pastorPreferredName}
              onChange={handleChange('pastorPreferredName')}
              placeholder="Pastor Juan"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="pastor-email" label="Correo personal">
            <input
              id="pastor-email"
              type="email"
              value={form.pastorEmail}
              onChange={handleChange('pastorEmail')}
              placeholder="juan.perez@ipupy.org"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="pastor-phone" label="Teléfono directo">
            <input
              id="pastor-phone"
              type="text"
              value={form.pastorPhone}
              onChange={handleChange('pastorPhone')}
              placeholder="+595 981 000 000"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="pastor-whatsapp" label="WhatsApp">
            <input
              id="pastor-whatsapp"
              type="text"
              value={form.pastorWhatsapp}
              onChange={handleChange('pastorWhatsapp')}
              placeholder="0991 123 456"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="pastor-start" label="Fecha de inicio">
            <input
              id="pastor-start"
              type="date"
              value={form.pastorStartDate}
              onChange={handleChange('pastorStartDate')}
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="pastor-grade" label="Grado ministerial">
            <input
              id="pastor-grade"
              type="text"
              value={form.grado}
              onChange={handleChange('grado')}
              placeholder="Presbítero"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="pastor-role" label="Posición">
            <input
              id="pastor-role"
              type="text"
              value={form.posicion}
              onChange={handleChange('posicion')}
              placeholder="Supervisor regional"
              className={inputClasses}
              disabled={createChurch.isPending}
            />
          </FormField>
        </div>

        <FormField htmlFor="pastor-notes" label="Notas administrativas">
          <textarea
            id="pastor-notes"
            value={form.pastorNotes}
            onChange={handleChange('pastorNotes')}
            placeholder="Detalles de transición, suplencias, responsabilidades adicionales…"
            className={`${inputClasses} min-h-[96px]`}
            disabled={createChurch.isPending}
          />
        </FormField>
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
