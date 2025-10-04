import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/lib/auth-context';
import { executeWithContext, executeTransaction } from '@/lib/db';
import { expectOne } from '@/lib/db-helpers';
import { setCORSHeaders } from '@/lib/cors';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const maxDuration = 60;

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const parseInteger = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNumber = (value: unknown): number => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDecodedChurchId = (auth: AuthContext | null): number | null => {
  if (!auth) {
    return null;
  }
  const raw = auth.churchId;
  const parsed = parseInteger(raw);
  return parsed === null ? null : parsed;
};

const enforceChurchAccess = (auth: AuthContext | null, churchId: unknown): number => {
  const parsed = parseInteger(churchId);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('church_id es requerido y debe ser válido');
  }

  if (auth?.role === 'church') {
    const decodedChurchId = getDecodedChurchId(auth);
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

const sanitizeString = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
};

interface Attendance {
  miembros_activos: number;
  visitas: number;
  ninos: number;
  jovenes: number;
  total_asistencia: number;
  bautismos_agua: number;
  bautismos_espiritu: number;
}

interface Contribution {
  donorId: number | null;
  donorName: string | null;
  ciRuc: string | null;
  receiptNumber: string | null;
  diezmo: number;
  ofrenda: number;
  misiones: number;
  lazos_amor: number;
  mision_posible: number;
  apy: number;
  instituto_biblico: number;
  diezmo_pastoral: number;
  caballeros: number;
  damas: number;
  jovenes: number;
  ninos: number;
  anexos: number;
  otros: number;
  total: number;
}

interface WorshipPayload {
  churchId: number;
  fechaCulto: string;
  tipoCulto: string;
  predicador: string | null;
  encargadoRegistro: string | null;
  anonymousOffering: number;
  observaciones: string | null;
  attendance: Attendance;
  contributions: Contribution[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeWorshipPayload = (body: any, auth: AuthContext): WorshipPayload => {
  const churchId = enforceChurchAccess(auth, body.church_id);
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

  const attendance: Attendance = {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedContributions: Contribution[] = contributions.map((entry: any, index: number) => {
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

interface ContributionRow {
  donorId: number | null;
  donorName: string | null;
  ciRuc: string | null;
  receiptNumber: string | null;
  fundBucket: string;
  amount: number;
  sourceRow: number;
}

const buildContributionRows = (entry: Contribution, rowIndex: number): ContributionRow[] => {
  const rows: ContributionRow[] = [];

  BUCKET_KEYS.forEach(({ key, bucket }) => {
    const amount = parseNumber(entry[key as keyof Contribution] as number);
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

const summarizeContributionTotals = (rows: ContributionRow[]) => {
  return rows.reduce((acc, row) => {
    const { fundBucket, amount } = row;
    if (!acc[fundBucket]) {
      acc[fundBucket] = 0;
    }
    acc[fundBucket] += amount;
    acc['total'] = (acc['total'] ?? 0) + amount;
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
  } as Record<string, number>);
};

const resolveDonorId = async (client: PoolClient, churchId: number, row: ContributionRow): Promise<number> => {
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

  return expectOne(result.rows)['donor_id'];
};

const saveWorshipRecord = async (
  payload: WorshipPayload,
  auth: AuthContext
): Promise<{
  record: Record<string, unknown>;
  totals: Record<string, number>;
  anonymousOffering: number;
  contributions: unknown[]
}> => {
  const contributionRows = payload.contributions.flatMap((entry, index) =>
    buildContributionRows(entry, index).map((row) => ({
      ...row,
      original: payload.contributions[index]
    }))
  );

  if (!contributionRows.length && payload.anonymousOffering <= 0) {
    throw new BadRequestError('Debe registrar montos para al menos un donante o ofrenda anónima.');
  }

  const totals = summarizeContributionTotals(contributionRows);
  const totalRecaudado = (totals['total'] ?? 0) + payload.anonymousOffering;

  const contextSubset = { userId: auth.userId, role: auth.role, churchId: auth.churchId };
  return executeTransaction(contextSubset, async (client) => {
    const insertRecordResult = await client.query(
      `
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
      `,
      [
        payload.churchId,
        payload.fechaCulto,
        payload.tipoCulto,
        payload.predicador,
        payload.encargadoRegistro,
        totals['diezmo'] ?? 0,
        totals['ofrenda'] ?? 0,
        // Group all 100% national funds as "misiones"
        (totals['misiones'] ?? 0) +
          (totals['lazos_amor'] ?? 0) +
          (totals['mision_posible'] ?? 0) +
          (totals['apy'] ?? 0) +
          (totals['instituto_biblico'] ?? 0) +
          (totals['diezmo_pastoral'] ?? 0) +
          (totals['caballeros'] ?? 0),
        // Group all local funds as "otros"
        (totals['damas'] ?? 0) + (totals['jovenes'] ?? 0) + (totals['ninos'] ?? 0) + (totals['anexos'] ?? 0) + (totals['otros'] ?? 0),
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
      ]
    );

    const record = expectOne(insertRecordResult.rows);
    const insertedContributions = [] as unknown[];

    for (const row of contributionRows) {
      const donorId = await resolveDonorId(client, payload.churchId, row);
      const amounts = {
        diezmo: row.fundBucket === 'diezmo' ? row.amount : 0,
        ofrenda: row.fundBucket === 'ofrenda' ? row.amount : 0,
        misiones: row.fundBucket === 'misiones' ? row.amount : 0,
        otros: row.fundBucket === 'otros' ? row.amount : 0
      };

      const result = await client.query(
        `
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
        `,
        [
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
        ]
      );

      insertedContributions.push(expectOne(result.rows));
    }

    return {
      record,
      totals,
      anonymousOffering: payload.anonymousOffering,
      contributions: insertedContributions
    };
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listWorshipRecords = async (query: any, auth: AuthContext): Promise<any[]> => {
  const churchId = enforceChurchAccess(auth, query.church_id);
  const month = parseInteger(query.month);
  const year = parseInteger(query.year);

  if (month === null || month < 1 || month > 12) {
    throw new BadRequestError('month debe estar entre 1 y 12');
  }
  if (year === null || year < 2020 || year > 2030) {
    throw new BadRequestError('year debe ser un año válido');
  }

  const recordsResult = await executeWithContext(auth, `
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordIds = records.map((r: any) => r.id);

  const contributionsResult = await executeWithContext(auth, `
    SELECT *
    FROM worship_contributions
    WHERE worship_record_id = ANY($1::bigint[])
    ORDER BY worship_record_id, numero_fila, id
  `, [recordIds]);

  const contributionsByRecord = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contributionsResult.rows.forEach((row: any) => {
    if (!contributionsByRecord.has(row.worship_record_id)) {
      contributionsByRecord.set(row.worship_record_id, []);
    }
    contributionsByRecord.get(row.worship_record_id).push(row);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return records.map((record: any) => ({
    ...record,
    contributions: contributionsByRecord.get(record.id) || []
  }));
};

const jsonResponse = (origin: string | null, body: Record<string, unknown>, status = 200) => {
  const response = NextResponse.json(body, { status });
  setCORSHeaders(response, origin);
  return response;
};

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response, req.headers.get('origin'));
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  try {
    const auth = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const records = await listWorshipRecords(query, auth);
    return jsonResponse(origin, { records });

  } catch (error) {
    console.error('Error in worship-records API:', error);
    if ((error as Error).message === 'Autenticación requerida') {
      return jsonResponse(origin, { error: 'Token de autenticación requerido' }, 401);
    }

    if (error instanceof BadRequestError) {
      return jsonResponse(origin, { error: error.message }, 400);
    }

    if (error instanceof ForbiddenError) {
      return jsonResponse(origin, { error: error.message }, 403);
    }

    return jsonResponse(origin, {
      error: 'Error interno del servidor',
      details: process.env['NODE_ENV'] === 'development' ? (error as Error).message : undefined
    }, 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  try {
    const auth = await requireAuth(req);

    const body = await req.json();
    const payload = normalizeWorshipPayload(body, auth);
    const result = await saveWorshipRecord(payload, auth);
    return jsonResponse(origin, result, 201);

  } catch (error) {
    console.error('Error in worship-records API:', error);

    if ((error as Error).message === 'Autenticación requerida') {
      return jsonResponse(origin, { error: 'Token de autenticación requerido' }, 401);
    }

    if (error instanceof BadRequestError) {
      return jsonResponse(origin, { error: error.message }, 400);
    }

    if (error instanceof ForbiddenError) {
      return jsonResponse(origin, { error: error.message }, 403);
    }

    return jsonResponse(origin, {
      error: 'Error interno del servidor',
      details: process.env['NODE_ENV'] === 'development' ? (error as Error).message : undefined
    }, 500);
  }
}
