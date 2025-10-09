import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';

/**
 * Admin Fund Directors API - Migrated to Convex
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await req.json();

    const { user_id, fund_id } = body as {
      user_id?: string;
      fund_id?: string;
    };

    if (!user_id) {
      throw new ValidationError('user_id es requerido');
    }
    if (!fund_id) {
      throw new ValidationError('fund_id es requerido');
    }

    const result = await client.mutation(api.admin.assignFundDirector, {
      user_id,
      fund_id: fund_id as Id<'funds'>,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.user,
        message: result.message,
      } satisfies ApiResponse<typeof result.user> & { message: string },
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/admin/fund-directors');
  }
}
