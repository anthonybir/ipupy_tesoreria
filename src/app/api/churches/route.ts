import { NextRequest, NextResponse } from 'next/server';

import { executeWithContext } from '@/lib/db';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireAuth, getAuthContext } from '@/lib/auth-context';
import { handleApiError, ValidationError } from '@/lib/api-errors';

const jsonResponse = (data: unknown, origin: string | null, status = 200) =>
  NextResponse.json(data, { status, headers: buildCorsHeaders(origin) });

const parsePositiveInt = (value: string | null, fieldName: string) => {
  if (!value) {
    throw new Error(`${fieldName} requerido`);
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} inválido`);
  }
  return parsed;
};

export async function OPTIONS(request: NextRequest) {
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }
  return jsonResponse({ error: 'Method not allowed' }, request.headers.get('origin'), 405);
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  /**
   * SECURITY NOTE: This endpoint allows unauthenticated access
   *
   * Rationale: Church directory is considered public information
   * - Only returns basic church info (name, city, pastor)
   * - RLS policies still restrict access to inactive churches
   * - Write operations (POST, PUT, DELETE) require authentication
   *
   * IMPORTANT: If RLS context is null, the query may fail with "permission denied"
   * This is intentional - it means RLS policies are working correctly.
   *
   * TODO: Consider implementing rate limiting for public endpoints
   */
  const auth = await getAuthContext(request);

  const result = await executeWithContext<{
    id: number;
    name: string;
    city: string;
    pastor: string;
  }>(auth, 'SELECT * FROM churches WHERE active = true ORDER BY name');

  return jsonResponse(result.rows ?? [], origin);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const auth = await requireAuth(request);

    const { name, city, pastor, phone, email, ruc, cedula, grado, posicion } = await request.json();

    if (!name || !city || !pastor) {
      throw new ValidationError('Nombre, ciudad y pastor son requeridos');
    }

    const result = await executeWithContext(
      auth,
      `
        INSERT INTO churches (name, city, pastor, phone, email, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [name, city, pastor, phone || '', email || '', ruc || '', cedula || '', grado || '', posicion || '']
    );

    return jsonResponse(result.rows[0], origin, 201);
  } catch (error) {
    return handleApiError(error, origin, 'POST /api/churches');
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

    const searchParams = request.nextUrl.searchParams;
    const churchId = parsePositiveInt(searchParams.get('id'), 'ID de iglesia');

    const { name, city, pastor, phone, email, ruc, cedula, grado, posicion, active } = await request.json();

    const result = await executeWithContext(
      auth,
      `
        UPDATE churches
        SET name = $1, city = $2, pastor = $3, phone = $4, email = $5, pastor_ruc = $6,
            pastor_cedula = $7, pastor_grado = $8, pastor_posicion = $9, active = $10, updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *
      `,
      [name, city, pastor, phone, email, ruc, cedula, grado, posicion, active, churchId]
    );

    if (result.rows.length === 0) {
      return jsonResponse({ error: 'Iglesia no encontrada' }, origin, 404);
    }

    return jsonResponse(result.rows[0], origin);
  } catch (error) {
    return handleApiError(error, origin, 'PUT /api/churches');
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

    const searchParams = request.nextUrl.searchParams;
    const churchId = parsePositiveInt(searchParams.get('id'), 'ID de iglesia');

    const result = await executeWithContext(
      auth,
      `
        UPDATE churches
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [churchId]
    );

    if (result.rows.length === 0) {
      return jsonResponse({ error: 'Iglesia no encontrada' }, origin, 404);
    }

    return jsonResponse({ message: 'Iglesia desactivada exitosamente' }, origin);
  } catch (error) {
    return handleApiError(error, origin, 'DELETE /api/churches');
  }
}
