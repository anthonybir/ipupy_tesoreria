import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { handleApiError, ValidationError } from '@/lib/api-errors';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get('q') || '').trim();
    const categoria = searchParams.get('categoria');
    const limit = Number.parseInt(searchParams.get('limit') ?? '20', 10);

    if (query.length < 2) {
      throw new ValidationError('La búsqueda debe contener al menos 2 caracteres');
    }

    const params: unknown[] = [`%${query}%`];
    const conditions = [`(LOWER(nombre) LIKE LOWER($1) OR ruc ILIKE $1)`];

    if (categoria) {
      params.push(categoria);
      conditions.push(`categoria = $${params.length}`);
    }

    params.push(limit);

    const result = await executeWithContext(
      auth,
      `
        SELECT id, ruc, nombre, categoria, email, telefono, es_activo
        FROM providers
        WHERE ${conditions.join(' AND ')}
        ORDER BY es_especial DESC, nombre ASC
        LIMIT $${params.length}
      `,
      params
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/providers/search');
  }
}
