const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');
const { setSecureCORSHeaders } = require('../src/lib/cors-handler');

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} inválido`);
  }
  return parsed;
};

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Token no proporcionado');
  }
  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Manejador principal para la API de iglesias
 * @param {Object} req - Objeto de request de Express/Vercel
 * @param {Object} res - Objeto de response de Express/Vercel
 * @returns {Promise<void>}
 */
module.exports = async function handler(req, res) {
  // Configure secure CORS (no wildcards)
  const isPreflightHandled = setSecureCORSHeaders(req, res, ['PUT', 'DELETE']);

  if (isPreflightHandled) {
    return; // Preflight request handled securely
  }

  try {
    // Verify JWT token for all requests
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
    console.error('Error en API churches:', error);
    if (error.name === 'JsonWebTokenError' || error.message.includes('Token')) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Maneja peticiones GET para obtener todas las iglesias activas
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} decoded - JWT decoded token
 * @returns {Promise<void>}
 */
async function handleGet(req, res, _decoded) {
  const result = await execute('SELECT * FROM churches WHERE active = true ORDER BY name');
  const churches = result.rows || [];
  // Return consistent format like other APIs
  res.json(churches);
}

/**
 * Maneja peticiones POST para crear una nueva iglesia
 * @param {Object} req - Request object con datos de la iglesia
 * @param {Object} res - Response object
 * @param {Object} decoded - JWT decoded token
 * @returns {Promise<void>}
 */
async function handlePost(req, res, _decoded) {
  const { name, city, pastor, phone, ruc, cedula, grado, posicion } = req.body;

  if (!name || !city || !pastor) {
    return res.status(400).json({ error: 'Nombre, ciudad y pastor son requeridos' });
  }

  try {
    const result = await execute(`
      INSERT INTO churches (name, city, pastor, phone, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, city, pastor, phone || '', ruc || '', cedula || '', grado || '', posicion || '']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'La iglesia ya existe' });
    }
    console.error('Error creando iglesia:', error);
    res.status(500).json({ error: 'No se pudo crear la iglesia' });
  }
}

async function handlePut(req, res, _decoded) {
  const { id } = req.query;
  const { name, city, pastor, phone, ruc, cedula, grado, posicion, active } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de iglesia requerido' });
  }

  const churchId = (() => {
    try {
      return parsePositiveInt(id, 'ID de iglesia');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  })();
  if (!churchId) {
    return; // response already sent
  }

  const result = await execute(`
    UPDATE churches
    SET name = $1, city = $2, pastor = $3, phone = $4, pastor_ruc = $5,
        pastor_cedula = $6, pastor_grado = $7, pastor_posicion = $8, active = $9, updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    RETURNING *
  `, [name, city, pastor, phone, ruc, cedula, grado, posicion, active, churchId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Iglesia no encontrada' });
  }

  res.json(result.rows[0]);
}

async function handleDelete(req, res, _decoded) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID de iglesia requerido' });
  }

  let churchId;
  try {
    churchId = parsePositiveInt(id, 'ID de iglesia');
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  // Soft delete
  const result = await execute(`
    UPDATE churches
    SET active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [churchId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Iglesia no encontrada' });
  }

  res.json({ message: 'Iglesia desactivada exitosamente' });
}