import path from 'path';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';

import { executeWithContext } from '@/lib/db';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireAuth, AuthContext } from '@/lib/auth-context';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import { createReportTransactions } from './route-helpers';

type GenericRecord = Record<string, unknown>;

// Keep BadRequestError for backward compatibility, but map to ValidationError
class BadRequestError extends ValidationError {
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

const DESIGNATED_FORM_KEYS = [
  'misiones',
  'lazos_amor',
  'mision_posible',
  'apy',
  'iba',
  'caballeros',
  'damas',
  'jovenes',
  'ninos'
] as const;

type DesignatedKey = typeof DESIGNATED_FORM_KEYS[number];

const DESIGNATED_FIELD_MAP: Record<DesignatedKey, string> = {
  misiones: 'ofrendas_directas_misiones',
  lazos_amor: 'lazos_amor',
  mision_posible: 'mision_posible',
  apy: 'apy',
  iba: 'instituto_biblico',
  caballeros: 'aporte_caballeros',
  damas: 'damas',
  jovenes: 'jovenes',
  ninos: 'ninos'
};

const EXPENSE_KEYS = [
  'energia_electrica',
  'agua',
  'recoleccion_basura',
  'servicios',
  'mantenimiento',
  'materiales',
  'otros_gastos'
] as const;

type ExpenseKey = typeof EXPENSE_KEYS[number];

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
  actor: string | undefined,
  auth?: AuthContext | null
) => {
  if (!reportId || previousStatus === newStatus) {
    return;
  }

  try {
    await executeWithContext(
      auth || null,
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
  notificationType = 'submission',
  auth?: AuthContext | null
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
    await executeWithContext(
      auth || null,
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

const setAuditContext = async (actorEmail: string | undefined, auth?: AuthContext | null) => {
  if (!actorEmail) {
    return;
  }

  try {
    await executeWithContext(auth || null, 'SELECT set_config($1, $2, true)', ['audit.user', actorEmail]);
  } catch {
    // Safe to ignore if audit schema is not yet installed
  }
};




const handleGetReports = async (request: NextRequest, auth: AuthContext) => {
  const searchParams = request.nextUrl.searchParams;
  const yearFilter = parseOptionalYear(searchParams.get('year'));
  const monthFilter = parseOptionalMonth(searchParams.get('month'));
  const churchFilter = parseOptionalChurchId(searchParams.get('church_id'));

  const filters: string[] = [];
  const params: unknown[] = [];

  // Church-level roles can only see their own church's reports
  const isChurchRole = auth.role === 'pastor' || auth.role === 'treasurer' || auth.role === 'church' || auth.role === 'secretary' || auth.role === 'member';

  if (isChurchRole) {
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

  const result = await executeWithContext(auth, recordsQuery, queryParams);
  return result.rows;
};

const extractReportPayload = (data: GenericRecord) => {
  const baseDiezmos = toNumber(data.diezmos);
  const baseOfrendas = toNumber(data.ofrendas);
  const otros = toNumber(data.otros);
  const anexos = toNumber(data.anexos);

  const designated: Record<DesignatedKey, number> = {} as Record<DesignatedKey, number>;
  let totalDesignados = 0;
  DESIGNATED_FORM_KEYS.forEach((key) => {
    const dbColumn = DESIGNATED_FIELD_MAP[key];
    const value = toNumber((data as GenericRecord)[key] ?? (data as GenericRecord)[dbColumn]);
    designated[key] = value;
    totalDesignados += value;
  });

  const expenses: Record<ExpenseKey, number> = {} as Record<ExpenseKey, number>;
  let gastosOperativos = 0;
  EXPENSE_KEYS.forEach((key) => {
    const value = toNumber((data as GenericRecord)[key]);
    expenses[key] = value;
    gastosOperativos += value;
  });

  const congregationalBase = baseDiezmos + baseOfrendas;
  const totalIngresos = congregationalBase + anexos + otros + totalDesignados;
  const diezmoNacional = Math.round(congregationalBase * 0.1);
  const honorariosPastoral = Math.max(0, totalIngresos - (totalDesignados + gastosOperativos + diezmoNacional));
  const totalSalidas = totalDesignados + gastosOperativos + diezmoNacional + honorariosPastoral;
  const saldoMes = totalIngresos - totalSalidas;

  return {
    totals: {
      totalEntradas: totalIngresos,
      fondoNacional: diezmoNacional,
      honorariosPastoral,
      gastosOperativos,
      totalSalidas,
      saldoMes,
      totalDesignados,
      congregationalBase,
      fechaDeposito: typeof data.fecha_deposito === 'string' ? data.fecha_deposito : null
    },
    breakdown: {
      diezmos: baseDiezmos,
      ofrendas: baseOfrendas,
      anexos,
      otros,
      ...designated
    },
    expenses
  };
};

const handleCreateReport = async (data: GenericRecord, auth: AuthContext) => {
  // Check if user has admin privileges
  const isAdminRole = auth.role === 'admin' || auth.role === 'super_admin' || auth.role === 'district_supervisor';

  // Church-level roles that can create reports: pastor, treasurer, and legacy 'church' role
  const isChurchRole = auth.role === 'pastor' || auth.role === 'treasurer' || auth.role === 'church';

  // Determine which church this report is for
  const scopedChurchId = isChurchRole
    ? parseRequiredChurchId(auth.churchId)
    : parseRequiredChurchId(data.church_id);

  // Church-level users can only submit for their own church
  if (isChurchRole && data.church_id && parseRequiredChurchId(data.church_id) !== scopedChurchId) {
    throw new BadRequestError('No puede registrar informes para otra iglesia');
  }

  // Only admin or church-level roles can create reports
  if (!isAdminRole && !isChurchRole) {
    throw new BadRequestError('No tiene permisos para crear informes');
  }

  const reportMonth = parseRequiredMonth(data.month);
  const reportYear = parseRequiredYear(data.year);

  await setAuditContext(auth.email);

  const existingReport = await executeWithContext(
    auth,
    'SELECT id, estado FROM reports WHERE church_id = $1 AND month = $2 AND year = $3',
    [scopedChurchId, reportMonth, reportYear]
  );

  if (existingReport.rows.length > 0) {
    throw new BadRequestError('Ya existe un informe para este mes y año');
  }

  const { totals, breakdown, expenses } = extractReportPayload(data);

  const designatedDbValues = DESIGNATED_FORM_KEYS.reduce<Record<string, number>>((acc, key) => {
    const column = DESIGNATED_FIELD_MAP[key];
    acc[column] = breakdown[key] ?? 0;
    return acc;
  }, {});

  const designatedForTransactions = DESIGNATED_FORM_KEYS.reduce<Record<DesignatedKey, number>>((acc, key) => {
    acc[key] = breakdown[key] ?? 0;
    return acc;
  }, {} as Record<DesignatedKey, number>);

  const expenseValues = EXPENSE_KEYS.reduce<Record<string, number>>((acc, key) => {
    acc[key] = expenses[key] ?? 0;
    return acc;
  }, {});

  const donorRowsInput = Array.isArray(data.aportantes) ? (data.aportantes as GenericRecord[]) : [];
  const donorRows = donorRowsInput
    .map((donor) => ({
      first_name: String(donor.first_name ?? '').trim(),
      last_name: String(donor.last_name ?? '').trim(),
      document: String(donor.document ?? '').trim(),
      amount: toNumber(donor.amount)
    }))
    .filter((donor) => donor.amount > 0 && (donor.first_name || donor.last_name || donor.document));

  if (breakdown.diezmos > 0) {
    const donorsTotal = donorRows.reduce((sum, donor) => sum + donor.amount, 0);
    if (donorRows.length === 0) {
      throw new BadRequestError('Registra al menos un aportante para los diezmos declarados.');
    }
    if (Math.abs(donorsTotal - breakdown.diezmos) > 1) {
      throw new BadRequestError('La suma de los aportantes no coincide con el total de diezmos.');
    }
  }

  const montoDepositado = data.monto_depositado !== undefined
    ? toNumber(data.monto_depositado)
    : totals.fondoNacional + totals.totalDesignados;

  const attachmentPrefix = `report-${scopedChurchId}-${reportYear}-${reportMonth}`;
  const attachments = data.attachments as { summary?: string; deposit?: string } | undefined;
  const fotoInforme = await saveBase64Attachment(attachments?.summary, `${attachmentPrefix}-resumen`);
  const fotoDeposito = await saveBase64Attachment(attachments?.deposit, `${attachmentPrefix}-deposito`);

  const isChurchSubmission = auth.role === 'church' || auth.role === 'pastor' || auth.role === 'treasurer';
  const isAdminSubmission = isAdminRole;

  // Determine submission source based on role and data
  let submissionSource = 'church_online';
  if (isAdminSubmission && data.submission_source) {
    submissionSource = String(data.submission_source); // Allow admin to specify source
  } else if (isAdminSubmission && data.manual_report_source) {
    submissionSource = 'pastor_manual'; // Admin entering on behalf of pastor
  } else if (isAdminSubmission) {
    submissionSource = 'admin_manual'; // Admin manual entry
  } else if (isChurchSubmission) {
    submissionSource = 'church_online'; // Church online submission
  }

  const submissionType = data.submission_type || (isChurchSubmission ? 'online' : 'manual');
  const submittedBy = auth.email || data.submitted_by || null;
  const submittedAt = new Date();

  // For admin manual entries on behalf of pastors, default to pendiente_admin
  const initialEstado = data.estado ?? (
    isChurchSubmission ? 'pendiente_admin' :
    (submissionSource === 'pastor_manual' ? 'pendiente_admin' : 'importado_excel')
  );

  // Track who entered manual reports
  const enteredBy = (isAdminSubmission && submissionSource !== 'admin_import') ? auth.email : null;
  const enteredAt = enteredBy ? new Date() : null;

  const result = await executeWithContext(
    auth,
    `
      INSERT INTO reports (
        church_id, month, year,
        diezmos, ofrendas, anexos, caballeros, damas,
        jovenes, ninos, otros,
        total_entradas, fondo_nacional, honorarios_pastoral,
        servicios, energia_electrica, agua, recoleccion_basura, mantenimiento, materiales, otros_gastos,
        total_salidas, saldo_mes,
        ofrendas_directas_misiones, lazos_amor, mision_posible, aporte_caballeros, apy, instituto_biblico,
        numero_deposito, fecha_deposito, monto_depositado,
        asistencia_visitas, bautismos_agua, bautismos_espiritu, observaciones, estado,
        foto_informe, foto_deposito, submission_type, submitted_by, submitted_at,
        submission_source, manual_report_source, manual_report_notes, entered_by, entered_at
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21,
        $22, $23,
        $24, $25, $26, $27, $28, $29,
        $30, $31, $32,
        $33, $34, $35, $36, $37,
        $38, $39, $40, $41, $42,
        $43, $44, $45, $46, $47
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
      totals.honorariosPastoral,
      expenseValues.servicios,
      expenseValues.energia_electrica,
      expenseValues.agua,
      expenseValues.recoleccion_basura,
      expenseValues.mantenimiento,
      expenseValues.materiales,
      expenseValues.otros_gastos,
      totals.totalSalidas,
      totals.saldoMes,
      designatedDbValues.ofrendas_directas_misiones ?? 0,
      designatedDbValues.lazos_amor ?? 0,
      designatedDbValues.mision_posible ?? 0,
      designatedDbValues.aporte_caballeros ?? 0,
      designatedDbValues.apy ?? 0,
      designatedDbValues.instituto_biblico ?? 0,
      data.numero_deposito || null,
      data.fecha_deposito || null,
      montoDepositado,
      toIntOrZero(data.asistencia_visitas),
      toIntOrZero(data.bautismos_agua),
      toIntOrZero(data.bautismos_espiritu),
      data.observaciones || '',
      initialEstado,
      fotoInforme,
      fotoDeposito,
      submissionType,
      submittedBy,
      submittedAt,
      submissionSource,
      data.manual_report_source || null,
      data.manual_report_notes || null,
      enteredBy,
      enteredAt
    ]
  );

  const report = result.rows[0];

  await recordReportStatus(Number(report.id), null, String(report.estado), auth.email || "", auth);

  const shouldAutoGenerateTransactions = !isChurchSubmission && String(report.estado) === 'procesado';

  if (shouldAutoGenerateTransactions) {
    await createReportTransactions(report, {
      totalEntradas: totals.totalEntradas,
      fondoNacional: totals.fondoNacional,
      honorariosPastoral: totals.honorariosPastoral,
      gastosOperativos: totals.gastosOperativos,
      fechaDeposito: totals.fechaDeposito || (typeof data.fecha_deposito === 'string' ? data.fecha_deposito : null)
    }, designatedForTransactions, auth);

    await executeWithContext(
      auth,
      `
        UPDATE reports
        SET transactions_created = TRUE,
            transactions_created_at = NOW(),
            transactions_created_by = $1
        WHERE id = $2
      `,
      [auth.email || 'system', report.id]
    );

    await queueReportNotification(report, auth.email, 'processed', auth);
  } else {
    await queueReportNotification(report, auth.email, 'submission', auth);
  }

  await replaceReportDonors(Number(report.id), scopedChurchId, donorRows, auth);

  return report;
};

const replaceReportDonors = async (
  reportId: number,
  churchId: number,
  donors: Array<{ first_name: string; last_name: string; document: string; amount: number }>,
  auth?: AuthContext | null
) => {
  await executeWithContext(auth || null, 'DELETE FROM report_tithers WHERE report_id = $1', [reportId]);

  if (!donors.length) {
    return;
  }

  for (const donor of donors) {
    await executeWithContext(
      auth || null,
      `
        INSERT INTO report_tithers (report_id, church_id, first_name, last_name, document, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        reportId,
        churchId,
        donor.first_name,
        donor.last_name,
        donor.document || null,
        donor.amount
      ]
    );
  }
};

const resetAutomaticTransactions = async (reportId: number, auth?: AuthContext | null) => {
  await executeWithContext(
    auth || null,
    `DELETE FROM fund_movements_enhanced
      WHERE transaction_id IN (
        SELECT id FROM transactions WHERE report_id = $1 AND created_by = 'system'
      )`,
    [reportId]
  );

  await executeWithContext(
    auth || null,
    'DELETE FROM transactions WHERE report_id = $1 AND created_by = $2',
    [reportId, 'system']
  );
};

const handleUpdateReport = async (
  reportId: number,
  data: GenericRecord,
  auth: AuthContext
) => {
  await setAuditContext(auth.email, auth);

  const existingResult = await executeWithContext(
    auth,
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

  // Check if user has permission to modify this report
  const isChurchRole = auth.role === 'pastor' || auth.role === 'treasurer' || auth.role === 'church';
  const isAdminRole = auth.role === 'admin' || auth.role === 'super_admin' || auth.role === 'district_supervisor';

  if (isChurchRole && parseRequiredChurchId(auth.churchId) !== existing.church_id) {
    throw new BadRequestError('No tiene permisos para modificar este informe');
  }

  if (!isAdminRole && !isChurchRole) {
    throw new BadRequestError('No tiene permisos para modificar este informe');
  }

  const { totals, breakdown, expenses } = extractReportPayload({ ...existing, ...data });

  const designatedDbValues = DESIGNATED_FORM_KEYS.reduce<Record<string, number>>((acc, key) => {
    const column = DESIGNATED_FIELD_MAP[key];
    acc[column] = breakdown[key] ?? 0;
    return acc;
  }, {});

  const designatedForTransactions = DESIGNATED_FORM_KEYS.reduce<Record<DesignatedKey, number>>((acc, key) => {
    acc[key] = breakdown[key] ?? 0;
    return acc;
  }, {} as Record<DesignatedKey, number>);

  const expenseValues = EXPENSE_KEYS.reduce<Record<string, number>>((acc, key) => {
    acc[key] = expenses[key] ?? 0;
    return acc;
  }, {});

  const donorRowsInput = Array.isArray(data.aportantes) ? (data.aportantes as GenericRecord[]) : null;
  const donorPayloadProvided = donorRowsInput !== null;
  const donorRows = donorPayloadProvided
    ? donorRowsInput!
        .map((donor) => ({
          first_name: String(donor.first_name ?? '').trim(),
          last_name: String(donor.last_name ?? '').trim(),
          document: String(donor.document ?? '').trim(),
          amount: toNumber(donor.amount)
        }))
        .filter((donor) => donor.amount > 0 && (donor.first_name || donor.last_name || donor.document))
    : [];

  if (donorPayloadProvided && breakdown.diezmos > 0) {
    const donorsTotal = donorRows.reduce((sum, donor) => sum + donor.amount, 0);
    if (donorRows.length === 0) {
      throw new BadRequestError('Registra al menos un aportante para los diezmos declarados.');
    }
    if (Math.abs(donorsTotal - breakdown.diezmos) > 1) {
      throw new BadRequestError('La suma de los aportantes no coincide con el total de diezmos.');
    }
  }

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

  const montoDepositado = data.monto_depositado !== undefined
    ? toNumber(data.monto_depositado)
    : toNumber(existing.monto_depositado ?? totals.fondoNacional + totals.totalDesignados);

  const isChurchUpdate = auth.role === 'church' || auth.role === 'pastor' || auth.role === 'treasurer';
  const submissionType = data.submission_type || existing.submission_type || (isChurchUpdate ? 'online' : 'manual');

  let estado = data.estado || existing.estado || (isChurchUpdate ? 'pendiente_admin' : 'importado_excel');
  const previousStatus = existing.estado;

  if (isChurchUpdate) {
    estado = 'pendiente_admin';
  }

  let processedBy = existing.processed_by;
  let processedAt = existing.processed_at ? new Date(String(existing.processed_at)) : null;

  if (estado === 'procesado') {
    processedBy = auth.email || processedBy || null;
    processedAt = new Date();
  } else if (previousStatus === 'procesado' && estado !== 'procesado') {
    processedBy = null;
    processedAt = null;
  }

  const updatedResult = await executeWithContext(
    auth,
    `
      UPDATE reports SET
        diezmos = $1,
        ofrendas = $2,
        anexos = $3,
        caballeros = $4,
        damas = $5,
        jovenes = $6,
        ninos = $7,
        otros = $8,
        total_entradas = $9,
        fondo_nacional = $10,
        honorarios_pastoral = $11,
        servicios = $12,
        energia_electrica = $13,
        agua = $14,
        recoleccion_basura = $15,
        mantenimiento = $16,
        materiales = $17,
        otros_gastos = $18,
        total_salidas = $19,
        saldo_mes = $20,
        ofrendas_directas_misiones = $21,
        lazos_amor = $22,
        mision_posible = $23,
        aporte_caballeros = $24,
        apy = $25,
        instituto_biblico = $26,
        numero_deposito = $27,
        fecha_deposito = $28,
        monto_depositado = $29,
        asistencia_visitas = $30,
        bautismos_agua = $31,
        bautismos_espiritu = $32,
        observaciones = $33,
        estado = $34,
        foto_informe = $35,
        foto_deposito = $36,
        submission_type = $37,
        processed_by = $38,
        processed_at = $39,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $40
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
      totals.honorariosPastoral,
      expenseValues.servicios,
      expenseValues.energia_electrica,
      expenseValues.agua,
      expenseValues.recoleccion_basura,
      expenseValues.mantenimiento,
      expenseValues.materiales,
      expenseValues.otros_gastos,
      totals.totalSalidas,
      totals.saldoMes,
      designatedDbValues.ofrendas_directas_misiones ?? existing.ofrendas_directas_misiones ?? 0,
      designatedDbValues.lazos_amor ?? existing.lazos_amor ?? 0,
      designatedDbValues.mision_posible ?? existing.mision_posible ?? 0,
      designatedDbValues.aporte_caballeros ?? existing.aporte_caballeros ?? 0,
      designatedDbValues.apy ?? existing.apy ?? 0,
      designatedDbValues.instituto_biblico ?? existing.instituto_biblico ?? 0,
      data.numero_deposito !== undefined ? data.numero_deposito || null : existing.numero_deposito || null,
      data.fecha_deposito !== undefined ? data.fecha_deposito || null : existing.fecha_deposito || null,
      montoDepositado,
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

  if (donorPayloadProvided) {
    await replaceReportDonors(reportId, existing.church_id, donorRows, auth);
  }

  const existingTransactionsCreated = Boolean(existing.transactions_created);
  const shouldGenerateTransactions = existingTransactionsCreated || estado === 'procesado';

  await resetAutomaticTransactions(reportId, auth);

  if (shouldGenerateTransactions) {
    await createReportTransactions(
      { ...existing, ...updatedReport },
      {
        totalEntradas: totals.totalEntradas,
        fondoNacional: totals.fondoNacional,
        honorariosPastoral: totals.honorariosPastoral,
        gastosOperativos: totals.gastosOperativos,
        fechaDeposito: totals.fechaDeposito || (typeof data.fecha_deposito === 'string' ? data.fecha_deposito : existing.fecha_deposito || null)
      },
      designatedForTransactions,
      auth
    );

    await executeWithContext(
      auth,
      `
        UPDATE reports
        SET transactions_created = TRUE,
            transactions_created_at = NOW(),
            transactions_created_by = $1
        WHERE id = $2
      `,
      [auth.email || existing.transactions_created_by || 'system', reportId]
    );
  } else {
    await executeWithContext(
      auth,
      `
        UPDATE reports
        SET transactions_created = FALSE,
            transactions_created_at = NULL,
            transactions_created_by = NULL
        WHERE id = $1
      `,
      [reportId]
    );
  }

  await recordReportStatus(reportId, String(previousStatus), String(updatedReport.estado), auth.email || "", auth);
  if (previousStatus !== updatedReport.estado && updatedReport.estado === 'procesado') {
    await queueReportNotification(updatedReport, auth.email, 'processed', auth);
  }

  return updatedReport;
};

const handleDeleteReport = async (reportId: number, auth: AuthContext) => {
  await setAuditContext(auth.email, auth);

  const existingResult = await executeWithContext(auth, 'SELECT church_id, estado FROM reports WHERE id = $1', [reportId]);
  if (existingResult.rows.length === 0) {
    throw new BadRequestError('Informe no encontrado');
  }

  const existing = existingResult.rows[0];
  // Check if user has permission to delete this report
  const isChurchRole = auth.role === 'pastor' || auth.role === 'treasurer' || auth.role === 'church';
  const isAdminRole = auth.role === 'admin' || auth.role === 'super_admin' || auth.role === 'district_supervisor';

  if (isChurchRole && parseRequiredChurchId(auth.churchId) !== existing.church_id) {
    throw new BadRequestError('No tiene permisos para eliminar este informe');
  }

  if (!isAdminRole && !isChurchRole) {
    throw new BadRequestError('No tiene permisos para eliminar este informe');
  }

  await resetAutomaticTransactions(reportId, auth);

  const result = await executeWithContext(auth, 'DELETE FROM reports WHERE id = $1 RETURNING id', [reportId]);

  if (result.rows.length === 0) {
    throw new BadRequestError('Informe no encontrado');
  }

  await recordReportStatus(reportId, String(existing.estado), 'eliminado', auth.email || "", auth);

  return { message: 'Informe eliminado exitosamente' };
};

export async function OPTIONS(request: NextRequest) {
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }
  return jsonResponse({ error: 'Method not allowed' }, request.headers.get('origin'), 405);
}

// Removed local handleError - now using centralized handleApiError from @/lib/api-errors

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

    const searchParams = request.nextUrl.searchParams;
    const lastReportParam = searchParams.get('last_report');

    if (lastReportParam === 'true') {
      const churchIdParam = searchParams.get('church_id');
      if (!churchIdParam) {
        return jsonResponse({ error: 'church_id is required for last_report query' }, origin, 400);
      }

      const churchId = parseOptionalChurchId(churchIdParam);
      if (churchId === null) {
        return jsonResponse({ error: 'Invalid church_id' }, origin, 400);
      }

      const lastReportResult = await executeWithContext(
        auth,
        `SELECT year, month FROM reports WHERE church_id = $1 ORDER BY year DESC, month DESC LIMIT 1`,
        [churchId]
      );

      if (lastReportResult.rows.length === 0) {
        return jsonResponse({ lastReport: null }, origin);
      }

      return jsonResponse({ lastReport: lastReportResult.rows[0] }, origin);
    }

    const rows = await handleGetReports(request, auth);
    return jsonResponse(rows, origin);
  } catch (error) {
    return handleApiError(error, origin, 'GET /api/reports');
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
    return handleApiError(error, origin, 'POST /api/reports');
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
    return handleApiError(error, origin, 'PUT /api/reports');
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
    return handleApiError(error, origin, 'DELETE /api/reports');
  }
}
