import { useCallback, useMemo } from 'react';
import { useQuery, keepPreviousData, type UseQueryResult } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';
import { useConvexQueryState, type ConvexQueryState } from '@/hooks/useConvexQueryState';
import { api } from '../../convex/_generated/api';
import { type ConvexFundDocument, type ConvexReportDocument } from '@/lib/convex-adapters';

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

type AdminQueryResult<T> = ConvexQueryState<T> & { data: T };

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

type ConvexFundWithStats = ConvexFundDocument & {
  total_in?: number;
  total_out?: number;
  transaction_count?: number;
};

const timestampToIso = (value?: number | null): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const mapConvexFundToAdminFund = (fund: ConvexFundWithStats): AdminFund => {
  const totalIn = fund.total_in ?? 0;
  const totalOut = fund.total_out ?? 0;
  const calculatedBalance = fund.current_balance + (totalIn - totalOut);

  return {
    id: fund.supabase_id ?? 0,
    name: fund.name,
    description: fund.description ?? null,
    type: fund.type ?? 'desconocido',
    current_balance: fund.current_balance,
    total_in: totalIn,
    total_out: totalOut,
    calculated_balance: calculatedBalance,
    is_active: fund.is_active,
  };
};

export const useAdminFunds = (): AdminQueryResult<AdminFund[]> => {
  const queryResult = useConvexQueryState(
    api.funds.list,
    [{ include_inactive: true }],
    (result: { data: ConvexFundWithStats[] }) => result.data.map(mapConvexFundToAdminFund)
  );

  const data = useMemo(() => queryResult.data ?? [], [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
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
  convexId: string | null;
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

type AdminReportsQueryResult = ConvexQueryState<AdminReportsResponse> & { data: AdminReportsResponse };

const mapConvexReportToAdmin = (report: ConvexReportDocument): AdminReportRecord => {
  const incomes: Record<string, number> = {
    diezmos: numberOrZero(report.diezmos),
    ofrendas: numberOrZero(report.ofrendas),
    anexos: numberOrZero(report.anexos),
    caballeros: numberOrZero(report.caballeros ?? report.aporte_caballeros),
    damas: numberOrZero(report.damas),
    jovenes: numberOrZero(report.jovenes),
    ninos: numberOrZero(report.ninos),
    otros: numberOrZero(report.otros),
  };

  const expenses: AdminReportRecord['expenses'] = {
    honorariosPastoral: numberOrZero(report.honorarios_pastoral),
    energiaElectrica: numberOrZero(report.energia_electrica),
    agua: numberOrZero(report.agua),
    recoleccionBasura: numberOrZero(report.recoleccion_basura),
    servicios: numberOrZero(report.servicios),
    mantenimiento: numberOrZero(report.mantenimiento),
    materiales: numberOrZero(report.materiales),
    otrosGastos: numberOrZero(report.otros_gastos),
  };

  const totalEntradas = numberOrZero(report.total_entradas);
  const totalDesignadoSource =
    report.total_designado !== undefined ? report.total_designado : report.total_fondo_nacional;
  const totalDesignado = numberOrZero(totalDesignadoSource);
  const totalOperativo = numberOrZero(report.total_operativo);
  const totalSalidasSource =
    report.total_salidas !== undefined ? report.total_salidas : report.total_salidas_calculadas;
  const totalSalidas = numberOrZero(totalSalidasSource);
  const saldoCalculado = numberOrZero(report.saldo_calculado);
  const saldoFinMesSource =
    (report as { saldo_fin_mes?: number | null }).saldo_fin_mes ?? report.saldo_mes ?? report.saldo_calculado;
  const saldoFinMes = numberOrZero(saldoFinMesSource);

  const supabaseId = typeof report.supabase_id === 'number' ? report.supabase_id : 0;
  const convexId = typeof report._id === 'string' ? report._id : null;
  const churchSupabaseId =
    typeof report.church_supabase_id === 'number' ? report.church_supabase_id : 0;
  const churchName = report.church_name ?? 'Desconocida';

  return {
    id: supabaseId,
    convexId,
    churchId: churchSupabaseId,
    churchName,
    month: report.month ?? 0,
    year: report.year ?? 0,
    status: report.estado,
    transactionsCreated: Boolean(report.transactions_created),
    incomes,
    expenses,
    totals: {
      totalEntradas,
      fondoNacional: numberOrZero(report.fondo_nacional),
      totalDesignado,
      totalOperativo,
      totalSalidas,
      saldoCalculado,
      saldoFinMes,
    },
    submittedAt: timestampToIso(report.submitted_at),
    processedAt: timestampToIso(report.processed_at),
    processedBy: report.processed_by ?? null,
    observations: report.observaciones ?? null,
    raw: report as Record<string, unknown>,
  };
};

const computeReportSummary = (reports: AdminReportRecord[]): AdminReportSummary => {
  return reports.reduce<Required<AdminReportSummary>>(
    (acc, report) => {
      acc.totalEntradas += report.totals.totalEntradas;
      acc.totalDesignado += report.totals.totalDesignado;
      acc.totalOperativo += report.totals.totalOperativo;
      acc.totalSalidas += report.totals.totalSalidas;
      if (report.status.includes('pendiente')) {
        acc.pendingCount += 1;
      }
      return acc;
    },
    { totalEntradas: 0, totalDesignado: 0, totalOperativo: 0, totalSalidas: 0, pendingCount: 0 }
  );
};

const filterReportsByAdminFilters = (
  reports: ConvexReportDocument[],
  filters: AdminReportFilters
) => {
  const statusFilter = filters.status;
  const churchIdFilter = filters.church_id ? Number(filters.church_id) : undefined;
  const yearFilter = filters.year ? Number(filters.year) : undefined;
  const monthFilter = filters.month && filters.month !== 'all' ? Number(filters.month) : undefined;
  const limit = typeof filters.limit === 'number' ? filters.limit : undefined;
  const startTimestamp = filters.start ? Date.parse(filters.start) : Number.NaN;
  const endTimestamp = filters.end ? Date.parse(filters.end) : Number.NaN;

  const filtered = reports.filter((report) => {
    if (statusFilter && report.estado !== statusFilter) {
      return false;
    }
    if (Number.isFinite(yearFilter) && report.year !== yearFilter) {
      return false;
    }
    if (Number.isFinite(monthFilter) && report.month !== monthFilter) {
      return false;
    }
    if (Number.isFinite(churchIdFilter) && report.church_supabase_id !== churchIdFilter) {
      return false;
    }

    if (!Number.isNaN(startTimestamp)) {
      const reference = report.submitted_at ?? report.created_at ?? report.updated_at ?? null;
      if (reference === null || reference < startTimestamp) {
        return false;
      }
    }

    if (!Number.isNaN(endTimestamp)) {
      const reference = report.submitted_at ?? report.created_at ?? report.updated_at ?? null;
      if (reference === null || reference > endTimestamp) {
        return false;
      }
    }

    return true;
  });

  const limited = typeof limit === 'number' ? filtered.slice(0, limit) : filtered;

  return { filtered, limited };
};

export const useAdminReports = (filters: AdminReportFilters = {}): AdminReportsQueryResult => {
  const yearNumber = filters.year ? Number(filters.year) : undefined;
  const monthNumber = filters.month && filters.month !== 'all' ? Number(filters.month) : undefined;

  const serverArgs = useMemo(() => {
    const args: { year?: number; month?: number } = {};
    if (Number.isFinite(yearNumber)) {
      args.year = yearNumber as number;
    }
    if (Number.isFinite(monthNumber)) {
      args.month = monthNumber as number;
    }
    return [args];
  }, [yearNumber, monthNumber]);

  const mapReports = useCallback(
    (reports: ConvexReportDocument[]): AdminReportsResponse => {
      const { filtered, limited } = filterReportsByAdminFilters(reports, filters);
      const mappedAll = filtered.map(mapConvexReportToAdmin);
      const mappedLimited = limited === filtered ? mappedAll : limited.map(mapConvexReportToAdmin);
      const summary = computeReportSummary(mappedAll);

      return {
        reports: mappedLimited,
        summary,
      };
    },
    [filters]
  );

  const queryResult = useConvexQueryState(api.reports.list, serverArgs, mapReports);

  const data = useMemo(
    () =>
      queryResult.data ?? {
        reports: [],
        summary: {
          totalEntradas: 0,
          totalDesignado: 0,
          totalOperativo: 0,
          totalSalidas: 0,
          pendingCount: 0,
        },
      },
    [queryResult.data]
  );

  return {
    ...queryResult,
    data,
  };
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
    const totalBalance = data.reduce((sum, fund) => sum + fund.calculated_balance, 0);
    return { totalBalance, fundCount: data.length };
  }, [data]);
};
