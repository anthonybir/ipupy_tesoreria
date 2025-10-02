import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasFundAccess } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;

    const eventCheck = await executeWithContext(auth, `
      SELECT fund_id FROM fund_events WHERE id = $1
    `, [eventId]);

    if (eventCheck.rowCount === 0) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const event = eventCheck.rows[0];
    if (!event) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (auth.role === 'fund_director' && !hasFundAccess(auth, event['fund_id'])) {
      const response = NextResponse.json(
        { error: 'No access to this event' },
        { status: 403 }
      );
      setCORSHeaders(response);
      return response;
    }

    const query = `
      SELECT
        a.*,
        p.full_name as recorded_by_name
      FROM fund_event_actuals a
      LEFT JOIN profiles p ON p.id = a.recorded_by
      WHERE a.event_id = $1
      ORDER BY a.recorded_at DESC
    `;

    const result = await executeWithContext(auth, query, [eventId]);

    const response = NextResponse.json({
      success: true,
      data: result.rows
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching event actuals:', error);
    const response = NextResponse.json(
      {
        error: 'Error fetching actuals',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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

    if (!body.line_type || !body.description || body.amount === undefined) {
      const response = NextResponse.json(
        { error: 'line_type, description, and amount are required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (!['income', 'expense'].includes(body.line_type)) {
      const response = NextResponse.json(
        { error: 'line_type must be either "income" or "expense"' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (body.amount < 0) {
      const response = NextResponse.json(
        { error: 'amount must be non-negative' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    const eventCheck = await executeWithContext(auth, `
      SELECT created_by, fund_id, status FROM fund_events WHERE id = $1
    `, [eventId]);

    if (eventCheck.rowCount === 0) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const event = eventCheck.rows[0];
    if (!event) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (auth.role === 'fund_director') {
      if (!hasFundAccess(auth, event['fund_id']) || event['created_by'] !== auth.userId) {
        const response = NextResponse.json(
          { error: 'Only the event creator can add actuals' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }
    }

    const result = await executeWithContext(auth, `
      INSERT INTO fund_event_actuals (
        event_id, line_type, description, amount, receipt_url, notes, recorded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      eventId,
      body.line_type,
      body.description,
      body.amount,
      body.receipt_url ?? null,
      body.notes ?? null,
      auth.userId
    ]);

    const response = NextResponse.json(
      {
        success: true,
        data: result.rows[0],
        message: 'Actual recorded successfully'
      },
      { status: 201 }
    );

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error creating event actual:', error);
    const response = NextResponse.json(
      {
        error: 'Error creating actual',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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