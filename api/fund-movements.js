const { execute } = require('../lib/db-supabase');
const { setSecureCORSHeaders } = require('../src/lib/cors-handler');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
    this.status = 400;
  }
}

const normalizeDate = (raw) => {
  if (!raw) {
    return null;
  }
  const value = String(raw).trim();
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestError('Las fechas deben usar el formato AAAA-MM-DD');
  }
  return value;
};

const parseInteger = (value, message) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new BadRequestError(message);
  }
  return parsed;
};

module.exports = async function handler(req, res) {
  // Configure secure CORS (no wildcards)
  const isPreflightHandled = setSecureCORSHeaders(req, res, ['POST']);

  if (isPreflightHandled) {
    return; // Preflight request handled securely
  }

  try {
    const {
      fund_id,
      church_id,
      start_date,
      end_date,
      date_from,
      date_to
    } = req.query || {};

    const normalizedFundId = parseInteger(fund_id, 'fund_id debe ser numérico');
    const normalizedChurchId = parseInteger(church_id, 'church_id debe ser numérico');
    const startDate = normalizeDate(start_date) || normalizeDate(date_from);
    const endDate = normalizeDate(end_date) || normalizeDate(date_to);

    let query = `
      SELECT
        fm.id,
        fm.fund_id,
        fm.transaction_id,
        fm.previous_balance,
        fm.movement,
        fm.new_balance,
        fm.created_at,
        f.name AS fund_name,
        t.concept,
        t.date,
        t.provider,
        t.document_number,
        t.amount_in,
        t.amount_out,
        t.balance,
        t.church_id,
        c.name AS church_name
      FROM fund_movements_enhanced fm
      LEFT JOIN funds f ON fm.fund_id = f.id
      LEFT JOIN transactions t ON fm.transaction_id = t.id
      LEFT JOIN churches c ON t.church_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (normalizedFundId !== null) {
      params.push(normalizedFundId);
      query += ` AND fm.fund_id = $${params.length}`;
    }

    if (normalizedChurchId !== null) {
      params.push(normalizedChurchId);
      query += ` AND t.church_id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND (t.date >= $${params.length}::date OR (t.date IS NULL AND fm.created_at::date >= $${params.length}::date))`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND (t.date <= $${params.length}::date OR (t.date IS NULL AND fm.created_at::date <= $${params.length}::date))`;
    }

    query += ' ORDER BY COALESCE(t.date, fm.created_at::date) DESC, fm.id DESC';

    const tableCheck = await execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'fund_movements_enhanced'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Fund movements table not yet initialized'
      });
    }

    const result = await execute(query, params);

    return res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });

  } catch (error) {
    console.error('Fund movements error:', error);
    const status = error.status || 500;
    return res.status(status).json({
      error: 'Error loading fund movements',
      details: error.message
    });
  }
};