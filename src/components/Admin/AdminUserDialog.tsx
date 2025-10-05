'use client';

import React, { useEffect, useMemo, useState, type JSX } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateAdminUser, useUpdateAdminUser, type AdminUserRecord, type CreateAdminUserPayload, type UpdateAdminUserPayload } from '@/hooks/useAdminUsers';
import { profileRoles, type ProfileRole } from '@/lib/authz';

export type AdminUserDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  onClose: () => void;
  user?: AdminUserRecord | null;
  churches: Array<{ id: number; name: string | null }>
};

// All roles are now assignable (migration 023 removed super_admin)
const assignableRoles = profileRoles();
const DEFAULT_ASSIGNABLE_ROLE: ProfileRole = (assignableRoles[0] ?? 'admin') as ProfileRole;

export function AdminUserDialog({ open, mode, onClose, user, churches }: AdminUserDialogProps): JSX.Element {
  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<ProfileRole>(DEFAULT_ASSIGNABLE_ROLE);
  const [churchId, setChurchId] = useState<string>('none');
  const [phone, setPhone] = useState('');

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && user) {
      setEmail(user.email);
      setFullName(user.full_name ?? '');
      setRole(user.role); // user.role is already ProfileRole type
      const churchValue = typeof user.church_id === 'number' ? String(user.church_id) : 'none';
      setChurchId(churchValue);
      setPhone(user.phone ?? '');
    } else {
      setEmail('');
      setFullName('');
      setRole(DEFAULT_ASSIGNABLE_ROLE);
      setChurchId('none');
      setPhone('');
    }
  }, [mode, open, user]);

  const disableSubmit = useMemo(() => {
    if (!email) {
      return true;
    }
    // Client-side email domain validation
    const emailValid = /^[^\s@]+@ipupy\.org\.py$/i.test(email.trim());
    return !emailValid;
  }, [email]);

  const handleSubmit = async () => {
    if (disableSubmit) {
      return;
    }

    const basePayload = {
      email,
      full_name: fullName || null,
      role,
      church_id: churchId && churchId !== 'none' ? Number(churchId) : null,
      phone: phone || null,
    } satisfies Omit<CreateAdminUserPayload, 'permissions'>;

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync({ ...basePayload });
      } else if (user) {
        const payload: UpdateAdminUserPayload = {
          id: user.id,
          ...basePayload,
        };
        await updateMutation.mutateAsync(payload);
      }

      onClose();
    } catch (error) {
      console.error('Error saving admin user:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Crear nuevo usuario' : 'Editar usuario'}</DialogTitle>
          <DialogDescription>
            Los usuarios se autentican con Google Workspace. Al guardar, envíe al usuario a iniciar sesión con Google para activar su acceso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-user-email">Email</Label>
            <Input
              id="admin-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@ipupy.org.py"
            />
            {email && !/^[^\s@]+@ipupy\.org\.py$/i.test(email.trim()) && (
              <p className="text-xs text-destructive">
                El email debe ser del dominio @ipupy.org.py
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-user-fullname">Nombre completo</Label>
            <Input
              id="admin-user-fullname"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nombre y Apellido"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-user-role">Rol</Label>
              <Select value={role} onValueChange={(value) => setRole(value as ProfileRole)}>
                <SelectTrigger id="admin-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((roleOption) => (
                    <SelectItem key={roleOption} value={roleOption}>
                      {roleOption.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-church">Iglesia</Label>
              <Select value={churchId} onValueChange={setChurchId}>
                <SelectTrigger id="admin-user-church">
                  <SelectValue placeholder="Seleccione una iglesia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="none" value="none">
                    Sin asignar
                  </SelectItem>
                  {churches.map((church) => (
                    <SelectItem key={church.id} value={String(church.id)}>
                      {church.name ?? 'Sin nombre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-user-phone">Teléfono</Label>
            <Input
              id="admin-user-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(+595) 999 123456"
            />
          </div>

          {mode === 'create' && (
            <Alert className="bg-muted/40">
              <AlertDescription>
                Se creará un perfil en estado pendiente. El usuario debe iniciar sesión con Google para activar su cuenta y sincronizarse con Supabase.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={disableSubmit} loading={isSubmitting}>
            {mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
