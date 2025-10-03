import { type NextRequest, NextResponse } from 'next/server';

import { requireAuth, hasFundAccess } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { firstOrNull, expectOne } from '@/lib/db-helpers';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

type EventRow = {
  id: string;
  created_by: string | null;
  status: string;
  fund_id: number;
};

type ActualRow = {
  id: string;
  event_id: string;
  line_type: 'income' | 'expense';
  description: string;
  amount: string;
  receipt_url: string | null;
  notes: string | null;
};

async function loadEvent(
  auth: Awaited<ReturnType<typeof requireAuth>>,
  eventId: string
): Promise<EventRow | null> {
  const eventResult = await executeWithContext(auth, `
    SELECT fe.id, fe.created_by, fe.status, fe.fund_id
    FROM fund_events fe
    WHERE fe.id = $1
  `, [eventId]);

  return firstOrNull(eventResult.rows) as EventRow | null;
}

async function loadActual(
  auth: Awaited<ReturnType<typeof requireAuth>>,
  actualId: string,
  eventId: string
): Promise<ActualRow | null> {
  const result = await executeWithContext(auth, `
    SELECT id, event_id, line_type, description, amount, receipt_url, notes
    FROM fund_event_actuals
    WHERE id = $1 AND event_id = $2
  `, [actualId, eventId]);

  return firstOrNull(result.rows) as ActualRow | null;
}

function canManageActual(
  auth: Awaited<ReturnType<typeof requireAuth>>,
  event: EventRow
) {
  const isAdmin = auth.role === 'admin';
  const isTreasurer = auth.role === 'treasurer';
  const isFundDirector = auth.role === 'fund_director';
  const isOwner = event.created_by === auth.userId;
  const statusAllowsDirectorEdit = ['draft', 'pending_revision', 'submitted'].includes(event.status);

  if (isAdmin || isTreasurer) {
    return true;
  }

  if (isFundDirector && hasFundAccess(auth, event.fund_id) && isOwner && statusAllowsDirectorEdit) {
    return true;
  }

  return false;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; actualId: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;
    const actualId = params.actualId;
    const body = await req.json();

    const event = await loadEvent(auth, eventId);
    if (!event) {
      const response = NextResponse.json({ error: 'Event not found' }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    const actual = await loadActual(auth, actualId, eventId);
    if (!actual) {
      const response = NextResponse.json({ error: 'Actual entry not found' }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    if (!canManageActual(auth, event)) {
      const response = NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      setCORSHeaders(response);
      return response;
    }

    const { line_type, description, amount, receipt_url, notes } = body ?? {};

    if (line_type && !['income', 'expense'].includes(line_type)) {
      const response = NextResponse.json({ error: 'line_type must be income or expense' }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    if (amount != null && Number(amount) < 0) {
      const response = NextResponse.json({ error: 'amount must be non-negative' }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    const updateResult = await executeWithContext(auth, `
      UPDATE fund_event_actuals
      SET
        line_type = COALESCE($3, line_type),
        description = COALESCE($4, description),
        amount = COALESCE($5, amount),
        receipt_url = COALESCE($6, receipt_url),
        notes = COALESCE($7, notes),
        recorded_at = recorded_at
      WHERE id = $1 AND event_id = $2
      RETURNING *
    `, [
      actualId,
      eventId,
      line_type ?? null,
      typeof description === 'string' ? description.trim() : null,
      amount != null ? Number(amount) : null,
      typeof receipt_url === 'string' ? receipt_url.trim() : null,
      typeof notes === 'string' ? notes.trim() : null
    ]);

    const response = NextResponse.json({ success: true, data: expectOne(updateResult.rows) });
    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error updating actual:', error);
    const response = NextResponse.json(
      { error: 'Error updating actual', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; actualId: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;
    const actualId = params.actualId;

    const event = await loadEvent(auth, eventId);
    if (!event) {
      const response = NextResponse.json({ error: 'Event not found' }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    const actual = await loadActual(auth, actualId, eventId);
    if (!actual) {
      const response = NextResponse.json({ error: 'Actual entry not found' }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    if (!canManageActual(auth, event)) {
      const response = NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      setCORSHeaders(response);
      return response;
    }

    await executeWithContext(auth, `
      DELETE FROM fund_event_actuals
      WHERE id = $1 AND event_id = $2
    `, [actualId, eventId]);

    const response = NextResponse.json({ success: true });
    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error deleting actual:', error);
    const response = NextResponse.json(
      { error: 'Error deleting actual', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}
