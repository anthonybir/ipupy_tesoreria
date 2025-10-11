import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';

/**
 * Admin Pastor Profile Linking API - Migrated to Convex
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 *
 * Links pastor profiles to churches
 */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await req.json();

    const { user_id, church_id } = body as {
      user_id?: string;
      church_id?: string;
    };

    if (!user_id) {
      throw new ValidationError('user_id es requerido');
    }
    if (!church_id) {
      throw new ValidationError('church_id es requerido');
    }

    // Update user profile with church assignment
    const user = await client.mutation(api.admin.updateUserRole, {
      user_id: user_id as Id<'users'>,
      role: 'pastor',
      church_id: church_id as Id<'churches'>,
    });

    return NextResponse.json(
      {
        success: true,
        data: user,
        message: 'Pastor vinculado a iglesia exitosamente',
      } satisfies ApiResponse<typeof user> & { message: string },
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/admin/pastors/link-profile');
  }
}
