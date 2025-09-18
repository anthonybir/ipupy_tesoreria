const { execute } = require('../lib/db-turso');
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
    console.error('Error en worship-records:', error);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// GET - Obtener registros de culto
async function handleGet(req, res, decoded) {
  try {
    const { church_id, fecha_inicio, fecha_fin, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT wr.*,
             c.name as church_name,
             c.pastor,
             COUNT(wc.id) as total_contributions
      FROM worship_records wr
      JOIN churches c ON wr.church_id = c.id
      LEFT JOIN worship_contributions wc ON wr.id = wc.worship_record_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filtros
    if (church_id) {
      sql += ` AND wr.church_id = ?`;
      params.push(church_id);
    } else if (decoded.role === 'church' && decoded.church_id) {
      sql += ` AND wr.church_id = ?`;
      params.push(decoded.church_id);
    }

    if (fecha_inicio) {
      sql += ` AND wr.fecha_culto >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += ` AND wr.fecha_culto <= ?`;
      params.push(fecha_fin);
    }

    sql += ` GROUP BY wr.id ORDER BY wr.fecha_culto DESC, wr.created_at DESC`;

    // Paginación
    const offset = (page - 1) * limit;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const result = await execute(sql, params);

    // Obtener total de registros para paginación
    let countSql = `
      SELECT COUNT(DISTINCT wr.id) as total
      FROM worship_records wr
      WHERE 1=1
    `;
    const countParams = [];

    if (church_id) {
      countSql += ` AND wr.church_id = ?`;
      countParams.push(church_id);
    } else if (decoded.role === 'church' && decoded.church_id) {
      countSql += ` AND wr.church_id = ?`;
      countParams.push(decoded.church_id);
    }

    if (fecha_inicio) {
      countSql += ` AND wr.fecha_culto >= ?`;
      countParams.push(fecha_inicio);
    }

    if (fecha_fin) {
      countSql += ` AND wr.fecha_culto <= ?`;
      countParams.push(fecha_fin);
    }

    const countResult = await execute(countSql, countParams);
    const total = countResult.rows[0]?.total || 0;

    return res.json({
      records: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo registros de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST - Crear nuevo registro de culto
async function handlePost(req, res, decoded) {
  try {
    const {
      church_id,
      fecha_culto,
      tipo_culto,
      predicador,
      encargado_registro,
      total_diezmos = 0,
      total_ofrendas = 0,
      total_misiones = 0,
      total_otros = 0,
      ofrenda_general_anonima = 0,
      miembros_activos = 0,
      visitas = 0,
      ninos = 0,
      jovenes = 0,
      bautismos_agua = 0,
      bautismos_espiritu = 0,
      observaciones = '',
      contributions = []
    } = req.body;

    // Validar permisos
    if (decoded.role === 'church' && decoded.church_id !== parseInt(church_id)) {
      return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
    }

    // Calcular totales
    const total_recaudado = total_diezmos + total_ofrendas + total_misiones + total_otros + ofrenda_general_anonima;
    const total_asistencia = miembros_activos + visitas + ninos + jovenes;

    // Insertar registro principal
    const worshipResult = await execute(`
      INSERT INTO worship_records (
        church_id, fecha_culto, tipo_culto, predicador, encargado_registro,
        total_diezmos, total_ofrendas, total_misiones, total_otros,
        ofrenda_general_anonima, total_recaudado,
        miembros_activos, visitas, ninos, jovenes, total_asistencia,
        bautismos_agua, bautismos_espiritu, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      church_id, fecha_culto, tipo_culto, predicador, encargado_registro,
      total_diezmos, total_ofrendas, total_misiones, total_otros,
      ofrenda_general_anonima, total_recaudado,
      miembros_activos, visitas, ninos, jovenes, total_asistencia,
      bautismos_agua, bautismos_espiritu, observaciones
    ]);

    const worshipRecordId = worshipResult.lastInsertRowid;

    // Insertar contribuciones individuales si existen
    if (contributions && contributions.length > 0) {
      for (const contrib of contributions) {
        const contributionTotal = (contrib.diezmo || 0) + (contrib.ofrenda || 0) +
                                (contrib.misiones || 0) + (contrib.otros || 0);

        await execute(`
          INSERT INTO worship_contributions (
            worship_record_id, numero_fila, nombre_aportante, ci_ruc,
            numero_recibo, diezmo, ofrenda, misiones, otros,
            otros_concepto, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          worshipRecordId,
          contrib.numero_fila || null,
          contrib.nombre_aportante || '',
          contrib.ci_ruc || '',
          contrib.numero_recibo || '',
          contrib.diezmo || 0,
          contrib.ofrenda || 0,
          contrib.misiones || 0,
          contrib.otros || 0,
          contrib.otros_concepto || '',
          contributionTotal
        ]);
      }
    }

    return res.status(201).json({
      message: 'Registro de culto creado exitosamente',
      worshipRecordId,
      total_recaudado,
      total_asistencia
    });

  } catch (error) {
    console.error('Error creando registro de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT - Actualizar registro de culto
async function handlePut(req, res, decoded) {
  try {
    const recordId = req.query.id;
    if (!recordId) {
      return res.status(400).json({ error: 'ID de registro requerido' });
    }

    // Verificar que el registro existe y permisos
    const existingRecord = await execute(
      'SELECT church_id FROM worship_records WHERE id = ?',
      [recordId]
    );

    if (!existingRecord.rows[0]) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (decoded.role === 'church' && decoded.church_id !== existingRecord.rows[0].church_id) {
      return res.status(403).json({ error: 'Sin permisos para este registro' });
    }

    const {
      fecha_culto,
      tipo_culto,
      predicador,
      encargado_registro,
      total_diezmos = 0,
      total_ofrendas = 0,
      total_misiones = 0,
      total_otros = 0,
      ofrenda_general_anonima = 0,
      miembros_activos = 0,
      visitas = 0,
      ninos = 0,
      jovenes = 0,
      bautismos_agua = 0,
      bautismos_espiritu = 0,
      observaciones = ''
    } = req.body;

    const total_recaudado = total_diezmos + total_ofrendas + total_misiones + total_otros + ofrenda_general_anonima;
    const total_asistencia = miembros_activos + visitas + ninos + jovenes;

    await execute(`
      UPDATE worship_records SET
        fecha_culto = ?, tipo_culto = ?, predicador = ?, encargado_registro = ?,
        total_diezmos = ?, total_ofrendas = ?, total_misiones = ?, total_otros = ?,
        ofrenda_general_anonima = ?, total_recaudado = ?,
        miembros_activos = ?, visitas = ?, ninos = ?, jovenes = ?, total_asistencia = ?,
        bautismos_agua = ?, bautismos_espiritu = ?, observaciones = ?
      WHERE id = ?
    `, [
      fecha_culto, tipo_culto, predicador, encargado_registro,
      total_diezmos, total_ofrendas, total_misiones, total_otros,
      ofrenda_general_anonima, total_recaudado,
      miembros_activos, visitas, ninos, jovenes, total_asistencia,
      bautismos_agua, bautismos_espiritu, observaciones,
      recordId
    ]);

    return res.json({ message: 'Registro actualizado exitosamente' });

  } catch (error) {
    console.error('Error actualizando registro de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE - Eliminar registro de culto
async function handleDelete(req, res, decoded) {
  try {
    const recordId = req.query.id;
    if (!recordId) {
      return res.status(400).json({ error: 'ID de registro requerido' });
    }

    // Solo administradores pueden eliminar registros
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden eliminar registros' });
    }

    // Eliminar contribuciones primero (foreign key)
    await execute('DELETE FROM worship_contributions WHERE worship_record_id = ?', [recordId]);

    // Eliminar registro principal
    const result = await execute('DELETE FROM worship_records WHERE id = ?', [recordId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    return res.json({ message: 'Registro eliminado exitosamente' });

  } catch (error) {
    console.error('Error eliminando registro de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}