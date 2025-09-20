const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');

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
    console.error('Error en API church-accounts:', error);
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
  const { church_id, account_id } = req.query;

  const numericChurchId = church_id ? parseInt(church_id, 10) : undefined;
  const numericAccountId = account_id ? parseInt(account_id, 10) : undefined;
  const decodedChurchId = decoded.church_id ? parseInt(decoded.church_id, 10) : undefined;

  const conditions = [];
  const params = [];

  if (decoded.role === 'church' && decodedChurchId) {
    conditions.push(`ca.church_id = $${params.length + 1}`);
    params.push(decodedChurchId);
  } else if (numericChurchId) {
    conditions.push(`ca.church_id = $${params.length + 1}`);
    params.push(numericChurchId);
  } else if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  if (numericAccountId) {
    conditions.push(`ca.id = $${params.length + 1}`);
    params.push(numericAccountId);
  }

  let queryText = `
    SELECT ca.*, c.name as church_name, c.city, c.pastor
    FROM church_accounts ca
    JOIN churches c ON ca.church_id = c.id
  `;

  if (conditions.length > 0) {
    queryText += ` WHERE ${conditions.join(' AND ')}`;
  }

  queryText += ' ORDER BY c.name, ca.account_name';

  const result = await execute(queryText, params);
  res.json(result.rows);
}

async function handlePost(req, res, decoded) {
  const data = req.body;

  // Validación básica
  if (!data.church_id || !data.account_name || !data.account_type) {
    return res.status(400).json({
      error: 'church_id, account_name y account_type son requeridos'
    });
  }

  // Control de acceso: usuarios de iglesia solo pueden crear cuentas para su iglesia
  if (decoded.role === 'church' && decoded.church_id && data.church_id !== decoded.church_id) {
    return res.status(403).json({ error: 'Solo puede crear cuentas para su iglesia' });
  }

  // Validar tipos de cuenta permitidos
  const allowedTypes = ['checking', 'savings', 'petty_cash', 'special_fund'];
  if (!allowedTypes.includes(data.account_type)) {
    return res.status(400).json({
      error: `Tipo de cuenta debe ser uno de: ${allowedTypes.join(', ')}`
    });
  }

  try {
    // Verificar que no exista una cuenta con el mismo nombre para esta iglesia
    const existingAccount = await execute(
      'SELECT id FROM church_accounts WHERE church_id = $1 AND account_name = $2',
      [parseInt(data.church_id, 10), data.account_name]
    );

    if (existingAccount.rows.length > 0) {
      return res.status(400).json({
        error: 'Ya existe una cuenta con ese nombre para esta iglesia'
      });
    }

    const openingBalance = parseFloat(data.opening_balance || 0);
    const isActive = data.is_active === undefined ? true : Boolean(data.is_active);

    const result = await execute(`
      INSERT INTO church_accounts (
        church_id, account_name, account_type, account_number, bank_name,
        opening_balance, current_balance, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      parseInt(data.church_id, 10),
      data.account_name,
      data.account_type,
      data.account_number || null,
      data.bank_name || null,
      openingBalance,
      openingBalance,
      isActive
    ]);

    res.status(201).json({
      id: result.rows[0].id,
      message: 'Cuenta creada exitosamente',
      account: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        error: 'Ya existe una cuenta con ese nombre para esta iglesia'
      });
    }
    console.error('Error creando cuenta:', error);
    res.status(500).json({ error: 'No se pudo crear la cuenta' });
  }
}

async function handlePut(req, res, decoded) {
  const { id } = req.query;
  const data = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de cuenta requerido' });
  }

  const accountId = parseInt(id, 10);
  const decodedChurchId = decoded.church_id ? parseInt(decoded.church_id, 10) : undefined;

  const existingAccount = await execute(
    'SELECT * FROM church_accounts WHERE id = $1', [accountId]
  );

  if (existingAccount.rows.length === 0) {
    return res.status(404).json({ error: 'Cuenta no encontrada' });
  }

  const account = existingAccount.rows[0];

  if (decoded.role === 'church' && decodedChurchId !== account.church_id) {
    return res.status(403).json({ error: 'Solo puede modificar cuentas de su iglesia' });
  }

  // Validar tipo de cuenta si se está actualizando
  if (data.account_type) {
    const allowedTypes = ['checking', 'savings', 'petty_cash', 'special_fund'];
    if (!allowedTypes.includes(data.account_type)) {
      return res.status(400).json({
        error: `Tipo de cuenta debe ser uno de: ${allowedTypes.join(', ')}`
      });
    }
  }

  try {
    // Construir query dinámicamente solo con campos proporcionados
    const updates = [];
    const params = [];

    if (data.account_name !== undefined) {
      updates.push(`account_name = $${params.length + 1}`);
      params.push(data.account_name);
    }
    if (data.account_type !== undefined) {
      updates.push(`account_type = $${params.length + 1}`);
      params.push(data.account_type);
    }
    if (data.account_number !== undefined) {
      updates.push(`account_number = $${params.length + 1}`);
      params.push(data.account_number);
    }
    if (data.bank_name !== undefined) {
      updates.push(`bank_name = $${params.length + 1}`);
      params.push(data.bank_name);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${params.length + 1}`);
      params.push(Boolean(data.is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(accountId);
    const result = await execute(`
      UPDATE church_accounts SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `, params);

    res.json({
      message: 'Cuenta actualizada exitosamente',
      account: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        error: 'Ya existe una cuenta con ese nombre para esta iglesia'
      });
    }
    console.error('Error actualizando cuenta:', error);
    res.status(500).json({ error: 'No se pudo actualizar la cuenta' });
  }
}

async function handleDelete(req, res, decoded) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID de cuenta requerido' });
  }

  const accountId = parseInt(id, 10);
  const decodedChurchId = decoded.church_id ? parseInt(decoded.church_id, 10) : undefined;

  const existingAccount = await execute(
    'SELECT * FROM church_accounts WHERE id = $1', [accountId]
  );

  if (existingAccount.rows.length === 0) {
    return res.status(404).json({ error: 'Cuenta no encontrada' });
  }

  const account = existingAccount.rows[0];

  if (decoded.role === 'church' && decodedChurchId !== account.church_id) {
    return res.status(403).json({ error: 'Solo puede eliminar cuentas de su iglesia' });
  }

  try {
    // Verificar si hay transacciones asociadas
    const transactions = await execute(
      'SELECT COUNT(*) as count FROM church_transactions WHERE account_id = $1',
      [accountId]
    );

    if (Number(transactions.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la cuenta porque tiene transacciones asociadas'
      });
    }

    const result = await execute('DELETE FROM church_accounts WHERE id = $1 RETURNING *', [accountId]);

    res.json({
      message: 'Cuenta eliminada exitosamente',
      account: result.rows[0]
    });

  } catch (error) {
    console.error('Error eliminando cuenta:', error);
    res.status(500).json({ error: 'No se pudo eliminar la cuenta' });
  }
}