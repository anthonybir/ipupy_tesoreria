const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

const isProvided = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const parseInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseFloat = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {throw new Error('Token no proporcionado');}

  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = async (req, res) => {
  // Configurar CORS
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
    case 'PUT':
      return await handlePut(req, res, decoded);
    case 'DELETE':
      return await handleDelete(req, res, decoded);
    default:
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API transactions:', error);
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

async function handleGet(req, res) {
  const { fund_id, church_id, date_from, date_to, page, limit } = req.query;

  const filters = [];
  const params = [];

  if (fund_id) {
    params.push(parseInteger(fund_id));
    filters.push(`t.fund_id = $${params.length}`);
  }

  if (church_id) {
    params.push(parseInteger(church_id));
    filters.push(`t.church_id = $${params.length}`);
  }

  if (date_from) {
    params.push(date_from);
    filters.push(`t.date >= $${params.length}`);
  }

  if (date_to) {
    params.push(date_to);
    filters.push(`t.date <= $${params.length}`);
  }

  const whereClause = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';

  const baseQuery = `
    SELECT t.*,
           c.name AS church_name, c.city,
           f.name AS fund_name, f.type AS fund_type,
           r.month, r.year
    FROM transactions t
    LEFT JOIN churches c ON t.church_id = c.id
    LEFT JOIN funds f ON t.fund_id = f.id
    LEFT JOIN reports r ON t.report_id = r.id
  `;

  const queryParams = [...params];
  let recordsQuery = `${baseQuery}${whereClause} ORDER BY t.date DESC, t.id DESC`;

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

  const result = await execute(recordsQuery, queryParams);
  res.json(result.rows);
}

async function handlePost(req, res, decoded) {
  const data = req.body;

  // Validate required fields
  if (!data.date) {
    throw new BadRequestError('La fecha es requerida');
  }

  if (!data.fund_id) {
    throw new BadRequestError('El fondo es requerido');
  }

  if (!data.concept) {
    throw new BadRequestError('El concepto es requerido');
  }

  const amount_in = toNumber(data.amount_in);
  const amount_out = toNumber(data.amount_out);

  if (amount_in === 0 && amount_out === 0) {
    throw new BadRequestError('Debe especificar un monto de entrada o salida');
  }

  if (amount_in > 0 && amount_out > 0) {
    throw new BadRequestError('Solo puede especificar entrada O salida, no ambos');
  }

  try {
    // Get current fund balance
    const fundResult = await execute(
      'SELECT current_balance FROM funds WHERE id = $1',
      [data.fund_id]
    );

    if (fundResult.rows.length === 0) {
      throw new BadRequestError('Fondo no encontrado');
    }

    const currentBalance = parseFloat(fundResult.rows[0].current_balance) || 0;
    const movement = amount_in > 0 ? amount_in : -amount_out;
    const newBalance = currentBalance + movement;

    // Check if withdrawal would result in negative balance
    if (newBalance < 0) {
      throw new BadRequestError(`Saldo insuficiente. Saldo actual: ${currentBalance.toLocaleString()}`);
    }

    // Start transaction
    await execute('BEGIN');

    // Insert transaction
    const transactionResult = await execute(`
      INSERT INTO transactions (
        date, church_id, report_id, fund_id, concept, provider, document_number,
        amount_in, amount_out, balance, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `, [
      data.date,
      data.church_id || null,
      data.report_id || null,
      data.fund_id,
      data.concept,
      data.provider || '',
      data.document_number || '',
      amount_in,
      amount_out,
      newBalance,
      decoded.email || 'admin'
    ]);

    const transaction = transactionResult.rows[0];

    // Update fund balance
    await execute(
      'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, data.fund_id]
    );

    // Record fund movement
    await execute(`
      INSERT INTO fund_movements_enhanced (
        fund_id, transaction_id, previous_balance, movement, new_balance
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      data.fund_id,
      transaction.id,
      currentBalance,
      movement,
      newBalance
    ]);

    await execute('COMMIT');

    res.json(transaction);

  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
}

async function handlePut(req, res, decoded) {
  const transactionId = parseInteger(req.url.split('/').pop());
  if (!transactionId) {
    throw new BadRequestError('ID de transacción inválido');
  }

  const data = req.body;

  try {
    // Get existing transaction
    const existingResult = await execute(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (existingResult.rows.length === 0) {
      throw new BadRequestError('Transacción no encontrada');
    }

    const existing = existingResult.rows[0];

    // For now, only allow updating certain fields to keep it simple
    const updateFields = [];
    const updateParams = [];

    if (data.concept) {
      updateParams.push(data.concept);
      updateFields.push(`concept = $${updateParams.length}`);
    }

    if (data.provider !== undefined) {
      updateParams.push(data.provider);
      updateFields.push(`provider = $${updateParams.length}`);
    }

    if (data.document_number !== undefined) {
      updateParams.push(data.document_number);
      updateFields.push(`document_number = $${updateParams.length}`);
    }

    if (updateFields.length === 0) {
      throw new BadRequestError('No hay campos para actualizar');
    }

    updateParams.push(transactionId);
    const query = `UPDATE transactions SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${updateParams.length} RETURNING *`;

    const result = await execute(query, updateParams);
    res.json(result.rows[0]);

  } catch (error) {
    throw error;
  }
}

async function handleDelete(req, res, decoded) {
  const transactionId = parseInteger(req.url.split('/').pop());
  if (!transactionId) {
    throw new BadRequestError('ID de transacción inválido');
  }

  try {
    // Get existing transaction
    const existingResult = await execute(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (existingResult.rows.length === 0) {
      throw new BadRequestError('Transacción no encontrada');
    }

    const transaction = existingResult.rows[0];

    // Start transaction
    await execute('BEGIN');

    // Get current fund balance
    const fundResult = await execute(
      'SELECT current_balance FROM funds WHERE id = $1',
      [transaction.fund_id]
    );

    const currentBalance = parseFloat(fundResult.rows[0].current_balance) || 0;
    const amount_in = parseFloat(transaction.amount_in) || 0;
    const amount_out = parseFloat(transaction.amount_out) || 0;
    const reverseMovement = amount_in > 0 ? -amount_in : amount_out;
    const newBalance = currentBalance + reverseMovement;

    // Check if reversal would result in negative balance
    if (newBalance < 0) {
      throw new BadRequestError(`No se puede eliminar: resultaría en saldo negativo. Saldo actual: ${currentBalance.toLocaleString()}`);
    }

    // Delete transaction
    await execute('DELETE FROM transactions WHERE id = $1', [transactionId]);

    // Update fund balance
    await execute(
      'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, transaction.fund_id]
    );

    // Record fund movement for deletion
    await execute(`
      INSERT INTO fund_movements_enhanced (
        fund_id, transaction_id, previous_balance, movement, new_balance
      ) VALUES ($1, NULL, $2, $3, $4)
    `, [
      transaction.fund_id,
      currentBalance,
      reverseMovement,
      newBalance
    ]);

    await execute('COMMIT');

    res.json({ success: true, message: 'Transacción eliminada correctamente' });

  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
}