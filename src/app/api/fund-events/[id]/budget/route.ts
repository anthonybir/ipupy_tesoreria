import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';

/**
 * Fund Event Budget Items API - Migrated to Convex
 *
 * Phase 4.9 - Fund Events Migration (2025-01-07)
 *
 * Manages budget line items for events
 */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const eventId = params.id;
    const body = await req.json();

    const { category, description, projected_amount, notes } = body as {
      category?: string;
      description?: string;
      projected_amount?: number;
      notes?: string;
    };

    // Validate required fields
    if (!category) {
      throw new ValidationError('category es requerido');
    }
    if (!description) {
      throw new ValidationError('description es requerido');
    }
    if (projected_amount === undefined) {
      throw new ValidationError('projected_amount es requerido');
    }

    const budgetArgs: {
      event_id: Id<'fund_events'>;
      category: string;
      description: string;
      projected_amount: number;
      notes?: string;
    } = {
      event_id: eventId as Id<'fund_events'>,
      category,
      description,
      projected_amount,
    };
    if (notes) budgetArgs.notes = notes;

    const item = await client.mutation(api.fundEvents.addBudgetItem, budgetArgs);

    return NextResponse.json(
      {
        success: true,
        data: item,
      } satisfies ApiResponse<typeof item>,
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/fund-events/[id]/budget');
  }
}
