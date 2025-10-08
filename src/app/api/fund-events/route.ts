import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
  getFundConvexId,
  getChurchConvexId,
  createReverseLookupMaps,
  mapEventToSupabaseShape,
} from '@/lib/convex-id-mapping';

/**
 * Fund Events API Routes - Migrated to Convex
 *
 * Phase 4.9 - Fund Events Migration (2025-01-07)
 *
 * Event planning and budget tracking for fund directors
 * - List/create events with filters
 * - Budget vs actual tracking
 * - Approval workflow (draft → submitted → approved)
 *
 * Authorization handled by Convex fundEvents functions
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);

    // Parse filters
    const status = searchParams.get('status');
    const fund_id_param = searchParams.get('fund_id');
    const church_id_param = searchParams.get('church_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query args
    const queryArgs: {
      status?: string;
      fund_id?: Id<'funds'>;
      church_id?: Id<'churches'>;
      date_from?: number;
      date_to?: number;
      limit?: number;
      offset?: number;
    } = {};

    if (status) queryArgs.status = status;

    // Convert numeric Supabase IDs to Convex IDs
    if (fund_id_param) {
      const numericId = parseInt(fund_id_param);
      const convexId = await getFundConvexId(client, numericId);
      if (convexId) {
        queryArgs.fund_id = convexId;
      } else {
        throw new ValidationError(`Fund ID ${numericId} not found`);
      }
    }

    if (church_id_param) {
      const numericId = parseInt(church_id_param);
      const convexId = await getChurchConvexId(client, numericId);
      if (convexId) {
        queryArgs.church_id = convexId;
      } else {
        throw new ValidationError(`Church ID ${numericId} not found`);
      }
    }
    if (date_from) {
      const timestamp = Date.parse(date_from);
      if (Number.isNaN(timestamp)) {
        throw new ValidationError('date_from inválida');
      }
      queryArgs.date_from = timestamp;
    }
    if (date_to) {
      const timestamp = Date.parse(date_to);
      if (Number.isNaN(timestamp)) {
        throw new ValidationError('date_to inválida');
      }
      queryArgs.date_to = timestamp;
    }
    if (limit) queryArgs.limit = limit;
    if (offset) queryArgs.offset = offset;

    // Call Convex query
    const { data: convexEvents, total, stats: aggregateStats } = await client.query(
      api.fundEvents.list,
      queryArgs
    );

    // Create lookup maps once to avoid N+1 queries
    const { fundMap, churchMap } = await createReverseLookupMaps(client);

    // Map Convex IDs back to numeric Supabase IDs using lookup maps
    const mappedEvents = convexEvents.map((event: typeof convexEvents[number]) =>
      mapEventToSupabaseShape(event, { fundMap, churchMap })
    );

    const stats = {
      draft: aggregateStats.draft,
      submitted: aggregateStats.submitted,
      approved: aggregateStats.approved,
      rejected: aggregateStats.rejected,
      pending_revision: aggregateStats.pending_revision,
    };

    return NextResponse.json({
      success: true,
      data: mappedEvents,
      pagination: {
        total,
        limit,
        offset,
      },
      stats,
    });
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/fund-events');
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await req.json();

    const { fund_id, church_id, name, description, event_date, budget_items } = body as {
      fund_id?: number | string; // Accept both numeric (Supabase) and string (Convex) IDs
      church_id?: number | string;
      name?: string;
      description?: string;
      event_date?: string;
      budget_items?: Array<{
        category: string;
        description: string;
        projected_amount: number;
        notes?: string;
      }>;
    };

    // Validate required fields
    if (!fund_id) {
      throw new ValidationError('fund_id es requerido');
    }
    if (!name) {
      throw new ValidationError('name es requerido');
    }
    if (!event_date) {
      throw new ValidationError('event_date es requerido');
    }

    // Parse and validate event date
    const eventDateTimestamp = Date.parse(event_date);
    if (Number.isNaN(eventDateTimestamp)) {
      throw new ValidationError('event_date inválida');
    }

    // Convert numeric Supabase IDs to Convex IDs
    let convexFundId: Id<'funds'>;
    if (typeof fund_id === 'number') {
      const resolvedId = await getFundConvexId(client, fund_id);
      if (!resolvedId) {
        throw new ValidationError(`Fund ID ${fund_id} not found`);
      }
      convexFundId = resolvedId;
    } else {
      convexFundId = fund_id as Id<'funds'>;
    }

    let convexChurchId: Id<'churches'> | undefined;
    if (church_id) {
      if (typeof church_id === 'number') {
        const resolvedId = await getChurchConvexId(client, church_id);
        if (!resolvedId) {
          throw new ValidationError(`Church ID ${church_id} not found`);
        }
        convexChurchId = resolvedId;
      } else {
        convexChurchId = church_id as Id<'churches'>;
      }
    }

    // Create event (conditionally include optional fields)
    const createArgs: {
      fund_id: Id<'funds'>;
      church_id?: Id<'churches'>;
      name: string;
      description?: string;
      event_date: number;
    } = {
      fund_id: convexFundId,
      name,
      event_date: eventDateTimestamp,
    };
    if (convexChurchId) createArgs.church_id = convexChurchId;
    if (description) createArgs.description = description;

    const event = await client.mutation(api.fundEvents.create, createArgs);

    if (!event) {
      throw new Error('Event creation failed');
    }

    // Add budget items if provided
    if (budget_items && budget_items.length > 0) {
      for (const item of budget_items) {
        const budgetArgs: {
          event_id: Id<'fund_events'>;
          category: string;
          description: string;
          projected_amount: number;
          notes?: string;
        } = {
          event_id: event._id,
          category: item.category,
          description: item.description,
          projected_amount: item.projected_amount,
        };
        if (item.notes) budgetArgs.notes = item.notes;

        await client.mutation(api.fundEvents.addBudgetItem, budgetArgs);
      }
    }

    // Fetch complete event with budget items
    const completeEvent = await client.query(api.fundEvents.get, {
      id: event._id,
    });

    // Map response to match Supabase contract (numeric IDs)
    const { fundMap, churchMap } = await createReverseLookupMaps(client);
    const mappedEvent = mapEventToSupabaseShape(completeEvent, { fundMap, churchMap });

    return NextResponse.json(
      {
        success: true,
        data: mappedEvent,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/fund-events');
  }
}
