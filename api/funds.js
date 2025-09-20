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
      // Check if this is a toggle request
      if (req.url && req.url.includes('/toggle')) {
        return await handleToggle(req, res, decoded);
      }
      return await handlePost(req, res, decoded);
    case 'PUT':
      // Check if this is a toggle request
      if (req.url && req.url.includes('/toggle')) {
        return await handleToggle(req, res, decoded);
      }
      return await handlePut(req, res, decoded);
    case 'DELETE':
      return await handleDelete(req, res, decoded);
    default:
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API funds:', error);
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
  const { type, active_only } = req.query;

  const filters = [];
  const params = [];

  if (type) {
    params.push(type);
    filters.push(`type = $${params.length}`);
  }

  if (active_only === 'true') {
    filters.push('is_active = true');
  }

  const whereClause = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';

  const query = `
    SELECT id, name, type, description, current_balance, is_active,
           created_at, updated_at
    FROM funds
    ${whereClause}
    ORDER BY name ASC
  `;

  const result = await execute(query, params);
  res.json(result.rows);
}

async function handlePost(req, res, decoded) {
  const data = req.body;

  // Validate required fields
  if (!data.name) {
    throw new BadRequestError('El nombre del fondo es requerido');
  }

  if (!data.type) {
    throw new BadRequestError('El tipo de fondo es requerido');
  }

  const validTypes = ['nacional', 'construccion', 'misionero', 'especial', 'obras_beneficas', 'educativo', 'otro'];
  if (!validTypes.includes(data.type)) {
    throw new BadRequestError('Tipo de fondo inválido');
  }

  const currentBalance = toNumber(data.current_balance, 0);
  const isActive = data.is_active !== false; // Default to true

  try {
    // Check if fund name already exists
    const existingResult = await execute(
      'SELECT id FROM funds WHERE name = $1',
      [data.name]
    );

    if (existingResult.rows.length > 0) {
      throw new BadRequestError('Ya existe un fondo con ese nombre');
    }

    // Start transaction
    await execute('BEGIN');

    // Insert fund
    const fundResult = await execute(`
      INSERT INTO funds (
        name, type, description, current_balance, is_active, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING *
    `, [
      data.name,
      data.type,
      data.description || '',
      currentBalance,
      isActive,
      decoded.email || 'admin'
    ]);

    const fund = fundResult.rows[0];

    // If there's an initial balance, record it as a movement
    if (currentBalance > 0) {
      await execute(`
        INSERT INTO fund_movements (
          fund_id, transaction_id, previous_balance, movement, new_balance
        ) VALUES ($1, NULL, $2, $3, $4)
      `, [
        fund.id,
        0,
        currentBalance,
        currentBalance
      ]);
    }

    await execute('COMMIT');

    res.json(fund);

  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
}

async function handlePut(req, res, decoded) {
  const url = req.url || '';
  const pathParts = url.split('/');
  const fundId = parseInteger(pathParts[pathParts.length - 1]);

  if (!fundId) {
    throw new BadRequestError('ID de fondo inválido');
  }

  const data = req.body;

  try {
    // Get existing fund
    const existingResult = await execute(
      'SELECT * FROM funds WHERE id = $1',
      [fundId]
    );

    if (existingResult.rows.length === 0) {
      throw new BadRequestError('Fondo no encontrado');
    }

    const existing = existingResult.rows[0];

    // Build update query
    const updateFields = [];
    const updateParams = [];

    if (data.name && data.name !== existing.name) {
      // Check if new name already exists
      const nameCheckResult = await execute(
        'SELECT id FROM funds WHERE name = $1 AND id != $2',
        [data.name, fundId]
      );

      if (nameCheckResult.rows.length > 0) {
        throw new BadRequestError('Ya existe un fondo con ese nombre');
      }

      updateParams.push(data.name);
      updateFields.push(`name = $${updateParams.length}`);
    }

    if (data.type && data.type !== existing.type) {
      const validTypes = ['nacional', 'construccion', 'misionero', 'especial', 'obras_beneficas', 'educativo', 'otro'];
      if (!validTypes.includes(data.type)) {
        throw new BadRequestError('Tipo de fondo inválido');
      }

      updateParams.push(data.type);
      updateFields.push(`type = $${updateParams.length}`);
    }

    if (data.description !== undefined && data.description !== existing.description) {
      updateParams.push(data.description);
      updateFields.push(`description = $${updateParams.length}`);
    }

    if (data.is_active !== undefined && data.is_active !== existing.is_active) {
      updateParams.push(data.is_active);
      updateFields.push(`is_active = $${updateParams.length}`);
    }

    if (updateFields.length === 0) {
      throw new BadRequestError('No hay campos para actualizar');
    }

    updateParams.push(fundId);
    const query = `UPDATE funds SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${updateParams.length} RETURNING *`;

    const result = await execute(query, updateParams);
    res.json(result.rows[0]);

  } catch (error) {
    throw error;
  }
}

async function handleToggle(req, res, decoded) {
  const url = req.url || '';
  const pathParts = url.split('/');
  const fundId = parseInteger(pathParts[pathParts.length - 2]); // Get ID before '/toggle'

  if (!fundId) {
    throw new BadRequestError('ID de fondo inválido');
  }

  try {
    // Get existing fund
    const existingResult = await execute(
      'SELECT * FROM funds WHERE id = $1',
      [fundId]
    );

    if (existingResult.rows.length === 0) {
      throw new BadRequestError('Fondo no encontrado');
    }

    const existing = existingResult.rows[0];
    const newStatus = !existing.is_active;

    // Update fund status
    const result = await execute(
      'UPDATE funds SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newStatus, fundId]
    );

    res.json(result.rows[0]);

  } catch (error) {
    throw error;
  }
}

async function handleDelete(req, res, decoded) {
  const url = req.url || '';
  const pathParts = url.split('/');
  const fundId = parseInteger(pathParts[pathParts.length - 1]);

  if (!fundId) {
    throw new BadRequestError('ID de fondo inválido');
  }

  try {
    // Get existing fund
    const existingResult = await execute(
      'SELECT * FROM funds WHERE id = $1',
      [fundId]
    );

    if (existingResult.rows.length === 0) {
      throw new BadRequestError('Fondo no encontrado');
    }

    const fund = existingResult.rows[0];

    // Check if fund has transactions
    const transactionResult = await execute(
      'SELECT COUNT(*) as count FROM transactions WHERE fund_id = $1',
      [fundId]
    );

    const transactionCount = parseInt(transactionResult.rows[0].count) || 0;

    if (transactionCount > 0) {
      throw new BadRequestError('No se puede eliminar el fondo porque tiene transacciones asociadas');
    }

    // Start transaction
    await execute('BEGIN');

    // Delete fund movements
    await execute('DELETE FROM fund_movements WHERE fund_id = $1', [fundId]);

    // Delete fund
    await execute('DELETE FROM funds WHERE id = $1', [fundId]);

    await execute('COMMIT');

    res.json({ success: true, message: 'Fondo eliminado correctamente' });

  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
}
