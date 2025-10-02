'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/Shared';
import { useUpdateChurch } from '@/hooks/useChurchMutations';
import type { ChurchRecord } from '@/types/api';

const inputClasses =
  'rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]';

type Props = {
  church: ChurchRecord | null;
  open: boolean;
  onClose: () => void;
};

type FormState = {
  name: string;
  city: string;
  pastor: string;
  phone: string;
  email: string;
  ruc: string;
  cedula: string;
  grado: string;
  posicion: string;
  pastorPreferredName: string;
  pastorEmail: string;
  pastorPhone: string;
  pastorWhatsapp: string;
  pastorStartDate: string;
  pastorEndDate: string;
  pastorNotes: string;
  active: boolean;
};

const emptyState: FormState = {
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
  pastorEndDate: '',
  pastorNotes: '',
  active: true
};

const asOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function ChurchEditDialog({ church, open, onClose }: Props) {
  const [form, setForm] = useState<FormState>(emptyState);
  const updateChurch = useUpdateChurch(church?.id ?? 0);

  useEffect(() => {
    if (!church) {
      setForm(emptyState);
      return;
    }

    const primary = church.primaryPastor;
    setForm({
      name: church.name,
      city: church.city,
      pastor: primary?.fullName ?? church.pastor,
      phone: primary?.phone ?? church.phone ?? '',
      email: primary?.email ?? church.email ?? '',
      ruc: church.ruc ?? '',
      cedula: church.cedula ?? '',
      grado: primary?.grado ?? church.grade ?? '',
      posicion: primary?.roleTitle ?? church.position ?? '',
      pastorPreferredName: primary?.preferredName ?? '',
      pastorEmail: primary?.email ?? church.email ?? '',
      pastorPhone: primary?.phone ?? church.phone ?? '',
      pastorWhatsapp: primary?.whatsapp ?? '',
      pastorStartDate: primary?.startDate ?? '',
      pastorEndDate: primary?.endDate ?? '',
      pastorNotes: primary?.notes ?? '',
      active: church.active
    });
  }, [church]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!church) return;

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
        active: form.active,
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
          endDate: asOptional(form.pastorEndDate) ?? null,
          notes: asNullable(form.pastorNotes)
        }
      } as const;

      await updateChurch.mutateAsync(payload);
      toast.success('Iglesia actualizada correctamente');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar');
    }
  };

  const handleChange = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar iglesia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField htmlFor="edit-name" label="Nombre" required>
              <input
                id="edit-name"
                type="text"
                value={form.name}
                onChange={handleChange('name')}
                className={inputClasses}
                required
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-city" label="Ciudad" required>
              <input
                id="edit-city"
                type="text"
                value={form.city}
                onChange={handleChange('city')}
                className={inputClasses}
                required
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-phone" label="Teléfono">
              <input
                id="edit-phone"
                type="text"
                value={form.phone}
                onChange={handleChange('phone')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-email" label="Correo">
              <input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-ruc" label="RUC">
              <input
                id="edit-ruc"
                type="text"
                value={form.ruc}
                onChange={handleChange('ruc')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-cedula" label="Cédula">
              <input
                id="edit-cedula"
                type="text"
                value={form.cedula}
                onChange={handleChange('cedula')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField htmlFor="edit-pastor" label="Nombre del pastor/a" required>
              <input
                id="edit-pastor"
                type="text"
                value={form.pastor}
                onChange={handleChange('pastor')}
                className={inputClasses}
                required
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-pastor-preferred" label="Nombre preferido">
              <input
                id="edit-pastor-preferred"
                type="text"
                value={form.pastorPreferredName}
                onChange={handleChange('pastorPreferredName')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-pastor-email" label="Correo personal">
              <input
                id="edit-pastor-email"
                type="email"
                value={form.pastorEmail}
                onChange={handleChange('pastorEmail')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-pastor-phone" label="Teléfono directo">
              <input
                id="edit-pastor-phone"
                type="text"
                value={form.pastorPhone}
                onChange={handleChange('pastorPhone')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-pastor-whatsapp" label="WhatsApp">
              <input
                id="edit-pastor-whatsapp"
                type="text"
                value={form.pastorWhatsapp}
                onChange={handleChange('pastorWhatsapp')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-pastor-start" label="Fecha de inicio">
              <input
                id="edit-pastor-start"
                type="date"
                value={form.pastorStartDate}
                onChange={handleChange('pastorStartDate')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-pastor-end" label="Fecha de finalización">
              <input
                id="edit-pastor-end"
                type="date"
                value={form.pastorEndDate}
                onChange={handleChange('pastorEndDate')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-grado" label="Grado ministerial">
              <input
                id="edit-grado"
                type="text"
                value={form.grado}
                onChange={handleChange('grado')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>

            <FormField htmlFor="edit-posicion" label="Posición">
              <input
                id="edit-posicion"
                type="text"
                value={form.posicion}
                onChange={handleChange('posicion')}
                className={inputClasses}
                disabled={updateChurch.isPending}
              />
            </FormField>
          </div>

          <FormField htmlFor="edit-pastor-notes" label="Notas administrativas">
            <textarea
              id="edit-pastor-notes"
              value={form.pastorNotes}
              onChange={handleChange('pastorNotes')}
              className={`${inputClasses} min-h-[96px]`}
              disabled={updateChurch.isPending}
            />
          </FormField>

          <FormField htmlFor="edit-active" label="Estado">
            <select
              id="edit-active"
              value={form.active ? 'true' : 'false'}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.value === 'true' }))}
              className={inputClasses}
              disabled={updateChurch.isPending}
            >
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
          </FormField>

          <div className="flex gap-3 justify-end border-t pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={updateChurch.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateChurch.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
