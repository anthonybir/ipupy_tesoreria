import { NextRequest, NextResponse } from 'next/server';

import { execute } from '@/lib/db';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireAuth } from '@/lib/auth-context';

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

  // Make GET endpoint public - authentication optional
  // This allows the churches page to load without login
  // Write operations (POST, PUT, DELETE) still require auth

  const result = await execute<{
    id: number;
    name: string;
    city: string;
    pastor: string;
  }>('SELECT * FROM churches WHERE active = true ORDER BY name');

  return jsonResponse(result.rows ?? [], origin);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  await requireAuth(request);

  const { name, city, pastor, phone, ruc, cedula, grado, posicion } = await request.json();

  if (!name || !city || !pastor) {
    return jsonResponse({ error: 'Nombre, ciudad y pastor son requeridos' }, origin, 400);
  }

  try {
    const result = await execute(
      `
        INSERT INTO churches (name, city, pastor, phone, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [name, city, pastor, phone || '', ruc || '', cedula || '', grado || '', posicion || '']
    );

    return jsonResponse(result.rows[0], origin, 201);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return jsonResponse({ error: 'La iglesia ya existe' }, origin, 400);
    }
    console.error('Error creando iglesia:', error);
    return jsonResponse({ error: 'No se pudo crear la iglesia' }, origin, 500);
  }
}

export async function PUT(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  await requireAuth(request);

  const searchParams = request.nextUrl.searchParams;
  let churchId: number;
  try {
    churchId = parsePositiveInt(searchParams.get('id'), 'ID de iglesia');
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, origin, 400);
  }

  const { name, city, pastor, phone, ruc, cedula, grado, posicion, active } = await request.json();

  const result = await execute(
    `
      UPDATE churches
      SET name = $1, city = $2, pastor = $3, phone = $4, pastor_ruc = $5,
          pastor_cedula = $6, pastor_grado = $7, pastor_posicion = $8, active = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `,
    [name, city, pastor, phone, ruc, cedula, grado, posicion, active, churchId]
  );

  if (result.rows.length === 0) {
    return jsonResponse({ error: 'Iglesia no encontrada' }, origin, 404);
  }

  return jsonResponse(result.rows[0], origin);
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  await requireAuth(request);

  const searchParams = request.nextUrl.searchParams;
  let churchId: number;
  try {
    churchId = parsePositiveInt(searchParams.get('id'), 'ID de iglesia');
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, origin, 400);
  }

  const result = await execute(
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
}
