import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';

/**
 * Provider API Routes - Migrated to Convex
 *
 * Phase 4.6 - Provider Routes Migration (2025-01-07)
 *
 * This route now uses Convex functions instead of direct Supabase queries.
 * Authorization is handled by Convex functions (requireMinRole("treasurer")).
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 * Each request creates a new client with the current user's Google ID token.
 */

const parseInteger = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated Convex client with user's session token
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(request.url);

    const limit = parseInteger(searchParams.get('limit'), 100);
    const offset = parseInteger(searchParams.get('offset'), 0);
    const categoria = searchParams.get('categoria') || undefined;
    const esActivoParam = searchParams.get('es_activo');
    const includeInactive = esActivoParam === 'false' || undefined;

    // Call Convex query - only include defined parameters
    const queryArgs: {
      limit?: number;
      offset?: number;
      categoria?: string;
      include_inactive?: boolean;
    } = {};

    if (limit !== 100) queryArgs.limit = limit;
    if (offset !== 0) queryArgs.offset = offset;
    if (categoria) queryArgs.categoria = categoria;
    if (includeInactive) queryArgs.include_inactive = includeInactive;

    const result = await client.query(api.providers.list, queryArgs);

    // Convex returns { data: Provider[], count: number }
    // Flatten into ApiResponse to maintain backward compatibility
    type Provider = typeof result.data[number];
    const response: ApiResponse<Provider[]> & { count: number } = {
      success: true,
      data: result.data,
      count: result.count
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/providers');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await request.json();
    const {
      ruc,
      nombre,
      tipo_identificacion,
      razon_social,
      direccion,
      telefono,
      email,
      categoria,
      notas
    } = body ?? {};

    if (!ruc || !nombre || !tipo_identificacion) {
      throw new ValidationError('RUC, nombre y tipo de identificación son requeridos');
    }

    // Check for duplicate RUC
    const existing = await client.query(api.providers.searchByRUC, { ruc });
    if (existing) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Ya existe un proveedor con este RUC'
      };
      return NextResponse.json(response, { status: 409 });
    }

    // Create provider via Convex
    const provider = await client.mutation(api.providers.create, {
      ruc,
      nombre,
      tipo_identificacion,
      razon_social: razon_social ?? undefined,
      direccion: direccion ?? undefined,
      telefono: telefono ?? undefined,
      email: email ?? undefined,
      categoria: categoria ?? undefined,
      notas: notas ?? undefined,
    });

    // Wrap in ApiResponse envelope
    type Provider = typeof provider;
    const response: ApiResponse<Provider> = {
      success: true,
      data: provider
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'POST /api/providers');
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await request.json();
    const {
      id,
      nombre,
      razon_social,
      direccion,
      telefono,
      email,
      categoria,
      notas,
      es_activo
    } = body ?? {};

    if (!id) {
      throw new ValidationError('ID de proveedor es requerido');
    }

    // Build updates object (only include defined, non-null fields)
    const updates: {
      nombre?: string;
      razon_social?: string;
      direccion?: string;
      telefono?: string;
      email?: string;
      categoria?: string;
      notas?: string;
      es_activo?: boolean;
    } = {};

    if (nombre !== undefined) updates.nombre = nombre;
    if (razon_social !== undefined && razon_social !== null) updates.razon_social = razon_social;
    if (direccion !== undefined && direccion !== null) updates.direccion = direccion;
    if (telefono !== undefined && telefono !== null) updates.telefono = telefono;
    if (email !== undefined && email !== null) updates.email = email;
    if (categoria !== undefined && categoria !== null) updates.categoria = categoria;
    if (notas !== undefined && notas !== null) updates.notas = notas;
    if (es_activo !== undefined) updates.es_activo = Boolean(es_activo);

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No hay campos para actualizar');
    }

    // Update via Convex
    const provider = await client.mutation(api.providers.update, {
      id: id as Id<'providers'>,
      ...updates,
    });

    if (!provider) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Proveedor no encontrado'
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Wrap in ApiResponse envelope
    type Provider = typeof provider;
    const response: ApiResponse<Provider> = {
      success: true,
      data: provider
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'PUT /api/providers');
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const idParam = searchParams.get('id');

    if (!idParam) {
      throw new ValidationError('ID de proveedor es requerido');
    }

    // Soft delete (archive) via Convex
    await client.mutation(api.providers.archive, {
      id: idParam as Id<'providers'>,
    });

    // Wrap in ApiResponse envelope with message at top level (backward compatibility)
    const response: ApiResponse<Record<string, never>> & { message: string } = {
      success: true,
      data: {},
      message: 'Proveedor archivado exitosamente'
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'DELETE /api/providers');
  }
}
