'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api-client';
import {
  RawReportRecord,
  ReportFilters,
  ReportRecord,
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

export function useReports(filters: ReportFilters) {
  return useQuery<ReportRecord[], Error>({
    queryKey: reportQueryKey(filters),
    queryFn: () => fetchReports(filters),
    placeholderData: (previousData) => previousData ?? []
  });
}
