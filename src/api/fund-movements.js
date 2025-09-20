const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

const parseInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Token no proporcionado');
  }
  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const decoded = verifyToken(req);

    switch (req.method) {
    case 'GET':
      return await handleGet(req, res, decoded);
    case 'POST':
      return await handlePost(req, res, decoded);
    default:
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en fund-movements:', error);
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'JsonWebTokenError' || error.message.includes('Token')) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

async function handleGet(req, res, decoded) {
  const { fund_id, date_from, date_to, page, limit } = req.query;

  const filters = [];
  const params = [];

  if (fund_id) {
    params.push(parseInteger(fund_id));
    filters.push(`fm.fund_id = $${params.length}`);
  }

  if (date_from) {
    params.push(date_from);
    filters.push(`fm.created_at >= $${params.length}`);
  }

  if (date_to) {
    params.push(date_to);
    filters.push(`fm.created_at <= $${params.length}`);
  }

  const whereClause = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';

  const baseQuery = `
    SELECT fm.*,
           f.name AS fund_name,
           t.concept
    FROM fund_movements_enhanced fm
    LEFT JOIN funds f ON fm.fund_id = f.id
    LEFT JOIN transactions t ON fm.transaction_id = t.id
  `;

  const queryParams = [...params];
  let recordsQuery = `${baseQuery}${whereClause} ORDER BY fm.created_at DESC, fm.id DESC`;

  const limitValue = parseInteger(limit);
  const pageValue = parseInteger(page);

  if (limitValue !== null && limitValue > 0) {
    const limitInt = Math.max(limitValue, 1);
    const pageInt = pageValue !== null && pageValue > 0 ? pageValue : 1;
    const offsetInt = (pageInt - 1) * limitInt;

    const limitPlaceholder = `$${queryParams.length + 1}`;
    const offsetPlaceholder = `$${queryParams.length + 2}`;
    recordsQuery += ` LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
    queryParams.push(limitInt, offsetInt);
  }

  try {
    const result = await execute(recordsQuery, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error loading fund movements:', error);
    throw error;
  }
}

async function handlePost(req, res, decoded) {
  // Fund movements are created automatically by the transaction API
  // This endpoint is not used directly, but kept for compatibility
  throw new BadRequestError('Los movimientos de fondos se crean automáticamente a través de las transacciones');
}
