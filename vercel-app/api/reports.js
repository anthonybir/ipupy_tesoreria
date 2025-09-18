const { execute, initDatabase } = require('../lib/db-turso');
const jwt = require('jsonwebtoken');

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error('Token no proporcionado');

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
    // Inicializar base de datos si es necesario
    if (process.env.VERCEL) {
      await initDatabase();
    }

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
    console.error('Error en API reports:', error);
    if (error.name === 'JsonWebTokenError' || error.message.includes('Token')) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleGet(req, res) {
  const { year, month, church_id } = req.query;

  try {
    let queryText = `
      SELECT r.*, c.name as church_name, c.city, c.pastor, c.grado, c.posicion
      FROM reports r
      JOIN churches c ON r.church_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (year) {
      paramCount++;
      queryText += ` AND r.year = $${paramCount}`;
      params.push(year);
    }

    if (month) {
      paramCount++;
      queryText += ` AND r.month = $${paramCount}`;
      params.push(month);
    }

    if (church_id) {
      paramCount++;
      queryText += ` AND r.church_id = $${paramCount}`;
      params.push(church_id);
    }

    queryText += ' ORDER BY c.name, r.year DESC, r.month DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    throw error;
  }
}

async function handlePost(req, res) {
  const data = req.body;

  // Validación básica
  if (!data.church_id || !data.month || !data.year) {
    return res.status(400).json({ error: 'church_id, month y year son requeridos' });
  }

  // Validar que el mes esté entre 1 y 12
  if (data.month < 1 || data.month > 12) {
    return res.status(400).json({ error: 'El mes debe estar entre 1 y 12' });
  }

  try {
    // Verificar si ya existe un informe para este mes/año/iglesia
    const existingReport = await query(
      'SELECT id FROM reports WHERE church_id = $1 AND month = $2 AND year = $3',
      [data.church_id, data.month, data.year]
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un informe para este mes y año' });
    }

    // Calcular totales automáticamente
    const diezmos = parseFloat(data.diezmos || 0);
    const ofrendas = parseFloat(data.ofrendas || 0);
    const anexos = parseFloat(data.anexos || 0);
    const caballeros = parseFloat(data.caballeros || 0);
    const damas = parseFloat(data.damas || 0);
    const jovenes = parseFloat(data.jovenes || 0);
    const ninos = parseFloat(data.ninos || 0);
    const otros = parseFloat(data.otros || 0);

    const totalEntradas = diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
    const fondoNacional = totalEntradas * 0.1; // 10% automático

    const honorariosPastoral = parseFloat(data.honorarios_pastoral || 0);
    const servicios = parseFloat(data.servicios || 0);
    const totalSalidas = honorariosPastoral + fondoNacional + servicios;

    const saldoMes = totalEntradas - totalSalidas;

    // Crear el informe
    const result = await query(`
      INSERT INTO reports (
        church_id, month, year, diezmos, ofrendas, anexos, caballeros, damas,
        jovenes, ninos, otros, total_entradas, fondo_nacional, honorarios_pastoral,
        servicios, total_salidas, saldo_mes, ofrendas_directas_misiones, lazos_amor,
        mision_posible, aporte_caballeros, apy, instituto_biblico, diezmo_pastoral,
        numero_deposito, fecha_deposito, monto_depositado, asistencia_visitas,
        bautismos_agua, bautismos_espiritu, observaciones, estado
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
      ) RETURNING *
    `, [
      data.church_id, data.month, data.year,
      diezmos, ofrendas, anexos, caballeros, damas, jovenes, ninos, otros,
      totalEntradas, fondoNacional, honorariosPastoral, servicios, totalSalidas, saldoMes,
      parseFloat(data.ofrendas_directas_misiones || 0),
      parseFloat(data.lazos_amor || 0),
      parseFloat(data.mision_posible || 0),
      parseFloat(data.aporte_caballeros || 0),
      parseFloat(data.apy || 0),
      parseFloat(data.instituto_biblico || 0),
      parseFloat(data.diezmo_pastoral || 0),
      data.numero_deposito || null,
      data.fecha_deposito || null,
      fondoNacional, // monto_depositado es igual al fondo nacional
      parseInt(data.asistencia_visitas || 0),
      parseInt(data.bautismos_agua || 0),
      parseInt(data.bautismos_espiritu || 0),
      data.observaciones || '',
      'recibido'
    ]);

    res.status(201).json({
      id: result.rows[0].id,
      message: 'Informe guardado exitosamente',
      report: result.rows[0],
      totales: { totalEntradas, fondoNacional, totalSalidas, saldoMes }
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Ya existe un informe para este mes y año' });
    }
    throw error;
  }
}

async function handlePut(req, res) {
  const { id } = req.query;
  const data = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de informe requerido' });
  }

  try {
    // Recalcular totales
    const diezmos = parseFloat(data.diezmos || 0);
    const ofrendas = parseFloat(data.ofrendas || 0);
    const anexos = parseFloat(data.anexos || 0);
    const caballeros = parseFloat(data.caballeros || 0);
    const damas = parseFloat(data.damas || 0);
    const jovenes = parseFloat(data.jovenes || 0);
    const ninos = parseFloat(data.ninos || 0);
    const otros = parseFloat(data.otros || 0);

    const totalEntradas = diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
    const fondoNacional = totalEntradas * 0.1;

    const honorariosPastoral = parseFloat(data.honorarios_pastoral || 0);
    const servicios = parseFloat(data.servicios || 0);
    const totalSalidas = honorariosPastoral + fondoNacional + servicios;

    const saldoMes = totalEntradas - totalSalidas;

    const result = await query(`
      UPDATE reports SET
        diezmos = $1, ofrendas = $2, anexos = $3, caballeros = $4, damas = $5,
        jovenes = $6, ninos = $7, otros = $8, total_entradas = $9, fondo_nacional = $10,
        honorarios_pastoral = $11, servicios = $12, total_salidas = $13, saldo_mes = $14,
        numero_deposito = $15, fecha_deposito = $16, monto_depositado = $17,
        asistencia_visitas = $18, bautismos_agua = $19, bautismos_espiritu = $20,
        observaciones = $21, estado = $22, updated_at = CURRENT_TIMESTAMP
      WHERE id = $23
      RETURNING *
    `, [
      diezmos, ofrendas, anexos, caballeros, damas, jovenes, ninos, otros,
      totalEntradas, fondoNacional, honorariosPastoral, servicios, totalSalidas, saldoMes,
      data.numero_deposito, data.fecha_deposito, fondoNacional,
      parseInt(data.asistencia_visitas || 0), parseInt(data.bautismos_agua || 0),
      parseInt(data.bautismos_espiritu || 0), data.observaciones || '',
      data.estado || 'recibido', id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    res.json({
      message: 'Informe actualizado exitosamente',
      report: result.rows[0],
      totales: { totalEntradas, fondoNacional, totalSalidas, saldoMes }
    });

  } catch (error) {
    throw error;
  }
}

async function handleDelete(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID de informe requerido' });
  }

  try {
    const result = await query('DELETE FROM reports WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    res.json({ message: 'Informe eliminado exitosamente' });
  } catch (error) {
    throw error;
  }
}