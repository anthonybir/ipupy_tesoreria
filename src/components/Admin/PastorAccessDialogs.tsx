'use client';

import React, { useState } from 'react';
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
import { useLinkPastorProfile, useUnlinkPastorProfile } from '@/hooks/usePastorAccess';
import type { PastorUserAccess } from '@/types/api';
import { ShieldCheck, UserX, AlertTriangle } from 'lucide-react';

type DialogProps = {
  pastorId: number;
  pastor?: PastorUserAccess;
  onClose: () => void;
};

// Grant Access Dialog
export const GrantAccessDialog = ({ pastorId, pastor, onClose }: DialogProps) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [profileId, setProfileId] = useState('');
  const [email, setEmail] = useState(pastor?.pastorName ? `${pastor.pastorName.toLowerCase().replace(/\s+/g, '.')}@ipupy.org.py` : '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('pastor');

  const linkMutation = useLinkPastorProfile();

  const handleGrant = async () => {
    if (mode === 'existing' && !profileId) {
      return;
    }
    if (mode === 'new' && (!email || !password || !role)) {
      return;
    }

    try {
      if (mode === 'existing') {
        await linkMutation.mutateAsync({
          pastor_id: pastorId,
          profile_id: profileId,
        });
      } else {
        await linkMutation.mutateAsync({
          pastor_id: pastorId,
          create_profile: {
            email,
            password,
            role,
          },
        });
      }
      onClose();
    } catch (error) {
      console.error('Error granting access:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Otorgar Acceso a la Plataforma
          </DialogTitle>
          <DialogDescription>
            Asigne un rol de plataforma a <strong>{pastor?.pastorName}</strong> de {pastor?.churchName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Método de Acceso</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as 'existing' | 'new')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">Vincular a usuario existente</SelectItem>
                <SelectItem value="new">Crear nuevo usuario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <Label htmlFor="profile-id">ID de Perfil de Usuario</Label>
              <Input
                id="profile-id"
                placeholder="UUID del perfil existente"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ingrese el ID del perfil de usuario existente para vincular
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="pastor@ipupy.org.py"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña Temporal</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  El usuario deberá cambiarla en el primer inicio de sesión
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol en la Plataforma</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="district_supervisor">Supervisor de Distrito</SelectItem>
                    <SelectItem value="pastor">Pastor</SelectItem>
                    <SelectItem value="treasurer">Tesorero</SelectItem>
                    <SelectItem value="secretary">Secretario</SelectItem>
                    <SelectItem value="member">Miembro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              El pastor recibirá acceso inmediatamente después de otorgar el permiso
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleGrant} disabled={linkMutation.isPending}>
            {linkMutation.isPending ? 'Otorgando...' : 'Otorgar Acceso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Change Role Dialog
export const ChangeRoleDialog = ({ pastorId, pastor, onClose }: DialogProps) => {
  const [newRole, setNewRole] = useState(pastor?.platformRole || 'pastor');

  const linkMutation = useLinkPastorProfile();

  const handleChangeRole = async () => {
    if (!pastor?.profileId) return;

    try {
      await linkMutation.mutateAsync({
        pastor_id: pastorId,
        profile_id: pastor.profileId,
        create_profile: {
          email: '', // Not used when updating
          role: newRole,
        },
      });
      onClose();
    } catch (error) {
      console.error('Error changing role:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Cambiar Rol de Plataforma
          </DialogTitle>
          <DialogDescription>
            Cambie el rol de <strong>{pastor?.pastorName}</strong> en la plataforma
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rol Actual</Label>
            <Input value={pastor?.platformRole || 'Sin rol'} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role">Nuevo Rol</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="district_supervisor">Supervisor de Distrito</SelectItem>
                <SelectItem value="pastor">Pastor</SelectItem>
                <SelectItem value="treasurer">Tesorero</SelectItem>
                <SelectItem value="secretary">Secretario</SelectItem>
                <SelectItem value="member">Miembro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              El cambio de rol será efectivo inmediatamente
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleChangeRole} disabled={linkMutation.isPending}>
            {linkMutation.isPending ? 'Cambiando...' : 'Cambiar Rol'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Revoke Access Dialog
export const RevokeAccessDialog = ({ pastorId, pastor, onClose }: DialogProps) => {
  const unlinkMutation = useUnlinkPastorProfile();

  const handleRevoke = async () => {
    try {
      await unlinkMutation.mutateAsync({ pastor_id: pastorId });
      onClose();
    } catch (error) {
      console.error('Error revoking access:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-red-600" />
            Revocar Acceso a la Plataforma
          </DialogTitle>
          <DialogDescription>
            ¿Está seguro que desea revocar el acceso de <strong>{pastor?.pastorName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Acción irreversible:</strong> El pastor perderá acceso inmediatamente a la plataforma.
              El registro pastoral se mantendrá en el directorio.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Pastor:</div>
              <div className="font-medium">{pastor?.pastorName}</div>
              <div className="text-muted-foreground">Iglesia:</div>
              <div className="font-medium">{pastor?.churchName}</div>
              <div className="text-muted-foreground">Rol Actual:</div>
              <div className="font-medium">{pastor?.platformRole || 'Sin rol'}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleRevoke} disabled={unlinkMutation.isPending}>
            {unlinkMutation.isPending ? 'Revocando...' : 'Revocar Acceso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
