import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasFundAccess } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { setCORSHeaders } from '@/lib/cors';
import type { CreateEventInput } from '@/types/financial';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const filters: string[] = [];
    const params: unknown[] = [];

    if (auth.role === 'fund_director') {
      if (!auth.assignedFunds || auth.assignedFunds.length === 0) {
        const response = NextResponse.json({
          success: true,
          data: [],
          stats: { draft: 0, submitted: 0, approved: 0, rejected: 0, pending_revision: 0 }
        });
        setCORSHeaders(response);
        return response;
      }

      filters.push(`fe.fund_id = ANY($${params.length + 1})`);
      params.push(auth.assignedFunds);
    }

    const status = searchParams.get('status');
    if (status) {
      filters.push(`fe.status = $${params.length + 1}`);
      params.push(status);
    }

    const fundId = searchParams.get('fund_id');
    if (fundId) {
      filters.push(`fe.fund_id = $${params.length + 1}`);
      params.push(parseInt(fundId));
    }

    const churchId = searchParams.get('church_id');
    if (churchId) {
      filters.push(`fe.church_id = $${params.length + 1}`);
      params.push(parseInt(churchId));
    }

    const dateFrom = searchParams.get('date_from');
    if (dateFrom) {
      filters.push(`fe.event_date >= $${params.length + 1}::date`);
      params.push(dateFrom);
    }

    const dateTo = searchParams.get('date_to');
    if (dateTo) {
      filters.push(`fe.event_date <= $${params.length + 1}::date`);
      params.push(dateTo);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const query = `
      SELECT
        fe.id,
        fe.fund_id,
        fe.church_id,
        fe.name,
        fe.description,
        fe.event_date,
        fe.status,
        fe.created_by,
        fe.approved_by,
        fe.approved_at,
        fe.submitted_at,
        fe.rejection_reason,
        fe.created_at,
        fe.updated_at,
        f.name as fund_name,
        c.name as church_name,
        p.full_name as created_by_name,
        COALESCE((
          SELECT SUM(projected_amount)
          FROM fund_event_budget_items
          WHERE event_id = fe.id
        ), 0) as total_budget,
        COALESCE((
          SELECT SUM(amount)
          FROM fund_event_actuals
          WHERE event_id = fe.id AND line_type = 'income'
        ), 0) as total_income,
        COALESCE((
          SELECT SUM(amount)
          FROM fund_event_actuals
          WHERE event_id = fe.id AND line_type = 'expense'
        ), 0) as total_expense
      FROM fund_events fe
      LEFT JOIN funds f ON f.id = fe.fund_id
      LEFT JOIN churches c ON c.id = fe.church_id
      LEFT JOIN profiles p ON p.id = fe.created_by
      ${whereClause}
      ORDER BY fe.created_at DESC
    `;

    const result = await executeWithContext(auth, query, params);

    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'pending_revision') as pending_revision
      FROM fund_events
      ${whereClause}
    `;

    const statsResult = await executeWithContext(auth, statsQuery, params);
    const stats = statsResult.rows[0];

    const response = NextResponse.json({
      success: true,
      data: result.rows,
      stats: {
        draft: parseInt(stats.draft),
        submitted: parseInt(stats.submitted),
        approved: parseInt(stats.approved),
        rejected: parseInt(stats.rejected),
        pending_revision: parseInt(stats.pending_revision),
      }
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching fund events:', error);
    const response = NextResponse.json(
      {
        error: 'Error fetching events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body: CreateEventInput = await req.json();

    if (!body.fund_id || !body.name || !body.event_date) {
      const response = NextResponse.json(
        { error: 'fund_id, name, and event_date are required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (auth.role === 'fund_director' && !hasFundAccess(auth, body.fund_id)) {
      const response = NextResponse.json(
        { error: 'No access to this fund' },
        { status: 403 }
      );
      setCORSHeaders(response);
      return response;
    }

    await executeWithContext(auth, 'BEGIN');

    try {
      const eventResult = await executeWithContext(auth, `
        INSERT INTO fund_events (
          fund_id, church_id, name, description, event_date, created_by, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'draft')
        RETURNING *
      `, [
        body.fund_id,
        body.church_id ?? null,
        body.name,
        body.description ?? null,
        body.event_date,
        auth.userId
      ]);

      const event = eventResult.rows[0];

      if (body.budget_items && body.budget_items.length > 0) {
        for (const item of body.budget_items) {
          await executeWithContext(auth, `
            INSERT INTO fund_event_budget_items (
              event_id, category, description, projected_amount, notes
            )
            VALUES ($1, $2, $3, $4, $5)
          `, [
            event.id,
            item.category,
            item.description,
            item.projected_amount,
            item.notes ?? null
          ]);
        }
      }

      await executeWithContext(auth, `
        INSERT INTO fund_event_audit (event_id, new_status, changed_by, comment)
        VALUES ($1, 'draft', $2, 'Evento creado')
      `, [event.id, auth.userId]);

      await executeWithContext(auth, 'COMMIT');

      const response = NextResponse.json(
        {
          success: true,
          data: event,
          message: 'Event created successfully'
        },
        { status: 201 }
      );

      setCORSHeaders(response);
      return response;
    } catch (error) {
      await executeWithContext(auth, 'ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating fund event:', error);
    const response = NextResponse.json(
      {
        error: 'Error creating event',
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