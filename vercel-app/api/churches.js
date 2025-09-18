const { query, initDatabase } = require('../lib/db');

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Inicializar base de datos si es necesario
    if (process.env.VERCEL) {
      await initDatabase();
    }

    switch (req.method) {
      case 'GET':
        await handleGet(req, res);
        break;
      case 'POST':
        await handlePost(req, res);
        break;
      case 'PUT':
        await handlePut(req, res);
        break;
      case 'DELETE':
        await handleDelete(req, res);
        break;
      default:
        res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API churches:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleGet(req, res) {
  try {
    const result = await query("SELECT * FROM churches WHERE active = true ORDER BY name");
    res.json(result.rows);
  } catch (error) {
    throw error;
  }
}

async function handlePost(req, res) {
  const { name, city, pastor, phone, ruc, cedula, grado, posicion } = req.body;

  if (!name || !city || !pastor) {
    return res.status(400).json({ error: 'Nombre, ciudad y pastor son requeridos' });
  }

  try {
    const result = await query(`
      INSERT INTO churches (name, city, pastor, phone, ruc, cedula, grado, posicion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, city, pastor, phone || '', ruc || '', cedula || '', grado || '', posicion || '']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'La iglesia ya existe' });
    }
    throw error;
  }
}

async function handlePut(req, res) {
  const { id } = req.query;
  const { name, city, pastor, phone, ruc, cedula, grado, posicion, active } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de iglesia requerido' });
  }

  try {
    const result = await query(`
      UPDATE churches
      SET name = $1, city = $2, pastor = $3, phone = $4, ruc = $5,
          cedula = $6, grado = $7, posicion = $8, active = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [name, city, pastor, phone, ruc, cedula, grado, posicion, active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Iglesia no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    throw error;
  }
}

async function handleDelete(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID de iglesia requerido' });
  }

  try {
    // Soft delete
    const result = await query(`
      UPDATE churches
      SET active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Iglesia no encontrada' });
    }

    res.json({ message: 'Iglesia desactivada exitosamente' });
  } catch (error) {
    throw error;
  }
}