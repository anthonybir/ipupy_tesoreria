import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { fetchJson, ApiError } from '@/lib/api-client';
import toast from 'react-hot-toast';
import { profileRoles, type ProfileRole } from '@/lib/authz';
import type { ApiResponse } from '@/types/utils';

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
  church_id: string | null;
  church_name: string | null;
  church_city?: string | null;
  fund_id?: string | null;
  phone?: string | null;
  is_active: boolean;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateAdminUserPayload = {
  email: string;
  full_name?: string | null;
  role: ProfileRole;
  church_id?: string | null;
  fund_id?: string | null;
  phone?: string | null;
  permissions?: Record<string, unknown> | null;
};

export type UpdateAdminUserPayload = {
  user_id: string;
  full_name?: string | null;
  role?: ProfileRole;
  church_id?: string | null;
  fund_id?: string | null;
  phone?: string | null;
  permissions?: Record<string, unknown> | null;
  is_active?: boolean;
};

const adminUsersKey = ['admin-users'] as const;

type AdminUsersApiUser = {
  user_id?: string | null;
  email: string;
  full_name?: string | null;
  role?: string | null;
  church_id?: string | null;
  fund_id?: string | null;
  church_name?: string | null;
  church_city?: string | null;
  phone?: string | null;
  active?: boolean;
  is_active?: boolean;
  created_at?: number | string | null;
  updated_at?: number | string | null;
  last_seen_at?: number | string | null;
};

type AdminUsersResponse = ApiResponse<AdminUsersApiUser[]> & { total?: number };

type MutationResponse<T = undefined> = {
  success: true;
  message?: string;
  data?: T;
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

const VALID_ROLE_SET = new Set(profileRoles());

const resolveRole = (role: string | null | undefined): ProfileRole =>
  role && VALID_ROLE_SET.has(role) ? (role as ProfileRole) : 'secretary';

const toIsoString = (value: unknown): string | null => {
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

const mapApiUserToRecord = (user: AdminUsersApiUser): AdminUserRecord => {
  const id = typeof user.user_id === 'string' && user.user_id.trim().length > 0 ? user.user_id : user.email;

  return {
    id,
    email: user.email,
    full_name: user.full_name ?? null,
    role: resolveRole(user.role),
    church_id: user.church_id ?? null,
    church_name: user.church_name ?? null,
    church_city: user.church_city ?? null,
    fund_id: user.fund_id ?? null,
    phone: user.phone ?? null,
    is_active: user.active ?? user.is_active ?? true,
    last_seen_at: toIsoString(user.last_seen_at),
    created_at: toIsoString(user.created_at),
    updated_at: toIsoString(user.updated_at),
  };
};

export function useAdminUsers(): UseQueryResult<AdminUserRecord[], Error> {
  return useQuery({
    queryKey: adminUsersKey,
    queryFn: async () => {
      const response = await fetchJson<AdminUsersResponse>('/api/admin/users');
      if (!response.success) {
        throw new ApiError(response.error ?? 'No se pudo cargar usuarios', 200, response);
      }
      return (response.data ?? []).map(mapApiUserToRecord);
    },
    staleTime: 30_000,
  });
}

export function useCreateAdminUser(): UseMutationResult<MutationResponse<AdminUserRecord>, Error, CreateAdminUserPayload> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAdminUserPayload) => {
      const apiResponse = await fetchJson<ApiResponse<AdminUsersApiUser> & { message?: string }>(
        '/api/admin/users',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!apiResponse.success) {
        throw new ApiError(apiResponse.error ?? 'No se pudo crear el usuario', 200, apiResponse);
      }

      const result: MutationResponse<AdminUserRecord> = {
        success: true,
        data: mapApiUserToRecord(apiResponse.data),
      };
      if (apiResponse.message) {
        result.message = apiResponse.message;
      }

      return result;
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

export function useUpdateAdminUser(): UseMutationResult<MutationResponse<AdminUserRecord>, Error, UpdateAdminUserPayload> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateAdminUserPayload) => {
      const apiResponse = await fetchJson<ApiResponse<AdminUsersApiUser> & { message?: string }>(
        '/api/admin/users',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!apiResponse.success) {
        throw new ApiError(apiResponse.error ?? 'No se pudo actualizar el usuario', 200, apiResponse);
      }

      const result: MutationResponse<AdminUserRecord> = {
        success: true,
        data: mapApiUserToRecord(apiResponse.data),
      };
      if (apiResponse.message) {
        result.message = apiResponse.message;
      }

      return result;
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

export function useDeactivateAdminUser(): UseMutationResult<MutationResponse, Error, { user_id: string; hard?: boolean }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user_id, hard }: { user_id: string; hard?: boolean }) => {
      const params = new URLSearchParams({ id: user_id });
      if (hard) {
        params.append('hard', 'true');
      }

      const apiResponse = await fetchJson<ApiResponse<Record<string, never>> & { message?: string }>(
        `/api/admin/users?${params.toString()}`,
        {
          method: 'DELETE',
        },
      );

      if (!apiResponse.success) {
        throw new ApiError(apiResponse.error ?? 'No se pudo actualizar el usuario', 200, apiResponse);
      }

      const result: MutationResponse = {
        success: true,
      };
      if (apiResponse.message) {
        result.message = apiResponse.message;
      }

      return result;
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
