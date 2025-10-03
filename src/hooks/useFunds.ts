'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api-client';
import {
  type FundCollection,
  type FundsApiResponse,
  normalizeFundsResponse,
} from '@/types/financial';

type FundsFilters = {
  includeInactive?: boolean;
  category?: string;
};

type UseFundsOptions = Pick<UseQueryOptions<FundCollection, Error>, 'enabled' | 'staleTime'>;

const buildQueryString = (filters: FundsFilters): string => {
  const params = new URLSearchParams();

  if (filters.includeInactive) {
    params.set('include_inactive', 'true');
  }

  if (filters.category) {
    params.set('category', filters.category);
  }

  return params.toString();
};

const fetchFunds = async (filters: FundsFilters): Promise<FundCollection> => {
  const query = buildQueryString(filters);
  const url = query ? `/api/financial/funds?${query}` : '/api/financial/funds';
  const payload = await fetchJson<FundsApiResponse>(url);
  return normalizeFundsResponse(payload);
};

export const fundsQueryKey = (filters: FundsFilters) =>
  ['financial', 'funds', filters.includeInactive ?? false, filters.category ?? 'all'] as const;

export function useFunds(filters: FundsFilters = {}, options?: UseFundsOptions) {
  const { enabled, staleTime } = options ?? {};

  return useQuery<FundCollection, Error>({
    queryKey: fundsQueryKey(filters),
    queryFn: () => fetchFunds(filters),
    staleTime: staleTime ?? 2 * 60 * 1000,
    ...(typeof enabled === 'boolean' ? { enabled } : {}),
  });
}
