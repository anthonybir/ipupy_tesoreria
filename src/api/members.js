/**
 * API Endpoints for Member Management System
 * IPU PY Treasury System - Phase 2
 * Handles CRUD operations for members, families, and ministries
 */

const { execute } = require('../lib/db');

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

// Helper function to validate required fields
const validateMember = (data) => {
  const required = ['church_id', 'nombre', 'apellido'];
  const missing = required.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw new BadRequestError(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }
};

// ============================================
// MEMBER CRUD OPERATIONS
// ============================================

// GET /api/members - List all members with pagination and filters
module.exports = async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
    case 'GET':
      await handleGetMembers(req, res);
      break;
    case 'POST':
      await handleCreateMember(req, res);
      break;
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Members API error:', error);
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

async function handleGetMembers(req, res) {
  const {
    church_id,
    family_id,
    ministry_id,
    es_activo = '1',
    search,
    page = '1',
    limit = '50',
    sort_by = 'apellido',
    sort_order = 'ASC'
  } = req.query;

  const churchId = parseOptionalPositiveInt(church_id, 'church_id');
  const familyId = parseOptionalPositiveInt(family_id, 'family_id');
  const ministryId = parseOptionalPositiveInt(ministry_id, 'ministry_id');
  const activeFlag = parseActiveFlag(es_activo);
  const searchTerm = isProvided(search) ? `%${search}%` : null;
  const limitInt = Math.max(parseInteger(limit) ?? 50, 1);
  const pageInt = Math.max(parseInteger(page) ?? 1, 1);
  const offset = (pageInt - 1) * limitInt;
  const sortField = sanitizeSortColumn(sort_by);
  const sortDirection = sanitizeSortOrder(sort_order);

  const conditions = [];
  const params = [];

  if (churchId !== null) {
    params.push(churchId);
    conditions.push(`m.church_id = $${params.length}`);
  }

  if (familyId !== null) {
    params.push(familyId);
    conditions.push(`m.family_id = $${params.length}`);
  }

  if (activeFlag !== null) {
    params.push(activeFlag);
    conditions.push(`m.es_activo = $${params.length}`);
  }

  if (searchTerm) {
    const baseIndex = params.length + 1;
    conditions.push(`(
      m.nombre ILIKE $${baseIndex} OR
      m.apellido ILIKE $${baseIndex + 1} OR
      m.ci_ruc ILIKE $${baseIndex + 2} OR
      m.telefono ILIKE $${baseIndex + 3} OR
      m.email ILIKE $${baseIndex + 4}
    )`);
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (ministryId !== null) {
    params.push(ministryId);
    conditions.push(`EXISTS (
      SELECT 1
      FROM member_ministries mm
      WHERE mm.member_id = m.id
        AND mm.ministry_id = $${params.length}
        AND mm.es_activo = true
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const membersQuery = `
    SELECT
      m.*,
      f.apellido_familia,
      f.direccion_principal AS familia_direccion,
      c.name AS church_name,
      c.city AS church_city,
      (SELECT COUNT(*) FROM member_ministries mm WHERE mm.member_id = m.id AND mm.es_activo = true) AS ministerios_count,
      (SELECT MAX(ma.created_at) FROM member_attendance ma WHERE ma.member_id = m.id) AS ultima_asistencia
    FROM members m
    LEFT JOIN families f ON m.family_id = f.id
    LEFT JOIN churches c ON m.church_id = c.id
    ${whereClause}
    ORDER BY m.${sortField} ${sortDirection}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const membersResult = await execute(membersQuery, [...params, limitInt, offset]);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM members m
    LEFT JOIN families f ON m.family_id = f.id
    LEFT JOIN churches c ON m.church_id = c.id
    ${whereClause}
  `;
  const countResult = await execute(countQuery, params);

  const members = membersResult.rows || [];
  const total = Number(countResult.rows[0]?.total || 0);

  for (const member of members) {
    const ministriesResult = await execute(
      `SELECT
        mn.id,
        mn.nombre,
        mn.descripcion,
        mm.rol,
        mm.fecha_inicio,
        mm.es_activo
      FROM member_ministries mm
      JOIN ministries mn ON mm.ministry_id = mn.id
      WHERE mm.member_id = $1 AND mm.es_activo = true
    `,
      [member.id]
    );

    member.ministerios = ministriesResult.rows || [];
  }

  res.status(200).json({
    success: true,
    data: members,
    pagination: {
      page: pageInt,
      limit: limitInt,
      total,
      pages: Math.ceil(total / limitInt)
    }
  });
}

async function handleCreateMember(req, res) {
  const memberData = req.body;

  try {
    validateMember(memberData);

    const {
      church_id,
      family_id,
      nombre,
      apellido,
      ci_ruc,
      fecha_nacimiento,
      telefono,
      email,
      direccion,
      estado_civil,
      profesion,
      sexo,
      fecha_bautismo_agua,
      fecha_bautismo_espiritu,
      fecha_membresia,
      es_miembro_activo = true,
      tipo_membresia = 'miembro',
      grado_ministerial = 'LAICO',
      posicion_ministerial,
      dones_espirituales,
      es_jefe_familia = false,
      parentesco_jefe,
      contacto_emergencia_nombre,
      contacto_emergencia_telefono,
      contacto_emergencia_relacion,
      observaciones,
      notas_pastorales,
      foto_perfil
    } = memberData;

    const churchId = parseRequiredPositiveInt(church_id, 'church_id');
    const familyId = parseOptionalPositiveInt(family_id, 'family_id');
    const isMemberActive = toBoolean(es_miembro_activo, true);
    const isHeadOfFamily = toBoolean(es_jefe_familia, false);

    const insertResult = await execute(
      `INSERT INTO members (
        church_id, family_id, nombre, apellido, ci_ruc, fecha_nacimiento,
        telefono, email, direccion, estado_civil, profesion, sexo,
        fecha_bautismo_agua, fecha_bautismo_espiritu, fecha_membresia,
        es_miembro_activo, tipo_membresia, grado_ministerial, posicion_ministerial,
        dones_espirituales, es_jefe_familia, parentesco_jefe,
        contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion,
        observaciones, notas_pastorales, foto_perfil
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22,
        $23, $24, $25,
        $26, $27, $28
      ) RETURNING id`,
      [
        churchId,
        familyId,
        nombre,
        apellido,
        ci_ruc,
        fecha_nacimiento || null,
        telefono || null,
        email || null,
        direccion || null,
        estado_civil || null,
        profesion || null,
        sexo || null,
        fecha_bautismo_agua || null,
        fecha_bautismo_espiritu || null,
        fecha_membresia || null,
        isMemberActive,
        tipo_membresia || 'miembro',
        grado_ministerial || 'LAICO',
        posicion_ministerial || null,
        JSON.stringify(dones_espirituales || []),
        isHeadOfFamily,
        parentesco_jefe || null,
        contacto_emergencia_nombre || null,
        contacto_emergencia_telefono || null,
        contacto_emergencia_relacion || null,
        observaciones || null,
        notas_pastorales || null,
        foto_perfil || null
      ]
    );

    const memberId = insertResult.rows[0].id;

    if (isHeadOfFamily && familyId) {
      await execute('UPDATE families SET jefe_familia_id = $1 WHERE id = $2', [memberId, familyId]);
    }

    const createdMember = await execute(
      `SELECT
        m.*,
        f.apellido_familia,
        c.name AS church_name
      FROM members m
      LEFT JOIN families f ON m.family_id = f.id
      LEFT JOIN churches c ON m.church_id = c.id
      WHERE m.id = $1`,
      [memberId]
    );

    res.status(201).json({
      success: true,
      message: 'Miembro creado exitosamente',
      data: createdMember.rows[0]
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error creando miembro:', error);
    res.status(500).json({
      success: false,
      error: 'No se pudo crear el miembro',
      details: error.message
    });
  }
}
