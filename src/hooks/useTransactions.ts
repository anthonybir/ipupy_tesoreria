'use client';

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api-client';
import {
  type TransactionCollection,
  type TransactionFilters,
  type TransactionsApiResponse,
  normalizeTransactionsResponse,
} from '@/types/financial';

type UseTransactionsOptions = Pick<
  UseQueryOptions<TransactionCollection, Error>,
  'enabled' | 'staleTime' | 'placeholderData'
>;

const buildQueryString = (filters: TransactionFilters): string => {
  const params = new URLSearchParams();

  if (filters.fundId) {
    params.set('fund_id', String(filters.fundId));
  }

  if (filters.churchId) {
    params.set('church_id', String(filters.churchId));
  }

  if (filters.dateFrom) {
    params.set('date_from', filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set('date_to', filters.dateTo);
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

const fetchTransactions = async (
  filters: TransactionFilters,
): Promise<TransactionCollection> => {
  const query = buildQueryString(filters);
  const url = query ? `/api/financial/transactions?${query}` : '/api/financial/transactions';
  const payload = await fetchJson<TransactionsApiResponse>(url);
  return normalizeTransactionsResponse(payload);
};

export const transactionsQueryKey = (
  filters: TransactionFilters,
) =>
  [
    'financial',
    'transactions',
    filters.fundId ?? 'all',
    filters.churchId ?? 'all',
    filters.month ?? 'any-month',
    filters.year ?? 'any-year',
    filters.dateFrom ?? null,
    filters.dateTo ?? null,
    filters.limit ?? 50,
    filters.offset ?? 0,
  ] as const;

export function useTransactions(
  filters: TransactionFilters,
  options?: UseTransactionsOptions,
): UseQueryResult<TransactionCollection, Error> {
  const { enabled = true, staleTime, placeholderData } = options ?? {};

  return useQuery<TransactionCollection, Error>({
    queryKey: transactionsQueryKey(filters),
    queryFn: () => fetchTransactions(filters),
    staleTime: staleTime ?? 30 * 1000,
    placeholderData: placeholderData ?? ((previous) => previous ?? undefined),
    enabled,
  });
}
