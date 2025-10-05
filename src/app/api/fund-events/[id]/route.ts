import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasFundAccess } from '@/lib/auth-supabase';
import { executeWithContext, executeTransaction } from '@/lib/db';
import { firstOrNull, expectOne } from '@/lib/db-helpers';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

type EventRow = Record<string, unknown>;

type EventMeta = {
  status: string | null;
  fundId: number | null;
  createdBy: string | null;
};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const getEventMeta = (row: EventRow | null | undefined): EventMeta => ({
  status: toStringOrNull(row?.['status']),
  fundId: toNumberOrNull(row?.['fund_id']),
  createdBy: toStringOrNull(row?.['created_by'])
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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
    const event = firstOrNull(result.rows);

    if (!event) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const { fundId: eventFundId } = getEventMeta(event as EventRow);
    if ((auth.role as string) === 'fund_director' /* TODO(fund-director): Add to migration-023 */ && (!eventFundId || !hasFundAccess(auth, eventFundId))) {
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
): Promise<NextResponse> {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;
    const body = await req.json();
    const { action, ...data } = body;

    const eventCheck = await executeWithContext(auth, `
      SELECT created_by, fund_id, status FROM fund_events WHERE id = $1
    `, [eventId]);

    const eventRow = firstOrNull(eventCheck.rows) as EventRow | null;
    if (!eventRow) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const { status: eventStatus, fundId: eventFundId, createdBy: eventCreatedBy } = getEventMeta(eventRow);

    if (action === 'submit') {
      if ((auth.role as string) === 'fund_director' /* TODO(fund-director): Add to migration-023 */) {
        if (!eventFundId || !hasFundAccess(auth, eventFundId) || !eventCreatedBy || eventCreatedBy !== auth.userId) {
          const response = NextResponse.json(
            { error: 'Only the event creator can submit' },
            { status: 403 }
          );
          setCORSHeaders(response);
          return response;
        }
      }

      if (eventStatus !== 'draft' && eventStatus !== 'pending_revision') {
        const response = NextResponse.json(
          { error: `Cannot submit event with status: ${eventStatus ?? 'unknown'}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      // Use executeTransaction for atomic status update + audit
      await executeTransaction(auth, async (client) => {
        await client.query(`
          UPDATE fund_events
          SET status = 'submitted', submitted_at = now(), updated_at = now()
          WHERE id = $1
        `, [eventId]);

        await client.query(`
          INSERT INTO fund_event_audit (event_id, previous_status, new_status, changed_by, comment)
          VALUES ($1, $2, 'submitted', $3, 'Enviado para aprobación')
        `, [eventId, eventStatus, auth.userId]);
      });

      const response = NextResponse.json({
        success: true,
        message: 'Event submitted for approval'
      });

      setCORSHeaders(response);
      return response;
    }

    if (action === 'approve') {
      if (!['admin', 'national_treasurer', 'treasurer'].includes(auth.role)) {
        const response = NextResponse.json(
          { error: 'Insufficient permissions to approve events' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }

      if (eventStatus !== 'submitted') {
        const response = NextResponse.json(
          { error: `Cannot approve event with status: ${eventStatus ?? 'unknown'}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      // Use executeTransaction for atomic approval + audit
      const ledgerResult = await executeTransaction(auth, async (client) => {
        const approvalResult = await client.query(`
          SELECT process_fund_event_approval($1, $2) as result
        `, [eventId, auth.userId]);

        const approvalRow = expectOne(approvalResult.rows);
        const result = approvalRow.result;

        await client.query(`
          INSERT INTO fund_event_audit (event_id, previous_status, new_status, changed_by, comment)
          VALUES ($1, 'submitted', 'approved', $2, $3)
        `, [eventId, auth.userId, data.comment || 'Evento aprobado y transacciones creadas']);

        return result;
      });

      const response = NextResponse.json({
        success: true,
        message: 'Event approved and transactions created',
        ledger_result: ledgerResult
      });

      setCORSHeaders(response);
      return response;
    }

    if (action === 'reject') {
      if (!['admin', 'national_treasurer', 'treasurer'].includes(auth.role)) {
        const response = NextResponse.json(
          { error: 'Insufficient permissions to reject events' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }

      if (eventStatus !== 'submitted') {
        const response = NextResponse.json(
          { error: `Cannot reject event with status: ${eventStatus ?? 'unknown'}` },
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

      // Use executeTransaction for atomic rejection + audit
      await executeTransaction(auth, async (client) => {
        await client.query(`
          UPDATE fund_events
          SET status = 'pending_revision', rejection_reason = $2, updated_at = now()
          WHERE id = $1
        `, [eventId, data.rejection_reason]);

        await client.query(`
          INSERT INTO fund_event_audit (event_id, previous_status, new_status, changed_by, comment)
          VALUES ($1, 'submitted', 'pending_revision', $2, $3)
        `, [eventId, auth.userId, data.rejection_reason]);
      });

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
): Promise<NextResponse> {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;
    const body = await req.json();

    const eventCheck = await executeWithContext(auth, `
      SELECT created_by, fund_id, status FROM fund_events WHERE id = $1
    `, [eventId]);

    const eventRow = firstOrNull(eventCheck.rows) as EventRow | null;
    if (!eventRow) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const { status: eventStatus, fundId: eventFundId, createdBy: eventCreatedBy } = getEventMeta(eventRow);

    if (eventStatus !== 'draft' && eventStatus !== 'pending_revision') {
      const response = NextResponse.json(
        { error: `Cannot edit event with status: ${eventStatus ?? 'unknown'}` },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if ((auth.role as string) === 'fund_director' /* TODO(fund-director): Add to migration-023 */) {
      if (!eventFundId || !hasFundAccess(auth, eventFundId) || !eventCreatedBy || eventCreatedBy !== auth.userId) {
        const response = NextResponse.json(
          { error: 'No access to edit this event' },
          { status: 403 }
        );
        setCORSHeaders(response);
        return response;
      }
    }

    // Use executeTransaction for atomic update
    await executeTransaction(auth, async (client) => {
      await client.query(`
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
    });

    const response = NextResponse.json({
      success: true,
      message: 'Event updated successfully'
    });

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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const auth = await requireAuth(req);
    const params = await context.params;
    const eventId = params.id;

    const eventCheck = await executeWithContext(auth, `
      SELECT created_by, fund_id, status FROM fund_events WHERE id = $1
    `, [eventId]);

    const eventRow = firstOrNull(eventCheck.rows) as EventRow | null;
    if (!eventRow) {
      const response = NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const { status: eventStatus, fundId: eventFundId, createdBy: eventCreatedBy } = getEventMeta(eventRow);

    if (eventStatus !== 'draft') {
      const response = NextResponse.json(
        { error: 'Only draft events can be deleted' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if ((auth.role as string) === 'fund_director' /* TODO(fund-director): Add to migration-023 */) {
      if (!eventFundId || !hasFundAccess(auth, eventFundId) || !eventCreatedBy || eventCreatedBy !== auth.userId) {
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

export async function OPTIONS(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}