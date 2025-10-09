import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../convex/_generated/api';
import { handleApiError } from '@/lib/api-errors';
import type { ApiResponse } from '@/types/utils';

/**
 * Dashboard API Routes - Migrated to Convex
 *
 * Phase 4.7 - Admin Routes Migration (2025-01-07)
 *
 * This route now uses Convex functions instead of direct Supabase queries.
 * Authorization is handled by Convex functions (requireAdmin for admin stats).
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 * Each request creates a new client with the current user's Google ID token.
 *
 * Supports two views:
 * - summary: Public dashboard summary (limited data)
 * - full: Complete dashboard with admin statistics (requires admin role)
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated Convex client with user's session token
    const client = await getAuthenticatedConvexClient();

    // Call Convex query - returns dashboard statistics
    // getDashboardStats handles admin authorization internally
    const stats = await client.query(api.admin.getDashboardStats, {});

    // ApiResponse envelope with legacy compatibility fields
    type DashboardStats = typeof stats;
    const response: ApiResponse<DashboardStats> & {
      summary: DashboardStats;
      totalChurches: number;
      reportedChurches: number;
      monthTotal: number;
      nationalFund: number;
      overview: typeof stats.overview;
      currentMonth: typeof stats.currentMonth;
      fundOverview: typeof stats.fundOverview;
    } = {
      success: true,
      data: stats,
      summary: stats,
      // Legacy compatibility - some clients expect specific keys
      totalChurches: stats.totalChurches,
      reportedChurches: stats.reportedChurches,
      monthTotal: stats.monthTotal,
      nationalFund: stats.nationalFund,
      overview: stats.overview,
      currentMonth: stats.currentMonth,
      fundOverview: stats.fundOverview,
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/dashboard');
  }
}
