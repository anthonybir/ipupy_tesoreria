import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext } from '@/lib/db';
import { firstOrNull } from '@/lib/db-helpers';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; budgetItemId: string }> }
): Promise<NextResponse> {
  try {
    const auth = await getAuthContext(req);

    if (!auth || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { category, description, projected_amount, notes } = body;

    if (!description?.trim() || projected_amount === null || projected_amount === undefined || projected_amount < 0) {
      return NextResponse.json(
        { error: 'Description and non-negative amount are required' },
        { status: 400 }
      );
    }

    const params = await context.params;
    const eventId = params.id;
    const budgetItemId = params.budgetItemId;

    const eventResult = await executeWithContext(
      auth,
      `SELECT fe.*, fe.created_by, fe.status, fe.fund_id
       FROM fund_events fe
       WHERE fe.id = $1`,
      [eventId]
    );

    const event = firstOrNull(eventResult.rows);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (!['draft', 'pending_revision'].includes(event['status'])) {
      return NextResponse.json(
        { error: 'Can only edit budget items for draft or pending_revision events' },
        { status: 400 }
      );
    }

    const isFundDirector = auth.role === 'fund_director';
    const isAdmin = auth.role === 'admin';
    const isNationalTreasurer = auth.role === 'national_treasurer';
    const isTreasurer = auth.role === 'treasurer';

    if (isFundDirector) {
      if (event['created_by'] !== auth.userId) {
        return NextResponse.json(
          { error: 'Fund directors can only edit their own events' },
          { status: 403 }
        );
      }
    } else if (!isAdmin && !isNationalTreasurer && !isTreasurer) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = await executeWithContext(
      auth,
      `UPDATE fund_event_budget_items
       SET category = $2, description = $3, projected_amount = $4, notes = $5, updated_at = now()
       WHERE id = $1 AND event_id = $6
       RETURNING *`,
      [budgetItemId, category, description, projected_amount, notes || null, eventId]
    );

    const budgetItem = firstOrNull(result.rows);
    if (!budgetItem) {
      return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
    }

    await executeWithContext(
      auth,
      `UPDATE fund_events SET updated_at = now() WHERE id = $1`,
      [eventId]
    );

    return NextResponse.json({ success: true, data: budgetItem });
  } catch (error) {
    console.error('Error updating budget item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; budgetItemId: string }> }
): Promise<NextResponse> {
  try {
    const auth = await getAuthContext(req);

    if (!auth || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const eventId = params.id;
    const budgetItemId = params.budgetItemId;

    const eventResult = await executeWithContext(
      auth,
      `SELECT fe.*, fe.created_by, fe.status, fe.fund_id
       FROM fund_events fe
       WHERE fe.id = $1`,
      [eventId]
    );

    const event = firstOrNull(eventResult.rows);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (!['draft', 'pending_revision'].includes(event['status'])) {
      return NextResponse.json(
        { error: 'Can only delete budget items from draft or pending_revision events' },
        { status: 400 }
      );
    }

    const isFundDirector = auth.role === 'fund_director';
    const isAdmin = auth.role === 'admin';
    const isNationalTreasurer = auth.role === 'national_treasurer';
    const isTreasurer = auth.role === 'treasurer';

    if (isFundDirector) {
      if (event['created_by'] !== auth.userId) {
        return NextResponse.json(
          { error: 'Fund directors can only delete items from their own events' },
          { status: 403 }
        );
      }
    } else if (!isAdmin && !isNationalTreasurer && !isTreasurer) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = await executeWithContext(
      auth,
      `DELETE FROM fund_event_budget_items WHERE id = $1 AND event_id = $2 RETURNING id`,
      [budgetItemId, eventId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
    }

    await executeWithContext(
      auth,
      `UPDATE fund_events SET updated_at = now() WHERE id = $1`,
      [eventId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting budget item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}