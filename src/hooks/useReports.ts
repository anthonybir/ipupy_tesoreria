'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api-client';
import {
  type RawReportRecord,
  type ReportFilters,
  type ReportRecord,
  normalizeReportRecord
} from '@/types/api';

const buildQueryString = (filters: ReportFilters): string => {
  const params = new URLSearchParams();

  if (filters.churchId) {
    params.set('church_id', String(filters.churchId));
  }
  if (filters.year) {
    params.set('year', String(filters.year));
  }
  if (filters.month) {
    params.set('month', String(filters.month));
  }
  if (filters.limit) {
    params.set('limit', String(filters.limit));
  }
  if (filters.page) {
    params.set('page', String(filters.page));
  }

  return params.toString();
};

const fetchReports = async (filters: ReportFilters): Promise<ReportRecord[]> => {
  const queryString = buildQueryString({ ...filters, limit: filters.limit ?? 50 });
  const url = queryString ? `/api/reports?${queryString}` : '/api/reports';
  const data = await fetchJson<RawReportRecord[]>(url);
  return data.map(normalizeReportRecord);
};

type QueryTuning = {
  staleTime: number;
  gcTime: number;
  refetchInterval?: number;
};

const determineQueryTuning = (filters: ReportFilters): QueryTuning => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isAggregatedView = !filters.churchId && !filters.month && (filters.limit ?? 0) >= 150;
  const isCurrentPeriod = (filters.year ?? currentYear) === currentYear && (!filters.month || filters.month === currentMonth);
  const isScopedHistory = Boolean(filters.month || (filters.year && filters.year !== currentYear));

  if (isAggregatedView) {
    return {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchInterval: 120 * 1000
    };
  }

  if (isCurrentPeriod) {
    return {
      staleTime: 30 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchInterval: 45 * 1000
    };
  }

  if (isScopedHistory) {
    return {
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000
    };
  }

  return {
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000
  };
};

export const reportQueryKey = (
  filters: ReportFilters
): (string | number | undefined)[] => [
  'reports',
  filters.churchId,
  filters.year,
  filters.month,
  filters.limit ?? 50,
  filters.page ?? 1
];

export function useReports(filters: ReportFilters): UseQueryResult<ReportRecord[], Error> {
  const tuning = determineQueryTuning(filters);

  const pollInterval = tuning.refetchInterval;

  return useQuery<ReportRecord[], Error>({
    queryKey: reportQueryKey(filters),
    queryFn: () => fetchReports(filters),
    placeholderData: (previousData) => previousData ?? [],
    staleTime: tuning.staleTime,
    gcTime: tuning.gcTime,
    ...(typeof pollInterval === 'number'
      ? {
          refetchInterval: pollInterval,
          refetchIntervalInBackground: true,
        }
      : {
          refetchInterval: false,
          refetchIntervalInBackground: false,
        }),
    refetchOnReconnect: true
  });
}

type LastReportResponse = {
  lastReport: { year: number; month: number } | null;
};

export function useLastReport(churchId: number | null): UseQueryResult<LastReportResponse, Error> {
  return useQuery<LastReportResponse, Error>({
    queryKey: ['last-report', churchId],
    queryFn: async () => {
      if (!churchId) {
        return { lastReport: null };
      }
      const url = `/api/reports?last_report=true&church_id=${churchId}`;
      return fetchJson<LastReportResponse>(url);
    },
    enabled: Boolean(churchId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000
  });
}
