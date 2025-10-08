import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../../../convex/_generated/api';
import { handleApiError } from '@/lib/api-errors';
import type { Id } from '../../../../../../../convex/_generated/dataModel';

/**
 * Fund Event Budget Item Detail API - Migrated to Convex
 *
 * Phase 4.9 - Fund Events Migration (2025-01-07)
 */

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ budgetItemId: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const itemId = params.budgetItemId;
    const body = await req.json();

    const { description, projected_amount, notes } = body as {
      description?: string;
      projected_amount?: number;
      notes?: string;
    };

    const updateArgs: {
      id: Id<'fund_event_budget_items'>;
      description?: string;
      projected_amount?: number;
      notes?: string;
    } = {
      id: itemId as Id<'fund_event_budget_items'>,
    };
    if (description !== undefined) updateArgs.description = description;
    if (projected_amount !== undefined) updateArgs.projected_amount = projected_amount;
    if (notes !== undefined) updateArgs.notes = notes;

    const item = await client.mutation(api.fundEvents.updateBudgetItem, updateArgs);

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'PATCH /api/fund-events/[id]/budget/[budgetItemId]');
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ budgetItemId: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const itemId = params.budgetItemId;

    await client.mutation(api.fundEvents.deleteBudgetItem, {
      id: itemId as Id<'fund_event_budget_items'>,
    });

    return NextResponse.json({
      success: true,
      message: 'Ítem presupuestario eliminado',
    });
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'DELETE /api/fund-events/[id]/budget/[budgetItemId]');
  }
}
