import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../convex/_generated/dataModel';
import { createReverseLookupMaps, mapEventToSupabaseShape } from '@/lib/convex-id-mapping';
import type { ApiResponse } from '@/types/utils';

/**
 * Fund Event Detail API Routes - Migrated to Convex
 *
 * Phase 4.9 - Fund Events Migration (2025-01-07)
 *
 * Handles individual event operations:
 * - GET: Fetch event with full details (budget items, actuals)
 * - PATCH: Update event details OR workflow actions (submit, approve, reject)
 * - DELETE: Delete event (draft only)
 *
 * NOTE: All responses mirror the legacy shape by exposing the Convex `_id`
 *       as the `id` field (string) and translating related IDs back to the
 *       numeric Supabase identifiers expected by the UI.
 */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const eventId = params.id;

    // Call Convex query - returns event with budget_items and actuals
    const event = await client.query(api.fundEvents.get, {
      id: eventId as Id<'fund_events'>,
    });

    const lookupMaps = await createReverseLookupMaps(client);
    const mappedEvent = mapEventToSupabaseShape(event, lookupMaps);

    // ApiResponse envelope
    type Event = typeof mappedEvent;
    const response: ApiResponse<Event> = {
      success: true,
      data: mappedEvent,
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/fund-events/[id]');
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const eventId = params.id as Id<'fund_events'>;
    const body = await req.json();

    const { action, ...data } = body as {
      action?: 'submit' | 'approve' | 'reject';
      name?: string;
      description?: string;
      event_date?: string;
      church_id?: string;
      rejection_reason?: string;
    };

    // Handle workflow actions
    if (action === 'submit') {
      const event = await client.mutation(api.fundEvents.submit, {
        id: eventId,
      });
      if (!event) {
        throw new ValidationError('Evento no encontrado después de la mutación');
      }
      const lookupMaps = await createReverseLookupMaps(client);
      const mappedEvent = mapEventToSupabaseShape(event, lookupMaps);
      // ApiResponse envelope with message
      type Event = typeof mappedEvent;
      const response: ApiResponse<Event> & { message: string } = {
        success: true,
        data: mappedEvent,
        message: 'Evento enviado para aprobación',
      };
      return NextResponse.json(response);
    }

    if (action === 'approve') {
      const event = await client.mutation(api.fundEvents.approve, {
        id: eventId,
      });
      if (!event) {
        throw new ValidationError('Evento no encontrado después de la mutación');
      }
      const lookupMaps = await createReverseLookupMaps(client);
      const mappedEvent = mapEventToSupabaseShape(event, lookupMaps);
      // ApiResponse envelope with message
      type Event = typeof mappedEvent;
      const response: ApiResponse<Event> & { message: string } = {
        success: true,
        data: mappedEvent,
        message: 'Evento aprobado',
      };
      return NextResponse.json(response);
    }

    if (action === 'reject') {
      if (!data.rejection_reason) {
        throw new ValidationError('rejection_reason es requerido');
      }
      const event = await client.mutation(api.fundEvents.reject, {
        id: eventId,
        reason: data.rejection_reason,
      });
      if (!event) {
        throw new ValidationError('Evento no encontrado después de la mutación');
      }
      const lookupMaps = await createReverseLookupMaps(client);
      const mappedEvent = mapEventToSupabaseShape(event, lookupMaps);
      // ApiResponse envelope with message
      type Event = typeof mappedEvent;
      const response: ApiResponse<Event> & { message: string } = {
        success: true,
        data: mappedEvent,
        message: 'Evento rechazado',
      };
      return NextResponse.json(response);
    }

    // Handle regular update
    const updates: {
      name?: string;
      description?: string;
      event_date?: number;
      church_id?: Id<'churches'>;
    } = {};

    if (data.name) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.event_date) {
      const timestamp = Date.parse(data.event_date);
      if (Number.isNaN(timestamp)) {
        throw new ValidationError('event_date inválida');
      }
      updates.event_date = timestamp;
    }
    if (data.church_id) {
      updates.church_id = data.church_id as Id<'churches'>;
    }

    const event = await client.mutation(api.fundEvents.update, {
      id: eventId,
      ...updates,
    });
    if (!event) {
      throw new ValidationError('Evento no encontrado después de la mutación');
    }

    const lookupMaps = await createReverseLookupMaps(client);
    const mappedEvent = mapEventToSupabaseShape(event, lookupMaps);

    // ApiResponse envelope
    type Event = typeof mappedEvent;
    const response: ApiResponse<Event> = {
      success: true,
      data: mappedEvent,
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'PATCH /api/fund-events/[id]');
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const params = await context.params;
    const eventId = params.id;

    await client.mutation(api.fundEvents.deleteEvent, {
      id: eventId as Id<'fund_events'>,
    });

    // ApiResponse envelope with message at top level (backward compatibility)
    const response: ApiResponse<Record<string, never>> & { message: string } = {
      success: true,
      data: {},
      message: 'Evento eliminado exitosamente',
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'DELETE /api/fund-events/[id]');
  }
}
