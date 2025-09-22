/**
 * API Endpoints for Accounting Management System
 * Consolidated handler for expense records and monthly ledger
 * IPU PY Treasury System
 */

const { execute, createConnection } = require('../lib/db');
const jwt = require('jsonwebtoken');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

// ============================================
// SHARED ERROR CLASSES AND UTILITIES
// ============================================

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const parseInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseRequiredChurchId = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('church_id es requerido y debe ser válido');
  }
  return parsed;
};

const parseRequiredMonth = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || parsed > 12) {
    throw new BadRequestError('month debe estar entre 1 y 12');
  }
  return parsed;
};

const parseRequiredYear = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 2020 || parsed > 2030) {
    throw new BadRequestError('year debe ser un año válido');
  }
  return parsed;
};

const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.warn('Invalid token:', error.message);
    return null;
  }
};

const getDecodedChurchId = (decoded) => {
  if (!decoded) {
    return null;
  }
  const raw = decoded.churchId ?? decoded.church_id;
  if (raw === undefined || raw === null) {
    return null;
  }
  const parsed = parseInteger(raw);
  return parsed === null ? null : parsed;
};

const enforceChurchAccess = (decoded, churchId) => {
  const normalizedChurchId = parseRequiredChurchId(churchId);
  if (!decoded) {
    return normalizedChurchId;
  }

  if (decoded.role === 'church') {
    const decodedChurchId = getDecodedChurchId(decoded);
    if (!decodedChurchId) {
      throw new BadRequestError('La cuenta no tiene una iglesia asignada.');
    }
    if (decodedChurchId !== normalizedChurchId) {
      throw new ForbiddenError('No tienes permiso para acceder a esta iglesia.');
    }
    return decodedChurchId;
  }

  return normalizedChurchId;
};

const sanitizeString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
};

// ============================================
// EXPENSE RECORDS HANDLERS
// ============================================

const ALLOWED_CATEGORIES = new Set([
  'servicios_basicos',
  'honorarios',
  'ministerio',
  'materiales',
  'mantenimiento',
  'otros'
]);

const normalizeExpensePayload = (body, decoded) => {
  const churchId = enforceChurchAccess(decoded, body.church_id);
  const fechaComprobante = sanitizeString(body.fecha_comprobante || body.fechaComprobante);
  if (!fechaComprobante) {
    throw new BadRequestError('La fecha del comprobante es requerida.');
  }

  const proveedor = sanitizeString(body.proveedor);
  if (!proveedor) {
    throw new BadRequestError('El proveedor es requerido.');
  }

  const concepto = sanitizeString(body.concepto);
  if (!concepto) {
    throw new BadRequestError('El concepto es requerido.');
  }

  const numeroComprobante = sanitizeString(body.numero_comprobante || body.numeroComprobante);
  const rucRaw = sanitizeString(body.ruc_ci_proveedor || body.rucCiProveedor);
  const rucCiProveedor = rucRaw ? rucRaw.toUpperCase() : null;

  const expenseCategoryRaw = sanitizeString(body.expense_category || body.expenseCategory) || 'otros';
  const esHonorarioPastoral = body.es_honorario_pastoral === true || body.esHonorarioPastoral === true || String(body.es_honorario_pastoral).toLowerCase() === 'true';
  const expenseCategory = esHonorarioPastoral ? 'honorarios' : expenseCategoryRaw;

  if (!ALLOWED_CATEGORIES.has(expenseCategory)) {
    throw new BadRequestError(`Categoría de gasto inválida: ${expenseCategory}`);
  }

  const amounts = {
    exenta: parseNumber(body.monto_exenta || body.montoExenta),
    gravada10: parseNumber(body.monto_gravada_10 || body.montoGravada10),
    iva10: parseNumber(body.iva_10 || body.iva10),
    gravada5: parseNumber(body.monto_gravada_5 || body.montoGravada5),
    iva5: parseNumber(body.iva_5 || body.iva5)
  };

  const totalFactura = parseNumber(body.total_factura || body.totalFactura || (amounts.exenta + amounts.gravada10 + amounts.iva10 + amounts.gravada5 + amounts.iva5));

  if (totalFactura <= 0) {
    throw new BadRequestError('El monto total debe ser mayor que 0.');
  }

  return {
    churchId,
    fechaComprobante,
    numeroComprobante,
    rucCiProveedor,
    proveedor,
    concepto,
    expenseCategory,
    tipoSalida: sanitizeString(body.tipo_salida || body.tipoSalida) || null,
    esHonorarioPastoral,
    amounts,
    totalFactura,
    observaciones: sanitizeString(body.observaciones)
  };
};

const saveExpenseRecord = async (payload, decoded) => {
  const esFacturaLegal = Boolean(payload.numeroComprobante && payload.rucCiProveedor);

  const result = await execute(`
    INSERT INTO expense_records (
      church_id,
      fecha_comprobante,
      numero_comprobante,
      ruc_ci_proveedor,
      proveedor,
      concepto,
      expense_category,
      monto_exenta,
      monto_gravada_10,
      iva_10,
      monto_gravada_5,
      iva_5,
      total_factura,
      es_factura_legal,
      tipo_salida,
      es_honorario_pastoral,
      observaciones,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
    [
      payload.churchId,
      payload.fechaComprobante,
      payload.numeroComprobante,
      payload.rucCiProveedor,
      payload.proveedor,
      payload.concepto,
      payload.expenseCategory,
      payload.amounts.exenta,
      payload.amounts.gravada10,
      payload.amounts.iva10,
      payload.amounts.gravada5,
      payload.amounts.iva5,
      payload.totalFactura,
      esFacturaLegal,
      payload.tipoSalida,
      payload.esHonorarioPastoral,
      payload.observaciones,
      decoded?.userId || null
    ]
  );

  return result.rows[0];
};

async function handleGetExpenseRecords(req, res, decoded) {
  const { church_id, year, month } = req.query;

  try {
    const churchId = enforceChurchAccess(decoded, church_id);
    const yearNum = parseRequiredYear(year);
    const monthNum = parseRequiredMonth(month);

    const result = await execute(`
      SELECT
        er.*,
        c.name as church_name
      FROM expense_records er
      LEFT JOIN churches c ON er.church_id = c.id
      WHERE er.church_id = $1
        AND EXTRACT(YEAR FROM er.fecha_comprobante) = $2
        AND EXTRACT(MONTH FROM er.fecha_comprobante) = $3
      ORDER BY er.fecha_comprobante DESC, er.created_at DESC`,
      [churchId, yearNum, monthNum]
    );

    return res.json({
      success: true,
      records: result.rows || [],
      month: monthNum,
      year: yearNum,
      church_id: churchId
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error fetching expense records:', error);
    return res.status(500).json({
      error: 'Error al obtener los gastos',
      details: error.message
    });
  }
}

async function handlePostExpenseRecord(req, res, decoded) {
  try {
    const payload = normalizeExpensePayload(req.body, decoded);
    const expense = await saveExpenseRecord(payload, decoded);

    return res.status(201).json({
      success: true,
      data: expense,
      message: 'Gasto registrado exitosamente'
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error saving expense record:', error);
    return res.status(500).json({
      error: 'Error al registrar el gasto',
      details: error.message
    });
  }
}

async function handleExpenseRecords(req, res, decoded) {
  if (req.method === 'GET') {
    return handleGetExpenseRecords(req, res, decoded);
  } else if (req.method === 'POST') {
    return handlePostExpenseRecord(req, res, decoded);
  } else {
    return res.status(405).json({ error: 'Método no permitido para expense records' });
  }
}

// ============================================
// MONTHLY LEDGER HANDLERS
// ============================================

const buildMonthlyLedger = async (churchId, monthNum, yearNum) => {
  try {
    const calculationResult = await execute(
      'SELECT * FROM calculate_monthly_totals($1, $2, $3)',
      [churchId, monthNum, yearNum]
    );

    if (!calculationResult.rows || calculationResult.rows.length === 0) {
      return null;
    }

    const totals = calculationResult.rows[0];

    const worshipResult = await execute(`
      SELECT
        COUNT(*) as total_services,
        SUM(num_hermanos + num_amigos + num_ninos) as total_attendance
      FROM worship_records
      WHERE church_id = $1
        AND EXTRACT(MONTH FROM fecha_culto) = $2
        AND EXTRACT(YEAR FROM fecha_culto) = $3`,
      [churchId, monthNum, yearNum]
    );

    const expensesResult = await execute(`
      SELECT
        expense_category,
        COUNT(*) as count,
        SUM(total_factura) as total
      FROM expense_records
      WHERE church_id = $1
        AND EXTRACT(MONTH FROM fecha_comprobante) = $2
        AND EXTRACT(YEAR FROM fecha_comprobante) = $3
      GROUP BY expense_category`,
      [churchId, monthNum, yearNum]
    );

    const existingReport = await execute(`
      SELECT id, estado, submitted_at
      FROM reports
      WHERE church_id = $1 AND month = $2 AND year = $3`,
      [churchId, monthNum, yearNum]
    );

    return {
      ...totals,
      worship_summary: worshipResult.rows[0] || { total_services: 0, total_attendance: 0 },
      expense_breakdown: expensesResult.rows || [],
      report_status: existingReport.rows[0] || null
    };
  } catch (error) {
    console.error('Error building monthly ledger:', error);
    throw error;
  }
};

async function handleGetMonthlyLedger(req, res, decoded) {
  const { church_id, month, year } = req.query;

  try {
    const churchId = enforceChurchAccess(decoded, church_id);
    const monthNum = parseRequiredMonth(month);
    const yearNum = parseRequiredYear(year);

    const ledger = await buildMonthlyLedger(churchId, monthNum, yearNum);

    if (!ledger) {
      throw new NotFoundError('No hay datos para el mes especificado');
    }

    return res.json({
      success: true,
      data: ledger,
      month: monthNum,
      year: yearNum,
      church_id: churchId
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error fetching monthly ledger:', error);
    return res.status(500).json({
      error: 'Error al obtener el libro mensual',
      details: error.message
    });
  }
}

async function handleCloseMonthlyLedger(req, res, decoded) {
  const { church_id, month, year } = req.body;

  try {
    const churchId = enforceChurchAccess(decoded, church_id);
    const monthNum = parseRequiredMonth(month);
    const yearNum = parseRequiredYear(year);

    // Check if month is already closed
    const existingReport = await execute(`
      SELECT id, estado
      FROM reports
      WHERE church_id = $1 AND month = $2 AND year = $3`,
      [churchId, monthNum, yearNum]
    );

    if (existingReport.rows.length > 0 && existingReport.rows[0].estado === 'enviado') {
      throw new BadRequestError('Este mes ya ha sido cerrado y enviado');
    }

    // Get totals
    const ledger = await buildMonthlyLedger(churchId, monthNum, yearNum);
    if (!ledger) {
      throw new BadRequestError('No hay datos para cerrar este mes');
    }

    // Create or update report
    const conn = await createConnection();
    try {
      await conn.query('BEGIN');

      let reportId;
      if (existingReport.rows.length > 0) {
        // Update existing report
        const updateResult = await conn.query(`
          UPDATE reports
          SET diezmos = $1, ofrendas = $2, total_entradas = $3,
              total_salidas = $4, saldo_mes = $5, fondo_nacional = $6,
              estado = 'enviado', submitted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
          RETURNING id`,
          [
            ledger.total_tithes,
            ledger.total_offerings,
            ledger.total_income,
            ledger.total_expenses,
            ledger.balance,
            ledger.national_fund_amount,
            existingReport.rows[0].id
          ]
        );
        reportId = updateResult.rows[0].id;
      } else {
        // Create new report
        const insertResult = await conn.query(`
          INSERT INTO reports (
            church_id, month, year, diezmos, ofrendas,
            total_entradas, total_salidas, saldo_mes,
            fondo_nacional, estado, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'enviado', CURRENT_TIMESTAMP)
          RETURNING id`,
          [
            churchId, monthNum, yearNum,
            ledger.total_tithes, ledger.total_offerings,
            ledger.total_income, ledger.total_expenses,
            ledger.balance, ledger.national_fund_amount
          ]
        );
        reportId = insertResult.rows[0].id;
      }

      await conn.query('COMMIT');

      return res.json({
        success: true,
        message: 'Mes cerrado exitosamente',
        report_id: reportId,
        data: ledger
      });
    } catch (error) {
      await conn.query('ROLLBACK');
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error closing monthly ledger:', error);
    return res.status(500).json({
      error: 'Error al cerrar el mes',
      details: error.message
    });
  }
}

async function handleMonthlyLedger(req, res, decoded) {
  const { action = 'get' } = req.query;

  if (action === 'close') {
    return handleCloseMonthlyLedger(req, res, decoded);
  } else {
    return handleGetMonthlyLedger(req, res, decoded);
  }
}

// ============================================
// MAIN HANDLER
// ============================================

module.exports = async function handler(req, res) {
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  const decoded = verifyToken(req);

  // Determine which type of request based on 'type' query parameter
  const { type = 'expenses' } = req.query;

  try {
    if (type === 'expenses') {
      return await handleExpenseRecords(req, res, decoded);
    } else if (type === 'ledger') {
      return await handleMonthlyLedger(req, res, decoded);
    } else {
      return res.status(400).json({
        error: 'Tipo inválido. Use type=expenses o type=ledger'
      });
    }
  } catch (error) {
    console.error('Error en API accounting:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};