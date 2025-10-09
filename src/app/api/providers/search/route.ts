import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { ApiResponse } from '@/types/utils';

/**
 * Provider Search API - Migrated to Convex
 *
 * Phase 4.6 - Provider Routes Migration (2025-01-07)
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get('q') || '').trim();
    const limit = Number.parseInt(searchParams.get('limit') ?? '20', 10);

    if (query.length < 2) {
      throw new ValidationError('La búsqueda debe contener al menos 2 caracteres');
    }

    // Call Convex search function (categoria not supported in Convex version)
    const results = await client.query(api.providers.search, {
      query,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        data: results,
      } satisfies ApiResponse<typeof results>,
    );
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/providers/search');
  }
}
