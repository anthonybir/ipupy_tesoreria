import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError } from '@/lib/api-errors';

/**
 * Admin Configuration API - Migrated to Convex
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');

    const queryArgs: { section?: string } = {};
    if (section) queryArgs.section = section;

    const config = await client.query(api.admin.getSystemConfig, queryArgs);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/admin/configuration');
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await req.json();

    const { section, data } = body as {
      section?: string;
      data?: Record<string, unknown>;
    };

    if (!section) {
      throw new Error('section es requerido');
    }

    const result = await client.mutation(api.admin.updateSystemConfig, {
      section,
      data,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/admin/configuration');
  }
}
