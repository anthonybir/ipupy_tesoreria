import { executeWithContext } from '@/lib/db';
import { type AuthContext } from '@/lib/auth-context';
import {
  createReportTransactions,
  createTransaction as createLedgerTransaction,
} from '@/app/api/reports/route-helpers';

type FundBalanceRow = {
  id: number;
  name: string;
  description: string;
  type: string;
  current_balance: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  total_in: string;
  total_out: string;
  calculated_balance: string;
};

type FundBalanceFilters = {
  includeInactive?: boolean;
  type?: string | null;
};

type LedgerTransactionResult = Awaited<ReturnType<typeof createLedgerTransaction>>;

type FundReconciliationRow = {
  id: number;
  name: string;
  stored_balance: string;
  total_income: string;
  total_expenses: string;
  calculated_balance: string;
  transaction_count: number;
  first_transaction: string | null;
  last_transaction: string | null;
  difference: string;
  status: 'balanced' | 'discrepancy';
};

export async function fetchFundBalances(auth: AuthContext | null, filters: FundBalanceFilters = {}): Promise<FundBalanceRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!filters.includeInactive) {
    conditions.push('f.is_active = TRUE');
  }

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`f.type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      f.id,
      f.name,
      f.description,
      f.type,
      f.current_balance,
      f.is_active,
      f.created_at,
      f.updated_at,
      f.created_by,
      COALESCE(SUM(t.amount_in), 0) AS total_in,
      COALESCE(SUM(t.amount_out), 0) AS total_out,
      COALESCE(SUM(t.amount_in - t.amount_out), 0) AS calculated_balance
    FROM funds f
    LEFT JOIN transactions t ON t.fund_id = f.id
    ${whereClause}
    GROUP BY f.id
    ORDER BY f.is_active DESC, f.name;
  `;

  const contextSubset = auth ? { userId: auth.userId, role: auth.role, churchId: auth.churchId } : null;
  const result = await executeWithContext<FundBalanceRow>(contextSubset, query, params);
  return result.rows;
}

// Process report approval and create fund transactions
export async function processReportApproval(
  auth: AuthContext | null,
  reportId: number,
  approvedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: true; reportId: number; approvedBy: string }> {
  const contextSubset = auth ? { userId: auth.userId, role: auth.role, churchId: auth.churchId } : null;

  // Get report details
  const reportResult = await executeWithContext<Record<string, unknown>>(contextSubset, `
    SELECT r.*, c.name as church_name
    FROM reports r
    JOIN churches c ON r.church_id = c.id
    WHERE r.id = $1
  `, [reportId]);

  if (reportResult.rowCount === 0) {
    throw new Error('Report not found');
  }

  const report = reportResult.rows[0];
  if (!report) {
    throw new Error('Report data is missing');
  }

  const toNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Extract financial data from report (using bracket notation for index signature access)
  const diezmos = toNumber(report['diezmos']);
  const ofrendas = toNumber(report['ofrendas']);
  const otros = toNumber(report['otros']);
  const anexos = toNumber(report['anexos']);

  // Calculate totals
  const congregationalBase = diezmos + ofrendas;
  const totalDesignados = toNumber(report['ofrendas_directas_misiones']) +
                          toNumber(report['lazos_amor']) +
                          toNumber(report['mision_posible']) +
                          toNumber(report['aporte_caballeros']) +
                          toNumber(report['apy']) +
                          toNumber(report['instituto_biblico']) +
                          toNumber(report['caballeros']) +
                          toNumber(report['damas']) +
                          toNumber(report['jovenes']) +
                          toNumber(report['ninos']);

  const gastosOperativos = toNumber(report['servicios']) +
                           toNumber(report['energia_electrica']) +
                           toNumber(report['agua']) +
                           toNumber(report['recoleccion_basura']) +
                           toNumber(report['mantenimiento']) +
                           toNumber(report['materiales']) +
                           toNumber(report['otros_gastos']);

  const totalIngresos = congregationalBase + anexos + otros + totalDesignados;
  const fondoNacional = Math.round(congregationalBase * 0.1);
  const honorariosPastoral = Math.max(0, totalIngresos - (totalDesignados + gastosOperativos + fondoNacional));

  // Prepare designated funds object
  const designated = {
    misiones: toNumber(report['ofrendas_directas_misiones']),
    lazos_amor: toNumber(report['lazos_amor']),
    mision_posible: toNumber(report['mision_posible']),
    apy: toNumber(report['apy']),
    iba: toNumber(report['instituto_biblico']),
    caballeros: toNumber(report['aporte_caballeros'] || report['caballeros']),
    damas: toNumber(report['damas']),
    jovenes: toNumber(report['jovenes']),
    ninos: toNumber(report['ninos'])
  };

  // Use the createReportTransactions helper for consistent transaction creation
  await createReportTransactions(
    report,
    {
      totalEntradas: totalIngresos,
      fondoNacional,
      honorariosPastoral,
      gastosOperativos,
      fechaDeposito: report['fecha_deposito'] as string | null
    },
    designated,
    auth
  );

  // Update report status metadata
  await executeWithContext(contextSubset, `
    UPDATE reports
    SET estado = 'procesado',
        processed_by = $1,
        processed_at = NOW(),
        transactions_created = TRUE,
        transactions_created_at = NOW(),
        transactions_created_by = $1,
        updated_at = NOW()
    WHERE id = $2
  `, [approvedBy, reportId]);

  // Log report approval with security context
  if (auth?.userId) {
    await executeWithContext(contextSubset, `
      INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      auth.userId,
      'admin.report.approve',
      JSON.stringify({
        report_id: reportId,
        church_id: report['church_id'],
        church_name: report['church_name'],
        year: report['anio'],
        month: report['mes'],
        total_ingresos: totalIngresos
      }),
      ipAddress || 'unknown',
      userAgent || 'unknown'
    ]);
  }

  return { success: true, reportId, approvedBy };
}

// Add external transaction (treasurer manual entry)
export async function addExternalTransaction(
  auth: AuthContext | null,
  data: {
  fund_id: number;
  concept: string;
  amount_in: number;
  amount_out: number;
  date: string;
  provider?: string | null;
  provider_id?: number | null;
  document_number?: string | null;
}): Promise<LedgerTransactionResult> {
  const transaction = await createLedgerTransaction({
    fund_id: data.fund_id,
    concept: data.concept,
    provider: data.provider ?? null,
    provider_id: data.provider_id ?? null,
    document_number: data.document_number ?? null,
    amount_in: data.amount_in,
    amount_out: data.amount_out,
    date: data.date,
    created_by: 'treasurer'
  }, auth);

  return transaction;
}

// Generate reconciliation report
export async function generateReconciliation(
  auth: AuthContext | null,
  fundId?: number
): Promise<FundReconciliationRow[]> {
  const contextSubset = auth ? { userId: auth.userId, role: auth.role, churchId: auth.churchId } : null;
  const fundFilter = fundId ? 'WHERE f.id = $1' : '';
  const params = fundId ? [fundId] : [];

  const result = await executeWithContext<FundReconciliationRow>(contextSubset, `
    WITH fund_summary AS (
      SELECT
        f.id,
        f.name,
        f.current_balance as stored_balance,
        COALESCE(SUM(t.amount_in), 0) as total_income,
        COALESCE(SUM(t.amount_out), 0) as total_expenses,
        COALESCE(SUM(t.amount_in - t.amount_out), 0) as calculated_balance,
        COUNT(t.id) as transaction_count,
        MIN(t.date) as first_transaction,
        MAX(t.date) as last_transaction
      FROM funds f
      LEFT JOIN transactions t ON t.fund_id = f.id
      ${fundFilter}
      GROUP BY f.id
    )
    SELECT
      *,
      (calculated_balance - stored_balance) as difference,
      CASE
        WHEN ABS(calculated_balance - stored_balance) < 1 THEN 'balanced'
        ELSE 'discrepancy'
      END as status
    FROM fund_summary
    ORDER BY name
  `, params);

  return result.rows;
}
