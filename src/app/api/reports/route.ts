import path from 'path';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';

import { execute } from '@/lib/db';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireAuth, AuthContext } from '@/lib/auth-context';

type GenericRecord = Record<string, unknown>;

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

const uploadsDir = path.join(process.cwd(), 'uploads');

const jsonResponse = (data: unknown, origin: string | null, status = 200) =>
  NextResponse.json(data, { status, headers: buildCorsHeaders(origin) });

const parseInteger = (value: string | null) => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const isProvided = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const parseOptionalYear = (value: string | null) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null) {
    throw new BadRequestError('Parámetro year inválido.');
  }
  return parsed;
};

const parseOptionalMonth = (value: string | null) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || parsed > 12) {
    throw new BadRequestError('Parámetro month debe estar entre 1 y 12.');
  }
  return parsed;
};

const parseOptionalChurchId = (value: string | null) => {
  if (!isProvided(value)) {
    return null;
  }
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('Parámetro church_id inválido.');
  }
  return parsed;
};

const parseRequiredChurchId = (value: unknown) => {
  const normalized = typeof value === 'string' ? value : value != null ? String(value) : null;
  const parsed = parseOptionalChurchId(normalized);
  if (parsed === null) {
    throw new BadRequestError('church_id es requerido');
  }
  return parsed;
};

const parseRequiredYear = (value: unknown) => {
  const normalized = typeof value === 'string' ? value : value != null ? String(value) : null;
  const parsed = parseInteger(normalized);
  if (parsed === null) {
    throw new BadRequestError('El año es requerido y debe ser numérico');
  }
  return parsed;
};

const parseRequiredMonth = (value: unknown) => {
  const normalized = typeof value === 'string' ? value : value != null ? String(value) : null;
  const parsed = parseInteger(normalized);
  if (parsed === null || parsed < 1 || parsed > 12) {
    throw new BadRequestError('El mes debe estar entre 1 y 12');
  }
  return parsed;
};

const parseReportId = (value: string | null) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('ID de informe inválido');
  }
  return parsed;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIntOrZero = (value: unknown): number => {
  const parsed = parseInteger(typeof value === 'string' ? value : value != null ? String(value) : null);
  return parsed === null ? 0 : parsed;
};

const ensureUploadsDir = async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Failed to create uploads directory:', error);
      throw error;
    }
  }
};

const saveBase64Attachment = async (raw: unknown, prefix: string) => {
  if (!raw) {
    return null;
  }

  try {
    await ensureUploadsDir();

    const rawString = String(raw);
    const match = rawString.match(/^data:(.+);base64,(.*)$/);
    const mimeType = match ? match[1] : 'image/png';
    const base64Data = match ? match[2] : rawString;
    const extension = mimeType.split('/').pop() || 'png';
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const filePath = path.join(uploadsDir, filename);

    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

    return path.join('uploads', filename);
  } catch (error) {
    console.error('Failed to store attachment:', error);
    return null;
  }
};

const recordReportStatus = async (
  reportId: number | null,
  previousStatus: string | null,
  newStatus: string | null,
  actor: string | undefined
) => {
  if (!reportId || previousStatus === newStatus) {
    return;
  }

  try {
    await execute(
      `
        INSERT INTO report_status_history (report_id, previous_status, new_status, changed_by)
        VALUES ($1, $2, $3, $4)
      `,
      [reportId, previousStatus || null, newStatus, actor || null]
    );
  } catch (error) {
    console.error('Failed to record report status transition:', error);
  }
};

const queueReportNotification = async (
  reportRow: GenericRecord | undefined,
  actorEmail: string | undefined,
  notificationType = 'submission'
) => {
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
    await execute(
      `
        INSERT INTO report_notifications (report_id, notification_type, recipient_email, subject, body)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [reportRow.id, notificationType, recipient, subject, body]
    );
  } catch (error) {
    console.error('Failed to queue a report notification:', error);
  }
};

const setAuditContext = async (actorEmail: string | undefined) => {
  if (!actorEmail) {
    return;
  }

  try {
    await execute('SELECT set_config($1, $2, true)', ['audit.user', actorEmail]);
  } catch {
    // Safe to ignore if audit schema is not yet installed
  }
};

const getOrCreateFund = async (name: string, type: string, description: string) => {
  let result = await execute('SELECT * FROM funds WHERE name = $1', [name]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  result = await execute(
    `
      INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [name, type, description, 0, true, 'system']
  );

  return result.rows[0];
};

const createTransaction = async (data: GenericRecord) => {
  const fundResult = await execute<{ current_balance: string }>(
    'SELECT current_balance FROM funds WHERE id = $1',
    [data.fund_id]
  );

  if (fundResult.rows.length === 0) {
    throw new Error('Fund not found');
  }

  const currentBalance = parseFloat(fundResult.rows[0].current_balance) || 0;
  const amountIn = Number(data.amount_in) || 0;
  const amountOut = Number(data.amount_out) || 0;
  const movement = amountIn > 0 ? amountIn : -amountOut;
  const newBalance = currentBalance + movement;

  if (newBalance < 0) {
    console.warn(`Warning: Transaction would result in negative balance for fund ${data.fund_id}`);
  }

  await execute('BEGIN');

  try {
    const transactionResult = await execute(
      `
        INSERT INTO transactions (
          date, church_id, report_id, fund_id, concept, provider, document_number,
          amount_in, amount_out, balance, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) RETURNING *
      `,
      [
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
      ]
    );

    const transaction = transactionResult.rows[0];

    await execute(
      'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, data.fund_id]
    );

    await execute(
      `
        INSERT INTO fund_movements_enhanced (
          fund_id, transaction_id, previous_balance, movement, new_balance
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [
        data.fund_id,
        transaction.id,
        currentBalance,
        movement,
        newBalance
      ]
    );

    await execute('COMMIT');
    return transaction;
  } catch (error) {
    await execute('ROLLBACK');
    throw error;
  }
};

const createReportTransactions = async (report: GenericRecord, totals: GenericRecord) => {
  try {
    const churchFund = await getOrCreateFund('Fondo General', 'nacional', 'Fondo principal de la iglesia');
    const nationalFund = await getOrCreateFund('Fondo Nacional', 'nacional', 'Fondo nacional IPU Paraguay (10%)');

    const totalEntradas = Number(totals.totalEntradas) || 0;
    const fondoNacional = Number(totals.fondoNacional) || 0;
    const honorariosPastoral = Number(totals.honorariosPastoral) || 0;
    const servicios = Number(totals.servicios) || 0;

    if (totalEntradas > 0) {
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Ingresos del mes ${report.month}/${report.year} - Diezmos y Ofrendas`,
        amount_in: totalEntradas,
        amount_out: 0,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }

    if (fondoNacional > 0) {
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Transferencia fondo nacional ${report.month}/${report.year} (10%)`,
        amount_in: 0,
        amount_out: fondoNacional,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });

      await createTransaction({
        church_id: report.church_id,
        fund_id: nationalFund.id,
        report_id: report.id,
        concept: `Ingreso fondo nacional desde ${report.church_name || 'iglesia'} ${report.month}/${report.year}`,
        amount_in: fondoNacional,
        amount_out: 0,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }

    if (honorariosPastoral > 0) {
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Honorarios pastorales ${report.month}/${report.year}`,
        amount_in: 0,
        amount_out: honorariosPastoral,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }

    if (servicios > 0) {
      await createTransaction({
        church_id: report.church_id,
        fund_id: churchFund.id,
        report_id: report.id,
        concept: `Servicios y gastos operativos ${report.month}/${report.year}`,
        amount_in: 0,
        amount_out: servicios,
        date: totals.fecha_deposito || new Date().toISOString().split('T')[0]
      });
    }
  } catch (error) {
    console.error('Error creating automatic transactions:', error);
  }
};

const handleGetReports = async (request: NextRequest, auth: AuthContext) => {
  const searchParams = request.nextUrl.searchParams;
  const yearFilter = parseOptionalYear(searchParams.get('year'));
  const monthFilter = parseOptionalMonth(searchParams.get('month'));
  const churchFilter = parseOptionalChurchId(searchParams.get('church_id'));

  const filters: string[] = [];
  const params: unknown[] = [];

  if (auth.role === 'church') {
    const scopedChurchId = parseRequiredChurchId(auth.churchId);
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

  const limitValue = parseInteger(searchParams.get('limit'));
  const pageValue = parseInteger(searchParams.get('page'));

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
  return result.rows;
};

const extractReportPayload = (data: GenericRecord) => {
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

  return {
    totals: {
      totalEntradas,
      fondoNacional,
      honorariosPastoral,
      servicios,
      totalSalidas,
      saldoMes,
      fecha_deposito: data.fecha_deposito
    },
    breakdown: {
      diezmos,
      ofrendas,
      anexos,
      caballeros,
      damas,
      jovenes,
      ninos,
      otros
    }
  };
};

const handleCreateReport = async (data: GenericRecord, auth: AuthContext) => {
  const scopedChurchId = auth.role === 'church'
    ? parseRequiredChurchId(auth.churchId)
    : parseRequiredChurchId(data.church_id);

  if (auth.role === 'church' && data.church_id && parseRequiredChurchId(data.church_id) !== scopedChurchId) {
    throw new BadRequestError('No puede registrar informes para otra iglesia');
  }

  const reportMonth = parseRequiredMonth(data.month);
  const reportYear = parseRequiredYear(data.year);

  await setAuditContext(auth.email);

  const existingReport = await execute(
    'SELECT id, estado FROM reports WHERE church_id = $1 AND month = $2 AND year = $3',
    [scopedChurchId, reportMonth, reportYear]
  );

  if (existingReport.rows.length > 0) {
    throw new BadRequestError('Ya existe un informe para este mes y año');
  }

  const { totals, breakdown } = extractReportPayload(data);

  const attachmentPrefix = `report-${scopedChurchId}-${reportYear}-${reportMonth}`;
  const attachments = data.attachments as { summary?: string; deposit?: string } | undefined;
  const fotoInforme = await saveBase64Attachment(attachments?.summary, `${attachmentPrefix}-resumen`);
  const fotoDeposito = await saveBase64Attachment(attachments?.deposit, `${attachmentPrefix}-deposito`);

  const submissionType = data.submission_type || (auth.role === 'church' ? 'online' : 'manual');
  const submittedBy = auth.email || data.submitted_by || null;
  const submittedAt = new Date();
  const estado = data.estado || 'pendiente';

  const result = await execute(
    `
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
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
        $32, $33, $34, $35, $36
      )
      RETURNING *
    `,
    [
      scopedChurchId,
      reportMonth,
      reportYear,
      breakdown.diezmos,
      breakdown.ofrendas,
      breakdown.anexos,
      breakdown.caballeros,
      breakdown.damas,
      breakdown.jovenes,
      breakdown.ninos,
      breakdown.otros,
      totals.totalEntradas,
      totals.fondoNacional,
      toNumber(data.honorarios_pastoral),
      toNumber(data.servicios),
      totals.totalSalidas,
      totals.saldoMes,
      toNumber(data.ofrendas_directas_misiones),
      toNumber(data.lazos_amor),
      toNumber(data.mision_posible),
      toNumber(data.aporte_caballeros),
      toNumber(data.apy),
      toNumber(data.instituto_biblico),
      toNumber(data.diezmo_pastoral),
      data.numero_deposito || null,
      data.fecha_deposito || null,
      data.monto_depositado !== undefined ? toNumber(data.monto_depositado, totals.fondoNacional) : totals.fondoNacional,
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
    ]
  );

  const report = result.rows[0];
  await recordReportStatus(Number(report.id), null, String(report.estado), auth.email || "");
  await queueReportNotification(report, auth.email);

  await createReportTransactions(report, {
    totalEntradas: totals.totalEntradas,
    fondoNacional: totals.fondoNacional,
    honorariosPastoral: totals.honorariosPastoral,
    servicios: totals.servicios,
    fecha_deposito: data.fecha_deposito
  });

  return report;
};

const handleUpdateReport = async (
  reportId: number,
  data: GenericRecord,
  auth: AuthContext
) => {
  await setAuditContext(auth.email);

  const existingResult = await execute(
    `
      SELECT r.*, c.name as church_name
      FROM reports r
      JOIN churches c ON r.church_id = c.id
      WHERE r.id = $1
    `,
    [reportId]
  );

  if (existingResult.rows.length === 0) {
    throw new BadRequestError('Informe no encontrado');
  }

  const existing = existingResult.rows[0];

  if (auth.role === 'church' && parseRequiredChurchId(auth.churchId) !== existing.church_id) {
    throw new BadRequestError('No tiene permisos para modificar este informe');
  }

  const { totals, breakdown } = extractReportPayload({ ...existing, ...data });
  const attachments = (data.attachments || {}) as { summary?: string | null; deposit?: string | null };
  const attachmentPrefix = `report-${existing.church_id}-${existing.year}-${existing.month}`;

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

  const submissionType = data.submission_type || existing.submission_type || (auth.role === 'church' ? 'online' : 'manual');
  const estado = data.estado || existing.estado || 'pendiente';
  const previousStatus = existing.estado;

  let processedBy = existing.processed_by;
  let processedAt = existing.processed_at ? new Date(String(existing.processed_at)) : null;

  if (estado === 'procesado' && previousStatus !== 'procesado') {
    processedBy = auth.email || processedBy || null;
    processedAt = new Date();
  }

  const updatedResult = await execute(
    `
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
    `,
    [
      breakdown.diezmos,
      breakdown.ofrendas,
      breakdown.anexos,
      breakdown.caballeros,
      breakdown.damas,
      breakdown.jovenes,
      breakdown.ninos,
      breakdown.otros,
      totals.totalEntradas,
      totals.fondoNacional,
      toNumber(data.honorarios_pastoral, parseFloat(String(existing.honorarios_pastoral || 0))),
      toNumber(data.servicios, parseFloat(String(existing.servicios || 0))),
      totals.totalSalidas,
      totals.saldoMes,
      data.numero_deposito !== undefined ? data.numero_deposito || null : existing.numero_deposito || null,
      data.fecha_deposito !== undefined ? data.fecha_deposito || null : existing.fecha_deposito || null,
      data.monto_depositado !== undefined
        ? toNumber(data.monto_depositado, totals.fondoNacional)
        : parseFloat(String(existing.monto_depositado || totals.fondoNacional)),
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
    ]
  );

  const updatedReport = updatedResult.rows[0];

  await recordReportStatus(reportId, String(previousStatus), String(updatedReport.estado), auth.email || "");
  if (previousStatus !== updatedReport.estado && updatedReport.estado === 'procesado') {
    await queueReportNotification(updatedReport, auth.email, 'processed');
  }

  return updatedReport;
};

const handleDeleteReport = async (reportId: number, auth: AuthContext) => {
  await setAuditContext(auth.email);

  const existingResult = await execute('SELECT church_id, estado FROM reports WHERE id = $1', [reportId]);
  if (existingResult.rows.length === 0) {
    throw new BadRequestError('Informe no encontrado');
  }

  const existing = existingResult.rows[0];
  if (auth.role === 'church' && parseRequiredChurchId(auth.churchId) !== existing.church_id) {
    throw new BadRequestError('No tiene permisos para eliminar este informe');
  }

  const result = await execute('DELETE FROM reports WHERE id = $1 RETURNING id', [reportId]);

  if (result.rows.length === 0) {
    throw new BadRequestError('Informe no encontrado');
  }

  await recordReportStatus(reportId, String(existing.estado), 'eliminado', auth.email || "");

  return { message: 'Informe eliminado exitosamente' };
};

export async function OPTIONS(request: NextRequest) {
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }
  return jsonResponse({ error: 'Method not allowed' }, request.headers.get('origin'), 405);
}

const handleError = (error: unknown, origin: string | null) => {
  if (error instanceof BadRequestError) {
    return jsonResponse({ error: error.message }, origin, 400);
  }
  if (error instanceof Error && error.message.includes('Autenticación requerida')) {
    return jsonResponse({ error: 'Token inválido o expirado' }, origin, 401);
  }
  console.error('Error en API reports:', error);
  const message = error instanceof Error ? error.message : 'Error interno del servidor';
  return jsonResponse(
    {
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    },
    origin,
    500
  );
};

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    // Make GET endpoint authentication-optional
    // Return empty array for unauthenticated users
    // This allows the reports page to load without login
    const { getAuthContext } = await import('@/lib/auth-context');
    const auth = await getAuthContext(request);

    if (!auth) {
      // Return empty array for unauthenticated users
      return jsonResponse([], origin);
    }

    const rows = await handleGetReports(request, auth);
    return jsonResponse(rows, origin);
  } catch (error) {
    return handleError(error, origin);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);

    // Validate request body exists and parse JSON safely
    let body: GenericRecord;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        throw new BadRequestError('Request body is empty');
      }
      body = JSON.parse(text) as GenericRecord;
    } catch (jsonError) {
      if (jsonError instanceof BadRequestError) {
        throw jsonError;
      }
      console.error('JSON parsing error:', jsonError);
      throw new BadRequestError('Invalid JSON in request body');
    }

    const report = await handleCreateReport(body, auth);
    return jsonResponse({ success: true, report }, origin, 201);
  } catch (error) {
    return handleError(error, origin);
  }
}

export async function PUT(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);
    const reportId = parseReportId(request.nextUrl.searchParams.get('id'));

    // Validate request body exists and parse JSON safely
    let body: GenericRecord;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        throw new BadRequestError('Request body is empty');
      }
      body = JSON.parse(text) as GenericRecord;
    } catch (jsonError) {
      if (jsonError instanceof BadRequestError) {
        throw jsonError;
      }
      console.error('JSON parsing error:', jsonError);
      throw new BadRequestError('Invalid JSON in request body');
    }

    const report = await handleUpdateReport(reportId, body, auth);
    return jsonResponse({ success: true, report }, origin);
  } catch (error) {
    return handleError(error, origin);
  }
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);
    const reportId = parseReportId(request.nextUrl.searchParams.get('id'));
    const result = await handleDeleteReport(reportId, auth);
    return jsonResponse(result, origin);
  } catch (error) {
    return handleError(error, origin);
  }
}
