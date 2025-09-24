const path = require('path');
const fs = require('fs/promises');
const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');
const { setSecureCORSHeaders } = require('../src/lib/cors-handler');

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

const uploadsDir = path.join(process.cwd(), 'uploads');

async function ensureUploadsDir() {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('Failed to create uploads directory:', error);
      throw error;
    }
  }
}

async function saveBase64Attachment(raw, prefix) {
  if (!raw) {
    return null;
  }

  try {
    await ensureUploadsDir();

    const match = String(raw).match(/^data:(.+);base64,(.*)$/);
    const mimeType = match ? match[1] : 'image/png';
    const base64Data = match ? match[2] : raw;
    const extension = mimeType.split('/').pop() || 'png';
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const filePath = path.join(uploadsDir, filename);

    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

    return path.join('uploads', filename);
  } catch (error) {
    console.error('Failed to store attachment:', error);
    return null;
  }
}

async function recordReportStatus(reportId, previousStatus, newStatus, actor) {
  if (!reportId || previousStatus === newStatus) {
    return;
  }

  try {
    await execute(`
      INSERT INTO report_status_history (report_id, previous_status, new_status, changed_by)
      VALUES ($1, $2, $3, $4)
    `, [reportId, previousStatus || null, newStatus, actor || null]);
  } catch (error) {
    console.error('Failed to record report status transition:', error);
  }
}

async function queueReportNotification(reportRow, actorEmail, notificationType = 'submission') {
  const recipient = process.env.TREASURY_NOTIFICATION_EMAIL;
  if (!recipient || !reportRow) {
    return;
  }

  const actionLabel = notificationType === 'processed' ? 'Informe procesado' : 'Nuevo informe';
  const subject = `${actionLabel} ${reportRow.month}/${reportRow.year} - Iglesia ${reportRow.church_id}`;
  const body = `${actionLabel.toUpperCase()}\n` +
    `Iglesia: ${reportRow.church_id}\n` +
    `Monto total: ${reportRow.total_entradas || 0}\n` +
    `Acción registrada por: ${actorEmail || 'usuario'}`;

  try {
    await execute(`
      INSERT INTO report_notifications (report_id, notification_type, recipient_email, subject, body)
      VALUES ($1, $2, $3, $4, $5)
    `, [reportRow.id, notificationType, recipient, subject, body]);
  } catch (error) {
    console.error('Failed to queue a report notification:', error);
  }
}

async function setAuditContext(actorEmail) {
  if (!actorEmail) {
    return;
  }

  try {
    await execute('SELECT set_config($1, $2, true)', ['audit.user', actorEmail]);
  } catch {
    // Safe to ignore if audit schema is not yet installed
  }
}

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
  // Configure secure CORS (no wildcards)
  const isPreflightHandled = setSecureCORSHeaders(req, res, ['PUT', 'DELETE']);

  if (isPreflightHandled) {
    return; // Preflight request handled securely
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

async function handleGet(req, res, decoded) {
  const { year, month, church_id, page, limit } = req.query;

  const yearFilter = parseOptionalYear(year);
  const monthFilter = parseOptionalMonth(month);
  const churchFilter = parseOptionalChurchId(church_id);

  const filters = [];
  const params = [];

  if (decoded?.role === 'church') {
    const scopedChurchId = parseRequiredChurchId(decoded.churchId);
    params.push(scopedChurchId);
    filters.push(`r.church_id = $${params.length}`);
  } else if (churchFilter !== null) {
    params.push(churchFilter);
    filters.push(`r.church_id = $${params.length}`);
  }

  if (yearFilter !== null) {
    params.push(yearFilter);
    filters.push(`r.year = $${params.length}`);
  }

  if (monthFilter !== null) {
    params.push(monthFilter);
    filters.push(`r.month = $${params.length}`);
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

async function handlePost(req, res, decoded) {
  const data = req.body || {};

  const scopedChurchId = decoded?.role === 'church'
    ? parseRequiredChurchId(decoded.churchId)
    : parseRequiredChurchId(data.church_id);

  if (decoded?.role === 'church' && data.church_id && parseRequiredChurchId(data.church_id) !== scopedChurchId) {
    return res.status(403).json({ error: 'No puede registrar informes para otra iglesia' });
  }

  const reportMonth = parseRequiredMonth(data.month);
  const reportYear = parseRequiredYear(data.year);

  try {
    await setAuditContext(decoded?.email);

    const existingReport = await execute(
      'SELECT id, estado FROM reports WHERE church_id = $1 AND month = $2 AND year = $3',
      [scopedChurchId, reportMonth, reportYear]
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un informe para este mes y año' });
    }

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

    const attachmentPrefix = `report-${scopedChurchId}-${reportYear}-${reportMonth}`;
    const fotoInforme = await saveBase64Attachment(data.attachments?.summary, `${attachmentPrefix}-resumen`);
    const fotoDeposito = await saveBase64Attachment(data.attachments?.deposit, `${attachmentPrefix}-deposito`);

    const submissionType = data.submission_type || (decoded?.role === 'church' ? 'online' : 'manual');
    const submittedBy = decoded?.email || data.submitted_by || null;
    const submittedAt = new Date();
    const estado = data.estado || 'pendiente';

    const result = await execute(`
      INSERT INTO reports (
        church_id, month, year, diezmos, ofrendas, anexos, caballeros, damas,
        jovenes, ninos, otros, total_entradas, fondo_nacional, honorarios_pastoral,
        servicios, total_salidas, saldo_mes, ofrendas_directas_misiones, lazos_amor,
        mision_posible, aporte_caballeros, apy, instituto_biblico, diezmo_pastoral,
        numero_deposito, fecha_deposito, monto_depositado, asistencia_visitas,
        bautismos_agua, bautismos_espiritu, observaciones, estado,
        foto_informe, foto_deposito, submission_type, submitted_by, submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        $33, $34, $35, $36, $37
      ) RETURNING *
    `, [
      scopedChurchId, reportMonth, reportYear,
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
      estado,
      fotoInforme,
      fotoDeposito,
      submissionType,
      submittedBy,
      submittedAt
    ]);

    const savedReport = result.rows[0];

    await recordReportStatus(savedReport.id, null, savedReport.estado, submittedBy);
    await queueReportNotification(savedReport, submittedBy);

    await createReportTransactions(savedReport, {
      totalEntradas,
      fondoNacional,
      honorariosPastoral,
      servicios,
      fecha_deposito: data.fecha_deposito,
      monto_depositado: toNumber(data.monto_depositado, fondoNacional)
    });

    res.status(201).json({
      id: savedReport.id,
      message: 'Informe guardado exitosamente',
      report: savedReport,
      totales: { totalEntradas, fondoNacional, totalSalidas, saldoMes }
    });

  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un informe para este mes y año' });
    }
    console.error('Error guardando informe:', error);
    res.status(500).json({ error: 'No se pudo guardar el informe' });
  }
}

async function handlePut(req, res, decoded) {
  const { id } = req.query;
  const data = req.body || {};
  const reportId = parseReportId(id);

  try {
    await setAuditContext(decoded?.email);

    const existingResult = await execute('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    const existing = existingResult.rows[0];

    if (decoded?.role === 'church' && parseRequiredChurchId(decoded.churchId) !== existing.church_id) {
      return res.status(403).json({ error: 'No tiene permisos para modificar este informe' });
    }

    const attachmentPrefix = `report-${existing.church_id}-${existing.year}-${existing.month}`;
    const attachments = data.attachments || {};

    const diezmos = data.diezmos !== undefined ? toNumber(data.diezmos) : parseFloat(existing.diezmos || 0);
    const ofrendas = data.ofrendas !== undefined ? toNumber(data.ofrendas) : parseFloat(existing.ofrendas || 0);
    const anexos = data.anexos !== undefined ? toNumber(data.anexos) : parseFloat(existing.anexos || 0);
    const caballeros = data.caballeros !== undefined ? toNumber(data.caballeros) : parseFloat(existing.caballeros || 0);
    const damas = data.damas !== undefined ? toNumber(data.damas) : parseFloat(existing.damas || 0);
    const jovenes = data.jovenes !== undefined ? toNumber(data.jovenes) : parseFloat(existing.jovenes || 0);
    const ninos = data.ninos !== undefined ? toNumber(data.ninos) : parseFloat(existing.ninos || 0);
    const otros = data.otros !== undefined ? toNumber(data.otros) : parseFloat(existing.otros || 0);

    const totalEntradas = diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
    const fondoNacional = totalEntradas * 0.1;

    const honorariosPastoral = data.honorarios_pastoral !== undefined
      ? toNumber(data.honorarios_pastoral)
      : parseFloat(existing.honorarios_pastoral || 0);
    const servicios = data.servicios !== undefined
      ? toNumber(data.servicios)
      : parseFloat(existing.servicios || 0);

    const totalSalidas = honorariosPastoral + fondoNacional + servicios;
    const saldoMes = totalEntradas - totalSalidas;

    let fotoInformePath = existing.foto_informe;
    if (Object.prototype.hasOwnProperty.call(attachments, 'summary')) {
      fotoInformePath = attachments.summary === null
        ? null
        : await saveBase64Attachment(attachments.summary, `${attachmentPrefix}-resumen`);
    }

    let fotoDepositoPath = existing.foto_deposito;
    if (Object.prototype.hasOwnProperty.call(attachments, 'deposit')) {
      fotoDepositoPath = attachments.deposit === null
        ? null
        : await saveBase64Attachment(attachments.deposit, `${attachmentPrefix}-deposito`);
    }

    const submissionType = data.submission_type || existing.submission_type || (decoded?.role === 'church' ? 'online' : 'manual');
    const estado = data.estado || existing.estado || 'pendiente';
    const previousStatus = existing.estado;

    let processedBy = existing.processed_by;
    let processedAt = existing.processed_at ? new Date(existing.processed_at) : null;

    if (estado === 'procesado' && previousStatus !== 'procesado') {
      processedBy = decoded?.email || processedBy || null;
      processedAt = new Date();
    }

    const updatedResult = await execute(`
      UPDATE reports SET
        diezmos = $1, ofrendas = $2, anexos = $3, caballeros = $4, damas = $5,
        jovenes = $6, ninos = $7, otros = $8, total_entradas = $9, fondo_nacional = $10,
        honorarios_pastoral = $11, servicios = $12, total_salidas = $13, saldo_mes = $14,
        numero_deposito = $15, fecha_deposito = $16, monto_depositado = $17,
        asistencia_visitas = $18, bautismos_agua = $19, bautismos_espiritu = $20,
        observaciones = $21, estado = $22,
        foto_informe = $23, foto_deposito = $24,
        submission_type = $25, processed_by = $26, processed_at = $27,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $28
      RETURNING *
    `, [
      diezmos, ofrendas, anexos, caballeros, damas, jovenes, ninos, otros,
      totalEntradas, fondoNacional, honorariosPastoral, servicios, totalSalidas, saldoMes,
      data.numero_deposito !== undefined ? data.numero_deposito || null : existing.numero_deposito || null,
      data.fecha_deposito !== undefined ? data.fecha_deposito || null : existing.fecha_deposito || null,
      data.monto_depositado !== undefined ? toNumber(data.monto_depositado, fondoNacional) : parseFloat(existing.monto_depositado || fondoNacional),
      data.asistencia_visitas !== undefined ? toIntOrZero(data.asistencia_visitas) : existing.asistencia_visitas || 0,
      data.bautismos_agua !== undefined ? toIntOrZero(data.bautismos_agua) : existing.bautismos_agua || 0,
      data.bautismos_espiritu !== undefined ? toIntOrZero(data.bautismos_espiritu) : existing.bautismos_espiritu || 0,
      data.observaciones !== undefined ? data.observaciones : existing.observaciones || '',
      estado,
      fotoInformePath,
      fotoDepositoPath,
      submissionType,
      processedBy,
      processedAt,
      reportId
    ]);

    const updatedReport = updatedResult.rows[0];

    await recordReportStatus(reportId, previousStatus, updatedReport.estado, decoded?.email);
    if (previousStatus !== updatedReport.estado && updatedReport.estado === 'procesado') {
      await queueReportNotification(updatedReport, decoded?.email, 'processed');
    }

    res.json({ success: true, report: updatedReport });
  } catch (error) {
    console.error('Error actualizando informe:', error);
    res.status(500).json({ error: 'No se pudo actualizar el informe' });
  }
}

async function handleDelete(req, res, decoded) {
  const { id } = req.query;

  const reportId = parseReportId(id);

  try {
    await setAuditContext(decoded?.email);

    const existingResult = await execute('SELECT church_id, estado FROM reports WHERE id = $1', [reportId]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    const existing = existingResult.rows[0];
    if (decoded?.role === 'church' && parseRequiredChurchId(decoded.churchId) !== existing.church_id) {
      return res.status(403).json({ error: 'No tiene permisos para eliminar este informe' });
    }

    const result = await execute('DELETE FROM reports WHERE id = $1 RETURNING id', [reportId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    await recordReportStatus(reportId, existing.estado, 'eliminado', decoded?.email);

    res.json({ message: 'Informe eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando informe:', error);
    res.status(500).json({ error: 'No se pudo eliminar el informe' });
  }
}
