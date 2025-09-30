'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/Shared';
import { useUpdateChurch } from '@/hooks/useChurchMutations';
import type { ChurchRecord } from '@/types/api';

type Props = {
  church: ChurchRecord | null;
  open: boolean;
  onClose: () => void;
};

export function ChurchEditDialog({ church, open, onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    city: '',
    pastor: '',
    phone: '',
    email: '',
    ruc: '',
    cedula: '',
    grado: '',
    posicion: '',
    active: true
  });

  const updateChurch = useUpdateChurch(church?.id ?? 0);

  useEffect(() => {
    if (church) {
      setForm({
        name: church.name,
        city: church.city,
        pastor: church.pastor,
        phone: church.phone || '',
        email: church.email || '',
        ruc: church.ruc || '',
        cedula: church.cedula || '',
        grado: church.grade || '',
        posicion: church.position || '',
        active: church.active
      });
    }
  }, [church]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!church) return;

    try {
      await updateChurch.mutateAsync(form);
      toast.success('Iglesia actualizada correctamente');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Iglesia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField htmlFor="edit-name" label="Nombre" required>
              <input
                id="edit-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
                required
              />
            </FormField>

            <FormField htmlFor="edit-city" label="Ciudad" required>
              <input
                id="edit-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
                required
              />
            </FormField>

            <FormField htmlFor="edit-pastor" label="Pastor/a" required>
              <input
                id="edit-pastor"
                type="text"
                value={form.pastor}
                onChange={(e) => setForm({ ...form, pastor: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
                required
              />
            </FormField>

            <FormField htmlFor="edit-phone" label="Teléfono">
              <input
                id="edit-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-email" label="Correo">
              <input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-ruc" label="RUC">
              <input
                id="edit-ruc"
                type="text"
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-cedula" label="Cédula">
              <input
                id="edit-cedula"
                type="text"
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-grado" label="Grado">
              <input
                id="edit-grado"
                type="text"
                value={form.grado}
                onChange={(e) => setForm({ ...form, grado: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-posicion" label="Posición">
              <input
                id="edit-posicion"
                type="text"
                value={form.posicion}
                onChange={(e) => setForm({ ...form, posicion: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-active" label="Estado">
              <select
                id="edit-active"
                value={form.active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </FormField>
          </div>

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
