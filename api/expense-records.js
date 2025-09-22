const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
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
  const parsed = parseInteger(raw);
  return parsed === null ? null : parsed;
};

const enforceChurchAccess = (decoded, churchId) => {
  const parsed = parseInteger(churchId);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('church_id es requerido y debe ser válido');
  }

  if (decoded?.role === 'church') {
    const decodedChurchId = getDecodedChurchId(decoded);
    if (!decodedChurchId) {
      throw new ForbiddenError('La cuenta no tiene una iglesia asociada.');
    }
    if (decodedChurchId !== parsed) {
      throw new ForbiddenError('No tienes permiso para registrar gastos para otra iglesia.');
    }
    return decodedChurchId;
  }

  return parsed;
};

const sanitizeString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
};

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
      tipo_salida,
      expense_category,
      monto_exenta,
      monto_gravada_10,
      iva_10,
      monto_gravada_5,
      iva_5,
      total_factura,
      es_factura_legal,
      es_honorario_pastoral,
      observaciones
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
    ) RETURNING *
  `, [
    payload.churchId,
    payload.fechaComprobante,
    payload.numeroComprobante,
    payload.rucCiProveedor,
    payload.proveedor,
    payload.concepto,
    payload.tipoSalida,
    payload.expenseCategory,
    payload.amounts.exenta,
    payload.amounts.gravada10,
    payload.amounts.iva10,
    payload.amounts.gravada5,
    payload.amounts.iva5,
    payload.totalFactura,
    esFacturaLegal,
    payload.esHonorarioPastoral,
    payload.observaciones
  ]);

  const record = result.rows[0];

  return {
    record,
    created_by: decoded.email || decoded.userId || 'sistema'
  };
};

const listExpenseRecords = async (query, decoded) => {
  const churchId = enforceChurchAccess(decoded, query.church_id);
  const month = parseInteger(query.month);
  const year = parseInteger(query.year);

  if (month === null || month < 1 || month > 12) {
    throw new BadRequestError('month debe estar entre 1 y 12');
  }
  if (year === null || year < 2020 || year > 2030) {
    throw new BadRequestError('year debe ser un año válido');
  }

  const result = await execute(`
    SELECT *
    FROM expense_records
    WHERE church_id = $1
      AND EXTRACT(MONTH FROM fecha_comprobante) = $2
      AND EXTRACT(YEAR FROM fecha_comprobante) = $3
    ORDER BY fecha_comprobante DESC, id DESC
  `, [churchId, month, year]);

  return result.rows;
};

module.exports = async (req, res) => {
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    if (req.method === 'GET') {
      const records = await listExpenseRecords(req.query, decoded);
      return res.json({ records });
    }

    if (req.method === 'POST') {
      const payload = normalizeExpensePayload(req.body, decoded);
      const result = await saveExpenseRecord(payload, decoded);
      return res.status(201).json(result);
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error in expense-records API:', error);

    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
