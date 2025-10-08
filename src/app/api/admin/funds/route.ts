import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { mapFundsListResponse } from '@/lib/convex-adapters';
import { normalizeFundsResponse } from '@/types/financial';
import { handleApiError } from '@/lib/api-errors';

/**
 * Admin Funds API - Migrated to Convex
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 *
 * Admin view of all funds (delegates to main funds API)
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);

    const type = searchParams.get('type');
    const include_inactive = searchParams.get('include_inactive') === 'true';

    const queryArgs: {
      type?: string;
      include_inactive?: boolean;
    } = {};
    if (type) queryArgs.type = type;
    if (include_inactive) queryArgs.include_inactive = true;

    // Use same list function - auth will determine access level
    const result = await client.query(api.funds.list, queryArgs);
    const payload = mapFundsListResponse(result);
    const funds = normalizeFundsResponse(payload);

    return NextResponse.json({
      success: true,
      data: funds.records,
      totals: funds.totals,
    });
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/admin/funds');
  }
}
