import type { RawNumeric } from './api';
import { toNumber } from './api';


export type RawFundRecord = {
  id: number;
  name: string;
  description: string;
  type: string;
  current_balance: RawNumeric;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
};

export type FundRecord = {
  id: number;
  name: string;
  description: string;
  type: string;
  balances: {
    current: number;
  };
  status: {
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  };
};

export const normalizeFundRecord = (raw: RawFundRecord): FundRecord => ({
  id: raw.id,
  name: raw.name,
  description: raw.description,
  type: raw.type,
  balances: {
    current: toNumber(raw.current_balance, 0),
  },
  status: {
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    createdBy: raw.created_by,
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

export type EventStatus = 'draft' | 'pending_revision' | 'submitted' | 'approved' | 'rejected' | 'cancelled';

export type EventCategory = 'venue' | 'materials' | 'food' | 'transport' | 'honoraria' | 'marketing' | 'other';

export type EventLineType = 'income' | 'expense';

export type RawFundEvent = {
  id: string;
  fund_id: number;
  church_id: number | null;
  name: string;
  description: string | null;
  event_date: string;
  status: EventStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  fund_name?: string | null;
  church_name?: string | null;
  created_by_name?: string | null;
  total_budget?: RawNumeric;
  total_income?: RawNumeric;
  total_expense?: RawNumeric;
};

export type FundEvent = {
  id: string;
  name: string;
  description: string | null;
  eventDate: string;
  status: EventStatus;
  fund: {
    id: number;
    name: string | null;
  };
  church: {
    id: number | null;
    name: string | null;
  };
  budget: {
    total: number;
    items?: EventBudgetItem[];
  };
  actuals: {
    totalIncome: number;
    totalExpense: number;
    netAmount: number;
    variance: number;
    entries?: EventActual[];
  };
  audit: {
    createdBy: string;
    createdByName: string | null;
    createdAt: string;
    approvedBy: string | null;
    approvedAt: string | null;
    submittedAt: string | null;
    history?: EventAuditEntry[];
  };
  rejectionReason: string | null;
};

export const normalizeFundEvent = (raw: RawFundEvent): FundEvent => {
  const totalBudget = toNumber(raw.total_budget, 0);
  const totalIncome = toNumber(raw.total_income, 0);
  const totalExpense = toNumber(raw.total_expense, 0);
  const netAmount = totalIncome - totalExpense;

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    eventDate: raw.event_date,
    status: raw.status,
    fund: {
      id: raw.fund_id,
      name: raw.fund_name ?? null,
    },
    church: {
      id: raw.church_id,
      name: raw.church_name ?? null,
    },
    budget: {
      total: totalBudget,
      items: [],
    },
    actuals: {
      totalIncome,
      totalExpense,
      netAmount,
      variance: netAmount - totalBudget,
    },
    audit: {
      createdBy: raw.created_by,
      createdByName: raw.created_by_name ?? null,
      createdAt: raw.created_at,
      approvedBy: raw.approved_by ?? null,
      approvedAt: raw.approved_at ?? null,
      submittedAt: raw.submitted_at ?? null,
    },
    rejectionReason: raw.rejection_reason,
  };
};

export type RawEventBudgetItem = {
  id: string;
  event_id: string;
  category: EventCategory;
  description: string;
  projected_amount: RawNumeric;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventBudgetItem = {
  id: string;
  eventId: string;
  category: EventCategory;
  description: string;
  projectedAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const normalizeEventBudgetItem = (raw: RawEventBudgetItem): EventBudgetItem => ({
  id: raw.id,
  eventId: raw.event_id,
  category: raw.category,
  description: raw.description,
  projectedAmount: toNumber(raw.projected_amount, 0),
  notes: raw.notes,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
});

export type RawEventActual = {
  id: string;
  event_id: string;
  line_type: EventLineType;
  description: string;
  amount: RawNumeric;
  receipt_url: string | null;
  notes: string | null;
  recorded_at: string;
  recorded_by: string;
};

export type EventActual = {
  id: string;
  eventId: string;
  lineType: EventLineType;
  description: string;
  amount: number;
  receiptUrl: string | null;
  notes: string | null;
  recordedAt: string;
  recordedBy: string;
  recordedByName?: string | null;
};

export const normalizeEventActual = (raw: RawEventActual): EventActual => ({
  id: raw.id,
  eventId: raw.event_id,
  lineType: raw.line_type,
  description: raw.description,
  amount: toNumber(raw.amount, 0),
  receiptUrl: raw.receipt_url,
  notes: raw.notes,
  recordedAt: raw.recorded_at,
  recordedBy: raw.recorded_by,
  recordedByName: (raw as { recorded_by_name?: string | null }).recorded_by_name ?? null,
});

export type RawEventAuditEntry = {
  id: string;
  event_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string | null;
  comment: string | null;
  changed_at: string;
};

export type EventAuditEntry = {
  id: string;
  eventId: string;
  previousStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  comment: string | null;
  changedAt: string;
};

export const normalizeEventAuditEntry = (raw: RawEventAuditEntry): EventAuditEntry => ({
  id: raw.id,
  eventId: raw.event_id,
  previousStatus: raw.previous_status,
  newStatus: raw.new_status,
  changedBy: raw.changed_by,
  comment: raw.comment,
  changedAt: raw.changed_at,
});

export type FundEventsApiResponse = {
  success?: boolean;
  data: RawFundEvent[];
  stats?: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    pending_revision: number;
  };
};

export type FundEventCollection = {
  records: FundEvent[];
  stats?: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    pendingRevision: number;
  };
};

export const normalizeFundEventsResponse = (payload: FundEventsApiResponse): FundEventCollection => ({
  records: payload.data.map(normalizeFundEvent),
  stats: payload.stats ? {
    draft: payload.stats.draft,
    submitted: payload.stats.submitted,
    approved: payload.stats.approved,
    rejected: payload.stats.rejected,
    pendingRevision: payload.stats.pending_revision,
  } : undefined,
});

export type RawFundEventDetail = RawFundEvent & {
  budget_items: RawEventBudgetItem[];
  actuals: Array<RawEventActual & { recorded_by_name?: string | null }>;
  audit_trail: RawEventAuditEntry[];
};

export type FundEventDetail = FundEvent & {
  budget: {
    total: number;
    items: EventBudgetItem[];
  };
  actuals: {
    totalIncome: number;
    totalExpense: number;
    netAmount: number;
    variance: number;
    entries: EventActual[];
  };
  audit: FundEvent['audit'] & {
    history: EventAuditEntry[];
  };
};

export const normalizeFundEventDetail = (raw: RawFundEventDetail): FundEventDetail => {
  const base = normalizeFundEvent(raw);

  const budgetItems = (raw.budget_items ?? []).map(normalizeEventBudgetItem);
  const totalBudget = budgetItems.reduce((sum, item) => sum + item.projectedAmount, 0);

  const actualEntries = (raw.actuals ?? []).map(normalizeEventActual);
  const totalIncome = actualEntries
    .filter((entry) => entry.lineType === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = actualEntries
    .filter((entry) => entry.lineType === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const netAmount = totalIncome - totalExpense;
  const variance = netAmount - totalBudget;

  const auditHistory = (raw.audit_trail ?? []).map(normalizeEventAuditEntry);

  return {
    ...base,
    budget: {
      total: totalBudget,
      items: budgetItems,
    },
    actuals: {
      totalIncome,
      totalExpense,
      netAmount,
      variance,
      entries: actualEntries,
    },
    audit: {
      ...base.audit,
      history: auditHistory,
    },
  };
};

export type CreateEventInput = {
  fund_id: number;
  church_id?: number | null;
  name: string;
  description?: string;
  event_date: string;
  budget_items?: Array<{
    category: EventCategory;
    description: string;
    projected_amount: number;
    notes?: string;
  }>;
};

export type EventFilters = {
  status?: EventStatus;
  fundId?: number;
  churchId?: number;
  dateFrom?: string;
  dateTo?: string;
};
