import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../convex/_generated/dataModel';
import { createReverseLookupMaps, getFundConvexId, getChurchConvexId } from '@/lib/convex-id-mapping';
import { mapTransactionsListResponse } from '@/lib/convex-adapters';
import { normalizeTransactionsResponse } from '@/types/financial';
import type { ApiResponse } from '@/types/utils';

/**
 * Transaction API Routes - Migrated to Convex
 *
 * Phase 4.4 - Transaction Routes Migration (2025-01-07)
 *
 * This route now uses Convex functions instead of direct Supabase queries.
 * Authorization is handled by Convex functions (requireMinRole("treasurer")).
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 * Each request creates a new client with the current user's Google ID token.
 */

const parseInteger = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseNumber = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated Convex client with user's session token
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const fund_id = searchParams.get('fund_id');
    const church_id = searchParams.get('church_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const limit = parseInteger(searchParams.get('limit'), 100);
    const offset = parseInteger(searchParams.get('offset'), 0);

    // Build query args (only include defined parameters)
    const queryArgs: {
      fund_id?: Id<'funds'>;
      church_id?: Id<'churches'>;
      date_from?: number;
      date_to?: number;
      month?: number;
      year?: number;
      limit?: number;
      offset?: number;
    } = {};

    if (fund_id) {
      if (/^\d+$/.test(fund_id)) {
        const numericFundId = Number.parseInt(fund_id, 10);
        const convexFundId = await getFundConvexId(client, numericFundId);
        if (!convexFundId) {
          throw new ValidationError(`Fondo ${numericFundId} no encontrado`);
        }
        queryArgs.fund_id = convexFundId;
      } else {
        queryArgs.fund_id = fund_id as Id<'funds'>;
      }
    }
    if (church_id) {
      if (/^\d+$/.test(church_id)) {
        const numericChurchId = Number.parseInt(church_id, 10);
        const convexChurchId = await getChurchConvexId(client, numericChurchId);
        if (!convexChurchId) {
          throw new ValidationError(`Iglesia ${numericChurchId} no encontrada`);
        }
        queryArgs.church_id = convexChurchId;
      } else {
        queryArgs.church_id = church_id as Id<'churches'>;
      }
    }

    // Validate date_from
    if (date_from) {
      const fromTimestamp = Date.parse(date_from);
      if (Number.isNaN(fromTimestamp)) {
        throw new ValidationError('date_from inválida');
      }
      queryArgs.date_from = fromTimestamp;
    }

    // Validate date_to
    if (date_to) {
      const toTimestamp = Date.parse(date_to);
      if (Number.isNaN(toTimestamp)) {
        throw new ValidationError('date_to inválida');
      }
      queryArgs.date_to = toTimestamp;
    }

    // Validate month (1-12)
    if (month) {
      const monthNum = parseInteger(month, 0);
      if (monthNum < 1 || monthNum > 12) {
        throw new ValidationError('month debe estar entre 1 y 12');
      }
      queryArgs.month = monthNum;
    }

    // Validate year (reasonable range)
    if (year) {
      const yearNum = parseInteger(year, 0);
      if (yearNum < 2000 || yearNum > 2100) {
        throw new ValidationError('year debe estar entre 2000 y 2100');
      }
      queryArgs.year = yearNum;
    }

    if (limit !== 100) queryArgs.limit = limit;
    if (offset !== 0) queryArgs.offset = offset;

    // Call Convex query - returns { data, pagination, totals }
    const result = await client.query(api.transactions.list, queryArgs);
    const { fundMap, churchMap } = await createReverseLookupMaps(client);
    const payload = mapTransactionsListResponse(result, { fundMap, churchMap });
    const transactions = normalizeTransactionsResponse(payload);

    // ApiResponse envelope with metadata
    type Transaction = typeof transactions.records[number];
    type Pagination = typeof transactions.pagination;
    type Totals = typeof transactions.totals;
    const response: ApiResponse<Transaction[]> & { pagination: Pagination; totals: Totals } = {
      success: true,
      data: transactions.records,
      pagination: transactions.pagination,
      totals: transactions.totals,
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/financial/transactions');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await request.json();
    const inputArray = Array.isArray(body) ? body : [body];

    // Validate and process each transaction
    const results: unknown[] = [];
    const errors: Array<{ index: number; transaction: unknown; error: string }> = [];

    for (const [index, transaction] of inputArray.entries()) {
      try {
        // Validate required fields
        if (!transaction['date']) {
          throw new ValidationError('date es requerido');
        }
        if (!transaction['fund_id']) {
          throw new ValidationError('fund_id es requerido');
        }
        if (!transaction['concept']) {
          throw new ValidationError('concept es requerido');
        }

        // Ensure at least one amount is provided
        const amountIn = parseNumber(String(transaction['amount_in'] ?? 0), 0);
        const amountOut = parseNumber(String(transaction['amount_out'] ?? 0), 0);

        if (amountIn === 0 && amountOut === 0) {
          throw new ValidationError('Se requiere al menos un monto (amount_in o amount_out)');
        }

        // Validate and parse date
        const dateTimestamp = Date.parse(transaction['date']);
        if (Number.isNaN(dateTimestamp)) {
          throw new ValidationError('date inválida');
        }

        // Build mutation args
        if (typeof transaction['fund_id'] !== 'string') {
          throw new ValidationError('fund_id debe ser un identificador válido');
        }
        if (typeof transaction['concept'] !== 'string') {
          throw new ValidationError('concept es requerido');
        }

        type CreateTransactionArgs = typeof api.transactions.create._args;
        const args: CreateTransactionArgs = {
          date: dateTimestamp,
          fund_id: transaction['fund_id'] as Id<'funds'>,
          concept: transaction['concept'],
          amount_in: amountIn,
          amount_out: amountOut,
        };

        // Optional fields
        if (typeof transaction['church_id'] === 'string') {
          args.church_id = transaction['church_id'] as Id<'churches'>;
        }
        if (typeof transaction['report_id'] === 'string') {
          args.report_id = transaction['report_id'] as Id<'reports'>;
        }
        if (typeof transaction['provider'] === 'string') {
          args.provider = transaction['provider'];
        }
        if (typeof transaction['provider_id'] === 'string') {
          args.provider_id = transaction['provider_id'] as Id<'providers'>;
        }
        if (typeof transaction['document_number'] === 'string') {
          args.document_number = transaction['document_number'];
        }

        // Create transaction via Convex
        const created = await client.mutation(api.transactions.create, args);
        results.push(created);
      } catch (error) {
        errors.push({
          index,
          transaction,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const createdCount = results.length;
    const failedCount = errors.length;

    const payload = {
      created: results,
      createdCount,
      failedCount,
      ...(errors.length > 0
        ? {
            errors: errors.map(({ index, error }) => ({ index, error })),
            errorDetails: errors,
          }
        : {}),
    };

    const response: ApiResponse<typeof payload> & { message: string } = {
      success: true,
      data: payload,
      message: `Created ${createdCount} transaction(s)${
        failedCount > 0 ? `, ${failedCount} failed` : ''
      }`,
    };

    return NextResponse.json(response, {
      status: failedCount === 0 ? 201 : 207,
    });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'POST /api/financial/transactions');
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('id');

    if (!transactionId) {
      throw new ValidationError('ID de transacción es requerido');
    }

    const body = await request.json();

    // Build updates object (only include defined, non-null fields)
    const updates: {
      date?: number;
      concept?: string;
      provider?: string;
      document_number?: string;
      amount_in?: number;
      amount_out?: number;
    } = {};

    if (body['date'] !== undefined) {
      const timestamp = Date.parse(body['date']);
      if (Number.isNaN(timestamp)) {
        throw new ValidationError('date inválida');
      }
      updates.date = timestamp;
    }

    if (body['concept'] !== undefined) updates.concept = body['concept'];
    if (body['provider'] !== undefined) updates.provider = body['provider'];
    if (body['document_number'] !== undefined) updates.document_number = body['document_number'];
    if (body['amount_in'] !== undefined) updates.amount_in = parseNumber(String(body['amount_in']), 0);
    if (body['amount_out'] !== undefined) updates.amount_out = parseNumber(String(body['amount_out']), 0);

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No hay campos para actualizar');
    }

    // Update via Convex (includes automatic balance recalculation)
    type UpdateTransactionArgs = typeof api.transactions.update._args;
    const transaction = await client.mutation(
      api.transactions.update,
      {
        id: transactionId as Id<'transactions'>,
        ...updates,
      } satisfies UpdateTransactionArgs
    );

    // ApiResponse envelope with message
    type Transaction = typeof transaction;
    const response: ApiResponse<Transaction> & { message: string } = {
      success: true,
      data: transaction,
      message: 'Transacción actualizada exitosamente',
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'PUT /api/financial/transactions');
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('id');

    if (!transactionId) {
      throw new ValidationError('ID de transacción es requerido');
    }

    // Delete via Convex (includes automatic balance recalculation)
    await client.mutation(api.transactions.deleteTransaction, {
      id: transactionId as Id<'transactions'>,
    });

    // ApiResponse envelope with message at top level (backward compatibility)
    const response: ApiResponse<Record<string, never>> & { message: string } = {
      success: true,
      data: {},
      message: 'Transacción eliminada exitosamente',
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'DELETE /api/financial/transactions');
  }
}
