import { type NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { firstOrNull } from '@/lib/db-helpers';
import { handleApiError, ValidationError } from '@/lib/api-errors';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const ruc = searchParams.get('ruc');

    if (!ruc) {
      throw new ValidationError('RUC es requerido');
    }

    const result = await executeWithContext(
      auth,
      `SELECT id, ruc, nombre, categoria, email, telefono FROM providers WHERE ruc = $1 LIMIT 1`,
      [ruc]
    );

    const provider = firstOrNull(result.rows);
    if (provider) {
      return NextResponse.json({ exists: true, provider });
    }

    return NextResponse.json({ exists: false, provider: null });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/providers/check-ruc');
  }
}
