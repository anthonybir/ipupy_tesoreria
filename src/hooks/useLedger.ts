'use client';

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api-client';
import {
  type FundMovementCollection,
  type FundMovementFilters,
  type FundMovementsApiResponse,
  normalizeFundMovementsResponse,
} from '@/types/financial';

type UseLedgerOptions = Pick<
  UseQueryOptions<FundMovementCollection, Error>,
  'enabled' | 'staleTime' | 'placeholderData'
>;

const buildQueryString = (filters: FundMovementFilters): string => {
  const params = new URLSearchParams();

  if (filters.reportId) {
    params.set('report_id', String(filters.reportId));
  }

  if (filters.churchId) {
    params.set('church_id', String(filters.churchId));
  }

  if (filters.fundId) {
    params.set('fund_id', String(filters.fundId));
  }

  if (filters.month) {
    params.set('month', String(filters.month));
  }

  if (filters.year) {
    params.set('year', String(filters.year));
  }

  params.set('limit', String(filters.limit ?? 50));
  params.set('offset', String(filters.offset ?? 0));

  return params.toString();
};

const fetchLedger = async (
  filters: FundMovementFilters,
): Promise<FundMovementCollection> => {
  const query = buildQueryString(filters);
  const url = query ? `/api/financial/fund-movements?${query}` : '/api/financial/fund-movements';
  const payload = await fetchJson<FundMovementsApiResponse>(url);
  return normalizeFundMovementsResponse(payload);
};

export const ledgerQueryKey = (
  filters: FundMovementFilters,
) =>
  [
    'financial',
    'fund-movements',
    filters.reportId ?? 'any-report',
    filters.churchId ?? 'any-church',
    filters.fundId ?? 'any-fund',
    filters.month ?? 'any-month',
    filters.year ?? 'any-year',
    filters.limit ?? 50,
    filters.offset ?? 0,
  ] as const;

export function useLedger(filters: FundMovementFilters, options?: UseLedgerOptions): UseQueryResult<FundMovementCollection, Error> {
  const { enabled = true, staleTime, placeholderData } = options ?? {};

  return useQuery<FundMovementCollection, Error>({
    queryKey: ledgerQueryKey(filters),
    queryFn: () => fetchLedger(filters),
    staleTime: staleTime ?? 60 * 1000,
    placeholderData: placeholderData ?? ((previous) => previous ?? undefined),
    enabled,
  });
}
