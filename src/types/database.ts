/**
 * Database Row Type Definitions for IPU PY Tesorería
 *
 * These types represent the exact structure of database rows as returned by PostgreSQL queries.
 * All types use snake_case to match database column names.
 *
 * Usage:
 * - Use these types for database query results (QueryResult<ChurchRow>)
 * - Convert to camelCase types for API responses
 * - All optional fields explicitly marked with `| undefined` (exactOptionalPropertyTypes)
 */

import type { ProfileRole } from '@/lib/authz';

/**
 * Churches table - 22 IPU Paraguay churches
 */
export type ChurchRow = {
  id: number;
  name: string;
  city: string | null | undefined;
  pastor: string | null | undefined;
  phone: string | null | undefined;
  pastor_ruc: string | null | undefined;
  pastor_cedula: string | null | undefined;
  pastor_grado: string | null | undefined;
  pastor_posicion: string | null | undefined;
  active: boolean;
  created_at: string;
  primary_pastor_id: number | null | undefined;
  updated_at: string | null | undefined;
};

/**
 * Pastors table - Pastor records with profile linkage
 */
export type PastorRow = {
  id: number;
  church_id: number;
  full_name: string;
  preferred_name: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  whatsapp: string | null | undefined;
  national_id: string | null | undefined;
  tax_id: string | null | undefined;
  grado: string | null | undefined;
  role_title: string | null | undefined;
  start_date: string | null | undefined;
  end_date: string | null | undefined;
  status: string;
  is_primary: boolean;
  profile_id: string | null | undefined;
  created_at: string;
  updated_at: string | null | undefined;
};

/**
 * Profiles table - User accounts with role-based access
 */
export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null | undefined;
  role: ProfileRole;
  church_id: number | null | undefined;
  is_active: boolean;
  role_assigned_at: string | null | undefined;
  role_assigned_by: string | null | undefined;
  created_at: string;
  updated_at: string | null | undefined;
};

/**
 * Monthly Reports table - Financial reports from churches
 */
export type MonthlyReportRow = {
  id: number;
  church_id: number;
  month: number;
  year: number;
  diezmos: string | number | null | undefined;
  ofrendas: string | number | null | undefined;
  anexos: string | number | null | undefined;
  caballeros: string | number | null | undefined;
  damas: string | number | null | undefined;
  jovenes: string | number | null | undefined;
  ninos: string | number | null | undefined;
  otros: string | number | null | undefined;
  total_entradas: string | number | null | undefined;
  honorarios_pastoral: string | number | null | undefined;
  honorarios_factura_numero: string | null | undefined;
  honorarios_ruc_pastor: string | null | undefined;
  fondo_nacional: string | number | null | undefined;
  energia_electrica: string | number | null | undefined;
  agua: string | number | null | undefined;
  recoleccion_basura: string | number | null | undefined;
  otros_gastos: string | number | null | undefined;
  total_salidas: string | number | null | undefined;
  ofrenda_misiones: string | number | null | undefined;
  lazos_amor: string | number | null | undefined;
  mision_posible: string | number | null | undefined;
  aporte_caballeros: string | number | null | undefined;
  apy: string | number | null | undefined;
  instituto_biblico: string | number | null | undefined;
  diezmo_pastoral: string | number | null | undefined;
  total_fondo_nacional: string | number | null | undefined;
  saldo_mes_anterior: string | number | null | undefined;
  entrada_iglesia_local: string | number | null | undefined;
  total_entrada_mensual: string | number | null | undefined;
  saldo_fin_mes: string | number | null | undefined;
  fecha_deposito: string | null | undefined;
  numero_deposito: string | null | undefined;
  monto_depositado: string | number | null | undefined;
  asistencia_visitas: number | null | undefined;
  bautismos_agua: number | null | undefined;
  bautismos_espiritu: number | null | undefined;
  foto_informe: string | null | undefined;
  foto_deposito: string | null | undefined;
  observaciones: string | null | undefined;
  estado: string;
  created_at: string;
  updated_at: string | null | undefined;
  processed_by: string | null | undefined;
  processed_at: string | null | undefined;
  transactions_created: boolean | null | undefined;
  transactions_created_at: string | null | undefined;
  transactions_created_by: string | null | undefined;
};

/**
 * Fund Balances table - Fund balances by church
 */
export type FundBalanceRow = {
  id: number;
  name: string;
  description: string | null | undefined;
  type: string;
  current_balance: string | number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null | undefined;
  created_by: string;
  total_in: string | number | null | undefined;
  total_out: string | number | null | undefined;
  calculated_balance: string | number | null | undefined;
};

/**
 * Fund Transactions table - Financial transaction ledger
 */
export type FundTransactionRow = {
  id: number;
  fund_id: number;
  church_id: number | null | undefined;
  report_id: number | null | undefined;
  concept: string;
  provider: string | null | undefined;
  provider_id: number | null | undefined;
  document_number: string | null | undefined;
  amount_in: string | number;
  amount_out: string | number;
  balance_after: string | number;
  date: string;
  created_by: string;
  created_at: string;
  notes: string | null | undefined;
};

/**
 * Fund Events table - Event budgeting with approval workflow
 */
export type FundEventRow = {
  id: number;
  fund_id: number;
  event_name: string;
  event_description: string | null | undefined;
  event_date: string | null | undefined;
  status: string;
  total_budget: string | number;
  total_actual: string | number;
  variance: string | number;
  created_by: string;
  created_at: string;
  updated_at: string | null | undefined;
  submitted_at: string | null | undefined;
  submitted_by: string | null | undefined;
  approved_at: string | null | undefined;
  approved_by: string | null | undefined;
  rejection_reason: string | null | undefined;
};

/**
 * Fund Event Line Items table - Budget line items for events
 */
export type FundEventLineItemRow = {
  id: number;
  event_id: number;
  category: string;
  description: string;
  budget_amount: string | number;
  actual_amount: string | number;
  variance: string | number;
  notes: string | null | undefined;
  created_at: string;
  updated_at: string | null | undefined;
};

/**
 * Donors table - Donor registry
 */
export type DonorRow = {
  id: number;
  church_id: number | null | undefined;
  full_name: string;
  preferred_name: string | null | undefined;
  national_id: string | null | undefined;
  tax_id: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  address: string | null | undefined;
  donor_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null | undefined;
  created_by: string;
  notes: string | null | undefined;
};

/**
 * Providers table - Centralized provider registry
 */
export type ProviderRow = {
  id: number;
  business_name: string;
  ruc: string;
  contact_name: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  address: string | null | undefined;
  category: string | null | undefined;
  is_active: boolean;
  created_at: string;
  updated_at: string | null | undefined;
  created_by: string;
  notes: string | null | undefined;
};

/**
 * System Configuration table - Admin-configurable settings
 */
export type SystemConfigurationRow = {
  id: number;
  key: string;
  value: string | null | undefined;
  description: string | null | undefined;
  section: string | null | undefined;
  data_type: string;
  is_public: boolean;
  updated_at: string | null | undefined;
  updated_by: string | null | undefined;
};

/**
 * User Activity table - Complete audit trail
 */
export type UserActivityRow = {
  id: number;
  user_id: string;
  action: string;
  entity_type: string | null | undefined;
  entity_id: string | null | undefined;
  details: Record<string, unknown> | null | undefined;
  ip_address: string | null | undefined;
  user_agent: string | null | undefined;
  created_at: string;
};

/**
 * Worship Records table - Worship service records
 */
export type WorshipRecordRow = {
  id: number;
  church_id: number;
  fecha_culto: string;
  tipo_culto: string;
  predicador: string | null | undefined;
  encargado_registro: string | null | undefined;
  total_diezmos: string | number | null | undefined;
  total_ofrendas: string | number | null | undefined;
  total_misiones: string | number | null | undefined;
  total_otros: string | number | null | undefined;
  ofrenda_general_anonima: string | number | null | undefined;
  total_recaudado: string | number | null | undefined;
  miembros_activos: number | null | undefined;
  visitas: number | null | undefined;
  ninos: number | null | undefined;
  jovenes: number | null | undefined;
  total_asistencia: number | null | undefined;
  bautismos_agua: number | null | undefined;
  bautismos_espiritu: number | null | undefined;
  observaciones: string | null | undefined;
  created_at: string;
  created_by: string | null | undefined;
};

/**
 * Worship Contributions table - Individual contributions in worship services
 */
export type WorshipContributionRow = {
  id: number;
  worship_record_id: number;
  numero_fila: number;
  nombre_aportante: string | null | undefined;
  ci_ruc: string | null | undefined;
  numero_recibo: string | null | undefined;
  diezmo: string | number | null | undefined;
  ofrenda: string | number | null | undefined;
  misiones: string | number | null | undefined;
  otros: string | number | null | undefined;
  otros_concepto: string | null | undefined;
  total: string | number;
};

/**
 * Helper type for database query results with joined church name
 */
export type MonthlyReportWithChurch = MonthlyReportRow & {
  church_name: string;
};

/**
 * Helper type for fund balances with aggregated totals
 */
export type FundBalanceWithTotals = FundBalanceRow & {
  total_transactions: number | null | undefined;
  last_transaction_date: string | null | undefined;
};

/**
 * Helper type for pastor with church information
 */
export type PastorWithChurch = PastorRow & {
  church_name: string | null | undefined;
  church_city: string | null | undefined;
};

/**
 * Helper type for profile with church information
 */
export type ProfileWithChurch = ProfileRow & {
  church_name: string | null | undefined;
};
