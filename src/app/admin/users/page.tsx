"use client";

import { useMemo, useState, type JSX } from "react";
import { PlusCircle, RefreshCw, UserCheck, UserX, Pencil } from "lucide-react";
import toast from "react-hot-toast";

import { PageHeader, DataTable, type DataTableColumn } from "@/components/Shared";
import { RoleSelect } from "@/components/Admin/RoleSelect";
import { AdminUserDialog } from "@/components/Admin/AdminUserDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeactivateAdminUser,
  useUpdateAdminUser,
  type AdminUserRecord,
} from "@/hooks/useAdminUsers";
import { useAdminChurches } from "@/hooks/useAdminChurches";
import type { ProfileRole } from "@/lib/authz";

const CHURCH_SCOPED_ROLES: ProfileRole[] = ["pastor", "church_manager", "secretary"];

type ChurchOption = {
  id: string;
  name: string;
  city?: string | null;
};

const scopeLabel = (user: AdminUserRecord): string => {
  if (user.role === "treasurer" || user.role === "admin" || user.role === "fund_director") {
    return "Nivel nacional";
  }
  return user.church_name ?? "Sin asignar";
};

const scopeSubtext = (user: AdminUserRecord): string | null => {
  if (user.church_city) {
    return user.church_city;
  }
  if (!user.church_id && CHURCH_SCOPED_ROLES.includes(user.role)) {
    return "Asignar iglesia requerida";
  }
  return null;
};

export default function AdminUsersPage(): JSX.Element {
  const usersQuery = useAdminUsers();
  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const deactivateMutation = useDeactivateAdminUser();
  const churchesQuery = useAdminChurches();

  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<string | null>(null);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null);

  const churchOptions: ChurchOption[] = useMemo(
    () =>
      churchesQuery.data.map((church) => ({
        id: church.convexId ?? String(church.id),
        name: church.name,
        city: church.city,
      })),
    [churchesQuery.data],
  );

  const handleOpenCreate = () => {
    setDialogMode("create");
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: AdminUserRecord) => {
    setDialogMode("edit");
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedUser(null);
  };

  const handleRoleChange = async (user: AdminUserRecord, nextRole: ProfileRole) => {
    if (user.role === nextRole) {
      return;
    }

    if (CHURCH_SCOPED_ROLES.includes(nextRole) && !user.church_id) {
      toast.error("Este rol requiere asignar una iglesia. Actualice el usuario antes de continuar.");
      handleOpenEdit(user);
      return;
    }

    setRoleUpdatingUserId(user.id);
    try {
      await updateMutation.mutateAsync({
        user_id: user.id,
        role: nextRole,
        church_id: user.church_id,
        fund_id: user.fund_id ?? null,
      });
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setRoleUpdatingUserId(null);
    }
  };

  const handleToggleActive = async (user: AdminUserRecord) => {
    setStatusUpdatingUserId(user.id);
    try {
      if (user.is_active) {
        await deactivateMutation.mutateAsync({ user_id: user.id });
      } else {
        await createMutation.mutateAsync({
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          church_id: user.church_id,
          fund_id: user.fund_id ?? null,
          phone: user.phone ?? null,
        });
      }
    } catch (error) {
      console.error("Error updating user status:", error);
    } finally {
      setStatusUpdatingUserId(null);
    }
  };

  const isRoleUpdating = (userId: string): boolean =>
    roleUpdatingUserId === userId && updateMutation.isPending;

  const isStatusUpdating = (userId: string): boolean =>
    statusUpdatingUserId === userId &&
    (deactivateMutation.isPending || updateMutation.isPending || createMutation.isPending);

  const users = usersQuery.data ?? [];
  const tableIsLoading = usersQuery.isLoading || usersQuery.isFetching;

  const columns: Array<DataTableColumn<AdminUserRecord>> = [
    {
      id: "name",
      header: "Usuario",
      render: (user) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--absd-ink)]">{user.full_name ?? "Sin nombre"}</span>
          <span className="font-mono text-xs text-[rgba(15,23,42,0.65)]">{user.email}</span>
        </div>
      ),
    },
    {
      id: "role",
      header: "Rol",
      render: (user) => (
        <RoleSelect
          value={user.role}
          onChange={(value) => handleRoleChange(user, value)}
          disabled={isRoleUpdating(user.id) || !user.is_active}
        />
      ),
    },
    {
      id: "scope",
      header: "Ámbito",
      render: (user) => (
        <div className="flex flex-col">
          <span className="text-sm text-[var(--absd-ink)]">{scopeLabel(user)}</span>
          {scopeSubtext(user) ? (
            <span className="text-xs text-[rgba(15,23,42,0.65)]">{scopeSubtext(user)}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Estado",
      align: "center",
      render: (user) => (
        <Badge variant={user.is_active ? "success" : "secondary"}>
          {user.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      render: (user) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(user)}>
            <Pencil className="h-4 w-4" aria-hidden />
            <span className="sr-only">Editar usuario</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleActive(user)}
            disabled={isStatusUpdating(user.id)}
            loading={isStatusUpdating(user.id)}
          >
            {user.is_active ? <UserX className="h-4 w-4" aria-hidden /> : <UserCheck className="h-4 w-4" aria-hidden />}
            <span className="sr-only">{user.is_active ? "Desactivar" : "Reactivar"}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Gestión de usuarios y roles"
        subtitle="Administre perfiles de Google Workspace, roles del sistema y alcance de permisos."
        badge={{ label: "WS-2 · Roles", tone: "info" }}
        actions={
          <Button type="button" onClick={handleOpenCreate}>
            <PlusCircle className="mr-2 h-4 w-4" aria-hidden />
            Crear usuario
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Usuarios del sistema</CardTitle>
            <CardDescription>
              Todos los usuarios deben autenticarse con Google Workspace. Asigne roles según el modelo de 6 niveles.
            </CardDescription>
          </div>
          {tableIsLoading ? <RefreshCw className="h-5 w-5 animate-spin text-[var(--absd-wisdom)]" aria-hidden /> : null}
        </CardHeader>
        <CardContent>
          <DataTable
            data={users}
            columns={columns}
            getRowId={(user) => user.id}
            loading={tableIsLoading}
            emptyContent="No hay usuarios registrados todavía."
          />
        </CardContent>
      </Card>

      <AdminUserDialog
        open={dialogOpen}
        mode={dialogMode}
        onClose={handleDialogClose}
        user={selectedUser}
        churches={churchOptions}
      />
    </div>
  );
}
