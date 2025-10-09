import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../../../convex/_generated/api';
import { handleApiError } from '@/lib/api-errors';
import type { Id } from '../../../../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';

/**
 * Fund Event Actual Item Detail API - Migrated to Convex
 *
 * Phase 4.9 - Fund Events Migration (2025-01-07)
 */

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ actualId: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const actualId = params.actualId;
    const body = await req.json();

    const { description, amount, receipt_url, notes } = body as {
      description?: string;
      amount?: number;
      receipt_url?: string;
      notes?: string;
    };

    const updateArgs: {
      id: Id<'fund_event_actuals'>;
      description?: string;
      amount?: number;
      receipt_url?: string;
      notes?: string;
    } = {
      id: actualId as Id<'fund_event_actuals'>,
    };
    if (description !== undefined) updateArgs.description = description;
    if (amount !== undefined) updateArgs.amount = amount;
    if (receipt_url !== undefined) updateArgs.receipt_url = receipt_url;
    if (notes !== undefined) updateArgs.notes = notes;

    const actual = await client.mutation(api.fundEvents.updateActual, updateArgs);

    return NextResponse.json(
      {
        success: true,
        data: actual,
      } satisfies ApiResponse<typeof actual>,
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'PATCH /api/fund-events/[id]/actuals/[actualId]');
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ actualId: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const actualId = params.actualId;

    await client.mutation(api.fundEvents.deleteActual, {
      id: actualId as Id<'fund_event_actuals'>,
    });

    return NextResponse.json(
      {
        success: true,
        data: {},
        message: 'Ítem actual eliminado',
      } satisfies ApiResponse<Record<string, never>> & { message: string },
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'DELETE /api/fund-events/[id]/actuals/[actualId]');
  }
}
