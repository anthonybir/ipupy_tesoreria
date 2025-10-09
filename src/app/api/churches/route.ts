import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { mapChurchDocumentToRaw } from '@/lib/convex-adapters';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import { normalizeChurchRecord } from '@/types/api';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

/**
 * Church API Routes - Migrated to Convex
 *
 * Phase 4.2 - Church Routes Migration (2025-01-07)
 *
 * This route now uses Convex functions instead of direct Supabase queries.
 * Authorization is handled by Convex functions (requireAdmin for mutations).
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 * Each request creates a new client with the current user's Google ID token.
 *
 * NOTE: Simplified from Supabase version - pastor management is now inline with
 * church records instead of separate pastors table. The primary_pastor complex
 * JOIN has been removed in favor of direct pastor fields on churches table.
 */

/**
 * GET /api/churches - List all active churches
 *
 * Returns: Church[] - Array of active churches sorted by name
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();

    // Call Convex list query (returns only active churches by default)
    const churches = await client.query(api.churches.list);
    const data = churches.map((doc) =>
      normalizeChurchRecord(mapChurchDocumentToRaw(doc))
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/churches');
  }
}

/**
 * POST /api/churches - Create new church
 *
 * Body: {
 *   name: string,
 *   city: string,
 *   pastor: string,
 *   phone?: string,
 *   email?: string,
 *   ruc?: string,
 *   cedula?: string,
 *   grado?: string,
 *   posicion?: string,
 *   active?: boolean
 * }
 *
 * Returns: Church - Created church record
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await request.json();

    const {
      name,
      city,
      pastor,
      phone,
      ruc,
      cedula,
      grado,
      posicion,
      active,
      primaryPastor // Legacy field support
    } = body ?? {};

    // Support both direct pastor field and primaryPastor object (legacy API)
    const pastorName = primaryPastor?.fullName || pastor;

    if (!name || !city || !pastorName) {
      throw new ValidationError('Nombre, ciudad y pastor responsable son requeridos');
    }

    // Create church via Convex
    const church = await client.mutation(api.churches.create, {
      name: name.trim(),
      city: city.trim(),
      pastor: pastorName.trim(),
      phone: phone || undefined,
      pastor_ruc: ruc || undefined,
      pastor_cedula: cedula || undefined,
      pastor_grado: grado || undefined,
      pastor_posicion: posicion || undefined,
      active: active ?? true,
    });

    if (!church) {
      throw new Error('Church creation failed');
    }
    const normalized = normalizeChurchRecord(mapChurchDocumentToRaw(church));

    return NextResponse.json({ success: true, data: normalized }, { status: 201 });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'POST /api/churches');
  }
}

/**
 * PUT /api/churches?id={churchId} - Update church
 *
 * Query Params: id (required)
 * Body: Partial<{
 *   name?: string,
 *   city?: string,
 *   pastor?: string,
 *   phone?: string,
 *   ruc?: string,
 *   cedula?: string,
 *   grado?: string,
 *   posicion?: string,
 *   active?: boolean
 * }>
 *
 * Returns: Church - Updated church record
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const churchIdStr = searchParams.get('id');

    if (!churchIdStr) {
      throw new ValidationError('ID de iglesia requerido');
    }

    const body = await request.json();
    const {
      name,
      city,
      pastor,
      phone,
      ruc,
      cedula,
      grado,
      posicion,
      active,
      primaryPastor // Legacy field support
    } = body ?? {};

    // Support both direct pastor field and primaryPastor object (legacy API)
    const pastorName = primaryPastor?.fullName || pastor;

    // Build updates object (only include defined fields)
    const updates: {
      name?: string;
      city?: string;
      pastor?: string;
      phone?: string;
      pastor_ruc?: string;
      pastor_cedula?: string;
      pastor_grado?: string;
      pastor_posicion?: string;
      active?: boolean;
    } = {};

    if (name !== undefined) updates.name = name.trim();
    if (city !== undefined) updates.city = city.trim();
    if (pastorName !== undefined) updates.pastor = pastorName.trim();
    if (phone !== undefined) updates.phone = phone;
    if (ruc !== undefined) updates.pastor_ruc = ruc;
    if (cedula !== undefined) updates.pastor_cedula = cedula;
    if (grado !== undefined) updates.pastor_grado = grado;
    if (posicion !== undefined) updates.pastor_posicion = posicion;
    if (active !== undefined) updates.active = Boolean(active);

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No hay campos para actualizar');
    }

    // Update via Convex
    const church = await client.mutation(api.churches.update, {
      id: churchIdStr as Id<'churches'>,
      ...updates,
    });

    if (!church) {
      return NextResponse.json(
        { success: false, error: 'Iglesia no encontrada' },
        { status: 404 }
      );
    }

    const normalized = normalizeChurchRecord(mapChurchDocumentToRaw(church));

    return NextResponse.json({ success: true, data: normalized });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'PUT /api/churches');
  }
}

/**
 * DELETE /api/churches?id={churchId} - Archive church (soft delete)
 *
 * Query Params: id (required)
 *
 * Returns: { message: string }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const churchIdStr = searchParams.get('id');

    if (!churchIdStr) {
      throw new ValidationError('ID de iglesia requerido');
    }

    // Archive (soft delete) via Convex
    await client.mutation(api.churches.archive, {
      id: churchIdStr as Id<'churches'>,
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Iglesia desactivada exitosamente' },
    });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'DELETE /api/churches');
  }
}
