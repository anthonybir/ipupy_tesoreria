import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

export const useAdminFunds = () => {
  return useQuery({
    queryKey: ['admin-funds'],
    queryFn: async () => {
      const response = await fetch('/api/admin/funds', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('No se pudo cargar la información de fondos');
      }

      const json = await response.json();
      const funds = (json.data || []) as Array<Record<string, unknown>>;

      return funds.map<AdminFund>((fund) => ({
        id: Number(fund.id),
        name: String(fund.name),
        description: (fund.description as string) ?? null,
        type: String(fund.type ?? 'desconocido'),
        current_balance: numberOrZero(fund.current_balance),
        total_in: numberOrZero(fund.total_in),
        total_out: numberOrZero(fund.total_out),
        calculated_balance: numberOrZero(fund.calculated_balance),
        is_active: Boolean(fund.is_active)
      }));
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

export const useAdminReports = (filters: AdminReportFilters = {}) => {
  return useQuery<AdminReportsResponse>({
    queryKey: ['admin-reports', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await fetch(`/api/admin/reports?${params.toString()}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar la lista de informes');
      }

      const json = await response.json();
      const reports = (json.data || []).map((item: Record<string, unknown>) => {
        const incomesSource = (item.incomes as Record<string, unknown>) ?? {};
        const expensesSource = (item.expenses as Record<string, unknown>) ?? {};
        const totalsSource = (item.totals as Record<string, unknown>) ?? {};

        const totals = {
          totalEntradas: numberOrZero(totalsSource.totalEntradas),
          fondoNacional: numberOrZero(totalsSource.fondoNacional),
          totalDesignado: numberOrZero(totalsSource.totalDesignado),
          totalOperativo: numberOrZero(totalsSource.totalOperativo),
          totalSalidas: numberOrZero(totalsSource.totalSalidas),
          saldoCalculado: numberOrZero(totalsSource.saldoCalculado),
          saldoFinMes: numberOrZero(totalsSource.saldoFinMes)
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

      const summarySource = json.summary ?? {};
      const summary: AdminReportSummary = {
        totalEntradas: numberOrZero(summarySource.totalEntradas),
        totalDesignado: numberOrZero(summarySource.totalDesignado),
        totalOperativo: numberOrZero(summarySource.totalOperativo),
        totalSalidas: numberOrZero(summarySource.totalSalidas),
        pendingCount: numberOrZero(summarySource.pendingCount)
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

export const useApproveReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { reportId: number }) => {
      const response = await fetch('/api/admin/reports/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'No se pudo aprobar el informe');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-funds'] });
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reconciliation'] });
    }
  });
};

export const useUpdateReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'No se pudo actualizar el informe');
      }

      return response.json();
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

export const useAdminTransactions = (filters: AdminTransactionsFilters = {}) => {
  return useQuery<AdminTransactionsResponse>({
    queryKey: ['admin-transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await fetch(`/api/admin/transactions?${params.toString()}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar el libro diario');
      }

      return response.json() as Promise<AdminTransactionsResponse>;
    },
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000
  });
};

export const useAdminReconciliation = (fundId?: number) => {
  return useQuery({
    queryKey: ['admin-reconciliation', fundId ?? 'all'],
    queryFn: async () => {
      const query = fundId ? `?fund_id=${fundId}` : '';
      const response = await fetch(`/api/admin/reconciliation${query}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('No se pudo generar la conciliación');
      }

      return response.json();
    },
    staleTime: 60 * 1000
  });
};

export const useAdminFundsSummary = () => {
  const { data } = useAdminFunds();
  return useMemo(() => {
    if (!data) return { totalBalance: 0, fundCount: 0 };
    const totalBalance = data.reduce((sum, fund) => sum + fund.calculated_balance, 0);
    return { totalBalance, fundCount: data.length };
  }, [data]);
};
