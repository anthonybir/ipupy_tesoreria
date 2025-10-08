import type { RawChurchRecord, RawReportRecord } from '@/types/api';
import type {
  EventCategory,
  EventStatus,
  FundEventsApiResponse,
  FundMovementsApiResponse,
  FundsApiResponse,
  RawEventActual,
  RawEventBudgetItem,
  RawEventAuditEntry,
  RawFundEvent,
  RawFundEventDetail,
  RawFundMovementRecord,
  RawFundRecord,
  RawFundTotals,
  RawTransactionRecord,
  TransactionsApiResponse,
} from '@/types/financial';
import { mapEventToSupabaseShape } from '@/lib/convex-id-mapping';

/**
 * Convert a numeric Convex timestamp (milliseconds) to an ISO string.
 */
const timestampToIso = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const timestampToIsoOrNow = (value: number | null | undefined): string => {
  const iso = timestampToIso(value);
  if (iso) {
    return iso;
  }
  const reference = typeof value === 'number' ? value : Date.now();
  const fallback = new Date(reference);
  return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
};

/**
 * Convex representation of a fund document (augmented with migration metadata).
 */
export type ConvexFundDocument = {
  _id: string;
  supabase_id?: number | null;
  name: string;
  description?: string | null;
  type?: string | null;
  current_balance: number;
  is_active: boolean;
  created_by?: string | null;
  created_at: number;
  updated_at?: number | null;
};

/**
 * Convex representation of the `funds.list` totals payload.
 */
export type ConvexFundTotals = {
  total_funds: number;
  active_funds: number;
  total_balance: number;
  total_target: number;
};

export const mapFundDocumentToRaw = (fund: ConvexFundDocument): RawFundRecord => ({
  id: fund.supabase_id ?? 0,
  convex_id: fund._id,
  name: fund.name,
  description: fund.description ?? '',
  type: fund.type ?? 'general',
  current_balance: fund.current_balance,
  is_active: fund.is_active,
  created_at: (() => {
    const iso = timestampToIso(fund.created_at);
    return iso ?? new Date(fund.created_at).toISOString();
  })(),
  updated_at: (() => {
    const updated = timestampToIso(fund.updated_at);
    const created = timestampToIso(fund.created_at);
    return updated ?? created ?? new Date(fund.created_at).toISOString();
  })(),
  created_by: fund.created_by ?? 'system',
});

export const mapFundTotals = (totals: ConvexFundTotals): RawFundTotals => ({
  total_funds: totals.total_funds,
  active_funds: totals.active_funds,
  total_balance: totals.total_balance,
  total_target: totals.total_target,
});

export const mapFundsListResponse = (
  result: { data: ConvexFundDocument[]; totals: ConvexFundTotals }
): FundsApiResponse => ({
  success: true,
  data: result.data.map(mapFundDocumentToRaw),
  totals: mapFundTotals(result.totals),
});

/**
 * Convex representation of a church document.
 */
export type ConvexChurchDocument = {
  _id: string;
  supabase_id?: number | null;
  name: string;
  city: string;
  pastor: string;
  phone?: string | null;
  pastor_ruc?: string | null;
  pastor_cedula?: string | null;
  pastor_grado?: string | null;
  pastor_posicion?: string | null;
  active: boolean;
  created_at: number;
};

export const mapChurchDocumentToRaw = (church: ConvexChurchDocument): RawChurchRecord => ({
  id: church.supabase_id ?? 0,
  convex_id: church._id,
  name: church.name,
  city: church.city,
  pastor: church.pastor,
  phone: church.phone ?? null,
  email: null,
  active: church.active,
  pastor_ruc: church.pastor_ruc ?? null,
  pastor_cedula: church.pastor_cedula ?? null,
  pastor_grado: church.pastor_grado ?? null,
  pastor_posicion: church.pastor_posicion ?? null,
  created_at: timestampToIso(church.created_at),
  updated_at: null,
  primary_pastor_id: null,
  primary_pastor_record_id: null,
  primary_pastor_full_name: null,
  primary_pastor_preferred_name: null,
  primary_pastor_email: null,
  primary_pastor_phone: null,
  primary_pastor_whatsapp: null,
  primary_pastor_national_id: null,
  primary_pastor_tax_id: null,
  primary_pastor_photo_url: null,
  primary_pastor_notes: null,
  primary_pastor_role_title: null,
  primary_pastor_grado: null,
  primary_pastor_status: null,
  primary_pastor_start_date: null,
  primary_pastor_end_date: null,
  primary_pastor_is_primary: null,
});

export type ConvexReportDocument = {
  _id: string;
  supabase_id?: number | null;
  church_id: string;
  church_supabase_id?: number | null;
  church_name?: string;
  city?: string;
  pastor?: string;
  estado: string;
  month: number;
  year: number;
  diezmos?: number;
  ofrendas?: number;
  anexos?: number;
  caballeros?: number;
  damas?: number;
  jovenes?: number;
  ninos?: number;
  otros?: number;
  total_entradas?: number;
  honorarios_pastoral?: number;
  fondo_nacional?: number;
  energia_electrica?: number;
  agua?: number;
  recoleccion_basura?: number;
  servicios?: number;
  mantenimiento?: number;
  materiales?: number;
  otros_gastos?: number;
  ofrenda_misiones?: number;
  lazos_amor?: number;
  mision_posible?: number;
  aporte_caballeros?: number;
  apy?: number;
  instituto_biblico?: number;
  diezmo_pastoral?: number;
  total_fondo_nacional?: number;
  total_designado?: number;
  total_operativo?: number;
  total_salidas?: number;
  total_salidas_calculadas?: number;
  saldo_mes?: number;
  saldo_calculado?: number;
  numero_deposito?: string | null;
  monto_depositado?: number | null;
  fecha_deposito?: number | null;
  observaciones?: string | null;
  submission_type?: string | null;
  submitted_by?: string | null;
  submitted_at?: number | null;
  processed_by?: string | null;
  processed_at?: number | null;
  foto_informe?: string | null;
  foto_deposito?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
  transactions_created?: boolean;
};

export const mapReportDocumentToRaw = (report: ConvexReportDocument): RawReportRecord => ({
  id: report.supabase_id ?? 0,
  convex_id: report._id,
  church_id: report.church_supabase_id ?? 0,
  church_name: report.church_name ?? 'Desconocida',
  month: report.month,
  year: report.year,
  estado: report.estado,
  total_entradas: report.total_entradas,
  total_salidas: report.total_salidas ?? report.total_salidas_calculadas,
  saldo_mes: report.saldo_mes ?? report.saldo_calculado,
  fondo_nacional: report.fondo_nacional,
  honorarios_pastoral: report.honorarios_pastoral,
  servicios: report.servicios,
  diezmos: report.diezmos,
  ofrendas: report.ofrendas,
  anexos: report.anexos,
  caballeros: report.caballeros ?? report.aporte_caballeros,
  damas: report.damas,
  jovenes: report.jovenes,
  ninos: report.ninos,
  otros: report.otros,
  ofrendas_directas_misiones: report.ofrenda_misiones,
  lazos_amor: report.lazos_amor,
  mision_posible: report.mision_posible,
  aporte_caballeros: report.aporte_caballeros ?? report.caballeros,
  apy: report.apy,
  instituto_biblico: report.instituto_biblico,
  energia_electrica: report.energia_electrica,
  agua: report.agua,
  recoleccion_basura: report.recoleccion_basura,
  mantenimiento: report.mantenimiento,
  materiales: report.materiales,
  otros_gastos: report.otros_gastos,
  numero_deposito: report.numero_deposito ?? null,
  monto_depositado: report.monto_depositado,
  fecha_deposito: timestampToIso(report.fecha_deposito),
  observaciones: report.observaciones ?? null,
  submission_type: report.submission_type ?? null,
  submitted_by: report.submitted_by ?? null,
  submitted_at: timestampToIso(report.submitted_at),
  processed_by: report.processed_by ?? null,
  processed_at: timestampToIso(report.processed_at),
  transactions_created: report.transactions_created ?? false,
  foto_informe: report.foto_informe ?? null,
  foto_deposito: report.foto_deposito ?? null,
  created_at: timestampToIso(report.created_at),
  updated_at: timestampToIso(report.updated_at),
  city: report.city ?? null,
  pastor: report.pastor ?? null,
  grado: null,
  posicion: null,
  cedula: null,
  ruc: null,
});

// -----------------------------------------------------------------------------
// Fund events
// -----------------------------------------------------------------------------

type LookupMaps = {
  fundMap: Map<string, number>;
  churchMap: Map<string, number>;
};

export type ConvexFundEventDocument = {
  _id: string;
  fund_id: string;
  church_id?: string | null;
  supabase_id?: number | null;
  name: string;
  description?: string | null;
  event_date: number;
  status: string;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: number | null;
  submitted_at?: number | null;
  rejection_reason?: string | null;
  created_at: number;
  updated_at: number;
  fund_name?: string | null;
  church_name?: string | null;
  created_by_name?: string | null;
  total_budget?: number;
  total_income?: number;
  total_expense?: number;
};

export type ConvexFundEventBudgetItem = {
  _id: string;
  event_id: string;
  category: EventCategory | string;
  description: string;
  projected_amount: number;
  notes?: string | null;
  created_at: number;
  updated_at?: number | null;
};

export type ConvexFundEventActual = {
  _id: string;
  event_id: string;
  line_type: 'income' | 'expense';
  description: string;
  amount: number;
  receipt_url?: string | null;
  notes?: string | null;
  recorded_at: number;
  recorded_by?: string | null;
};

export type ConvexFundEventDetailDocument = ConvexFundEventDocument & {
  budget_items?: ConvexFundEventBudgetItem[];
  actuals?: ConvexFundEventActual[];
  audit_trail?: Array<{
    _id: string;
    event_id: string;
    previous_status?: string | null;
    new_status?: string | null;
    changed_by?: string | null;
    comment?: string | null;
    changed_at?: number | null;
  }>;
};

const toRawFundEventBase = (
  event: ConvexFundEventDocument,
  maps: LookupMaps
): RawFundEvent => {
  const shaped = mapEventToSupabaseShape(event, maps);

  return {
    id: shaped.id,
    convex_id: event._id,
    fund_id: shaped.fund_id,
    church_id: shaped.church_id,
    name: shaped.name,
    description: shaped.description ?? null,
    event_date: timestampToIsoOrNow(event.event_date),
    status: shaped.status as EventStatus,
    created_by: shaped.created_by ?? 'Sistema',
    approved_by: shaped.approved_by ?? null,
    approved_at: timestampToIso(shaped.approved_at),
    submitted_at: timestampToIso(shaped.submitted_at),
    rejection_reason: shaped.rejection_reason ?? null,
    created_at: timestampToIsoOrNow(event.created_at),
    updated_at: timestampToIso(shaped.updated_at) ?? timestampToIsoOrNow(event.created_at),
    fund_name: shaped.fund_name ?? null,
    church_name: shaped.church_name ?? null,
    created_by_name: shaped.created_by_name ?? null,
    total_budget: shaped.total_budget ?? 0,
    total_income: shaped.total_income ?? 0,
    total_expense: shaped.total_expense ?? 0,
  };
};

export const mapFundEventDocumentToRaw = (
  event: ConvexFundEventDocument,
  maps: LookupMaps
): RawFundEvent => toRawFundEventBase(event, maps);

const mapBudgetItemToRaw = (item: ConvexFundEventBudgetItem): RawEventBudgetItem => ({
  id: item._id,
  event_id: item.event_id,
  category: item.category as EventCategory,
  description: item.description,
  projected_amount: item.projected_amount,
  notes: item.notes ?? null,
  created_at: timestampToIsoOrNow(item.created_at),
  updated_at: timestampToIso(item.updated_at) ?? timestampToIsoOrNow(item.created_at),
});

const mapActualToRaw = (actual: ConvexFundEventActual): RawEventActual => ({
  id: actual._id,
  event_id: actual.event_id,
  line_type: actual.line_type,
  description: actual.description,
  amount: actual.amount,
  receipt_url: actual.receipt_url ?? null,
  notes: actual.notes ?? null,
  recorded_at: timestampToIsoOrNow(actual.recorded_at),
  recorded_by: actual.recorded_by ?? 'Sistema',
});

const mapAuditEntry = (entry: {
  _id: string;
  event_id: string;
  previous_status?: string | null;
  new_status?: string | null;
  changed_by?: string | null;
  comment?: string | null;
  changed_at?: number | null;
}): RawEventAuditEntry => ({
  id: entry._id,
  event_id: entry.event_id,
  previous_status: entry.previous_status ?? null,
  new_status: entry.new_status ?? "desconocido",
  changed_by: entry.changed_by ?? 'Sistema',
  comment: entry.comment ?? null,
  changed_at: timestampToIsoOrNow(entry.changed_at ?? Date.now()),
});

export const mapFundEventDetailToRaw = (
  event: ConvexFundEventDetailDocument,
  maps: LookupMaps
): RawFundEventDetail => {
  const base = toRawFundEventBase(event, maps);
  const budgetItems = event.budget_items?.map(mapBudgetItemToRaw) ?? [];
  const actuals = event.actuals?.map(mapActualToRaw) ?? [];
  const auditTrail = event.audit_trail?.map(mapAuditEntry) ?? [];

  return {
    ...base,
    budget_items: budgetItems,
    actuals,
    audit_trail: auditTrail,
  };
};

export const mapFundEventsListResponse = (
  result: {
    data: ConvexFundEventDocument[];
    total: number;
    stats?: {
      draft?: number;
      submitted?: number;
      approved?: number;
      rejected?: number;
      pending_revision?: number;
    };
  },
  maps: LookupMaps
): FundEventsApiResponse => ({
  success: true,
  data: result.data.map((event) => mapFundEventDocumentToRaw(event, maps)),
  stats: (() => {
    const counters = {
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      pending_revision: 0,
    };

    for (const event of result.data) {
      switch (event.status) {
        case 'draft':
          counters.draft += 1;
          break;
        case 'submitted':
          counters.submitted += 1;
          break;
        case 'approved':
          counters.approved += 1;
          break;
        case 'rejected':
          counters.rejected += 1;
          break;
        case 'pending_revision':
          counters.pending_revision += 1;
          break;
        default:
          break;
      }
    }

    return {
      draft: result.stats?.draft ?? counters.draft,
      submitted: result.stats?.submitted ?? counters.submitted,
      approved: result.stats?.approved ?? counters.approved,
      rejected: result.stats?.rejected ?? counters.rejected,
      pending_revision: result.stats?.pending_revision ?? counters.pending_revision,
    };
  })(),
});

// -----------------------------------------------------------------------------
// Transactions
// -----------------------------------------------------------------------------

export type ConvexTransactionDocument = {
  _id: string;
  supabase_id?: number | null;
  date: number;
  fund_id: string;
  fund_name?: string | null | undefined;
  fund_supabase_id?: number | null | undefined;
  church_id?: string | null | undefined;
  church_name?: string | null | undefined;
  church_supabase_id?: number | null | undefined;
  report_id?: string | null | undefined;
  report_supabase_id?: number | null | undefined;
  report_month?: number | null | undefined;
  report_year?: number | null | undefined;
  concept: string;
  provider?: string | null | undefined;
  provider_id?: string | null | undefined;
  document_number?: string | null | undefined;
  amount_in: number;
  amount_out: number;
  balance: number;
  created_by?: string | null | undefined;
  created_at: number;
  updated_at: number;
};

export type ConvexTransactionsListResult = {
  data: ConvexTransactionDocument[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  totals: {
    count: number;
    total_in: number;
    total_out: number;
    balance: number;
  };
};

export const mapTransactionDocumentToRaw = (
  transaction: ConvexTransactionDocument,
  maps: LookupMaps & { reportMap?: Map<string, number> }
): RawTransactionRecord => ({
  id: transaction.supabase_id ?? 0,
  date: timestampToIsoOrNow(transaction.date),
  fund_id:
    transaction.fund_supabase_id ??
    maps.fundMap.get(transaction.fund_id) ??
    0,
  fund_name: transaction.fund_name ?? null,
  church_id: transaction.church_id
    ? transaction.church_supabase_id ??
      maps.churchMap.get(transaction.church_id) ??
      null
    : null,
  church_name: transaction.church_name ?? null,
  report_id: transaction.report_id
    ? transaction.report_supabase_id ??
      maps.reportMap?.get(transaction.report_id) ??
      null
    : null,
  concept: transaction.concept,
  provider: transaction.provider ?? null,
  document_number: transaction.document_number ?? null,
  amount_in: transaction.amount_in,
  amount_out: transaction.amount_out,
  created_by: transaction.created_by ?? 'Sistema',
  created_at: timestampToIsoOrNow(transaction.created_at),
  updated_at: timestampToIso(transaction.updated_at),
});

export const mapTransactionsListResponse = (
  result: ConvexTransactionsListResult,
  maps: LookupMaps & { reportMap?: Map<string, number> }
): TransactionsApiResponse => ({
  success: true,
  data: result.data.map((tx) => mapTransactionDocumentToRaw(tx, maps)),
  pagination: result.pagination,
  totals: {
    count: result.totals.count,
    total_in: result.totals.total_in,
    total_out: result.totals.total_out,
    balance: result.totals.balance,
  },
});

export const mapTransactionsToFundMovements = (
  result: ConvexTransactionsListResult
): FundMovementsApiResponse => {
  const data: RawFundMovementRecord[] = result.data.map((tx) => {
    const rawAmount =
      tx.amount_in > 0
        ? tx.amount_in
        : tx.amount_out > 0
          ? tx.amount_out
          : 0;

    return {
      id: tx.supabase_id ?? 0,
      report_id: tx.report_supabase_id ?? 0,
      church_id: tx.church_supabase_id ?? 0,
      fund_id: tx.fund_supabase_id ?? 0,
      amount: rawAmount,
      type: tx.report_id ? 'automatic' : 'manual',
      description: tx.concept,
      created_at: timestampToIsoOrNow(tx.created_at),
      created_by: tx.created_by ?? 'Sistema',
      church_name: tx.church_name ?? null,
      fund_name: tx.fund_name ?? null,
      report_month: tx.report_month ?? null,
      report_year: tx.report_year ?? null,
    };
  });

  const totalAmount = data.reduce((sum, record) => {
    const numericAmount = typeof record.amount === 'number' ? record.amount : Number(record.amount ?? 0);
    return sum + (Number.isFinite(numericAmount) ? numericAmount : 0);
  }, 0);

  return {
    success: true,
    data,
    pagination: result.pagination,
    totals: {
      count: result.totals.count,
      total_amount: totalAmount,
    },
  };
};
