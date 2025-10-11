import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../convex/_generated/api';
import { handleApiError } from '@/lib/api-errors';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';
export const maxDuration = 60;

const jsonResponse = (origin: string | null, body: Record<string, unknown>, status = 200) => {
  const response = NextResponse.json(body, { status });
  setCORSHeaders(response, origin);
  return response;
};

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response, req.headers.get('origin'));
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return jsonResponse(origin, { success: false, error: 'Autenticación requerida' }, 401);
    }

    const client = await getAuthenticatedConvexClient();
    const stats = await client.query(api.admin.getDashboardStats, {});

    const responseBody = {
      success: true,
      user: {
        email: auth.email,
        role: auth.role || 'user',
        name: auth.fullName ?? auth.email
      },
      metrics: stats.metrics,
      recentReports: stats.recentReports,
      churches: stats.churchesOverview,
      currentPeriod: stats.currentPeriod,
      funds: stats.fundSummary,
      trends: stats.trends,
      overview: stats.overview,
      currentMonth: stats.currentMonth,
      fundOverview: stats.fundOverview
    };

    return jsonResponse(origin, responseBody);
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    return handleApiError(error, origin, 'GET /api/dashboard-init');
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  return jsonResponse(origin, { error: 'Method not allowed' }, 405);
}
