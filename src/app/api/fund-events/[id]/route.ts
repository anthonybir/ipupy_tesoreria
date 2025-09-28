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

    const query = `
      SELECT
        fe.*,
        f.name as fund_name,
        c.name as church_name,
        p.full_name as created_by_name,
        pa.full_name as approved_by_name,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', id,
              'category', category,
              'description', description,
              'projected_amount', projected_amount,
              'notes', notes
            )
          )
          FROM fund_event_budget_items
          WHERE event_id = fe.id
        ), '[]'::json) as budget_items,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', id,
              'line_type', line_type,
              'description', description,
              'amount', amount,
              'receipt_url', receipt_url,
              'notes', notes,
              'recorded_at', recorded_at
            )
          )
          FROM fund_event_actuals
          WHERE event_id = fe.id
        ), '[]'::json) as actuals,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', id,
              'previous_status', previous_status,
              'new_status', new_status,
              'comment', comment,
              'changed_at', changed_at
            )
            ORDER BY changed_at DESC
          )
          FROM fund_event_audit
          WHERE event_id = fe.id
        ), '[]'::json) as audit_trail
      FROM fund_events fe
      LEFT JOIN funds f ON f.id = fe.fund_id
      LEFT JOIN churches c ON c.id = fe.church_id
      LEFT JOIN profiles p ON p.id = fe.created_by
      LEFT JOIN profiles pa ON pa.id = fe.approved_by
      WHERE fe.id = $1
    `;

    const result = await executeWithContext(auth, query, [eventId]);

    if (result.rowCount === 0) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const event = result.rows[0];

    if (auth.role === 'fund_director' && !hasFundAccess(auth, event.fund_id)) {
      const response = NextResponse.json(
        { error: 'No access to this event' },
        { status: 403 }
      );
      setCORSHeaders(response);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      data: event
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching event:', error);
    const response = NextResponse.json(
      {
        error: 'Error fetching event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;
    const body = await req.json();
    const { action, ...data } = body;

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

    if (action === 'submit') {
      if (auth.role === 'fund_director') {
        if (!hasFundAccess(auth, event.fund_id) || event.created_by !== auth.userId) {
          const response = NextResponse.json(
            { error: 'Only the event creator can submit' },
            { status: 403 }
          );
          setCORSHeaders(response);
          return response;
        }
      }

      if (event.status !== 'draft' && event.status !== 'pending_revision') {
        const response = NextResponse.json(
          { error: `Cannot submit event with status: ${event.status}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      await executeWithContext(auth, `
        UPDATE fund_events
        SET status = 'submitted', submitted_at = now(), updated_at = now()
        WHERE id = $1
      `, [eventId]);

      await executeWithContext(auth, `
        INSERT INTO fund_event_audit (event_id, previous_status, new_status, changed_by, comment)
        VALUES ($1, $2, 'submitted', $3, 'Enviado para aprobación')
      `, [eventId, event.status, auth.userId]);

      const response = NextResponse.json({
        success: true,
        message: 'Event submitted for approval'
      });

      setCORSHeaders(response);
      return response;
    }

    if (action === 'approve') {
      if (!['admin', 'treasurer'].includes(auth.role)) {
        const response = NextResponse.json(
          { error: 'Insufficient permissions to approve events' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }

      if (event.status !== 'submitted') {
        const response = NextResponse.json(
          { error: `Cannot approve event with status: ${event.status}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      await executeWithContext(auth, 'BEGIN');

      try {
        const approvalResult = await executeWithContext(auth, `
          SELECT process_fund_event_approval($1, $2) as result
        `, [eventId, auth.userId]);

        const ledgerResult = approvalResult.rows[0].result;

        await executeWithContext(auth, `
          INSERT INTO fund_event_audit (event_id, previous_status, new_status, changed_by, comment)
          VALUES ($1, 'submitted', 'approved', $2, $3)
        `, [eventId, auth.userId, data.comment || 'Evento aprobado y transacciones creadas']);

        await executeWithContext(auth, 'COMMIT');

        const response = NextResponse.json({
          success: true,
          message: 'Event approved and transactions created',
          ledger_result: ledgerResult
        });

        setCORSHeaders(response);
        return response;
      } catch (error) {
        await executeWithContext(auth, 'ROLLBACK');
        throw error;
      }
    }

    if (action === 'reject') {
      if (!['admin', 'treasurer'].includes(auth.role)) {
        const response = NextResponse.json(
          { error: 'Insufficient permissions to reject events' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }

      if (event.status !== 'submitted') {
        const response = NextResponse.json(
          { error: `Cannot reject event with status: ${event.status}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      if (!data.rejection_reason) {
        const response = NextResponse.json(
          { error: 'rejection_reason is required' },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      await executeWithContext(auth, `
        UPDATE fund_events
        SET status = 'pending_revision', rejection_reason = $2, updated_at = now()
        WHERE id = $1
      `, [eventId, data.rejection_reason]);

      await executeWithContext(auth, `
        INSERT INTO fund_event_audit (event_id, previous_status, new_status, changed_by, comment)
        VALUES ($1, 'submitted', 'pending_revision', $2, $3)
      `, [eventId, auth.userId, data.rejection_reason]);

      const response = NextResponse.json({
        success: true,
        message: 'Event returned for revision'
      });

      setCORSHeaders(response);
      return response;
    }

    const response = NextResponse.json(
      { error: 'Invalid action. Must be one of: submit, approve, reject' },
      { status: 400 }
    );
    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error updating event:', error);
    const response = NextResponse.json(
      {
        error: 'Error updating event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;
    const body = await req.json();

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

    if (event.status !== 'draft' && event.status !== 'pending_revision') {
      const response = NextResponse.json(
        { error: `Cannot edit event with status: ${event.status}` },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (auth.role === 'fund_director') {
      if (!hasFundAccess(auth, event.fund_id) || event.created_by !== auth.userId) {
        const response = NextResponse.json(
          { error: 'No access to edit this event' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }
    }

    await executeWithContext(auth, 'BEGIN');

    try {
      await executeWithContext(auth, `
        UPDATE fund_events
        SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          event_date = COALESCE($4, event_date),
          church_id = COALESCE($5, church_id),
          updated_at = now()
        WHERE id = $1
      `, [
        eventId,
        body.name,
        body.description,
        body.event_date,
        body.church_id
      ]);

      await executeWithContext(auth, 'COMMIT');

      const response = NextResponse.json({
        success: true,
        message: 'Event updated successfully'
      });

      setCORSHeaders(response);
      return response;
    } catch (error) {
      await executeWithContext(auth, 'ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating event:', error);
    const response = NextResponse.json(
      {
        error: 'Error updating event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;

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

    if (event.status !== 'draft') {
      const response = NextResponse.json(
        { error: 'Only draft events can be deleted' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (auth.role === 'fund_director') {
      if (!hasFundAccess(auth, event.fund_id) || event.created_by !== auth.userId) {
        const response = NextResponse.json(
          { error: 'No access to delete this event' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }
    }

    await executeWithContext(auth, `
      DELETE FROM fund_events WHERE id = $1
    `, [eventId]);

    const response = NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error deleting event:', error);
    const response = NextResponse.json(
      {
        error: 'Error deleting event',
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