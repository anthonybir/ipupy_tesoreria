import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import { getFundConvexId } from '@/lib/convex-id-mapping';
import { mapFundsListResponse } from '@/lib/convex-adapters';
import { normalizeFundsResponse } from '@/types/financial';

/**
 * Fund API Routes - Migrated to Convex
 *
 * Phase 4.5 - Fund Routes Migration (2025-01-07)
 *
 * This route now uses Convex functions instead of direct Supabase queries.
 * Authorization is handled by Convex functions (requireAdmin for mutations).
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 * Each request creates a new client with the current user's Google ID token.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated Convex client with user's session token
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const type = searchParams.get('type');

    // Build query args
    const queryArgs: {
      type?: string;
      include_inactive?: boolean;
    } = {};

    if (type) queryArgs.type = type;
    if (includeInactive) queryArgs.include_inactive = true;

    // Call Convex query - returns { data: FundWithStats[], totals: {...} }
    const convexResult = await client.query(api.funds.list, queryArgs);
    const payload = mapFundsListResponse(convexResult);
    const fundsCollection = normalizeFundsResponse(payload);

    return NextResponse.json({
      success: true,
      data: fundsCollection.records,
      totals: fundsCollection.totals,
    });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/financial/funds');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await request.json();

    // Validate required fields
    if (!body['name']) {
      throw new ValidationError('name es requerido');
    }

    // Build mutation args
    const args: {
      name: string;
      description?: string;
      type?: string;
      initial_balance?: number;
      is_active?: boolean;
    } = {
      name: body['name'],
    };

    // Optional fields
    if (body['description']) args.description = body['description'];
    if (body['type']) args.type = body['type'];
    if (body['initial_balance'] !== undefined) {
      args.initial_balance = Number(body['initial_balance']);
    }
    if (body['is_active'] !== undefined) {
      args.is_active = body['is_active'];
    }

    // Create via Convex (includes duplicate name check)
    type CreateFundArgs = typeof api.funds.create._args;
    const convexFund = await client.mutation(
      api.funds.create,
      args as CreateFundArgs
    );

    if (!convexFund) {
      throw new Error('Fund creation failed');
    }

    // Map to expected contract shape
    const createdAtIso = new Date(convexFund.created_at).toISOString();
    const updatedAtIso = convexFund.updated_at
      ? new Date(convexFund.updated_at).toISOString()
      : createdAtIso;

    const fund = {
      id: convexFund.supabase_id || 0,
      name: convexFund.name,
      description: convexFund.description || '',
      type: convexFund.type || 'general',
      current_balance: convexFund.current_balance,
      is_active: convexFund.is_active,
      created_at: createdAtIso,
      updated_at: updatedAtIso,
      created_by: convexFund.created_by || 'system',
    };

    return NextResponse.json(
      {
        success: true,
        data: fund,
        message: 'Fondo creado exitosamente',
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'POST /api/financial/funds');
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const fundIdParam = searchParams.get('id');

    if (!fundIdParam) {
      throw new ValidationError('ID de fondo es requerido');
    }

    // Convert numeric Supabase ID to Convex ID
    const numericId = parseInt(fundIdParam);
    const convexId = await getFundConvexId(client, numericId);
    if (!convexId) {
      throw new ValidationError(`Fund ID ${numericId} not found`);
    }

    const body = await request.json();

    // Build updates object (only include defined fields)
    const updates: {
      name?: string;
      description?: string;
      type?: string;
      current_balance?: number;
      is_active?: boolean;
    } = {};

    if (body['name'] !== undefined) updates.name = body['name'];
    if (body['description'] !== undefined) updates.description = body['description'];
    if (body['type'] !== undefined) updates.type = body['type'];
    if (body['current_balance'] !== undefined) {
      updates.current_balance = Number(body['current_balance']);
    }
    if (body['is_active'] !== undefined) updates.is_active = body['is_active'];

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No hay campos para actualizar');
    }

    // Update via Convex
    type UpdateFundArgs = typeof api.funds.update._args;
    const convexFund = await client.mutation(api.funds.update, {
      id: convexId,
      ...updates,
    } satisfies UpdateFundArgs);

    if (!convexFund) {
      throw new Error('Fund update failed');
    }

    // Map to expected contract shape
    const createdAtIso = new Date(convexFund.created_at).toISOString();
    const updatedAtIso = convexFund.updated_at
      ? new Date(convexFund.updated_at).toISOString()
      : createdAtIso;

    const fund = {
      id: convexFund.supabase_id || 0,
      name: convexFund.name,
      description: convexFund.description || '',
      type: convexFund.type || 'general',
      current_balance: convexFund.current_balance,
      is_active: convexFund.is_active,
      created_at: createdAtIso,
      updated_at: updatedAtIso,
      created_by: convexFund.created_by || 'system',
    };

    return NextResponse.json({
      success: true,
      data: fund,
      message: 'Fondo actualizado exitosamente',
    });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'PUT /api/financial/funds');
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const fundIdParam = searchParams.get('id');

    if (!fundIdParam) {
      throw new ValidationError('ID de fondo es requerido');
    }

    // Convert numeric Supabase ID to Convex ID
    const numericId = parseInt(fundIdParam);
    const convexId = await getFundConvexId(client, numericId);
    if (!convexId) {
      throw new ValidationError(`Fund ID ${numericId} not found`);
    }

    // Delete via Convex (handles soft/hard delete based on transactions)
    const result = await client.mutation(api.funds.archive, {
      id: convexId,
    });

    return NextResponse.json({
      success: true,
      message: result.deleted
        ? 'Fondo eliminado permanentemente'
        : 'Fondo desactivado (tiene transacciones)',
    });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'DELETE /api/financial/funds');
  }
}
