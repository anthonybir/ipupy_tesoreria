'use client';

import { useMemo } from 'react';
import { api } from '../../convex/_generated/api';

import { mapFundsListResponse, type ConvexFundDocument, type ConvexFundTotals } from '@/lib/convex-adapters';
import { normalizeFundsResponse, type FundCollection, type FundsApiResponse } from '@/types/financial';
import { useConvexQueryState, type ConvexQueryState } from '@/hooks/useConvexQueryState';

type FundsFilters = {
  includeInactive?: boolean;
  category?: string;
};

type UseFundsOptions = {
  enabled?: boolean;
  staleTime?: number; // retained for compatibility but ignored (Convex handles freshness)
};

type UseFundsResult = ConvexQueryState<FundCollection> & { data: FundCollection };

const EMPTY_FUNDS: FundCollection = {
  records: [],
  totals: {
    totalFunds: 0,
    activeFunds: 0,
    totalBalance: 0,
    totalTarget: 0,
  },
};

const mapFunds = (result: { data: ConvexFundDocument[]; totals: ConvexFundTotals }): FundCollection => {
  const payload: FundsApiResponse = mapFundsListResponse(result);
  return normalizeFundsResponse(payload);
};

const buildArgs = (filters: FundsFilters): readonly unknown[] => {
  const args: { type?: string; include_inactive?: boolean } = {};

  if (filters.category) {
    args.type = filters.category;
  }

  if (filters.includeInactive) {
    args.include_inactive = true;
  }

  return Object.keys(args).length > 0 ? [args] : [{}];
};

export const fundsQueryKey = (filters: FundsFilters) =>
  ['financial', 'funds', filters.includeInactive ?? false, filters.category ?? 'all'] as const;

export function useFunds(filters: FundsFilters = {}, options?: UseFundsOptions): UseFundsResult {
  const args = useMemo(() => buildArgs(filters), [filters]);
  const enabled = options?.enabled ?? true;

  const queryResult = useConvexQueryState(
    api.funds.list,
    args,
    (result: { data: ConvexFundDocument[]; totals: ConvexFundTotals }) => mapFunds(result),
    { enabled }
  );

  const data = useMemo(() => queryResult.data ?? EMPTY_FUNDS, [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}
