import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';
import type { ChurchRecord } from '@/types/api';

export type AdminChurch = ChurchRecord & {
  last_report?: string | null;
};

type AdminChurchesResponse = {
  data?: AdminChurch[];
  error?: string;
};

/**
 * Fetch all churches for admin management panel
 *
 * Returns church list with last report dates for monitoring.
 * Uses TanStack Query for automatic caching and refetching.
 *
 * @returns Query result with church data
 */
export function useAdminChurches(): UseQueryResult<AdminChurch[], Error> {
  return useQuery({
    queryKey: ['admin-churches'],
    queryFn: async () => {
      const response = await fetchJson<AdminChurchesResponse>('/api/churches');
      return response.data ?? [];
    },
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes (formerly cacheTime)
  });
}
