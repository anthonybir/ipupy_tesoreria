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

const parseOptionalYear = (value) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null) {
    throw new BadRequestError('Parámetro year inválido.');
  }
  return parsed;
};

const parseOptionalMonth = (value) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || parsed > 12) {
    throw new BadRequestError('Parámetro month debe estar entre 1 y 12.');
  }
  return parsed;
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

const parseRequiredYear = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    throw new BadRequestError('El año es requerido y debe ser numérico');
  }
  return parsed;
};

const parseRequiredMonth = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || parsed > 12) {
    throw new BadRequestError('El mes debe estar entre 1 y 12');
  }
  return parsed;
};

const parseReportId = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('ID de informe inválido');
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

// Create automatic transactions when a report is submitted
async function createReportTransactions(report, totals) {
  try {
    // Get or create required funds
    const churchFund = await getOrCreateFund('Fondo General', 'nacional', 'Fondo principal de la iglesia');
    const nationalFund = await getOrCreateFund('Fondo Nacional', 'nacional', 'Fondo nacional IPU Paraguay (10%)');

    // 1. Create income transaction for total church income
    if (totals.totalEntradas > 0) {
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Ingresos del mes ${report.month}/${report.year} - Diezmos y Ofrendas`,
        amount_in: totals.totalEntradas,
        amount_out: 0,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }

    // 2. Create transfer to national fund (10%)
    if (totals.fondoNacional > 0) {
      // Withdrawal from church fund
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Transferencia fondo nacional ${report.month}/${report.year} (10%)`,
        amount_in: 0,
        amount_out: totals.fondoNacional,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });

      // Deposit to national fund
      await createTransaction({
        church_id: report.church_id,
        fund_id: nationalFund.id,
        report_id: report.id,
        concept: `Ingreso fondo nacional desde ${report.church_name || 'iglesia'} ${report.month}/${report.year}`,
        amount_in: totals.fondoNacional,
        amount_out: 0,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }

    // 3. Create expense transactions
    if (totals.honorariosPastoral > 0) {
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Honorarios pastorales ${report.month}/${report.year}`,
        amount_in: 0,
        amount_out: totals.honorariosPastoral,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }

    if (totals.servicios > 0) {
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Servicios y gastos operativos ${report.month}/${report.year}`,
        amount_in: 0,
        amount_out: totals.servicios,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }

    console.log(`Created automatic transactions for report ${report.id}`);

  } catch (error) {
    console.error('Error creating automatic transactions:', error);
    // Don't throw error here - report was already saved successfully
  }
}

async function getOrCreateFund(name, type, description) {
  // Check if fund exists
  let result = await execute('SELECT * FROM funds WHERE name = $1', [name]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Create fund if it doesn't exist
  result = await execute(`
    INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [name, type, description, 0, true, 'system']);

  return result.rows[0];
}

async function createTransaction(data) {
  // Get current fund balance
  const fundResult = await execute(
    'SELECT current_balance FROM funds WHERE id = $1',
    [data.fund_id]
  );

  if (fundResult.rows.length === 0) {
    throw new Error('Fund not found');
  }

  const currentBalance = parseFloat(fundResult.rows[0].current_balance) || 0;
  const movement = data.amount_in > 0 ? data.amount_in : -data.amount_out;
  const newBalance = currentBalance + movement;

  // Check if withdrawal would result in negative balance
  if (newBalance < 0) {
    console.warn(`Warning: Transaction would result in negative balance for fund ${data.fund_id}`);
    // Don't block automatic transactions, but log the warning
  }

  // Start transaction
  await execute('BEGIN');

  try {
    // Insert transaction
    const transactionResult = await execute(`
      INSERT INTO transactions (
        date, church_id, report_id, fund_id, concept, provider, document_number,
        amount_in, amount_out, balance, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `, [
      data.date,
      data.church_id || null,
      data.report_id || null,
      data.fund_id,
      data.concept,
      data.provider || 'Informe automático',
      data.document_number || '',
      data.amount_in || 0,
      data.amount_out || 0,
      newBalance,
      'system'
    ]);

    const transaction = transactionResult.rows[0];

    // Update fund balance
    await execute(
      'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, data.fund_id]
    );

    // Record fund movement
    await execute(`
      INSERT INTO fund_movements_enhanced (
        fund_id, transaction_id, previous_balance, movement, new_balance
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      data.fund_id,
      transaction.id,
      currentBalance,
      movement,
      newBalance
    ]);

    await execute('COMMIT');
    return transaction;

  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
}

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {throw new Error('Token no proporcionado');}

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
    // Database is initialized via migrations, not here

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
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'JsonWebTokenError' || error.message.includes('Token')) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

async function handleGet(req, res) {
  const { year, month, church_id, page, limit } = req.query;

  const yearFilter = parseOptionalYear(year);
  const monthFilter = parseOptionalMonth(month);
  const churchFilter = parseOptionalChurchId(church_id);

  const filters = [];
  const params = [];

  if (yearFilter !== null) {
    params.push(yearFilter);
    filters.push(`r.year = $${params.length}`);
  }

  if (monthFilter !== null) {
    params.push(monthFilter);
    filters.push(`r.month = $${params.length}`);
  }

  if (churchFilter !== null) {
    params.push(churchFilter);
    filters.push(`r.church_id = $${params.length}`);
  }

  const whereClause = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';

  const baseQuery = `
    SELECT r.*, c.name AS church_name, c.city, c.pastor,
           c.pastor_grado AS grado, c.pastor_posicion AS posicion,
           c.pastor_cedula AS cedula, c.pastor_ruc AS ruc
    FROM reports r
    JOIN churches c ON r.church_id = c.id
  `;

  const queryParams = [...params];
  let recordsQuery = `${baseQuery}${whereClause} ORDER BY c.name, r.year DESC, r.month DESC`;

  const limitValue = parseInteger(limit);
  const pageValue = parseInteger(page);

  if (limitValue !== null && limitValue > 0) {
    const limitInt = Math.max(limitValue, 1);
    const pageInt = pageValue !== null && pageValue > 0 ? pageValue : 1;
    const offsetInt = (pageInt - 1) * limitInt;

    const limitPlaceholder = `$${queryParams.length + 1}`;
    const offsetPlaceholder = `$${queryParams.length + 2}`;
    recordsQuery += ` LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
    queryParams.push(limitInt, offsetInt);
  }

  const result = await execute(recordsQuery, queryParams);
  res.json(result.rows);
}

async function handlePost(req, res) {
  const data = req.body;

  const churchId = parseRequiredChurchId(data.church_id);
  const reportMonth = parseRequiredMonth(data.month);
  const reportYear = parseRequiredYear(data.year);

  try {
    // Verificar si ya existe un informe para este mes/año/iglesia
    const existingReport = await execute(
      'SELECT id FROM reports WHERE church_id = $1 AND month = $2 AND year = $3',
      [churchId, reportMonth, reportYear]
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un informe para este mes y año' });
    }

    // Calcular totales automáticamente
    const diezmos = toNumber(data.diezmos);
    const ofrendas = toNumber(data.ofrendas);
    const anexos = toNumber(data.anexos);
    const caballeros = toNumber(data.caballeros);
    const damas = toNumber(data.damas);
    const jovenes = toNumber(data.jovenes);
    const ninos = toNumber(data.ninos);
    const otros = toNumber(data.otros);

    const totalEntradas = diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
    const fondoNacional = totalEntradas * 0.1; // 10% automático

    const honorariosPastoral = toNumber(data.honorarios_pastoral);
    const servicios = toNumber(data.servicios);
    const totalSalidas = honorariosPastoral + fondoNacional + servicios;

    const saldoMes = totalEntradas - totalSalidas;

    // Crear el informe
    const result = await execute(`
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
      churchId, reportMonth, reportYear,
      diezmos, ofrendas, anexos, caballeros, damas, jovenes, ninos, otros,
      totalEntradas, fondoNacional, honorariosPastoral, servicios, totalSalidas, saldoMes,
      toNumber(data.ofrendas_directas_misiones),
      toNumber(data.lazos_amor),
      toNumber(data.mision_posible),
      toNumber(data.aporte_caballeros),
      toNumber(data.apy),
      toNumber(data.instituto_biblico),
      toNumber(data.diezmo_pastoral),
      data.numero_deposito || null,
      data.fecha_deposito || null,
      toNumber(data.monto_depositado, fondoNacional),
      toIntOrZero(data.asistencia_visitas),
      toIntOrZero(data.bautismos_agua),
      toIntOrZero(data.bautismos_espiritu),
      data.observaciones || '',
      data.estado || 'recibido'
    ]);

    const savedReport = result.rows[0];

    // Create automatic transactions for the report
    await createReportTransactions(savedReport, {
      totalEntradas,
      fondoNacional,
      honorariosPastoral,
      servicios,
      fecha_deposito: data.fecha_deposito,
      monto_depositado: toNumber(data.monto_depositado, fondoNacional)
    });

    res.status(201).json({
      id: result.rows[0].id,
      message: 'Informe guardado exitosamente',
      report: result.rows[0],
      totales: { totalEntradas, fondoNacional, totalSalidas, saldoMes }
    });

  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Ya existe un informe para este mes y año' });
    }
    console.error('Error guardando informe:', error);
    res.status(500).json({ error: 'No se pudo guardar el informe' });
  }
}

async function handlePut(req, res) {
  const { id } = req.query;
  const data = req.body;

  const reportId = parseReportId(id);

  // Recalcular totales
  const diezmos = toNumber(data.diezmos);
  const ofrendas = toNumber(data.ofrendas);
  const anexos = toNumber(data.anexos);
  const caballeros = toNumber(data.caballeros);
  const damas = toNumber(data.damas);
  const jovenes = toNumber(data.jovenes);
  const ninos = toNumber(data.ninos);
  const otros = toNumber(data.otros);

  const totalEntradas = diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
  const fondoNacional = totalEntradas * 0.1;

  const honorariosPastoral = toNumber(data.honorarios_pastoral);
  const servicios = toNumber(data.servicios);
  const totalSalidas = honorariosPastoral + fondoNacional + servicios;

  const saldoMes = totalEntradas - totalSalidas;

  const result = await execute(`
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
    data.numero_deposito || null,
    data.fecha_deposito || null,
    toNumber(data.monto_depositado, fondoNacional),
    toIntOrZero(data.asistencia_visitas),
    toIntOrZero(data.bautismos_agua),
    toIntOrZero(data.bautismos_espiritu),
    data.observaciones || '',
    data.estado || 'recibido',
    reportId
  ]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Informe no encontrado' });
  }

  res.json({
    message: 'Informe actualizado exitosamente',
    report: result.rows[0],
    totales: { totalEntradas, fondoNacional, totalSalidas, saldoMes }
  });
}

async function handleDelete(req, res) {
  const { id } = req.query;

  const reportId = parseReportId(id);

  const result = await execute('DELETE FROM reports WHERE id = $1 RETURNING *', [reportId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Informe no encontrado' });
  }

  res.json({ message: 'Informe eliminado exitosamente' });
}
