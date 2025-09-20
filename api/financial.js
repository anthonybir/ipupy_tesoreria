const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');
const jwt = require('jsonwebtoken');

// Shared error classes and utilities
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

// Shared auth middleware
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null; // No token provided - allow for public GET requests
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.warn('Invalid token:', error.message);
    return null;
  }
};

module.exports = async (req, res) => {
  // Configure CORS
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // For GET requests, authentication is optional
    // For POST/PUT/DELETE, authentication is required
    const decoded = verifyToken(req);

    if (req.method !== 'GET' && !decoded) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { type } = req.query;

    // Route to appropriate handler based on type parameter
    switch (type) {
      case 'funds':
        return await handleFundsAPI(req, res, decoded);
      case 'transactions':
        return await handleTransactionsAPI(req, res, decoded);
      case 'church-transactions':
        return await handleChurchTransactionsAPI(req, res, decoded);
      default:
        return res.status(400).json({
          error: 'Parámetro type requerido. Valores válidos: funds, transactions, church-transactions'
        });
    }
  } catch (error) {
    console.error('Error en API financial:', error);

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

// === FUNDS API HANDLERS ===
async function handleFundsAPI(req, res, decoded) {
  switch (req.method) {
    case 'GET':
      await handleGetFunds(req, res, decoded);
      break;
    case 'PUT':
      await handleUpdateFund(req, res, decoded);
      break;
    default:
      res.status(405).json({ error: 'Método no permitido para funds' });
      break;
  }
}

// Obtener todos los fondos
async function handleGetFunds(req, res, decoded) {
  try {
    const result = await execute(`
      SELECT
        id,
        name,
        type,
        description,
        current_balance,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM funds
      WHERE is_active = true
      ORDER BY name ASC
    `);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error obteniendo fondos:', error);
    res.status(500).json({ error: 'Error al obtener los fondos' });
  }
}

// Actualizar un fondo (solo para administradores)
async function handleUpdateFund(req, res, decoded) {
  // Solo administradores pueden actualizar fondos
  if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Permisos insuficientes' });
  }

  const { id } = req.query;
  const { current_balance, description } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID del fondo requerido' });
  }

  if (current_balance === undefined || current_balance === null) {
    return res.status(400).json({ error: 'Nuevo saldo requerido' });
  }

  try {
    // Validar que el fondo existe
    const fundExists = await execute('SELECT id FROM funds WHERE id = $1', [id]);
    if (fundExists.rows.length === 0) {
      return res.status(404).json({ error: 'Fondo no encontrado' });
    }

    // Actualizar el fondo
    const updateFields = ['current_balance = $1', 'updated_at = NOW()'];
    const updateValues = [current_balance];

    if (description !== undefined) {
      updateFields.push('description = $2');
      updateValues.push(description);
    }

    updateValues.push(id); // Para el WHERE

    const result = await execute(`
      UPDATE funds
      SET ${updateFields.join(', ')}
      WHERE id = $${updateValues.length}
      RETURNING id, name, type, description, current_balance, updated_at
    `, updateValues);

    res.json({
      success: true,
      message: 'Fondo actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando fondo:', error);
    res.status(500).json({ error: 'Error al actualizar el fondo' });
  }
}

// === TRANSACTIONS API HANDLERS ===
async function handleTransactionsAPI(req, res, decoded) {
  switch (req.method) {
    case 'GET':
      return await handleGetTransactions(req, res, decoded);
    case 'POST':
      return await handlePostTransaction(req, res, decoded);
    case 'PUT':
      return await handlePutTransaction(req, res, decoded);
    case 'DELETE':
      return await handleDeleteTransaction(req, res, decoded);
    default:
      return res.status(405).json({ error: 'Método no permitido para transactions' });
  }
}

async function handleGetTransactions(req, res) {
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

async function handlePostTransaction(req, res, decoded) {
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

async function handlePutTransaction(req, res, decoded) {
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

async function handleDeleteTransaction(req, res, decoded) {
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

// === CHURCH TRANSACTIONS API HANDLERS ===
async function handleChurchTransactionsAPI(req, res, decoded) {
  switch (req.method) {
    case 'GET':
      return await handleGetChurchTransactions(req, res, decoded);
    case 'POST':
      return await handlePostChurchTransaction(req, res, decoded);
    case 'PUT':
      return await handlePutChurchTransaction(req, res, decoded);
    case 'DELETE':
      return await handleDeleteChurchTransaction(req, res, decoded);
    default:
      return res.status(405).json({ error: 'Método no permitido para church-transactions' });
  }
}

async function handleGetChurchTransactions(req, res, decoded) {
  const {
    church_id,
    account_id,
    transaction_type,
    category_id,
    start_date,
    end_date,
    limit = 100,
    offset = 0
  } = req.query;

  const decodedChurchId = decoded.church_id ? parseInt(decoded.church_id, 10) : undefined;
  const numericChurchId = church_id ? parseInt(church_id, 10) : undefined;
  const numericAccountId = account_id ? parseInt(account_id, 10) : undefined;
  const numericCategoryId = category_id ? parseInt(category_id, 10) : undefined;
  const limitInt = Math.max(parseInt(limit, 10) || 100, 1);
  const offsetInt = Math.max(parseInt(offset, 10) || 0, 0);

  const conditions = [];
  const params = [];

  if (decoded.role === 'church' && decodedChurchId) {
    conditions.push(`ct.church_id = $${params.length + 1}`);
    params.push(decodedChurchId);
  } else if (numericChurchId) {
    conditions.push(`ct.church_id = $${params.length + 1}`);
    params.push(numericChurchId);
  } else if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  if (numericAccountId) {
    conditions.push(`ct.account_id = $${params.length + 1}`);
    params.push(numericAccountId);
  }

  if (transaction_type) {
    conditions.push(`ct.transaction_type = $${params.length + 1}`);
    params.push(transaction_type);
  }

  if (!Number.isNaN(numericCategoryId)) {
    conditions.push(`ct.category_id = $${params.length + 1}`);
    params.push(numericCategoryId);
  }

  if (start_date) {
    conditions.push(`ct.transaction_date >= $${params.length + 1}`);
    params.push(start_date);
  }

  if (end_date) {
    conditions.push(`ct.transaction_date <= $${params.length + 1}`);
    params.push(end_date);
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  const baseQuery = `
    SELECT
      ct.*,
      c.name AS church_name,
      ca.account_name,
      ca.account_type,
      ctc.category_name,
      ctc.category_type,
      ta.account_name AS transfer_account_name
    FROM church_transactions ct
    JOIN churches c ON ct.church_id = c.id
    JOIN church_accounts ca ON ct.account_id = ca.id
    LEFT JOIN church_transaction_categories ctc ON ct.category_id = ctc.id
    LEFT JOIN church_accounts ta ON ct.transfer_account_id = ta.id
  `;

  const summaryQuery = `
    SELECT
      transaction_type,
      COUNT(*) AS count,
      SUM(amount) AS total_amount
    FROM church_transactions ct
    ${whereClause}
    GROUP BY transaction_type
  `;

  const summaryResult = await execute(summaryQuery, params);

  const limitPlaceholder = `$${params.length + 1}`;
  const offsetPlaceholder = `$${params.length + 2}`;
  const queryParams = [...params, limitInt, offsetInt];

  const result = await execute(
    `${baseQuery}${whereClause} ORDER BY ct.transaction_date DESC, ct.created_at DESC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    queryParams
  );

  res.json({
    transactions: result.rows,
    summary: summaryResult.rows,
    pagination: {
      limit: limitInt,
      offset: offsetInt,
      total: result.rows.length
    }
  });
}

async function handlePostChurchTransaction(req, res, decoded) {
  const data = req.body;

  if (!data.church_id || !data.account_id || !data.amount || !data.transaction_type || !data.description) {
    return res.status(400).json({
      error: 'church_id, account_id, amount, transaction_type y description son requeridos'
    });
  }

  const churchId = parseInt(data.church_id, 10);
  const accountId = parseInt(data.account_id, 10);
  const transferAccountId = data.transfer_account_id ? parseInt(data.transfer_account_id, 10) : null;
  const categoryId = data.category_id ? parseInt(data.category_id, 10) : null;
  const amount = parseFloat(data.amount);

  if (decoded.role === 'church' && decoded.church_id && churchId !== parseInt(decoded.church_id, 10)) {
    return res.status(403).json({ error: 'Solo puede crear transacciones para su iglesia' });
  }

  const allowedTypes = ['income', 'expense', 'transfer'];
  if (!allowedTypes.includes(data.transaction_type)) {
    return res.status(400).json({
      error: `Tipo de transacción debe ser uno de: ${allowedTypes.join(', ')}`
    });
  }

  if (data.transaction_type === 'transfer' && !transferAccountId) {
    return res.status(400).json({
      error: 'transfer_account_id es requerido para transferencias'
    });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }

  try {
    const accountCheck = await execute(
      'SELECT id FROM church_accounts WHERE id = $1 AND church_id = $2',
      [accountId, churchId]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Cuenta no encontrada o no pertenece a la iglesia' });
    }

    if (data.transaction_type === 'transfer') {
      const transferAccountCheck = await execute(
        'SELECT id FROM church_accounts WHERE id = $1 AND church_id = $2',
        [transferAccountId, churchId]
      );

      if (transferAccountCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'Cuenta destino no encontrada o no pertenece a la iglesia'
        });
      }
    }

    const transactionDate = data.transaction_date || new Date().toISOString().split('T')[0];
    const createdBy = decoded.email || decoded.user_id || 'sistema';

    const insertResult = await execute(`
      INSERT INTO church_transactions (
        church_id, account_id, transaction_date, amount, transaction_type,
        category_id, description, reference_number, check_number, vendor_customer,
        worship_record_id, expense_record_id, report_id, transfer_account_id,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15
      )
      RETURNING id
    `, [
      churchId,
      accountId,
      transactionDate,
      amount,
      data.transaction_type,
      categoryId,
      data.description,
      data.reference_number || null,
      data.check_number || null,
      data.vendor_customer || null,
      data.worship_record_id || null,
      data.expense_record_id || null,
      data.report_id || null,
      transferAccountId,
      createdBy
    ]);

    const transactionId = insertResult.rows[0].id;

    const fullTransaction = await execute(`
      SELECT
        ct.*,
        c.name AS church_name,
        ca.account_name,
        ca.account_type,
        ctc.category_name,
        ctc.category_type,
        ta.account_name AS transfer_account_name
      FROM church_transactions ct
      JOIN churches c ON ct.church_id = c.id
      JOIN church_accounts ca ON ct.account_id = ca.id
      LEFT JOIN church_transaction_categories ctc ON ct.category_id = ctc.id
      LEFT JOIN church_accounts ta ON ct.transfer_account_id = ta.id
      WHERE ct.id = $1
    `, [transactionId]);

    res.status(201).json({
      id: transactionId,
      message: 'Transacción creada exitosamente',
      transaction: fullTransaction.rows[0]
    });
  } catch (error) {
    console.error('Error creando transacción:', error);
    res.status(500).json({ error: 'No se pudo crear la transacción' });
  }
}

async function handlePutChurchTransaction(req, res, decoded) {
  const { id } = req.query;
  const data = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de transacción requerido' });
  }

  const transactionId = parseInt(id, 10);

  const existingTransaction = await execute(
    'SELECT * FROM church_transactions WHERE id = $1',
    [transactionId]
  );

  if (existingTransaction.rows.length === 0) {
    return res.status(404).json({ error: 'Transacción no encontrada' });
  }

  const transaction = existingTransaction.rows[0];
  const decodedChurchId = decoded.church_id ? parseInt(decoded.church_id, 10) : undefined;

  if (decoded.role === 'church' && decodedChurchId !== transaction.church_id) {
    return res.status(403).json({ error: 'Solo puede modificar transacciones de su iglesia' });
  }

  const updates = [];
  const params = [];

  if (data.transaction_date !== undefined) {
    updates.push(`transaction_date = $${params.length + 1}`);
    params.push(data.transaction_date);
  }

  if (data.amount !== undefined) {
    const amount = parseFloat(data.amount);
    if (amount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    updates.push(`amount = $${params.length + 1}`);
    params.push(amount);
  }

  if (data.description !== undefined) {
    updates.push(`description = $${params.length + 1}`);
    params.push(data.description);
  }

  if (data.category_id !== undefined) {
    updates.push(`category_id = $${params.length + 1}`);
    params.push(data.category_id ? parseInt(data.category_id, 10) : null);
  }

  if (data.reference_number !== undefined) {
    updates.push(`reference_number = $${params.length + 1}`);
    params.push(data.reference_number || null);
  }

  if (data.check_number !== undefined) {
    updates.push(`check_number = $${params.length + 1}`);
    params.push(data.check_number || null);
  }

  if (data.vendor_customer !== undefined) {
    updates.push(`vendor_customer = $${params.length + 1}`);
    params.push(data.vendor_customer || null);
  }

  if (data.is_reconciled !== undefined) {
    updates.push(`is_reconciled = $${params.length + 1}`);
    params.push(Boolean(data.is_reconciled));
    if (data.is_reconciled) {
      updates.push('reconciled_date = CURRENT_DATE');
    } else {
      updates.push('reconciled_date = NULL');
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  params.push(transactionId);

  const result = await execute(`
    UPDATE church_transactions
    SET ${updates.join(', ')}
    WHERE id = $${params.length}
    RETURNING *
  `, params);

  res.json({
    message: 'Transacción actualizada exitosamente',
    transaction: result.rows[0]
  });
}

async function handleDeleteChurchTransaction(req, res, decoded) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID de transacción requerido' });
  }

  const transactionId = parseInt(id, 10);
  const existingTransaction = await execute(
    'SELECT * FROM church_transactions WHERE id = $1',
    [transactionId]
  );

  if (existingTransaction.rows.length === 0) {
    return res.status(404).json({ error: 'Transacción no encontrada' });
  }

  const transaction = existingTransaction.rows[0];
  const decodedChurchId = decoded.church_id ? parseInt(decoded.church_id, 10) : undefined;

  if (decoded.role === 'church' && decodedChurchId !== transaction.church_id) {
    return res.status(403).json({ error: 'Solo puede eliminar transacciones de su iglesia' });
  }

  const result = await execute(
    'DELETE FROM church_transactions WHERE id = $1 RETURNING *',
    [transactionId]
  );

  res.json({
    message: 'Transacción eliminada exitosamente',
    transaction: result.rows[0]
  });
}