"use client";

import { useMemo } from "react";
import { api } from "../../convex/_generated/api";

import {
  mapTransactionsToFundMovements,
  type ConvexTransactionsListResult,
} from "@/lib/convex-adapters";
import {
  normalizeFundMovementsResponse,
  type FundMovementCollection,
  type FundMovementFilters,
} from "@/types/financial";
import { useFunds } from "@/hooks/useFunds";
import { useChurches } from "@/hooks/useChurches";
import {
  useConvexQueryState,
  type ConvexQueryState,
} from "@/hooks/useConvexQueryState";

type UseLedgerOptions = {
  enabled?: boolean;
};

type UseLedgerResult = ConvexQueryState<FundMovementCollection> & {
  data: FundMovementCollection;
};

type TransactionsListArgs = {
  fund_id?: string;
  church_id?: string;
  report_supabase_id?: number;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
};

const EMPTY_COLLECTION: FundMovementCollection = {
  records: [],
  pagination: {
    limit: 50,
    offset: 0,
    total: 0,
  },
  totals: {
    count: 0,
    totalAmount: 0,
  },
};

const buildArgs = (
  filters: FundMovementFilters,
  fundSupabaseToConvex: Map<number, string>,
  churchSupabaseToConvex: Map<number, string>
): readonly unknown[] => {
  const args: TransactionsListArgs = {};

  if (filters.fundId) {
    const convexId = fundSupabaseToConvex.get(filters.fundId);
    if (convexId) {
      args.fund_id = convexId;
    }
  }

  if (filters.churchId) {
    const convexId = churchSupabaseToConvex.get(filters.churchId);
    if (convexId) {
      args.church_id = convexId;
    }
  }

  if (filters.reportId) {
    args.report_supabase_id = filters.reportId;
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

  return [args];
};

export function useLedger(
  filters: FundMovementFilters,
  options?: UseLedgerOptions
): UseLedgerResult {
  const fundsQuery = useFunds({ includeInactive: true });
  const churchesQuery = useChurches();

  const fundSupabaseToConvex = useMemo(() => {
    const map = new Map<number, string>();
    for (const fund of fundsQuery.data.records) {
      if (fund.convexId) {
        map.set(fund.id, fund.convexId);
      }
    }
    return map;
  }, [fundsQuery.data.records]);

  const churchSupabaseToConvex = useMemo(() => {
    const map = new Map<number, string>();
    for (const church of churchesQuery.data) {
      if (church.convexId) {
        map.set(church.id, church.convexId);
      }
    }
    return map;
  }, [churchesQuery.data]);

  const args = useMemo(
    () => buildArgs(filters, fundSupabaseToConvex, churchSupabaseToConvex),
    [filters, fundSupabaseToConvex, churchSupabaseToConvex]
  );

  const enabled = options?.enabled ?? true;

  const queryResult = useConvexQueryState(
    api.transactions.list,
    args,
    (result: ConvexTransactionsListResult) =>
      normalizeFundMovementsResponse(mapTransactionsToFundMovements(result)),
    { enabled }
  );

  const data = useMemo(
    () => queryResult.data ?? EMPTY_COLLECTION,
    [queryResult.data]
  );

  return {
    ...queryResult,
    data,
  };
}
