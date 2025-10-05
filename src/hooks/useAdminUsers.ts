import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { fetchJson, ApiError } from '@/lib/api-client';
import toast from 'react-hot-toast';
import type { ProfileRole } from '@/lib/authz';

/**
 * Admin user record
 *
 * @property is_active - Admin can deactivate users to revoke system access
 */
export type AdminUserRecord = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  church_id: number | null;
  church_name: string | null;
  church_city?: string | null;
  phone?: string | null;
  is_active: boolean;
  last_seen_at?: string | null;
  created_at?: string | null;
};

export type CreateAdminUserPayload = {
  email: string;
  full_name?: string | null;
  role: ProfileRole;
  church_id?: number | null;
  phone?: string | null;
  permissions?: Record<string, unknown> | null;
};

export type UpdateAdminUserPayload = {
  id: string;
  email?: string;
  full_name?: string | null;
  role?: ProfileRole;
  church_id?: number | null;
  phone?: string | null;
  permissions?: Record<string, unknown> | null;
  is_active?: boolean;
};

const adminUsersKey = ['admin-users'] as const;

type AdminUsersResponse = {
  success?: boolean;
  data?: AdminUserRecord[];
};

type MutationResponse = {
  success: boolean;
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};

export function useAdminUsers(): UseQueryResult<AdminUserRecord[], Error> {
  return useQuery({
    queryKey: adminUsersKey,
    queryFn: async () => {
      const response = await fetchJson<AdminUsersResponse>('/api/admin/users');
      return response.data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateAdminUser(): UseMutationResult<MutationResponse, Error, CreateAdminUserPayload> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAdminUserPayload) => {
      const response = await fetchJson<MutationResponse>('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
      toast.success(data.message || 'Usuario creado');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo crear el usuario'));
    },
  });
}

export function useUpdateAdminUser(): UseMutationResult<MutationResponse, Error, UpdateAdminUserPayload> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateAdminUserPayload) => {
      const response = await fetchJson<MutationResponse>('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
      toast.success(data.message || 'Usuario actualizado');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo actualizar el usuario'));
    },
  });
}

export function useDeactivateAdminUser(): UseMutationResult<MutationResponse, Error, { id: string; hard?: boolean }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, hard }: { id: string; hard?: boolean }) => {
      const params = new URLSearchParams({ id });
      if (hard) {
        params.append('hard', 'true');
      }

      const response = await fetchJson<MutationResponse>(`/api/admin/users?${params.toString()}`, {
        method: 'DELETE',
      });

      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
      toast.success(data.message || 'Usuario actualizado');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo actualizar el usuario'));
    },
  });
}
