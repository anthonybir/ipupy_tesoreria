import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const stringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const stringOrDefault = (value: unknown, fallback: string): string => stringOrNull(value) ?? fallback;

const booleanFrom = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
};

export interface AdminFund {
  id: number;
  name: string;
  description: string | null;
  type: string;
  current_balance: number;
  total_in: number;
  total_out: number;
  calculated_balance: number;
  is_active: boolean;
}

export const useAdminFunds = (): UseQueryResult<AdminFund[], Error> => {
  return useQuery({
    queryKey: ['admin-funds'],
    queryFn: async () => {
      const json = await fetchJson<{ data: Array<Record<string, unknown>> }>('/api/admin/funds');
      const funds = json.data as Array<Record<string, unknown>>;

      return funds.map<AdminFund>((fund) => {
        const idValue = Number(fund['id']);
        return {
          id: Number.isFinite(idValue) ? idValue : 0,
          name: stringOrDefault(fund['name'], 'Sin nombre'),
          description: stringOrNull(fund['description']),
          type: stringOrDefault(fund['type'], 'desconocido'),
          current_balance: numberOrZero(fund['current_balance']),
          total_in: numberOrZero(fund['total_in']),
          total_out: numberOrZero(fund['total_out']),
          calculated_balance: numberOrZero(fund['calculated_balance']),
          is_active: booleanFrom(fund['is_active'])
        };
      });
    },
    staleTime: 60 * 1000
  });
};

export interface AdminReportFilters {
  status?: string;
  year?: string;
  month?: string;
  church_id?: string;
  start?: string;
  end?: string;
  limit?: number;
}

export interface AdminReportRecord {
  id: number;
  churchId: number;
  churchName: string;
  month: number;
  year: number;
  status: string;
  transactionsCreated: boolean;
  incomes: Record<string, number>;
  expenses: Record<string, number> & { honorariosPastoral?: number };
  totals: {
    totalEntradas: number;
    fondoNacional: number;
    totalDesignado: number;
    totalOperativo: number;
    totalSalidas: number;
    saldoCalculado: number;
    saldoFinMes: number;
  };
  submittedAt?: string | null;
  processedAt?: string | null;
  processedBy?: string | null;
  observations?: string | null;
  raw: Record<string, unknown>;
}

export interface AdminReportSummary {
  totalEntradas?: number;
  totalDesignado?: number;
  totalOperativo?: number;
  totalSalidas?: number;
  pendingCount?: number;
}

export interface AdminReportsResponse {
  reports: AdminReportRecord[];
  summary: AdminReportSummary;
}

export const useAdminReports = (filters: AdminReportFilters = {}): UseQueryResult<AdminReportsResponse, Error> => {
  return useQuery<AdminReportsResponse>({
    queryKey: ['admin-reports', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const json = await fetchJson<{ data: Array<Record<string, unknown>>; summary: Record<string, unknown> }>(
        `/api/admin/reports?${params.toString()}`
      );
      const reports = json.data.map((item: Record<string, unknown>) => {
        const incomesSource = item['incomes'] as Record<string, unknown>;
        const expensesSource = item['expenses'] as Record<string, unknown>;
        const totalsSource = item['totals'] as Record<string, unknown>;

        const totals = {
          totalEntradas: numberOrZero(totalsSource['totalEntradas']),
          fondoNacional: numberOrZero(totalsSource['fondoNacional']),
          totalDesignado: numberOrZero(totalsSource['totalDesignado']),
          totalOperativo: numberOrZero(totalsSource['totalOperativo']),
          totalSalidas: numberOrZero(totalsSource['totalSalidas']),
          saldoCalculado: numberOrZero(totalsSource['saldoCalculado']),
          saldoFinMes: numberOrZero(totalsSource['saldoFinMes'])
        };

        const expenses = Object.fromEntries(
          Object.entries(expensesSource).map(([key, value]) => [key, numberOrZero(value)])
        ) as AdminReportRecord['expenses'];

        return {
          ...item,
          incomes: Object.fromEntries(
            Object.entries(incomesSource).map(([key, value]) => [key, numberOrZero(value)])
          ) as Record<string, number>,
          expenses,
          totals
        } as AdminReportRecord;
      });

      const summarySource = json.summary;
      const summary: AdminReportSummary = {
        totalEntradas: numberOrZero(summarySource['totalEntradas']),
        totalDesignado: numberOrZero(summarySource['totalDesignado']),
        totalOperativo: numberOrZero(summarySource['totalOperativo']),
        totalSalidas: numberOrZero(summarySource['totalSalidas']),
        pendingCount: numberOrZero(summarySource['pendingCount'])
      };

      return {
        reports,
        summary
      } as AdminReportsResponse;
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000
  });
};

export const useApproveReport = (): UseMutationResult<unknown, Error, { reportId: number }, unknown> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { reportId: number }) => {
      return fetchJson('/api/admin/reports/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-funds'] });
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reconciliation'] });
    }
  });
};

export const useUpdateReport = (): UseMutationResult<unknown, Error, Record<string, unknown>, unknown> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return fetchJson('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    }
  });
};

export interface AdminTransactionsFilters {
  fund_id?: string;
  church_id?: string;
  start_date?: string;
  end_date?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface AdminTransactionsResponse {
  success: boolean;
  data: Array<Record<string, unknown>>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

export const useAdminTransactions = (filters: AdminTransactionsFilters = {}): UseQueryResult<AdminTransactionsResponse, Error> => {
  return useQuery<AdminTransactionsResponse>({
    queryKey: ['admin-transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      return fetchJson<AdminTransactionsResponse>(`/api/admin/transactions?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000
  });
};

export const useAdminReconciliation = (fundId?: number): UseQueryResult<unknown, Error> => {
  return useQuery({
    queryKey: ['admin-reconciliation', fundId ?? 'all'],
    queryFn: async () => {
      const query = fundId ? `?fund_id=${fundId}` : '';
      return fetchJson(`/api/admin/reconciliation${query}`);
    },
    staleTime: 60 * 1000
  });
};

export const useAdminFundsSummary = (): { totalBalance: number; fundCount: number } => {
  const { data } = useAdminFunds();
  return useMemo(() => {
    if (!data) return { totalBalance: 0, fundCount: 0 };
    const totalBalance = data.reduce((sum, fund) => sum + fund.calculated_balance, 0);
    return { totalBalance, fundCount: data.length };
  }, [data]);
};
