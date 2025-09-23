import type { RawNumeric } from './api';
import { toNumber } from './api';

const toNullableNumber = (value: RawNumeric): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
};

export type RawFundRecord = {
  id: number;
  name: string;
  description: string;
  category: string;
  initial_balance: RawNumeric;
  current_balance: RawNumeric;
  target_amount: RawNumeric;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FundRecord = {
  id: number;
  name: string;
  description: string;
  category: string;
  balances: {
    initial: number;
    current: number;
    target: number | null;
  };
  status: {
    active: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export const normalizeFundRecord = (raw: RawFundRecord): FundRecord => ({
  id: raw.id,
  name: raw.name,
  description: raw.description,
  category: raw.category,
  balances: {
    initial: toNumber(raw.initial_balance, 0),
    current: toNumber(raw.current_balance, 0),
    target: toNullableNumber(raw.target_amount),
  },
  status: {
    active: raw.active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  },
});

export type FundTotals = {
  totalFunds: number;
  activeFunds: number;
  totalBalance: number;
  totalTarget: number;
};

export type RawFundTotals = {
  total_funds: number;
  active_funds: number;
  total_balance: number;
  total_target: number;
};

export const normalizeFundTotals = (raw: RawFundTotals): FundTotals => ({
  totalFunds: raw.total_funds,
  activeFunds: raw.active_funds,
  totalBalance: raw.total_balance,
  totalTarget: raw.total_target,
});

export type FundsApiResponse = {
  success?: boolean;
  data: RawFundRecord[];
  totals: RawFundTotals;
};

export type FundCollection = {
  records: FundRecord[];
  totals: FundTotals;
};

export const normalizeFundsResponse = (payload: FundsApiResponse): FundCollection => ({
  records: payload.data.map(normalizeFundRecord),
  totals: normalizeFundTotals(payload.totals),
});

export type TransactionFilters = {
  fundId?: number;
  churchId?: number;
  reportId?: number;
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type RawTransactionRecord = {
  id: number;
  date: string;
  fund_id: number;
  fund_name?: string | null;
  church_id?: number | null;
  church_name?: string | null;
  report_id?: number | null;
  concept: string;
  provider?: string | null;
  document_number?: string | null;
  amount_in: RawNumeric;
  amount_out: RawNumeric;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
};

export type TransactionRecord = {
  id: number;
  date: string;
  concept: string;
  fund: {
    id: number;
    name: string | null;
  };
  church: {
    id: number | null;
    name: string | null;
  };
  reportId: number | null;
  provider: string | null;
  documentNumber: string | null;
  amounts: {
    in: number;
    out: number;
    balance: number;
  };
  audit: {
    createdBy: string;
    createdAt: string;
    updatedAt: string | null;
  };
};

export const normalizeTransactionRecord = (
  raw: RawTransactionRecord,
): TransactionRecord => {
  const amountIn = toNumber(raw.amount_in, 0);
  const amountOut = toNumber(raw.amount_out, 0);

  return {
    id: raw.id,
    date: raw.date,
    concept: raw.concept,
    fund: {
      id: raw.fund_id,
      name: raw.fund_name ?? null,
    },
    church: {
      id: raw.church_id ?? null,
      name: raw.church_name ?? null,
    },
    reportId: raw.report_id ?? null,
    provider: raw.provider ?? null,
    documentNumber: raw.document_number ?? null,
    amounts: {
      in: amountIn,
      out: amountOut,
      balance: amountIn - amountOut,
    },
    audit: {
      createdBy: raw.created_by,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at ?? null,
    },
  };
};

export type TransactionTotals = {
  count: number;
  totalIn: number;
  totalOut: number;
  balance: number;
};

export type RawTransactionTotals = {
  count: number;
  total_in: number;
  total_out: number;
  balance: number;
};

export const normalizeTransactionTotals = (
  raw: RawTransactionTotals,
): TransactionTotals => ({
  count: raw.count,
  totalIn: raw.total_in,
  totalOut: raw.total_out,
  balance: raw.balance,
});

export type TransactionPagination = {
  limit: number;
  offset: number;
  total: number;
};

export type TransactionsApiResponse = {
  success?: boolean;
  data: RawTransactionRecord[];
  pagination: TransactionPagination;
  totals: {
    count: number;
    total_in: number;
    total_out: number;
    balance: number;
  };
};

export type TransactionCollection = {
  records: TransactionRecord[];
  pagination: TransactionPagination;
  totals: TransactionTotals;
};

export const normalizeTransactionsResponse = (
  payload: TransactionsApiResponse,
): TransactionCollection => ({
  records: payload.data.map(normalizeTransactionRecord),
  pagination: payload.pagination,
  totals: normalizeTransactionTotals({
    count: payload.totals.count,
    total_in: payload.totals.total_in,
    total_out: payload.totals.total_out,
    balance: payload.totals.balance,
  }),
});

export type FundMovementFilters = {
  reportId?: number;
  churchId?: number;
  fundId?: number;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
};

export type RawFundMovementRecord = {
  id: number;
  report_id: number;
  church_id: number;
  fund_id: number;
  amount: RawNumeric;
  type: 'automatic' | 'manual';
  description: string;
  created_at: string;
  created_by: string;
  church_name?: string | null;
  fund_name?: string | null;
  report_month?: number | null;
  report_year?: number | null;
};

export type FundMovementRecord = {
  id: number;
  amount: number;
  type: 'automatic' | 'manual';
  description: string;
  createdAt: string;
  createdBy: string;
  fund: {
    id: number;
    name: string | null;
  };
  church: {
    id: number;
    name: string | null;
  };
  report: {
    id: number;
    month: number | null;
    year: number | null;
  };
};

export const normalizeFundMovementRecord = (
  raw: RawFundMovementRecord,
): FundMovementRecord => ({
  id: raw.id,
  amount: toNumber(raw.amount, 0),
  type: raw.type,
  description: raw.description,
  createdAt: raw.created_at,
  createdBy: raw.created_by,
  fund: {
    id: raw.fund_id,
    name: raw.fund_name ?? null,
  },
  church: {
    id: raw.church_id,
    name: raw.church_name ?? null,
  },
  report: {
    id: raw.report_id,
    month: raw.report_month ?? null,
    year: raw.report_year ?? null,
  },
});

export type FundMovementTotals = {
  count: number;
  totalAmount: number;
};

export type RawFundMovementTotals = {
  count: number;
  total_amount: RawNumeric;
};

export const normalizeFundMovementTotals = (
  raw: RawFundMovementTotals,
): FundMovementTotals => ({
  count: raw.count,
  totalAmount: toNumber(raw.total_amount, 0),
});

export type FundMovementsApiResponse = {
  success?: boolean;
  data: RawFundMovementRecord[];
  pagination: TransactionPagination;
  totals: {
    count: number;
    total_amount: RawNumeric;
  };
};

export type FundMovementCollection = {
  records: FundMovementRecord[];
  pagination: TransactionPagination;
  totals: FundMovementTotals;
};

export const normalizeFundMovementsResponse = (
  payload: FundMovementsApiResponse,
): FundMovementCollection => ({
  records: payload.data.map(normalizeFundMovementRecord),
  pagination: payload.pagination,
  totals: normalizeFundMovementTotals({
    count: payload.totals.count,
    total_amount: payload.totals.total_amount,
  }),
});

export type ExportType = 'monthly' | 'yearly' | 'churches';

export type DataExportParams = {
  year: number;
  month?: number;
  type: ExportType;
};
