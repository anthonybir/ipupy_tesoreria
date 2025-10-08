import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../../convex/_generated/dataModel';

/**
 * Fund Event Actuals API - Migrated to Convex
 *
 * Phase 4.9 - Fund Events Migration (2025-01-07)
 *
 * Manages actual income/expenses for events
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

    const { line_type, description, amount, receipt_url, notes } = body as {
      line_type?: string;
      description?: string;
      amount?: number;
      receipt_url?: string;
      notes?: string;
    };

    // Validate required fields
    if (!line_type) {
      throw new ValidationError('line_type es requerido');
    }
    if (line_type !== 'income' && line_type !== 'expense') {
      throw new ValidationError('line_type debe ser "income" o "expense"');
    }
    if (!description) {
      throw new ValidationError('description es requerido');
    }
    if (amount === undefined) {
      throw new ValidationError('amount es requerido');
    }

    const actualArgs: {
      event_id: Id<'fund_events'>;
      line_type: 'income' | 'expense';
      description: string;
      amount: number;
      receipt_url?: string;
      notes?: string;
    } = {
      event_id: eventId as Id<'fund_events'>,
      line_type: line_type as 'income' | 'expense',
      description,
      amount,
    };
    if (receipt_url) actualArgs.receipt_url = receipt_url;
    if (notes) actualArgs.notes = notes;

    const actual = await client.mutation(api.fundEvents.addActual, actualArgs);

    return NextResponse.json(
      {
        success: true,
        data: actual,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/fund-events/[id]/actuals');
  }
}
