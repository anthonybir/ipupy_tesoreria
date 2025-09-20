const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');

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

const parseOptionalChurchId = (value) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('Parámetro church_id inválido.');
  }
  return parsed;
};

const parseRequiredChurchId = (value) => {
  const parsed = parseOptionalChurchId(value);
  if (parsed === null) {
    throw new BadRequestError('church_id es requerido');
  }
  return parsed;
};

const parseRecordId = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('ID de registro inválido');
  }
  return parsed;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIntOrZero = (value) => {
  const parsed = parseInteger(value);
  return parsed === null ? 0 : parsed;
};

const toOptionalInt = (value) => {
  const parsed = parseInteger(value);
  return parsed === null ? null : parsed;
};

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
    console.error('Error en worship-records:', error);
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'JsonWebTokenError' || (typeof error.message === 'string' && error.message.includes('Token'))) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

async function handleGet(req, res, decoded) {
  const { church_id, fecha_inicio, fecha_fin, page, limit } = req.query;

  const decodedChurchId = parseOptionalChurchId(decoded.church_id);
  if (decoded.role === 'church' && decodedChurchId === null) {
    throw new BadRequestError('El usuario autenticado no tiene un church_id válido.');
  }

  const requestedChurchId = parseOptionalChurchId(church_id);
  const limitValue = parseInteger(limit);
  const pageValue = parseInteger(page);

  const limitInt = Math.max(limitValue ?? 50, 1);
  const pageInt = Math.max(pageValue ?? 1, 1);
  const offsetInt = (pageInt - 1) * limitInt;

  const conditions = [];
  const params = [];

  if (decoded.role === 'church' && decodedChurchId !== null) {
    params.push(decodedChurchId);
    conditions.push(`wr.church_id = $${params.length}`);
  } else if (requestedChurchId !== null) {
    params.push(requestedChurchId);
    conditions.push(`wr.church_id = $${params.length}`);
  }

  if (isProvided(fecha_inicio)) {
    params.push(fecha_inicio);
    conditions.push(`wr.fecha_culto >= $${params.length}`);
  }

  if (isProvided(fecha_fin)) {
    params.push(fecha_fin);
    conditions.push(`wr.fecha_culto <= $${params.length}`);
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  const queryParams = [...params];
  const limitPlaceholder = `$${queryParams.length + 1}`;
  const offsetPlaceholder = `$${queryParams.length + 2}`;

  const recordsQuery = `
      SELECT
        wr.*, c.name AS church_name, c.pastor,
        COUNT(wc.id) AS total_contributions
      FROM worship_records wr
      JOIN churches c ON wr.church_id = c.id
      LEFT JOIN worship_contributions wc ON wr.id = wc.worship_record_id
      ${whereClause}
      GROUP BY wr.id, c.id
      ORDER BY wr.fecha_culto DESC, wr.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

  try {
    const recordsResult = await execute(recordsQuery, [...queryParams, limitInt, offsetInt]);
    const countResult = await execute(
      `SELECT COUNT(*) AS total FROM worship_records wr${whereClause}`,
      params
    );

    const total = Number(countResult.rows[0]?.total || 0);

    return res.json({
      records: recordsResult.rows,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total,
        totalPages: Math.ceil(total / limitInt)
      }
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error obteniendo registros de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function handlePost(req, res, decoded) {
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

  const churchId = parseRequiredChurchId(church_id);
  const decodedChurchId = parseOptionalChurchId(decoded.church_id);

  if (decoded.role === 'church' && decodedChurchId !== null && churchId !== decodedChurchId) {
    return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
  }

  const diezmos = toNumber(total_diezmos);
  const ofrendas = toNumber(total_ofrendas);
  const misiones = toNumber(total_misiones);
  const otros = toNumber(total_otros);
  const ofrendaAnonima = toNumber(ofrenda_general_anonima);

  const miembrosActivos = toIntOrZero(miembros_activos);
  const visitasInt = toIntOrZero(visitas);
  const ninosInt = toIntOrZero(ninos);
  const jovenesInt = toIntOrZero(jovenes);

  const totalRecaudado = diezmos + ofrendas + misiones + otros + ofrendaAnonima;
  const totalAsistencia = miembrosActivos + visitasInt + ninosInt + jovenesInt;

  try {
    const insertResult = await execute(
      `INSERT INTO worship_records (
         church_id, fecha_culto, tipo_culto, predicador, encargado_registro,
         total_diezmos, total_ofrendas, total_misiones, total_otros,
         ofrenda_general_anonima, total_recaudado,
         miembros_activos, visitas, ninos, jovenes, total_asistencia,
         bautismos_agua, bautismos_espiritu, observaciones
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11,
         $12, $13, $14, $15, $16,
         $17, $18, $19
       ) RETURNING id
      `,
      [
        churchId,
        fecha_culto,
        tipo_culto,
        predicador || null,
        encargado_registro || null,
        diezmos,
        ofrendas,
        misiones,
        otros,
        ofrendaAnonima,
        totalRecaudado,
        miembrosActivos,
        visitasInt,
        ninosInt,
        jovenesInt,
        totalAsistencia,
        toIntOrZero(bautismos_agua),
        toIntOrZero(bautismos_espiritu),
        observaciones || null
      ]
    );

    const worshipRecordId = insertResult.rows[0].id;

    if (Array.isArray(contributions) && contributions.length > 0) {
      for (const contrib of contributions) {
        const diezmoContrib = toNumber(contrib.diezmo);
        const ofrendaContrib = toNumber(contrib.ofrenda);
        const misionesContrib = toNumber(contrib.misiones);
        const otrosContrib = toNumber(contrib.otros);
        const contributionTotal = diezmoContrib + ofrendaContrib + misionesContrib + otrosContrib;

        await execute(
          `INSERT INTO worship_contributions (
             worship_record_id, numero_fila, nombre_aportante, ci_ruc,
             numero_recibo, diezmo, ofrenda, misiones, otros,
             otros_concepto, total
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8, $9,
             $10, $11
           )`,
          [
            worshipRecordId,
            toOptionalInt(contrib.numero_fila),
            contrib.nombre_aportante || null,
            contrib.ci_ruc || null,
            contrib.numero_recibo || null,
            diezmoContrib,
            ofrendaContrib,
            misionesContrib,
            otrosContrib,
            contrib.otros_concepto || null,
            contributionTotal
          ]
        );
      }
    }

    return res.status(201).json({
      message: 'Registro de culto creado exitosamente',
      record_id: worshipRecordId
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error creando registro de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function handlePut(req, res, decoded) {
  try {
    const { id } = req.query;
    const data = req.body;

    const recordId = parseRecordId(id);

    const existing = await execute('SELECT church_id FROM worship_records WHERE id = $1', [recordId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const decodedChurchId = parseOptionalChurchId(decoded.church_id);
    if (decoded.role === 'church' && decodedChurchId !== null && decodedChurchId !== existing.rows[0].church_id) {
      return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
    }

    const diezmos = toNumber(data.total_diezmos);
    const ofrendas = toNumber(data.total_ofrendas);
    const misiones = toNumber(data.total_misiones);
    const otros = toNumber(data.total_otros);
    const ofrendaAnonima = toNumber(data.ofrenda_general_anonima);

    const miembrosActivos = toIntOrZero(data.miembros_activos);
    const visitasInt = toIntOrZero(data.visitas);
    const ninosInt = toIntOrZero(data.ninos);
    const jovenesInt = toIntOrZero(data.jovenes);

    const totalRecaudado = diezmos + ofrendas + misiones + otros + ofrendaAnonima;
    const totalAsistencia = miembrosActivos + visitasInt + ninosInt + jovenesInt;

    const updateResult = await execute(
      `UPDATE worship_records SET
         fecha_culto = $1,
         tipo_culto = $2,
         predicador = $3,
         encargado_registro = $4,
         total_diezmos = $5,
         total_ofrendas = $6,
         total_misiones = $7,
         total_otros = $8,
         ofrenda_general_anonima = $9,
         total_recaudado = $10,
         miembros_activos = $11,
         visitas = $12,
         ninos = $13,
         jovenes = $14,
         total_asistencia = $15,
         bautismos_agua = $16,
         bautismos_espiritu = $17,
         observaciones = $18,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $19
       RETURNING id
      `,
      [
        data.fecha_culto,
        data.tipo_culto,
        data.predicador || null,
        data.encargado_registro || null,
        diezmos,
        ofrendas,
        misiones,
        otros,
        ofrendaAnonima,
        totalRecaudado,
        miembrosActivos,
        visitasInt,
        ninosInt,
        jovenesInt,
        totalAsistencia,
        toIntOrZero(data.bautismos_agua),
        toIntOrZero(data.bautismos_espiritu),
        data.observaciones || null,
        recordId
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (Array.isArray(data.contributions)) {
      await execute('DELETE FROM worship_contributions WHERE worship_record_id = $1', [recordId]);

      for (const contrib of data.contributions) {
        const diezmoContrib = toNumber(contrib.diezmo);
        const ofrendaContrib = toNumber(contrib.ofrenda);
        const misionesContrib = toNumber(contrib.misiones);
        const otrosContrib = toNumber(contrib.otros);
        const contributionTotal = diezmoContrib + ofrendaContrib + misionesContrib + otrosContrib;

        await execute(
          `INSERT INTO worship_contributions (
             worship_record_id, numero_fila, nombre_aportante, ci_ruc,
             numero_recibo, diezmo, ofrenda, misiones, otros,
             otros_concepto, total
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8, $9,
             $10, $11
           )`,
          [
            recordId,
            toOptionalInt(contrib.numero_fila),
            contrib.nombre_aportante || null,
            contrib.ci_ruc || null,
            contrib.numero_recibo || null,
            diezmoContrib,
            ofrendaContrib,
            misionesContrib,
            otrosContrib,
            contrib.otros_concepto || null,
            contributionTotal
          ]
        );
      }
    }

    return res.json({
      message: 'Registro de culto actualizado exitosamente'
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error actualizando registro de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function handleDelete(req, res, decoded) {
  try {
    const { id } = req.query;

    const recordId = parseRecordId(id);

    const existing = await execute('SELECT church_id FROM worship_records WHERE id = $1', [recordId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const decodedChurchId = parseOptionalChurchId(decoded.church_id);
    if (decoded.role === 'church' && decodedChurchId !== null && decodedChurchId !== existing.rows[0].church_id) {
      return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
    }

    await execute('DELETE FROM worship_contributions WHERE worship_record_id = $1', [recordId]);
    await execute('DELETE FROM worship_records WHERE id = $1', [recordId]);

    return res.json({ message: 'Registro de culto eliminado exitosamente' });
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error eliminando registro de culto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
