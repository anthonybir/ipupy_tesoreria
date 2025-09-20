const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');
const jwt = require('jsonwebtoken');

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Token no proporcionado');
  }

  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = async (req, res) => {
  // Configurar CORS
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  try {
    const decoded = verifyToken(req);

    switch (req.method) {
      case 'GET':
        await handleGetFunds(req, res, decoded);
        break;

      case 'PUT':
        await handleUpdateFund(req, res, decoded);
        break;

      default:
        res.status(405).json({ error: 'Método no permitido' });
        break;
    }
  } catch (error) {
    console.error('Error en API de fondos:', error);

    if (error.name === 'JsonWebTokenError' || error.message === 'Token no proporcionado') {
      return res.status(401).json({ error: 'Token inválido o no proporcionado' });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

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