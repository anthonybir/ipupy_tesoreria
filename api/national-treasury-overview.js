const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Token no proporcionado');
  }

  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

const isProvided = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const parseInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const resolveYear = (value) => {
  if (!isProvided(value)) {
    return new Date().getFullYear();
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    throw new BadRequestError('Año inválido.');
  }
  return parsed;
};

const resolveMonth = (value) => {
  if (!isProvided(value)) {
    return null;
  }

  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || parsed > 12) {
    throw new BadRequestError('Mes inválido. Debe estar entre 1 y 12.');
  }
  return parsed;
};

const resolveChurchId = (value) => {
  if (!isProvided(value)) {
    return null;
  }

  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('church_id inválido.');
  }
  return parsed;
};

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const decoded = verifyToken(req);

    // Solo admins pueden acceder a la vista nacional
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API national-treasury-overview:', error);
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'JsonWebTokenError' || (typeof error.message === 'string' && error.message.includes('Token'))) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

async function handleGet(req, res) {
  const { year, month, church_id, view_type = 'summary' } = req.query;

  const monthProvided = isProvided(month);
  const filters = {
    year: resolveYear(year),
    month: resolveMonth(month),
    monthProvided,
    churchId: resolveChurchId(church_id)
  };

  try {
    switch (view_type) {
      case 'summary':
        return await getNationalSummary(res, filters);
      case 'variance_analysis':
        return await getVarianceAnalysis(res, filters);
      case 'church_comparison':
        return await getChurchComparison(res, filters);
      case 'monthly_trends':
        return await getMonthlyTrends(res, filters);
      default:
        return await getNationalSummary(res, filters);
    }
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error en vista nacional:', error);
    return res.status(500).json({ error: 'Error obteniendo datos nacionales' });
  }
}
async function getNationalSummary(res, { year, month, monthProvided }) {
  const reportParams = [year];
  let reportWhere = 'WHERE r.year = $1';

  if (month !== null) {
    const monthPlaceholder = `$${reportParams.length + 1}`;
    reportWhere += ` AND r.month = ${monthPlaceholder}`;
    reportParams.push(month);
  }

  const macroSummary = await execute(
    `SELECT
        COUNT(DISTINCT r.church_id) AS churches_reporting,
        COUNT(r.id) AS total_reports,
        SUM(r.total_entradas) AS total_macro_income,
        SUM(r.total_salidas) AS total_macro_expenses,
        SUM(r.total_fondo_nacional) AS total_national_fund,
        SUM(r.monto_depositado) AS total_deposits,
        AVG(r.total_entradas) AS avg_income_per_church,
        AVG(r.total_salidas) AS avg_expenses_per_church
      FROM reports r
      ${reportWhere}
    `,
    reportParams
  );

  const microParams = [year];
  let microWhere = 'WHERE EXTRACT(YEAR FROM ct.transaction_date) = $1';

  if (month !== null) {
    const monthPlaceholder = `$${microParams.length + 1}`;
    microWhere += ` AND EXTRACT(MONTH FROM ct.transaction_date) = ${monthPlaceholder}`;
    microParams.push(month);
  }

  const microSummary = await execute(
    `SELECT
        COUNT(DISTINCT ct.church_id) AS churches_with_micro_accounting,
        COUNT(ct.id) AS total_micro_transactions,
        SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END) AS total_micro_income,
        SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END) AS total_micro_expenses,
        COUNT(CASE WHEN ct.transaction_type = 'income' THEN 1 END) AS income_transactions_count,
        COUNT(CASE WHEN ct.transaction_type = 'expense' THEN 1 END) AS expense_transactions_count
      FROM church_transactions ct
      ${microWhere}
    `,
    microParams
  );

  const accountSummary = await execute(
    `SELECT
      COUNT(DISTINCT ca.church_id) AS churches_with_accounts,
      COUNT(ca.id) AS total_accounts,
      SUM(ca.current_balance) AS total_balances,
      COUNT(CASE WHEN ca.account_type = 'checking' THEN 1 END) AS checking_accounts,
      COUNT(CASE WHEN ca.account_type = 'savings' THEN 1 END) AS savings_accounts,
      COUNT(CASE WHEN ca.account_type = 'petty_cash' THEN 1 END) AS petty_cash_accounts,
      COUNT(CASE WHEN ca.account_type = 'special_fund' THEN 1 END) AS special_fund_accounts
    FROM church_accounts ca
    WHERE ca.is_active = true
  `
  );

  const churchContext = await execute(
    `SELECT
      COUNT(*) AS total_churches,
      COUNT(CASE WHEN active = true THEN 1 END) AS active_churches
    FROM churches
  `
  );
  const macroRow = macroSummary.rows[0] || {};
  const microRow = microSummary.rows[0] || {};
  const accountRow = accountSummary.rows[0] || {};
  const churchContextRow = churchContext.rows[0] || {};

  const macroIncome = parseFloat(macroRow.total_macro_income || 0);
  const macroExpenses = parseFloat(macroRow.total_macro_expenses || 0);
  const microIncome = parseFloat(microRow.total_micro_income || 0);
  const microExpenses = parseFloat(microRow.total_micro_expenses || 0);

  const churchesReporting = Number(macroRow.churches_reporting || 0);
  const microChurches = Number(microRow.churches_with_micro_accounting || 0);
  const activeChurches = Number(churchContextRow.active_churches || 0);
  const totalChurches = Number(churchContextRow.total_churches || 0);

  const variance = {
    income_difference: macroIncome - microIncome,
    expense_difference: macroExpenses - microExpenses,
    coverage_percentage: churchesReporting > 0 ? (microChurches / churchesReporting) * 100 : 0
  };

  res.json({
    period: { year, month: monthProvided ? month : null },
    macro_reporting: macroRow,
    micro_accounting: microRow,
    account_summary: accountRow,
    church_context: churchContextRow,
    variance_analysis: variance,
    summary: {
      total_churches: totalChurches,
      churches_with_macro_reports: churchesReporting,
      churches_with_micro_accounting: microChurches,
      micro_adoption_rate: activeChurches > 0 ? (microChurches / activeChurches) * 100 : 0
    }
  });
}

async function getVarianceAnalysis(res, { year, month, monthProvided }) {
  const params = [year];
  const reportConditions = ['r.year = $1'];

  if (month !== null) {
    const monthPlaceholder = `$${params.length + 1}`;
    reportConditions.push(`r.month = ${monthPlaceholder}`);
    params.push(month);
  }

  const microYearPlaceholder = `$${params.length + 1}`;
  params.push(year);
  const microConditions = [`EXTRACT(YEAR FROM transaction_date) = ${microYearPlaceholder}`];

  if (month !== null) {
    const monthPlaceholder = `$${params.length + 1}`;
    microConditions.push(`EXTRACT(MONTH FROM transaction_date) = ${monthPlaceholder}`);
    params.push(month);
  }

  const varianceData = await execute(
    `SELECT
        c.id AS church_id,
        c.name AS church_name,
        c.city,
        c.pastor,
        COALESCE(r.total_entradas, 0) AS macro_income,
        COALESCE(r.total_salidas, 0) AS macro_expenses,
        COALESCE(r.total_fondo_nacional, 0) AS macro_national_fund,
        r.id AS report_id,
        COALESCE(micro.total_income, 0) AS micro_income,
        COALESCE(micro.total_expenses, 0) AS micro_expenses,
        COALESCE(micro.transaction_count, 0) AS micro_transaction_count,
        COALESCE(r.total_entradas, 0) - COALESCE(micro.total_income, 0) AS income_variance,
        COALESCE(r.total_salidas, 0) - COALESCE(micro.total_expenses, 0) AS expense_variance,
        CASE
          WHEN r.id IS NOT NULL AND micro.transaction_count > 0 THEN 'dual_tracking'
          WHEN r.id IS NOT NULL AND micro.transaction_count = 0 THEN 'macro_only'
          WHEN r.id IS NULL AND micro.transaction_count > 0 THEN 'micro_only'
          ELSE 'no_data'
        END AS tracking_status
      FROM churches c
      LEFT JOIN reports r
        ON c.id = r.church_id
       AND ${reportConditions.join(' AND ')}
      LEFT JOIN (
        SELECT
          church_id,
          SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) AS total_income,
          SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS total_expenses,
          COUNT(*) AS transaction_count
        FROM church_transactions
        WHERE ${microConditions.join(' AND ')}
        GROUP BY church_id
      ) micro ON c.id = micro.church_id
      WHERE c.active = true
      ORDER BY ABS(COALESCE(r.total_entradas, 0) - COALESCE(micro.total_income, 0)) DESC
    `,
    params
  );
  const rows = varianceData.rows || [];

  const statusSummary = rows.reduce((acc, row) => {
    const status = row.tracking_status || 'no_data';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const totalChurches = rows.length;
  const churchesWithVariance = rows.filter((row) => {
    const incomeVariance = Math.abs(parseFloat(row.income_variance || 0));
    const expenseVariance = Math.abs(parseFloat(row.expense_variance || 0));
    return incomeVariance > 1000 || expenseVariance > 1000;
  }).length;

  const incomeVarianceSum = rows.reduce(
    (sum, row) => sum + parseFloat(row.income_variance || 0),
    0
  );
  const expenseVarianceSum = rows.reduce(
    (sum, row) => sum + parseFloat(row.expense_variance || 0),
    0
  );

  res.json({
    period: { year, month: monthProvided ? month : null },
    church_variances: rows,
    implementation_status: statusSummary,
    statistics: {
      total_churches: totalChurches,
      churches_with_variances: churchesWithVariance,
      average_income_variance: totalChurches ? incomeVarianceSum / totalChurches : 0,
      average_expense_variance: totalChurches ? expenseVarianceSum / totalChurches : 0
    }
  });
}

async function getChurchComparison(res, { year, churchId }) {
  if (churchId !== null) {
    const churchDetails = await execute(
      `SELECT
          c.*,
          COALESCE(acc.total_balance, 0) AS total_account_balance,
          COALESCE(acc.account_count, 0) AS account_count,
          COALESCE(hist.total_reports, 0) AS historical_reports,
          COALESCE(hist.avg_monthly_income, 0) AS avg_monthly_income,
          COALESCE(hist.avg_monthly_expenses, 0) AS avg_monthly_expenses
        FROM churches c
        LEFT JOIN (
          SELECT
            church_id,
            SUM(current_balance) AS total_balance,
            COUNT(*) AS account_count
          FROM church_accounts
          WHERE is_active = true
          GROUP BY church_id
        ) acc ON c.id = acc.church_id
        LEFT JOIN (
          SELECT
            church_id,
            COUNT(*) AS total_reports,
            AVG(total_entradas) AS avg_monthly_income,
            AVG(total_salidas) AS avg_monthly_expenses
          FROM reports
          WHERE year = $1
          GROUP BY church_id
        ) hist ON c.id = hist.church_id
        WHERE c.id = $2
      `,
      [year, churchId]
    );

    if (churchDetails.rows.length === 0) {
      return res.status(404).json({ error: 'Iglesia no encontrada' });
    }

    const recentTransactions = await execute(
      `SELECT ct.*, ctc.category_name, ca.account_name
        FROM church_transactions ct
        LEFT JOIN church_transaction_categories ctc ON ct.category_id = ctc.id
        LEFT JOIN church_accounts ca ON ct.account_id = ca.id
        WHERE ct.church_id = $1
        ORDER BY ct.transaction_date DESC, ct.created_at DESC
        LIMIT 20
      `,
      [churchId]
    );

    return res.json({
      church: churchDetails.rows[0],
      recent_transactions: recentTransactions.rows
    });
  }

  const comparison = await execute(
    `SELECT
        c.id,
        c.name,
        c.city,
        c.pastor,
        COUNT(r.id) AS reports_submitted,
        COALESCE(SUM(r.total_entradas), 0) AS total_reported_income,
        COALESCE(SUM(r.total_salidas), 0) AS total_reported_expenses,
        COALESCE(micro.transaction_count, 0) AS micro_transactions,
        COALESCE(micro.micro_income, 0) AS micro_income,
        COALESCE(micro.micro_expenses, 0) AS micro_expenses,
        COALESCE(acc.total_balance, 0) AS account_balance,
        COALESCE(acc.account_count, 0) AS account_count,
        CASE
          WHEN COUNT(r.id) > 0 AND micro.transaction_count > 0 THEN 100
          WHEN COUNT(r.id) > 0 AND micro.transaction_count = 0 THEN 60
          WHEN COUNT(r.id) = 0 AND micro.transaction_count > 0 THEN 40
          ELSE 0
        END AS implementation_score
      FROM churches c
      LEFT JOIN reports r ON c.id = r.church_id AND r.year = $1
      LEFT JOIN (
        SELECT
          church_id,
          COUNT(*) AS transaction_count,
          SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) AS micro_income,
          SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS micro_expenses
        FROM church_transactions
        WHERE EXTRACT(YEAR FROM transaction_date) = $2
        GROUP BY church_id
      ) micro ON c.id = micro.church_id
      LEFT JOIN (
        SELECT
          church_id,
          SUM(current_balance) AS total_balance,
          COUNT(*) AS account_count
        FROM church_accounts
        WHERE is_active = true
        GROUP BY church_id
      ) acc ON c.id = acc.church_id
      WHERE c.active = true
      GROUP BY c.id, c.name, c.city, c.pastor, micro.transaction_count, micro.micro_income, micro.micro_expenses, acc.total_balance, acc.account_count
      ORDER BY implementation_score DESC, total_reported_income DESC
    `,
    [year, year]
  );

  res.json({
    period: { year },
    church_comparison: comparison.rows
  });
}

async function getMonthlyTrends(res, { year }) {
  const trends = await execute(
    `SELECT
        months.month,
        COALESCE(macro.churches_reporting, 0) AS macro_churches,
        COALESCE(macro.total_income, 0) AS macro_income,
        COALESCE(macro.total_expenses, 0) AS macro_expenses,
        COALESCE(macro.total_national_fund, 0) AS macro_national_fund,
        COALESCE(micro.churches_with_transactions, 0) AS micro_churches,
        COALESCE(micro.total_income, 0) AS micro_income,
        COALESCE(micro.total_expenses, 0) AS micro_expenses,
        COALESCE(micro.transaction_count, 0) AS micro_transaction_count
      FROM (SELECT generate_series(1, 12) AS month) months
      LEFT JOIN (
        SELECT
          r.month,
          COUNT(DISTINCT r.church_id) AS churches_reporting,
          SUM(r.total_entradas) AS total_income,
          SUM(r.total_salidas) AS total_expenses,
          SUM(r.total_fondo_nacional) AS total_national_fund
        FROM reports r
        WHERE r.year = $1
        GROUP BY r.month
      ) macro ON months.month = macro.month
      LEFT JOIN (
        SELECT
          EXTRACT(MONTH FROM ct.transaction_date) AS month,
          COUNT(DISTINCT ct.church_id) AS churches_with_transactions,
          SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END) AS total_income,
          SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END) AS total_expenses,
          COUNT(*) AS transaction_count
        FROM church_transactions ct
        WHERE EXTRACT(YEAR FROM ct.transaction_date) = $2
        GROUP BY EXTRACT(MONTH FROM ct.transaction_date)
      ) micro ON months.month = micro.month
      ORDER BY months.month
    `,
    [year, year]
  );

  res.json({
    year,
    monthly_trends: trends.rows
  });
}
