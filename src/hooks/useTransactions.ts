"use client";

import { useMemo } from "react";
import { api } from "../../convex/_generated/api";

import {
  mapTransactionsListResponse,
  type ConvexTransactionsListResult,
} from "@/lib/convex-adapters";
import {
  normalizeTransactionsResponse,
  type TransactionCollection,
  type TransactionFilters,
} from "@/types/financial";
import { useFunds } from "@/hooks/useFunds";
import { useChurches } from "@/hooks/useChurches";
import {
  useConvexQueryState,
  type ConvexQueryState,
} from "@/hooks/useConvexQueryState";

type UseTransactionsOptions = {
  enabled?: boolean;
};

type UseTransactionsResult = ConvexQueryState<TransactionCollection> & {
  data: TransactionCollection;
};

type LookupMaps = {
  fundMap: Map<string, number>;
  fundSupabaseToConvex: Map<number, string>;
  churchMap: Map<string, number>;
  churchSupabaseToConvex: Map<number, string>;
};

type TransactionsQueryArgs = {
  fund_id?: string;
  church_id?: string;
  date_from?: number;
  date_to?: number;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
};

const EMPTY_COLLECTION: TransactionCollection = {
  records: [],
  pagination: {
    limit: 50,
    offset: 0,
    total: 0,
  },
  totals: {
    count: 0,
    totalIn: 0,
    totalOut: 0,
    balance: 0,
  },
};

const buildLookupMaps = (
  funds: ReturnType<typeof useFunds>["data"],
  churches: ReturnType<typeof useChurches>["data"]
): LookupMaps => {
  const fundMap = new Map<string, number>();
  const fundSupabaseToConvex = new Map<number, string>();

  for (const fund of funds.records) {
    if (fund.convexId) {
      fundMap.set(fund.convexId, fund.id);
      fundSupabaseToConvex.set(fund.id, fund.convexId);
    }
  }

  const churchMap = new Map<string, number>();
  const churchSupabaseToConvex = new Map<number, string>();

  for (const church of churches) {
    if (church.convexId) {
      churchMap.set(church.convexId, church.id);
      churchSupabaseToConvex.set(church.id, church.convexId);
    }
  }

  return {
    fundMap,
    fundSupabaseToConvex,
    churchMap,
    churchSupabaseToConvex,
  };
};

const buildArgs = (
  filters: TransactionFilters,
  maps: LookupMaps
): readonly unknown[] => {
  const args: TransactionsQueryArgs = {};

  if (filters.fundId) {
    const convexId = maps.fundSupabaseToConvex.get(filters.fundId);
    if (convexId) {
      args.fund_id = convexId;
    }
  }

  if (filters.churchId) {
    const convexId = maps.churchSupabaseToConvex.get(filters.churchId);
    if (convexId) {
      args.church_id = convexId;
    }
  }

  if (filters.dateFrom) {
    const timestamp = Date.parse(filters.dateFrom);
    if (!Number.isNaN(timestamp)) {
      args.date_from = timestamp;
    }
  }

  if (filters.dateTo) {
    const timestamp = Date.parse(filters.dateTo);
    if (!Number.isNaN(timestamp)) {
      args.date_to = timestamp;
    }
  }

  if (typeof filters.month === "number") {
    args.month = filters.month;
  }

  if (typeof filters.year === "number") {
    args.year = filters.year;
  }

  if (typeof filters.limit === "number") {
    args.limit = filters.limit;
  }

  if (typeof filters.offset === "number") {
    args.offset = filters.offset;
  }

  return Object.keys(args).length > 0 ? [args] : [{}];
};

export function useTransactions(
  filters: TransactionFilters,
  options?: UseTransactionsOptions
): UseTransactionsResult {
  const fundsQuery = useFunds({ includeInactive: true });
  const churchesQuery = useChurches();

  const lookupMaps = useMemo(
    () => buildLookupMaps(fundsQuery.data, churchesQuery.data),
    [fundsQuery.data, churchesQuery.data]
  );

  const args = useMemo(
    () => buildArgs(filters, lookupMaps),
    [filters, lookupMaps]
  );

  const enabled = options?.enabled ?? true;

  const queryResult = useConvexQueryState(
    api.transactions.list,
    args,
    (result: ConvexTransactionsListResult) => {
      const payload = mapTransactionsListResponse(result, {
        fundMap: lookupMaps.fundMap,
        churchMap: lookupMaps.churchMap,
      });
      return normalizeTransactionsResponse(payload);
    },
    { enabled }
  );

  const data = useMemo(() => queryResult.data ?? EMPTY_COLLECTION, [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}
