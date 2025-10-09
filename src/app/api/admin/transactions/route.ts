import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../convex/_generated/dataModel';
import { getFundConvexId, getChurchConvexId, createReverseLookupMaps } from '@/lib/convex-id-mapping';
import { mapTransactionsListResponse } from '@/lib/convex-adapters';
import { normalizeTransactionsResponse } from '@/types/financial';
import type { ApiResponse } from '@/types/utils';

/**
 * Admin Transactions API - Migrated to Convex
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 *
 * Admin view of all transactions (delegates to main transactions API)
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);

    // Parse all filter parameters
    const fund_id = searchParams.get('fund_id');
    const church_id = searchParams.get('church_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const args: {
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
      const numericFundId = Number.parseInt(fund_id, 10);
      if (Number.isNaN(numericFundId)) {
        throw new ValidationError('fund_id inválido');
      }
      const convexFundId = await getFundConvexId(client, numericFundId);
      if (!convexFundId) {
        throw new ValidationError(`Fondo ${numericFundId} no encontrado`);
      }
      args.fund_id = convexFundId;
    }

    if (church_id) {
      const numericChurchId = Number.parseInt(church_id, 10);
      if (Number.isNaN(numericChurchId)) {
        throw new ValidationError('church_id inválido');
      }
      const convexChurchId = await getChurchConvexId(client, numericChurchId);
      if (!convexChurchId) {
        throw new ValidationError(`Iglesia ${numericChurchId} no encontrada`);
      }
      args.church_id = convexChurchId;
    }

    if (date_from) {
      const parsed = Date.parse(date_from);
      if (Number.isNaN(parsed)) {
        throw new ValidationError('date_from inválida');
      }
      args.date_from = parsed;
    }

    if (date_to) {
      const parsed = Date.parse(date_to);
      if (Number.isNaN(parsed)) {
        throw new ValidationError('date_to inválida');
      }
      args.date_to = parsed;
    }

    if (month) {
      const parsedMonth = Number.parseInt(month, 10);
      if (Number.isNaN(parsedMonth)) {
        throw new ValidationError('month inválido');
      }
      args.month = parsedMonth;
    }

    if (year) {
      const parsedYear = Number.parseInt(year, 10);
      if (Number.isNaN(parsedYear)) {
        throw new ValidationError('year inválido');
      }
      args.year = parsedYear;
    }

    if (searchParams.get('limit')) {
      const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);
      if (!Number.isNaN(parsedLimit)) {
        args.limit = parsedLimit;
      }
    }

    if (searchParams.get('offset')) {
      const parsedOffset = Number.parseInt(searchParams.get('offset') ?? '', 10);
      if (!Number.isNaN(parsedOffset)) {
        args.offset = parsedOffset;
      }
    }

    const result = await client.query(api.transactions.list, args);
    const { fundMap, churchMap } = await createReverseLookupMaps(client);
    const payload = mapTransactionsListResponse(result, { fundMap, churchMap });
    const transactions = normalizeTransactionsResponse(payload);

    return NextResponse.json(
      {
        success: true,
        data: transactions.records,
        pagination: transactions.pagination,
        totals: transactions.totals,
      } satisfies ApiResponse<typeof transactions.records> & {
        pagination: typeof transactions.pagination;
        totals: typeof transactions.totals;
      },
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/admin/transactions');
  }
}
