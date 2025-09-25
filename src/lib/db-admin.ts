import { execute } from '@/lib/db';

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

export async function fetchFundBalances(filters: FundBalanceFilters = {}) {
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

  const result = await execute<FundBalanceRow>(query, params);
  return result.rows;
}

// Process report approval and create fund transactions
export async function processReportApproval(reportId: number, approvedBy: string) {
  await execute('BEGIN');

  try {
    // Get report details
    const reportResult = await execute(`
      SELECT r.*, c.name as church_name
      FROM reports r
      JOIN churches c ON r.church_id = c.id
      WHERE r.id = $1
    `, [reportId]);

    if (reportResult.rowCount === 0) {
      throw new Error('Report not found');
    }

    const report = reportResult.rows[0];

    const toNumber = (value: unknown) => {
      const parsed = Number(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const diezmos = toNumber(report.diezmos);
    const ofrendas = toNumber(report.ofrendas);
    const transactionDate = report.fecha_deposito
      ? new Date(report.fecha_deposito).toISOString().slice(0, 10)
      : `${report.year}-${String(report.month).padStart(2, '0')}-01`;

    // Create transactions for each fund
    const transactions = [];

    // 10% of tithes and offerings to General fund
    if (diezmos > 0 || ofrendas > 0) {
      const totalBase = diezmos + ofrendas;
      const generalAmount = totalBase * 0.1;

      const txn = await execute(`
        INSERT INTO transactions (
          fund_id, church_id, report_id, concept,
          amount_in, amount_out, date, created_by, created_at
        ) VALUES (
          1, $1, $2, $3, $4, 0, $5,
          'system', NOW()
        ) RETURNING id
      `, [
        report.church_id,
        reportId,
        `Diezmos Nacionales - ${report.church_name}`,
        generalAmount,
        transactionDate
      ]);
      transactions.push(txn.rows[0]);
    }

    // 100% of designated funds to respective funds
    const designatedFunds = [
      { field: 'misiones', fund_id: 2, name: 'Misiones' },
      { field: 'lazos_amor', fund_id: 3, name: 'Lazos de Amor' },
      { field: 'mision_posible', fund_id: 4, name: 'Misión Posible' },
      { field: 'caballeros', fund_id: 5, name: 'Caballeros' },
      { field: 'apy', fund_id: 6, name: 'APY' },
      { field: 'iba', fund_id: 7, name: 'IBA' },
      { field: 'ninos', fund_id: 8, name: 'Niños' },
      { field: 'damas', fund_id: 9, name: 'Damas' }
    ];

    for (const fund of designatedFunds) {
      const designatedAmount = toNumber(report[fund.field]);
      if (designatedAmount > 0) {
        const txn = await execute(`
          INSERT INTO transactions (
            fund_id, church_id, report_id, concept,
            amount_in, amount_out, date, created_by, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, 0, $6,
            'system', NOW()
          ) RETURNING id
        `, [
          fund.fund_id,
          report.church_id,
          reportId,
          `Ofrenda ${fund.name} - ${report.church_name}`,
          designatedAmount,
          transactionDate
        ]);
        transactions.push(txn.rows[0]);
      }
    }

    // Update report status metadata
    await execute(`
      UPDATE reports
      SET estado = 'aprobado_admin',
          processed_by = $1,
          processed_at = NOW(),
          transactions_created = TRUE,
          transactions_created_at = NOW(),
          transactions_created_by = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [approvedBy, reportId]);

    // Update fund balances
    await execute(`
      UPDATE funds f
      SET current_balance = COALESCE((
        SELECT SUM(t.amount_in - t.amount_out)
        FROM transactions t
        WHERE t.fund_id = f.id
      ), 0),
      updated_at = NOW()
    `);

    await execute('COMMIT');
    return { success: true, transactions };
  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
}

// Add external transaction (treasurer manual entry)
export async function addExternalTransaction(data: {
  fund_id: number;
  concept: string;
  amount_in: number;
  amount_out: number;
  date: string;
  provider?: string | null;
  document_number?: string | null;
}) {
  await execute('BEGIN');

  try {
    // Insert transaction
    const result = await execute(`
      INSERT INTO transactions (
        fund_id, concept, provider, document_number,
        amount_in, amount_out, date, created_by, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'treasurer', NOW()
      ) RETURNING *
    `, [
      data.fund_id,
      data.concept,
      data.provider ?? null,
      data.document_number ?? null,
      data.amount_in,
      data.amount_out,
      data.date
    ]);

    // Update fund balance
    await execute(`
      UPDATE funds
      SET current_balance = current_balance + $1 - $2,
          updated_at = NOW()
      WHERE id = $3
    `, [data.amount_in, data.amount_out, data.fund_id]);

    await execute('COMMIT');
    return result.rows[0];
  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
}

// Generate reconciliation report
export async function generateReconciliation(fundId?: number) {
  const fundFilter = fundId ? 'WHERE f.id = $1' : '';
  const params = fundId ? [fundId] : [];

  const result = await execute(`
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
