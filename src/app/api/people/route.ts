import { type NextRequest, NextResponse } from 'next/server';
import type { ConvexHttpClient } from 'convex/browser';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireAuth } from '@/lib/auth-context';
import { getChurchConvexId } from '@/lib/convex-id-mapping';
import type { ApiResponse } from '@/types/utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

const parseInteger = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parsePositiveInt = (value: string | number | null | undefined, fieldName: string) => {
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

type MembersQuery = {
  churchId?: number | null;
  limit: number;
  offset: number;
  sortColumn: string;
  sortOrder: 'ASC' | 'DESC';
  activeFlag?: boolean | null;
};

type MemberPayload = {
  church_id?: string | number | null;
  nombre?: string;
  apellido?: string;
  family_id?: string | number | null;
  ci_ruc?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  es_activo?: unknown;
  es_bautizado?: unknown;
  es_miembro_oficial?: unknown;
  nota?: string | null;
};

type MemberMutationPayload = {
  nombre: string;
  apellido: string;
  family_id?: Id<'families'>;
  ci_ruc?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  es_activo?: boolean;
  es_bautizado?: boolean;
  es_miembro_oficial?: boolean;
  nota?: string;
};

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
    activeFlag: active === null ? null : toBoolean(active, true),
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

const sanitizeMemberPayload = (payload: MemberPayload) => ({
  nombre: payload.nombre?.trim() ?? '',
  apellido: payload.apellido?.trim() ?? '',
  ci_ruc: payload.ci_ruc?.trim() ?? null,
  telefono: payload.telefono?.trim() ?? null,
  email: payload.email?.trim() ?? null,
  direccion: payload.direccion?.trim() ?? null,
  es_activo: isProvided(payload.es_activo) ? toBoolean(payload.es_activo) : undefined,
  es_bautizado: isProvided(payload.es_bautizado) ? toBoolean(payload.es_bautizado) : undefined,
  es_miembro_oficial: isProvided(payload.es_miembro_oficial) ? toBoolean(payload.es_miembro_oficial) : undefined,
  nota: payload.nota?.trim() ?? null,
  family_id:
    typeof payload.family_id === 'string' && payload.family_id.trim().length > 0
      ? payload.family_id.trim()
      : null,
});

const resolveChurchConvexId = async (
  client: ConvexHttpClient,
  supabaseId: number | null,
): Promise<string | undefined> => {
  if (supabaseId === null) {
    return undefined;
  }

  const convexId = await getChurchConvexId(client, supabaseId);
  if (!convexId) {
    throw new BadRequestError('La iglesia especificada no existe en Convex');
  }
  return convexId;
};

const resolveMemberConvexId = async (
  client: ConvexHttpClient,
  rawId: string | null,
): Promise<string> => {
  if (!rawId) {
    throw new BadRequestError('ID de miembro inválido');
  }

  const trimmed = rawId.trim();
  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(numeric)) {
    const legacyMatch = await client.query(api.admin.findMemberByLegacyId, { supabase_id: numeric });
    if (!legacyMatch) {
      throw new BadRequestError('Miembro no encontrado');
    }
    return legacyMatch;
  }

  return trimmed;
};

const handleMembersRequest = async (
  client: ConvexHttpClient,
  request: NextRequest,
): Promise<ApiResponse<unknown>> => {
  switch (request.method) {
    case 'GET': {
      const query = buildMembersQuery(request);
      const churchConvexId = await resolveChurchConvexId(client, query.churchId ?? null);
      const churchFilter = churchConvexId as Id<'churches'> | undefined;
      const sortColumn = query.sortColumn as 'apellido' | 'nombre' | 'created_at' | 'updated_at' | 'ci_ruc';
      const sortOrder = query.sortOrder as 'ASC' | 'DESC';

      const listArgs: {
        churchId?: Id<'churches'>;
        limit: number;
        offset: number;
        sortColumn: typeof sortColumn;
        sortOrder: typeof sortOrder;
        activeFlag?: boolean;
      } = {
        limit: query.limit,
        offset: query.offset,
        sortColumn,
        sortOrder,
      };

      if (churchFilter) {
        listArgs.churchId = churchFilter;
      }
      if (query.activeFlag !== null && query.activeFlag !== undefined) {
        listArgs.activeFlag = query.activeFlag;
      }

      const result = await client.query(api.admin.listMembers, listArgs);

      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      } as ApiResponse<typeof result.data> & { pagination: typeof result.pagination };
    }
    case 'POST': {
      const payload = (await request.json()) as MemberPayload;
      validateMemberPayload(payload);

      const sanitized = sanitizeMemberPayload(payload);
      const churchSupabaseId = parsePositiveInt(payload.church_id ?? null, 'church_id');
      const churchConvexId = await resolveChurchConvexId(client, churchSupabaseId);
      if (!churchConvexId) {
        throw new BadRequestError('La iglesia especificada es obligatoria');
      }

      const familyConvexId =
        typeof sanitized.family_id === 'string' && sanitized.family_id.trim().length > 0
          ? sanitized.family_id.trim()
          : undefined;

      const createPayload: MemberMutationPayload = {
        nombre: sanitized.nombre,
        apellido: sanitized.apellido,
        es_activo: sanitized.es_activo ?? true,
        es_bautizado: sanitized.es_bautizado ?? false,
        es_miembro_oficial: sanitized.es_miembro_oficial ?? false,
      };

      if (familyConvexId) {
        createPayload.family_id = familyConvexId as Id<'families'>;
      }
      if (sanitized.ci_ruc) {
        createPayload.ci_ruc = sanitized.ci_ruc;
      }
      if (sanitized.telefono) {
        createPayload.telefono = sanitized.telefono;
      }
      if (sanitized.email) {
        createPayload.email = sanitized.email;
      }
      if (sanitized.direccion) {
        createPayload.direccion = sanitized.direccion;
      }
      if (sanitized.nota) {
        createPayload.nota = sanitized.nota;
      }

      const created = await client.mutation(api.admin.createMember, {
        church_id: churchConvexId as Id<'churches'>,
        payload: createPayload,
      });

      return {
        success: true,
        data: created,
      } as ApiResponse<typeof created>;
    }
    case 'PUT': {
      const memberIdParam = request.nextUrl.searchParams.get('id');
      const memberId = await resolveMemberConvexId(client, memberIdParam);
      const payload = (await request.json()) as MemberPayload;
      validateMemberPayload(payload);

      const sanitized = sanitizeMemberPayload(payload);

      const familyConvexId =
        typeof sanitized.family_id === 'string' && sanitized.family_id.trim().length > 0
          ? sanitized.family_id.trim()
          : undefined;

      const updatePayload: MemberMutationPayload = {
        nombre: sanitized.nombre,
        apellido: sanitized.apellido,
      };

      if (familyConvexId) {
        updatePayload.family_id = familyConvexId as Id<'families'>;
      }
      if (sanitized.ci_ruc !== null) {
        updatePayload.ci_ruc = sanitized.ci_ruc ?? undefined;
      }
      if (sanitized.telefono !== null) {
        updatePayload.telefono = sanitized.telefono ?? undefined;
      }
      if (sanitized.email !== null) {
        updatePayload.email = sanitized.email ?? undefined;
      }
      if (sanitized.direccion !== null) {
        updatePayload.direccion = sanitized.direccion ?? undefined;
      }
      if (sanitized.es_activo !== undefined) {
        updatePayload.es_activo = sanitized.es_activo;
      }
      if (sanitized.es_bautizado !== undefined) {
        updatePayload.es_bautizado = sanitized.es_bautizado;
      }
      if (sanitized.es_miembro_oficial !== undefined) {
        updatePayload.es_miembro_oficial = sanitized.es_miembro_oficial;
      }
      if (sanitized.nota !== null) {
        updatePayload.nota = sanitized.nota ?? undefined;
      }

      const updated = await client.mutation(api.admin.updateMember, {
        member_id: memberId as Id<'members'>,
        payload: updatePayload,
      });

      return {
        success: true,
        data: updated,
      } as ApiResponse<typeof updated>;
    }
    case 'DELETE': {
      const memberIdParam = request.nextUrl.searchParams.get('id');
      const memberId = await resolveMemberConvexId(client, memberIdParam);

      await client.mutation(api.admin.deleteMember, { member_id: memberId as Id<'members'> });

      return {
        success: true,
        data: {},
        message: 'Miembro eliminado exitosamente',
      } as ApiResponse<Record<string, never>> & { message: string };
    }
    default:
      throw new BadRequestError('Método no permitido');
  }
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
    await requireAuth();
    const client = await getAuthenticatedConvexClient();
    const result = await handleMembersRequest(client, request);
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
    await requireAuth();
    const client = await getAuthenticatedConvexClient();
    const result = await handleMembersRequest(client, request);
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
    await requireAuth();
    const client = await getAuthenticatedConvexClient();
    const result = await handleMembersRequest(client, request);
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
    await requireAuth();
    const client = await getAuthenticatedConvexClient();
    const result = await handleMembersRequest(client, request);
    return corsJson(result, origin);
  } catch (error) {
    return handleError(error, origin);
  }
}
