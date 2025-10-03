import { type NextRequest, NextResponse } from 'next/server';

import { requireAuth, hasFundAccess } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { firstOrNull, expectOne } from '@/lib/db-helpers';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

async function loadEvent(auth: Awaited<ReturnType<typeof requireAuth>>, eventId: string) {
  const eventResult = await executeWithContext(auth, `
    SELECT fe.id, fe.created_by, fe.status, fe.fund_id
    FROM fund_events fe
    WHERE fe.id = $1
  `, [eventId]);

  return firstOrNull(eventResult.rows) as {
    id: string;
    created_by: string | null;
    status: string;
    fund_id: number;
  } | null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;

    const event = await loadEvent(auth, eventId);
    if (!event) {
      const response = NextResponse.json({ error: 'Event not found' }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    if (auth.role === 'fund_director' && !hasFundAccess(auth, event.fund_id)) {
      const response = NextResponse.json({ error: 'No access to this event' }, { status: 403 });
      setCORSHeaders(response);
      return response;
    }

    const budgets = await executeWithContext(auth, `
      SELECT id, category, description, projected_amount, notes, created_at, updated_at
      FROM fund_event_budget_items
      WHERE event_id = $1
      ORDER BY created_at ASC
    `, [eventId]);

    const response = NextResponse.json({ success: true, data: budgets.rows });
    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching budget items:', error);
    const response = NextResponse.json(
      { error: 'Error fetching budget items', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;
    const body = await req.json();
    const { category, description, projected_amount, notes } = body ?? {};

    if (!category || !description?.trim() || projected_amount === null || projected_amount === undefined || Number(projected_amount) < 0) {
      const response = NextResponse.json(
        { error: 'category, description and non-negative projected_amount are required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    const event = await loadEvent(auth, eventId);
    if (!event) {
      const response = NextResponse.json({ error: 'Event not found' }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    const isDraftStatus = ['draft', 'pending_revision'].includes(event.status);
    const isFundDirectorOwner = auth.role === 'fund_director' && event.created_by === auth.userId;
    const isTreasurer = auth.role === 'treasurer';
    const isAdmin = auth.role === 'admin';

    if (auth.role === 'fund_director') {
      if (!hasFundAccess(auth, event.fund_id) || !isDraftStatus || !isFundDirectorOwner) {
        const response = NextResponse.json(
          { error: 'Fund directors can only add items to their own draft events' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }
    } else if (!isTreasurer && !isAdmin) {
      const response = NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      setCORSHeaders(response);
      return response;
    }

    const insertResult = await executeWithContext(auth, `
      INSERT INTO fund_event_budget_items (event_id, category, description, projected_amount, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, category, description, projected_amount, notes, created_at, updated_at
    `, [
      eventId,
      category,
      description.trim(),
      Number(projected_amount),
      notes?.trim() || null
    ]);

    await executeWithContext(auth, `UPDATE fund_events SET updated_at = now() WHERE id = $1`, [eventId]);

    const response = NextResponse.json({ success: true, data: expectOne(insertResult.rows) }, { status: 201 });
    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error creating budget item:', error);
    const response = NextResponse.json(
      { error: 'Error creating budget item', details: error instanceof Error ? error.message : 'Unknown error' },
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
