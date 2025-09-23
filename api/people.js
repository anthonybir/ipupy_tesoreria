/**
 * API Endpoints for People Management System
 * Consolidated handler for families and members
 * IPU PY Treasury System
 */

const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

// Import member utilities from the original members.js
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

const parseOptionalPositiveInt = (value, fieldName) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError(`${fieldName} inválido`);
  }
  return parsed;
};

const parseRequiredPositiveInt = (value, fieldName) => {
  const parsed = parseOptionalPositiveInt(value, fieldName);
  if (parsed === null) {
    throw new BadRequestError(`${fieldName} es requerido`);
  }
  return parsed;
};

const parseActiveFlag = (value) => {
  if (!isProvided(value) || value === 'all') {
    return null;
  }
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'si', 'sí'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no'].includes(normalized)) {
    return false;
  }
  throw new BadRequestError('Parámetro es_activo inválido');
};

const sanitizeSortColumn = (value) => {
  const allowed = new Set(['apellido', 'nombre', 'created_at', 'updated_at', 'ci_ruc']);
  return allowed.has(value) ? value : 'apellido';
};

const sanitizeSortOrder = (value) => (String(value).toUpperCase() === 'DESC' ? 'DESC' : 'ASC');

const toBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (!isProvided(value)) {
    return defaultValue;
  }
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'si', 'sí'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

// Helper function to validate required fields for members
const validateMember = (data) => {
  const required = ['church_id', 'nombre', 'apellido'];
  const missing = required.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw new BadRequestError(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }
};

// ============================================
// FAMILIES HANDLERS
// ============================================

async function handleFamilies(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido para familias' });
  }

  try {
    const familiesResult = await execute(
      `SELECT
         f.id,
         f.apellido_familia,
         f.direccion_principal,
         f.telefono_principal,
         f.jefe_familia_id,
         COALESCE(MAX(CONCAT_WS(' ', jefe.nombre, jefe.apellido)), '') AS jefe_familia_nombre,
         COUNT(m.id) AS miembros_total,
         SUM(CASE WHEN m.es_activo = true THEN 1 ELSE 0 END) AS miembros_activos
       FROM families f
       LEFT JOIN members m ON m.family_id = f.id
       LEFT JOIN members jefe ON f.jefe_familia_id = jefe.id
       GROUP BY f.id, f.apellido_familia, f.direccion_principal, f.telefono_principal, f.jefe_familia_id
       ORDER BY f.apellido_familia NULLS LAST, f.id`
    );

    const families = (familiesResult.rows || []).map((row) => ({
      id: row.id,
      apellido_familia: row.apellido_familia,
      direccion_principal: row.direccion_principal,
      telefono_principal: row.telefono_principal,
      jefe_familia_id: row.jefe_familia_id,
      jefe_familia_nombre: row.jefe_familia_nombre || null,
      miembros_total: Number(row.miembros_total || 0),
      miembros_activos: Number(row.miembros_activos || 0)
    }));

    return res.json({
      success: true,
      data: families,
      count: families.length
    });
  } catch (error) {
    console.error('Error en API families:', error);
    return res.status(500).json({
      success: false,
      error: 'Error obteniendo familias',
      details: error.message
    });
  }
}

// ============================================
// MEMBERS HANDLERS
// ============================================

async function handleGetMembers(req, res) {
  const {
    church_id,
    limit = '100',
    offset = '0',
    sort = 'apellido',
    order = 'ASC',
    es_activo = 'all'
  } = req.query;

  try {
    const churchId = parseOptionalPositiveInt(church_id, 'church_id');
    const limitValue = parseOptionalPositiveInt(limit, 'limit') || 100;
    const offsetValue = parseOptionalPositiveInt(offset, 'offset') || 0;
    const sortColumn = sanitizeSortColumn(sort);
    const sortOrder = sanitizeSortOrder(order);
    const activeFlag = parseActiveFlag(es_activo);

    // Build query
    const conditions = [];
    const params = [];

    if (churchId) {
      conditions.push(`church_id = $${params.length + 1}`);
      params.push(churchId);
    }

    if (activeFlag !== null) {
      conditions.push(`es_activo = $${params.length + 1}`);
      params.push(activeFlag);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, id`;
    const limitClause = `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitValue, offsetValue);

    const query = `
      SELECT
        m.*,
        c.name AS church_name,
        f.apellido_familia AS family_name
      FROM members m
      LEFT JOIN churches c ON m.church_id = c.id
      LEFT JOIN families f ON m.family_id = f.id
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

    const result = await execute(query, params);
    const countResult = await execute(
      `SELECT COUNT(*) AS total FROM members ${whereClause}`,
      params.slice(0, -2)
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: limitValue,
        offset: offsetValue
      }
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching members:', error);
    return res.status(500).json({
      error: 'Error obteniendo miembros',
      details: error.message
    });
  }
}

async function handleCreateMember(req, res) {
  const { body } = req;

  try {
    validateMember(body);

    const result = await execute(
      `INSERT INTO members (
        church_id, nombre, apellido, family_id, ci_ruc, telefono,
        email, direccion, es_activo, es_bautizado, es_miembro_oficial,
        nota
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        parseRequiredPositiveInt(body.church_id, 'church_id'),
        body.nombre,
        body.apellido,
        parseOptionalPositiveInt(body.family_id, 'family_id'),
        body.ci_ruc || null,
        body.telefono || null,
        body.email || null,
        body.direccion || null,
        toBoolean(body.es_activo, true),
        toBoolean(body.es_bautizado, false),
        toBoolean(body.es_miembro_oficial, false),
        body.nota || null
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El CI/RUC ya existe' });
    }
    console.error('Error creating member:', error);
    return res.status(500).json({
      error: 'Error creando miembro',
      details: error.message
    });
  }
}

async function handleUpdateMember(req, res) {
  const { id } = req.query;
  const { body } = req;

  try {
    const memberId = parseRequiredPositiveInt(id, 'ID de miembro');

    // Check if member exists
    const existing = await execute('SELECT id FROM members WHERE id = $1', [memberId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    const result = await execute(
      `UPDATE members SET
        church_id = COALESCE($1, church_id),
        nombre = COALESCE($2, nombre),
        apellido = COALESCE($3, apellido),
        family_id = $4,
        ci_ruc = $5,
        telefono = $6,
        email = $7,
        direccion = $8,
        es_activo = COALESCE($9, es_activo),
        es_bautizado = COALESCE($10, es_bautizado),
        es_miembro_oficial = COALESCE($11, es_miembro_oficial),
        nota = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *`,
      [
        body.church_id ? parseRequiredPositiveInt(body.church_id, 'church_id') : null,
        body.nombre || null,
        body.apellido || null,
        body.family_id ? parseOptionalPositiveInt(body.family_id, 'family_id') : null,
        body.ci_ruc || null,
        body.telefono || null,
        body.email || null,
        body.direccion || null,
        isProvided(body.es_activo) ? toBoolean(body.es_activo) : null,
        isProvided(body.es_bautizado) ? toBoolean(body.es_bautizado) : null,
        isProvided(body.es_miembro_oficial) ? toBoolean(body.es_miembro_oficial) : null,
        body.nota || null,
        memberId
      ]
    );

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El CI/RUC ya existe' });
    }
    console.error('Error updating member:', error);
    return res.status(500).json({
      error: 'Error actualizando miembro',
      details: error.message
    });
  }
}

async function handleDeleteMember(req, res) {
  const { id } = req.query;

  try {
    const memberId = parseRequiredPositiveInt(id, 'ID de miembro');

    const result = await execute(
      'DELETE FROM members WHERE id = $1 RETURNING id',
      [memberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    return res.json({
      success: true,
      message: 'Miembro eliminado exitosamente'
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error deleting member:', error);
    return res.status(500).json({
      error: 'Error eliminando miembro',
      details: error.message
    });
  }
}

async function handleMembers(req, res) {
  switch (req.method) {
  case 'GET':
    return handleGetMembers(req, res);
  case 'POST':
    return handleCreateMember(req, res);
  case 'PUT':
    return handleUpdateMember(req, res);
  case 'DELETE':
    return handleDeleteMember(req, res);
  default:
    return res.status(405).json({ error: 'Método no permitido' });
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

  // Determine which type of request based on 'type' query parameter
  const { type = 'members' } = req.query;

  try {
    if (type === 'families') {
      return await handleFamilies(req, res);
    } else if (type === 'members') {
      return await handleMembers(req, res);
    } else {
      return res.status(400).json({
        error: 'Tipo inválido. Use type=families o type=members'
      });
    }
  } catch (error) {
    console.error('Error en API people:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};