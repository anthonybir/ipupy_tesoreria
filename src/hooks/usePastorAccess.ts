import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';
import type { PastorUserAccess, PastorAccessSummary, PastorLinkRequest } from '@/types/api';
import toast from 'react-hot-toast';

// ============================================================================
// Query Keys
// ============================================================================

export const pastorAccessKeys = {
  all: ['pastor-access'] as const,
  lists: () => [...pastorAccessKeys.all, 'list'] as const,
  list: (filters?: { status?: string; church_id?: string }) =>
    [...pastorAccessKeys.lists(), filters] as const,
  detail: (id: number) => [...pastorAccessKeys.all, 'detail', id] as const,
};

// ============================================================================
// API Response Types
// ============================================================================

type PastorAccessResponse = {
  success: boolean;
  data: PastorUserAccess[];
  summary: PastorAccessSummary;
};

type PastorLinkResponse = {
  success: boolean;
  message: string;
  data: {
    pastor_id: number;
    pastor_name: string;
    church_id: number;
    church_name: string;
    profile_id: string;
    platform_email: string;
    platform_role: string;
    platform_active: boolean;
  };
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all pastors with their platform access status
 */
export function usePastorAccess(filters?: { status?: string; church_id?: string }): UseQueryResult<PastorAccessResponse, Error> {
  return useQuery({
    queryKey: pastorAccessKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.church_id) params.append('church_id', filters.church_id);

      const response = await fetchJson<PastorAccessResponse>(
        `/api/admin/pastors/access?${params.toString()}`
      );

      return response;
    },
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Link a pastor to a user profile (grant platform access)
 */
export function useLinkPastorProfile(): UseMutationResult<PastorLinkResponse, Error, PastorLinkRequest, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: PastorLinkRequest) => {
      const response = await fetchJson<PastorLinkResponse>('/api/admin/pastors/link-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      return response;
    },
    onSuccess: (data) => {
      // Invalidate pastor access queries
      queryClient.invalidateQueries({ queryKey: pastorAccessKeys.lists() });
      // Invalidate admin users query (may show linked pastor info)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

      toast.success(data.message || 'Pastor linked to profile successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to link pastor to profile');
    },
  });
}

/**
 * Unlink a pastor from their user profile (revoke platform access)
 */
export function useUnlinkPastorProfile(): UseMutationResult<{ success: boolean; message: string }, Error, { pastor_id: number; delete_profile?: boolean }, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { pastor_id: number; delete_profile?: boolean }) => {
      const searchParams = new URLSearchParams({
        pastor_id: params.pastor_id.toString(),
      });

      if (params.delete_profile) {
        searchParams.append('delete_profile', 'true');
      }

      const response = await fetchJson<{ success: boolean; message: string }>(
        `/api/admin/pastors/link-profile?${searchParams.toString()}`,
        {
          method: 'DELETE',
        }
      );

      return response;
    },
    onSuccess: (data) => {
      // Invalidate pastor access queries
      queryClient.invalidateQueries({ queryKey: pastorAccessKeys.lists() });
      // Invalidate admin users query
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

      toast.success(data.message || 'Pastor unlinked from profile successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unlink pastor from profile');
    },
  });
}

/**
 * Change a pastor's platform role (via profile update)
 */
export function useChangePastorRole(): UseMutationResult<{ success: boolean; message: string }, Error, { profile_id: string; role: string }, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { profile_id: string; role: string }) => {
      const response = await fetchJson<{ success: boolean; message: string }>(
        '/api/admin/users',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: params.profile_id,
            role: params.role,
          }),
        }
      );

      return response;
    },
    onSuccess: () => {
      // Invalidate pastor access queries
      queryClient.invalidateQueries({ queryKey: pastorAccessKeys.lists() });
      // Invalidate admin users query
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

      toast.success('Pastor role updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update pastor role');
    },
  });
}
