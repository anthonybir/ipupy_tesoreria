import { type NextRequest, NextResponse } from 'next/server';

import { executeWithContext } from '@/lib/db';
import { firstOrDefault, expectOne } from '@/lib/db-helpers';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireAuth, type AuthContext } from '@/lib/auth-context';
import type { ApiResponse } from '@/types/utils';

type NumericString = string | number | null | undefined;

type MembersQuery = {
  churchId?: number | null;
  limit: number;
  offset: number;
  sortColumn: string;
  sortOrder: 'ASC' | 'DESC';
  activeFlag?: boolean | null;
};

type MemberPayload = {
  church_id?: NumericString;
  nombre?: string;
  apellido?: string;
  family_id?: NumericString;
  ci_ruc?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  es_activo?: unknown;
  es_bautizado?: unknown;
  es_miembro_oficial?: unknown;
  nota?: string | null;
};
class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

const corsJson = <T extends ApiResponse<unknown>>(
  payload: T,
  origin: string | null,
  status = 200,
) => NextResponse.json(payload, { status, headers: buildCorsHeaders(origin) });

const corsError = (message: string, origin: string | null, status: number, details?: unknown) =>
  corsJson<ApiResponse<never>>(
    {
      success: false,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    origin,
    status,
  );

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (!value) {
    return fallback;
  }
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'si', 'sí'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no'].includes(normalized)) {
    return false;
  }
  return fallback;
};
const isProvided = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const parseInteger = (value: NumericString) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parsePositiveInt = (value: NumericString, fieldName: string) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError(`${fieldName} inválido`);
  }
  return parsed;
};

const sanitizeSortColumn = (value: string | null) => {
  const allowed = new Set(['apellido', 'nombre', 'created_at', 'updated_at', 'ci_ruc']);
  return allowed.has(value ?? '') ? (value as string) : 'apellido';
};

const sanitizeSortOrder = (value: string | null): 'ASC' | 'DESC' =>
  String(value ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
const buildMembersQuery = (request: NextRequest): MembersQuery => {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInteger(searchParams.get('limit')) ?? 100;
  const offset = parseInteger(searchParams.get('offset')) ?? 0;
  const active = searchParams.get('es_activo');

  return {
    churchId: parseInteger(searchParams.get('church_id')),
    limit: Math.max(limit, 10),
    offset: Math.max(offset, 0),
    sortColumn: sanitizeSortColumn(searchParams.get('sort')),
    sortOrder: sanitizeSortOrder(searchParams.get('order')),
    activeFlag: active === null ? null : toBoolean(active, true)
  };
};
const validateMemberPayload = (payload: MemberPayload) => {
  const missing: string[] = [];
  if (!payload.church_id) {
    missing.push('church_id');
  }
  if (!payload.nombre) {
    missing.push('nombre');
  }
  if (!payload.apellido) {
    missing.push('apellido');
  }
  if (missing.length > 0) {
    throw new BadRequestError(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }
};
const buildMembersWhereClause = (query: MembersQuery) => {
  const filters: string[] = [];
  const params: unknown[] = [];

  if (query.churchId) {
    params.push(query.churchId);
    filters.push(`m.church_id = $${params.length}`);
  }

  if (query.activeFlag !== null && query.activeFlag !== undefined) {
    params.push(query.activeFlag);
    filters.push(`m.es_activo = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return { whereClause, params };
};
const fetchMembers = async (auth: AuthContext | null, query: MembersQuery) => {
  const { whereClause, params } = buildMembersWhereClause(query);
  const orderBy = `ORDER BY ${query.sortColumn} ${query.sortOrder}`;
  const limitPlaceholder = `$${params.length + 1}`;
  const offsetPlaceholder = `$${params.length + 2}`;

  const records = await executeWithContext(auth, 
    `
      SELECT
        m.*, f.apellido_familia,
        CASE WHEN m.es_activo THEN 'activo' ELSE 'inactivo' END as estado_label
      FROM members m
      LEFT JOIN families f ON m.family_id = f.id
      ${whereClause}
      ${orderBy}
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    [...params, query.limit, query.offset]
  );

  const count = await executeWithContext(auth, 
    `SELECT COUNT(*) AS total FROM members m ${whereClause}`,
    params
  );

  return {
    data: records.rows,
    pagination: {
      total: Number(firstOrDefault(count.rows, { total: 0 })['total']),
      limit: query.limit,
      offset: query.offset
    }
  };
};
const createMember = async (auth: AuthContext | null, payload: MemberPayload) => {
  validateMemberPayload(payload);

  const result = await executeWithContext(auth, 
    `
      INSERT INTO members (
        church_id, nombre, apellido, family_id, ci_ruc, telefono,
        email, direccion, es_activo, es_bautizado, es_miembro_oficial, nota
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
      )
      RETURNING *
    `,
    [
      parsePositiveInt(payload.church_id, 'church_id'),
      payload.nombre,
      payload.apellido,
      parseInteger(payload.family_id),
      payload.ci_ruc || null,
      payload.telefono || null,
      payload.email || null,
      payload.direccion || null,
      toBoolean(payload.es_activo, true),
      toBoolean(payload.es_bautizado, false),
      toBoolean(payload.es_miembro_oficial, false),
      payload.nota || null
    ]
  );

  return expectOne(result.rows);
};
const updateMember = async (auth: AuthContext | null, memberId: number, payload: MemberPayload) => {
  const existing = await executeWithContext(auth, 'SELECT id FROM members WHERE id = $1', [memberId]);
  if (existing.rows.length === 0) {
    throw new BadRequestError('Miembro no encontrado');
  }

  const result = await executeWithContext(auth, 
    `
      UPDATE members SET
        church_id = COALESCE($1, church_id),
        nombre = COALESCE($2, nombre),
        apellido = COALESCE($3, apellido),
        family_id = $4,
        ci_ruc = $5,
        telefono = $6,
        email = $7,
        direccion = $8,
        es_activo = COALESCE($9, es_activo),
        es_bautizado = COALESCE($10, es_bautizado),
        es_miembro_oficial = COALESCE($11, es_miembro_oficial),
        nota = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `,
    [
      payload.church_id ? parsePositiveInt(payload.church_id, 'church_id') : null,
      payload.nombre || null,
      payload.apellido || null,
      payload.family_id ? parseInteger(payload.family_id) : null,
      payload.ci_ruc || null,
      payload.telefono || null,
      payload.email || null,
      payload.direccion || null,
      isProvided(payload.es_activo) ? toBoolean(payload.es_activo) : null,
      isProvided(payload.es_bautizado) ? toBoolean(payload.es_bautizado) : null,
      isProvided(payload.es_miembro_oficial) ? toBoolean(payload.es_miembro_oficial) : null,
      payload.nota || null,
      memberId
    ]
  );

  return expectOne(result.rows);
};
const deleteMember = async (auth: AuthContext | null, memberId: number) => {
  const result = await executeWithContext(auth, 'DELETE FROM members WHERE id = $1 RETURNING id', [memberId]);
  if (result.rows.length === 0) {
    throw new BadRequestError('Miembro no encontrado');
  }
};
const handleMembersRequest = async (auth: AuthContext | null, request: NextRequest) => {
  switch (request.method) {
    case 'GET': {
      const query = buildMembersQuery(request);
      const result = await fetchMembers(auth, query);
      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      } satisfies ApiResponse<typeof result.data> & { pagination: typeof result.pagination };
    }
    case 'POST': {
      const payload = (await request.json()) as MemberPayload;
      const created = await createMember(auth, payload);
      return { success: true, data: created } satisfies ApiResponse<typeof created>;
    }
    case 'PUT': {
      const memberId = parsePositiveInt(request.nextUrl.searchParams.get('id'), 'ID de miembro');
      const payload = (await request.json()) as MemberPayload;
      const updated = await updateMember(auth, memberId, payload);
      return { success: true, data: updated } satisfies ApiResponse<typeof updated>;
    }
    case 'DELETE': {
      const memberId = parsePositiveInt(request.nextUrl.searchParams.get('id'), 'ID de miembro');
      await deleteMember(auth, memberId);
      return {
        success: true,
        data: {},
        message: 'Miembro eliminado exitosamente',
      } satisfies ApiResponse<Record<string, never>> & { message: string };
    }
    default:
      throw new BadRequestError('Método no permitido');
  }
};
const handleRequest = async (auth: AuthContext | null, request: NextRequest) => {
  const type = request.nextUrl.searchParams.get('type') ?? 'members';

  if (type !== 'members') {
    throw new BadRequestError('Tipo de recurso no migrado aún');
  }

  return handleMembersRequest(auth, request);
};

const handleError = (error: unknown, origin: string | null) => {
  if (error instanceof BadRequestError) {
    return corsError(error.message, origin, 400);
  }
  if (error instanceof Error && error.message.includes('Token')) {
    return corsError('Token inválido o expirado', origin, 401);
  }
  console.error('People API error:', error);
  const details = error instanceof Error ? error.message : 'Error interno del servidor';
  return corsError('Error interno del servidor', origin, 500, details);
};

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }
  return corsError('Method not allowed', request.headers.get('origin'), 405);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);
    const result = await handleRequest(auth, request);
    return corsJson(result, origin);
  } catch (error) {
    return handleError(error, origin);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);
    const result = await handleRequest(auth, request);
    return corsJson(result, origin, 201);
  } catch (error) {
    return handleError(error, origin);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);
    const result = await handleRequest(auth, request);
    return corsJson(result, origin);
  } catch (error) {
    return handleError(error, origin);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);
    const result = await handleRequest(auth, request);
    return corsJson(result, origin);
  } catch (error) {
    return handleError(error, origin);
  }
}
