"use client";

import { useMemo } from "react";
import { api } from "../../convex/_generated/api";

import {
  mapReportDocumentToRaw,
  type ConvexReportDocument,
} from "@/lib/convex-adapters";
import {
  normalizeReportRecord,
  type ReportRecord,
} from "@/types/api";
import {
  useConvexQueryState,
  type ConvexQueryState,
} from "@/hooks/useConvexQueryState";
import { useChurches } from "@/hooks/useChurches";

type UseReportOptions = {
  convexId?: string | null;
  churchId?: number | null;
  year?: number | null;
  month?: number | null;
  enabled?: boolean;
};

type UseReportResult = ConvexQueryState<ReportRecord | null> & {
  data: ReportRecord | null;
};

const mapToReportRecord = (
  report: ConvexReportDocument | null,
  churchLookup: Map<string, number>
): ReportRecord | null => {
  if (!report) {
    return null;
  }

  const enriched: ConvexReportDocument = report.church_supabase_id
    ? report
    : {
        ...report,
        church_supabase_id: churchLookup.get(report.church_id) ?? null,
      };

  return normalizeReportRecord(mapReportDocumentToRaw(enriched));
};

export function useReport(options: UseReportOptions): UseReportResult {
  const { data: churches } = useChurches();

  const churchConvexToSupabase = useMemo(() => {
    const map = new Map<string, number>();
    for (const church of churches) {
      if (church.convexId) {
        map.set(church.convexId, church.id);
      }
    }
    return map;
  }, [churches]);

  const churchSupabaseToConvex = useMemo(() => {
    const map = new Map<number, string>();
    for (const church of churches) {
      if (church.convexId) {
        map.set(church.id, church.convexId);
      }
    }
    return map;
  }, [churches]);

  const convexId = options.convexId ?? null;
  const isEnabled = options.enabled ?? true;

  const hasPeriodFilters =
    options.churchId !== undefined &&
    options.churchId !== null &&
    options.year !== undefined &&
    options.year !== null &&
    options.month !== undefined &&
    options.month !== null;

  const churchConvexId = useMemo(() => {
    if (!hasPeriodFilters) {
      return null;
    }
    return options.churchId !== undefined && options.churchId !== null
      ? churchSupabaseToConvex.get(options.churchId) ?? null
      : null;
  }, [hasPeriodFilters, options.churchId, churchSupabaseToConvex]);

  const directArgs = useMemo(() => {
    return convexId ? [{ id: convexId }] : [];
  }, [convexId]);

  const directQuery = useConvexQueryState(
    api.reports.get,
    directArgs,
    (report: ConvexReportDocument) => mapToReportRecord(report, churchConvexToSupabase),
    {
      enabled: isEnabled && Boolean(convexId),
    }
  );

  const periodArgs = useMemo(() => {
    if (!hasPeriodFilters || !churchConvexId) {
      return [];
    }
    return [
      {
        churchId: churchConvexId,
        year: options.year,
        month: options.month,
      },
    ];
  }, [hasPeriodFilters, churchConvexId, options.year, options.month]);

  const periodQuery = useConvexQueryState(
    api.reports.getByChurchAndPeriod,
    periodArgs,
    (report: ConvexReportDocument | null) => mapToReportRecord(report, churchConvexToSupabase),
    {
      enabled: isEnabled && !convexId && hasPeriodFilters && Boolean(churchConvexId),
    }
  );

  const activeQuery = convexId ? directQuery : periodQuery;

  return {
    ...activeQuery,
    data: activeQuery.data ?? null,
  };
}
