const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');

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
    case 'PUT':
      return await handlePut(req, res, decoded);
    case 'DELETE':
      return await handleDelete(req, res, decoded);
    default:
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API church-transactions:', error);
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

async function handlePost(req, res, decoded) {
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

async function handlePut(req, res, decoded) {
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

async function handleDelete(req, res, decoded) {
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
