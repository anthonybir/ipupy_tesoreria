import { type NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { firstOrDefault, expectOne } from '@/lib/db-helpers';
import { handleApiError, ValidationError } from '@/lib/api-errors';

type ProviderRow = {
  id: number;
  ruc: string;
  nombre: string;
  tipo_identificacion: string;
  razon_social: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  categoria: string | null;
  notas: string | null;
  es_activo: boolean;
  es_especial: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const parseInteger = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildProviderFilters = (searchParams: URLSearchParams) => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const categoria = searchParams.get('categoria');
  const esActivo = searchParams.get('es_activo');

  if (categoria) {
    params.push(categoria);
    conditions.push(`categoria = $${params.length}`);
  }

  if (esActivo !== null) {
    params.push(esActivo === 'true');
    conditions.push(`es_activo = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const limit = parseInteger(searchParams.get('limit'), 100);
    const offset = parseInteger(searchParams.get('offset'), 0);
    const { whereClause, params } = buildProviderFilters(searchParams);

    const dataParams = [...params, limit, offset];
    const providersResult = await executeWithContext<ProviderRow>(
      auth,
      `
        SELECT id, ruc, nombre, tipo_identificacion, razon_social, direccion, telefono, email,
               categoria, notas, es_activo, es_especial, created_at, updated_at, created_by
        FROM providers
        ${whereClause}
        ORDER BY es_especial DESC, nombre ASC
        LIMIT $${dataParams.length - 1}
        OFFSET $${dataParams.length}
      `,
      dataParams
    );

    const countResult = await executeWithContext<{ count: string }>(
      auth,
      `SELECT COUNT(*) AS count FROM providers ${whereClause}`,
      params
    );

    return NextResponse.json({
      data: providersResult.rows,
      count: Number.parseInt(String(firstOrDefault(countResult.rows, { count: '0' }).count), 10)
    });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/providers');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
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

    const existing = await executeWithContext(auth, `SELECT id FROM providers WHERE ruc = $1`, [ruc]);
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json({ error: 'Ya existe un proveedor con este RUC' }, { status: 409 });
    }

    const result = await executeWithContext<ProviderRow>(
      auth,
      `
        INSERT INTO providers (
          ruc, nombre, tipo_identificacion, razon_social, direccion, telefono, email,
          categoria, notas, es_activo, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
        RETURNING *
      `,
      [
        ruc,
        nombre,
        tipo_identificacion,
        razon_social ?? null,
        direccion ?? null,
        telefono ?? null,
        email ?? null,
        categoria ?? null,
        notas ?? null,
        auth.userId
      ]
    );

    return NextResponse.json({ data: expectOne(result.rows) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'POST /api/providers');
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
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

    const updates: string[] = [];
    const values: unknown[] = [];

    const pushUpdate = (column: string, value: unknown) => {
      updates.push(`${column} = $${values.length + 1}`);
      values.push(value);
    };

    if (nombre !== undefined) pushUpdate('nombre', nombre);
    if (razon_social !== undefined) pushUpdate('razon_social', razon_social ?? null);
    if (direccion !== undefined) pushUpdate('direccion', direccion ?? null);
    if (telefono !== undefined) pushUpdate('telefono', telefono ?? null);
    if (email !== undefined) pushUpdate('email', email ?? null);
    if (categoria !== undefined) pushUpdate('categoria', categoria ?? null);
    if (notas !== undefined) pushUpdate('notas', notas ?? null);
    if (es_activo !== undefined) pushUpdate('es_activo', Boolean(es_activo));

    if (updates.length === 0) {
      throw new ValidationError('No hay campos para actualizar');
    }

    pushUpdate('updated_at', new Date());

    values.push(id);

    const result = await executeWithContext<ProviderRow>(
      auth,
      `
        UPDATE providers
        SET ${updates.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: expectOne(result.rows) });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'PUT /api/providers');
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const idParam = searchParams.get('id');
    const id = idParam ? Number.parseInt(idParam, 10) : NaN;

    if (!Number.isInteger(id)) {
      throw new ValidationError('ID de proveedor es requerido');
    }

    const result = await executeWithContext<ProviderRow>(
      auth,
      `
        UPDATE providers
        SET es_activo = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'DELETE /api/providers');
  }
}
