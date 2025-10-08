"use client";

import { useEffect, useMemo } from "react";
import { api } from "../../convex/_generated/api";

import {
  mapReportDocumentToRaw,
  type ConvexReportDocument,
} from "@/lib/convex-adapters";
import {
  normalizeReportRecord,
  type ReportFilters,
  type ReportRecord,
} from "@/types/api";
import {
  useConvexQueryState,
  type ConvexQueryState,
} from "@/hooks/useConvexQueryState";
import { useChurches } from "@/hooks/useChurches";

type QueryTuning = {
  staleTime: number;
  gcTime: number;
  refetchInterval?: number;
};

const determineQueryTuning = (filters: ReportFilters): QueryTuning => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isAggregatedView =
    !filters.churchId && !filters.month && (filters.limit ?? 0) >= 150;
  const isCurrentPeriod =
    (filters.year ?? currentYear) === currentYear &&
    (!filters.month || filters.month === currentMonth);
  const isScopedHistory = Boolean(
    filters.month || (filters.year && filters.year !== currentYear)
  );

  if (isAggregatedView) {
    return {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchInterval: 120 * 1000,
    };
  }

  if (isCurrentPeriod) {
    return {
      staleTime: 30 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchInterval: 45 * 1000,
    };
  }

  if (isScopedHistory) {
    return {
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    };
  }

  return {
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  };
};

export const reportQueryKey = (
  filters: ReportFilters
): (string | number | undefined)[] => [
  "reports",
  filters.churchId,
  filters.year,
  filters.month,
  filters.limit ?? 50,
  filters.page ?? 1,
];

type UseReportsResult = ConvexQueryState<ReportRecord[]> & {
  data: ReportRecord[];
};

const DEFAULT_LIMIT = 50;

const mapReportsToRecords = (
  reports: ConvexReportDocument[],
  filters: ReportFilters
): ReportRecord[] => {
  const normalized = reports
    .map((report) => normalizeReportRecord(mapReportDocumentToRaw(report)))
    .filter((report) => {
      if (filters.churchId && report.churchId !== filters.churchId) {
        return false;
      }
      if (filters.year && report.year !== filters.year) {
        return false;
      }
      if (filters.month && report.month !== filters.month) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    });

  const limit = filters.limit ?? DEFAULT_LIMIT;
  const page = filters.page ?? 1;
  const start = Math.max(0, (page - 1) * limit);
  const end = start + limit;

  return normalized.slice(start, end);
};

export function useReports(filters: ReportFilters): UseReportsResult {
  const tuning = useMemo(() => determineQueryTuning(filters), [filters]);
  const { data: churches } = useChurches();

  const convexChurchId = useMemo(() => {
    if (!filters.churchId) {
      return undefined;
    }
    const match = churches.find((church) => church.id === filters.churchId);
    return match?.convexId ?? undefined;
  }, [churches, filters.churchId]);

  const serverArgs = useMemo(() => {
    const args: { churchId?: string; year?: number; month?: number } = {};
    if (convexChurchId) {
      args.churchId = convexChurchId;
    }
    if (typeof filters.year === "number") {
      args.year = filters.year;
    }
    if (typeof filters.month === "number") {
      args.month = filters.month;
    }
    return [args];
  }, [convexChurchId, filters.year, filters.month]);

  const queryResult = useConvexQueryState(
    api.reports.list,
    serverArgs,
    (reports: ConvexReportDocument[]) => mapReportsToRecords(reports, filters)
  );

  const { refetch } = queryResult;

  useEffect(() => {
    if (typeof tuning.refetchInterval !== "number") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refetch();
    }, tuning.refetchInterval);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refetch, tuning.refetchInterval]);

  const data = useMemo(() => queryResult.data ?? [], [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}

type LastReportResponse = {
  lastReport: { year: number; month: number } | null;
};

type UseLastReportResult = ConvexQueryState<LastReportResponse> & {
  data: LastReportResponse;
};

const computeLastReport = (
  reports: ConvexReportDocument[],
  churchId: number | null
): LastReportResponse => {
  if (!churchId) {
    return { lastReport: null };
  }

  const normalized = reports
    .map((report) => normalizeReportRecord(mapReportDocumentToRaw(report)))
    .filter((report) => report.churchId === churchId)
    .sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    });

  const [mostRecent] = normalized;

  if (!mostRecent) {
    return { lastReport: null };
  }

  return {
    lastReport: {
      year: mostRecent.year,
      month: mostRecent.month,
    },
  };
};

export function useLastReport(churchId: number | null): UseLastReportResult {
  const { data: churches } = useChurches();

  const convexChurchId = useMemo(() => {
    if (churchId === null) {
      return undefined;
    }
    const match = churches.find((church) => church.id === churchId);
    return match?.convexId ?? undefined;
  }, [churches, churchId]);

  const serverArgs = useMemo(() => {
    if (!convexChurchId) {
      return [{}];
    }
    return [{ churchId: convexChurchId }];
  }, [convexChurchId]);

  const queryResult = useConvexQueryState(
    api.reports.list,
    serverArgs,
    (reports: ConvexReportDocument[]) => computeLastReport(reports, churchId)
  );

  const data = useMemo(
    () => queryResult.data ?? { lastReport: null },
    [queryResult.data]
  );

  return {
    ...queryResult,
    data,
  };
}
