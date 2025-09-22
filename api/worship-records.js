const { execute, createConnection } = require('../lib/db');
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
      throw new ForbiddenError('No tienes permiso para registrar cultos para otra iglesia.');
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

const normalizeWorshipPayload = (body, decoded) => {
  const churchId = enforceChurchAccess(decoded, body.church_id);
  const fechaCulto = sanitizeString(body.fecha_culto || body.fechaCulto);
  const tipoCulto = sanitizeString(body.tipo_culto || body.tipoCulto);

  if (!fechaCulto) {
    throw new BadRequestError('La fecha del culto es requerida.');
  }
  if (!tipoCulto) {
    throw new BadRequestError('El tipo de culto es requerido.');
  }

  const anonymousOffering = parseNumber(body.ofrenda_general_anonima || body.ofrendaGeneralAnonima);
  const observaciones = sanitizeString(body.observaciones);
  const predicador = sanitizeString(body.predicador);
  const encargadoRegistro = sanitizeString(body.encargado_registro || body.encargadoRegistro);

  const attendance = {
    miembros_activos: parseInteger(body.miembros_activos || body.miembrosActivos) || 0,
    visitas: parseInteger(body.visitas) || 0,
    ninos: parseInteger(body.ninos || body.niños) || 0,
    jovenes: parseInteger(body.jovenes || body.jóvenes) || 0,
    total_asistencia: parseInteger(body.total_asistencia || body.totalAsistencia) || 0,
    bautismos_agua: parseInteger(body.bautismos_agua || body.bautismosAgua) || 0,
    bautismos_espiritu: parseInteger(body.bautismos_espiritu || body.bautismosEspiritu) || 0
  };

  const contributions = Array.isArray(body.contributions) ? body.contributions : [];
  if (!contributions.length) {
    throw new BadRequestError('Debe registrar al menos una contribución.');
  }

  const normalizedContributions = contributions.map((entry, index) => {
    const donorName = sanitizeString(entry.nombre_aportante || entry.nombreAportante);
    const donorId = entry.donor_id || entry.donorId;
    const ciRucRaw = sanitizeString(entry.ci_ruc || entry.ciRuc);
    const ciRuc = ciRucRaw ? ciRucRaw.toUpperCase() : null;
    const diezmo = parseNumber(entry.diezmo);
    const ofrenda = parseNumber(entry.ofrenda);
    const misiones = parseNumber(entry.misiones);
    const lazosAmor = parseNumber(entry.lazos_amor || entry.lazosAmor);
    const misionPosible = parseNumber(entry.mision_posible || entry.misionPosible);
    const apy = parseNumber(entry.apy);
    const institutoBiblico = parseNumber(entry.instituto_biblico || entry.institutoBiblico);
    const diezmoPastoral = parseNumber(entry.diezmo_pastoral || entry.diezmoPastoral);
    const caballeros = parseNumber(entry.caballeros);
    const damas = parseNumber(entry.damas);
    const jovenes = parseNumber(entry.jovenes);
    const ninos = parseNumber(entry.ninos);
    const anexos = parseNumber(entry.anexos);
    const otros = parseNumber(entry.otros);
    const total = parseNumber(entry.total);

    const hasAnyAmount = diezmo || ofrenda || misiones || lazosAmor || misionPosible ||
                        apy || institutoBiblico || diezmoPastoral || caballeros ||
                        damas || jovenes || ninos || anexos || otros;

    if (!donorName && !hasAnyAmount) {
      throw new BadRequestError(`La fila ${index + 1} no tiene datos válidos.`);
    }

    const receiptNumber = sanitizeString(entry.numero_recibo || entry.numeroRecibo || entry.receiptNumber);

    const calculatedTotal = diezmo + ofrenda + misiones + lazosAmor + misionPosible +
                          apy + institutoBiblico + diezmoPastoral + caballeros +
                          damas + jovenes + ninos + anexos + otros;

    return {
      donorId: donorId ? parseInteger(donorId) : null,
      donorName,
      ciRuc,
      receiptNumber,
      diezmo,
      ofrenda,
      misiones,
      lazos_amor: lazosAmor,
      mision_posible: misionPosible,
      apy,
      instituto_biblico: institutoBiblico,
      diezmo_pastoral: diezmoPastoral,
      caballeros,
      damas,
      jovenes,
      ninos,
      anexos,
      otros,
      total: total || calculatedTotal
    };
  });

  return {
    churchId,
    fechaCulto,
    tipoCulto,
    predicador,
    encargadoRegistro,
    anonymousOffering,
    observaciones,
    attendance,
    contributions: normalizedContributions
  };
};

const BUCKET_KEYS = [
  { key: 'diezmo', bucket: 'diezmo' },
  { key: 'ofrenda', bucket: 'ofrenda' },
  { key: 'misiones', bucket: 'misiones' },
  { key: 'lazos_amor', bucket: 'lazos_amor' },
  { key: 'mision_posible', bucket: 'mision_posible' },
  { key: 'apy', bucket: 'apy' },
  { key: 'instituto_biblico', bucket: 'instituto_biblico' },
  { key: 'diezmo_pastoral', bucket: 'diezmo_pastoral' },
  { key: 'caballeros', bucket: 'caballeros' },
  { key: 'damas', bucket: 'damas' },
  { key: 'jovenes', bucket: 'jovenes' },
  { key: 'ninos', bucket: 'ninos' },
  { key: 'anexos', bucket: 'anexos' },
  { key: 'otros', bucket: 'otros' }
];

const buildContributionRows = (entry, rowIndex) => {
  const rows = [];

  BUCKET_KEYS.forEach(({ key, bucket }) => {
    const amount = parseNumber(entry[key]);
    if (amount > 0) {
      rows.push({
        donorId: entry.donorId,
        donorName: entry.donorName,
        ciRuc: entry.ciRuc,
        receiptNumber: entry.receiptNumber,
        fundBucket: bucket,
        amount,
        sourceRow: rowIndex + 1
      });
    }
  });

  if (!rows.length && entry.total > 0) {
    rows.push({
      donorId: entry.donorId,
      donorName: entry.donorName,
      ciRuc: entry.ciRuc,
      receiptNumber: entry.receiptNumber,
      fundBucket: 'otros',
      amount: entry.total,
      sourceRow: rowIndex + 1
    });
  }

  return rows;
};

const summarizeContributionTotals = (rows) => {
  return rows.reduce((acc, row) => {
    const { fundBucket, amount } = row;
    if (!acc[fundBucket]) {
      acc[fundBucket] = 0;
    }
    acc[fundBucket] += amount;
    acc.total += amount;
    return acc;
  }, {
    diezmo: 0,
    ofrenda: 0,
    misiones: 0,
    lazos_amor: 0,
    mision_posible: 0,
    apy: 0,
    instituto_biblico: 0,
    diezmo_pastoral: 0,
    caballeros: 0,
    damas: 0,
    jovenes: 0,
    ninos: 0,
    anexos: 0,
    otros: 0,
    total: 0
  });
};

const resolveDonorId = async (client, churchId, row) => {
  if (row.donorId) {
    const result = await client.query(
      'SELECT id FROM donors WHERE id = $1 AND church_id = $2',
      [row.donorId, churchId]
    );
    if (result.rows.length === 0) {
      throw new ForbiddenError('El donante seleccionado no pertenece a esta iglesia.');
    }
    return row.donorId;
  }

  if (!row.donorName || !row.ciRuc) {
    throw new BadRequestError('Nombre y CI/RUC son requeridos para nuevos donantes.');
  }

  const result = await client.query(
    'SELECT find_or_create_donor($1, $2, $3) AS donor_id',
    [churchId, row.donorName, row.ciRuc]
  );

  return result.rows[0].donor_id;
};

const saveWorshipRecord = async (payload, _decoded) => {
  const contributionRows = payload.contributions.flatMap((entry, index) =>
    buildContributionRows(entry, index).map(row => ({
      ...row,
      original: payload.contributions[index]
    }))
  );

  if (!contributionRows.length && payload.anonymousOffering <= 0) {
    throw new BadRequestError('Debe registrar montos para al menos un donante o ofrenda anónima.');
  }

  const totals = summarizeContributionTotals(contributionRows);
  const totalRecaudado = totals.total + payload.anonymousOffering;

  const pool = createConnection();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertRecordResult = await client.query(`
      INSERT INTO worship_records (
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
      ) RETURNING *
    `, [
      payload.churchId,
      payload.fechaCulto,
      payload.tipoCulto,
      payload.predicador,
      payload.encargadoRegistro,
      totals.diezmo,
      totals.ofrenda,
      // Group all 100% national funds as "misiones"
      totals.misiones + totals.lazos_amor + totals.mision_posible + totals.apy +
        totals.instituto_biblico + totals.diezmo_pastoral + totals.caballeros,
      // Group all local funds as "otros"
      totals.damas + totals.jovenes + totals.ninos + totals.anexos + totals.otros,
      payload.anonymousOffering,
      totalRecaudado,
      payload.attendance.miembros_activos,
      payload.attendance.visitas,
      payload.attendance.ninos,
      payload.attendance.jovenes,
      payload.attendance.total_asistencia,
      payload.attendance.bautismos_agua,
      payload.attendance.bautismos_espiritu,
      payload.observaciones
    ]);

    const record = insertRecordResult.rows[0];
    const insertedContributions = [];

    for (const row of contributionRows) {
      const donorId = await resolveDonorId(client, payload.churchId, row);
      const amounts = {
        diezmo: row.fundBucket === 'diezmo' ? row.amount : 0,
        ofrenda: row.fundBucket === 'ofrenda' ? row.amount : 0,
        misiones: row.fundBucket === 'misiones' ? row.amount : 0,
        otros: row.fundBucket === 'otros' ? row.amount : 0
      };

      const result = await client.query(`
        INSERT INTO worship_contributions (
          worship_record_id,
          numero_fila,
          nombre_aportante,
          ci_ruc,
          numero_recibo,
          diezmo,
          ofrenda,
          misiones,
          otros,
          total,
          fund_bucket,
          donor_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        ) RETURNING *
      `, [
        record.id,
        row.sourceRow,
        row.donorName,
        row.ciRuc,
        row.receiptNumber,
        amounts.diezmo,
        amounts.ofrenda,
        amounts.misiones,
        amounts.otros,
        row.amount,
        row.fundBucket,
        donorId
      ]);

      insertedContributions.push(result.rows[0]);
    }

    await client.query('COMMIT');

    return {
      record,
      totals,
      anonymousOffering: payload.anonymousOffering,
      contributions: insertedContributions
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const listWorshipRecords = async (query, decoded) => {
  const churchId = enforceChurchAccess(decoded, query.church_id);
  const month = parseInteger(query.month);
  const year = parseInteger(query.year);

  if (month === null || month < 1 || month > 12) {
    throw new BadRequestError('month debe estar entre 1 y 12');
  }
  if (year === null || year < 2020 || year > 2030) {
    throw new BadRequestError('year debe ser un año válido');
  }

  const recordsResult = await execute(`
    SELECT *
    FROM worship_records
    WHERE church_id = $1
      AND EXTRACT(MONTH FROM fecha_culto) = $2
      AND EXTRACT(YEAR FROM fecha_culto) = $3
    ORDER BY fecha_culto DESC
  `, [churchId, month, year]);

  const records = recordsResult.rows;
  if (!records.length) {
    return [];
  }

  const recordIds = records.map(r => r.id);

  const contributionsResult = await execute(`
    SELECT *
    FROM worship_contributions
    WHERE worship_record_id = ANY($1::bigint[])
    ORDER BY worship_record_id, numero_fila, id
  `, [recordIds]);

  const contributionsByRecord = new Map();
  contributionsResult.rows.forEach(row => {
    if (!contributionsByRecord.has(row.worship_record_id)) {
      contributionsByRecord.set(row.worship_record_id, []);
    }
    contributionsByRecord.get(row.worship_record_id).push(row);
  });

  return records.map(record => ({
    ...record,
    contributions: contributionsByRecord.get(record.id) || []
  }));
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
      const records = await listWorshipRecords(req.query, decoded);
      return res.json({ records });
    }

    if (req.method === 'POST') {
      const payload = normalizeWorshipPayload(req.body, decoded);
      const result = await saveWorshipRecord(payload, decoded);
      return res.status(201).json(result);
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error in worship-records API:', error);

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
