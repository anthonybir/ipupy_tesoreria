import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { ApiResponse } from '@/types/utils';

/**
 * Provider RUC Check API - Migrated to Convex
 *
 * Phase 4.6 - Provider Routes Migration (2025-01-07)
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const ruc = searchParams.get('ruc');

    if (!ruc) {
      throw new ValidationError('RUC es requerido');
    }

    const provider = await client.query(api.providers.searchByRUC, { ruc });

    const exists = provider ? true : false;

    return NextResponse.json(
      {
        success: true,
        data: {
          exists,
          provider: provider ?? null,
        },
      } satisfies ApiResponse<{
        exists: boolean;
        provider: typeof provider;
      }>,
    );
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/providers/check-ruc');
  }
}
