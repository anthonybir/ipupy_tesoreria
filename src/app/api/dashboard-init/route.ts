import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext } from '@/lib/db';
import { firstOrDefault } from '@/lib/db-helpers';
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
    const auth = await getAuthContext(req);
    if (!auth) {
      return jsonResponse(origin, { error: 'Authentication required' }, 401);
    }

    const queries = [
      executeWithContext(auth, `
        SELECT
          COUNT(DISTINCT c.id) as total_churches,
          COUNT(DISTINCT r.id) as total_reports,
          COUNT(DISTINCT CASE WHEN r.created_at >= date_trunc('month', CURRENT_DATE)
            THEN r.id END) as current_month_reports,
          COALESCE(SUM(CASE WHEN r.created_at >= date_trunc('month', CURRENT_DATE)
            THEN COALESCE(r.diezmos, 0) + COALESCE(r.ofrendas, 0) END), 0) as current_month_total,
          COALESCE(AVG(COALESCE(r.diezmos, 0) + COALESCE(r.ofrendas, 0)), 0) as average_amount
        FROM churches c
        LEFT JOIN reports r ON c.id = r.church_id
      `),
      executeWithContext(auth, `
        SELECT
          r.id, r.church_id, r.month, r.year,
          r.diezmos, r.ofrendas, r.fondo_nacional,
          r.created_at, r.estado,
          c.name as church_name, c.city as church_city
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        ORDER BY r.created_at DESC
        LIMIT 10
      `),
      executeWithContext(auth, `
        SELECT
          c.id, c.name, c.city, c.pastor, c.grado, c.posicion, c.cedula,
          c.barrio, c.estado, c.fecha_fundacion, c.telefono, c.email,
          COUNT(DISTINCT r.id) as report_count,
          MAX(r.created_at) as last_report_date
        FROM churches c
        LEFT JOIN reports r ON c.id = r.church_id
        GROUP BY c.id, c.name, c.city, c.pastor, c.grado, c.posicion, c.cedula,
                 c.barrio, c.estado, c.fecha_fundacion, c.telefono, c.email
        ORDER BY c.name
      `),
      executeWithContext(auth, `
        SELECT
          EXTRACT(YEAR FROM CURRENT_DATE) as current_year,
          EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
          to_char(CURRENT_DATE, 'Month YYYY') as current_period
      `),
      executeWithContext(auth, `
        SELECT
          COUNT(*) as total_funds,
          COUNT(CASE WHEN active = true THEN 1 END) as active_funds,
          COALESCE(SUM(current_balance), 0) as total_balance
        FROM funds
      `).catch(() => ({
        rows: [{ total_funds: 0, active_funds: 0, total_balance: 0 }]
      })),
      executeWithContext(auth, `
        SELECT
          TO_CHAR(date_trunc('month', created_at), 'Mon') as month_name,
          EXTRACT(MONTH FROM created_at) as month,
          EXTRACT(YEAR FROM created_at) as year,
          COUNT(*) as report_count,
          SUM(COALESCE(diezmos, 0) + COALESCE(ofrendas, 0)) as total_amount
        FROM reports
        WHERE created_at >= date_trunc('month', CURRENT_DATE - interval '5 months')
        GROUP BY date_trunc('month', created_at),
                 EXTRACT(MONTH FROM created_at),
                 EXTRACT(YEAR FROM created_at)
        ORDER BY year, month
      `)
    ];

    const results = await Promise.all(queries);

    const responseBody = {
      success: true,
      user: {
        email: auth.email,
        role: auth.role || 'user',
        name: auth.email
      },
      metrics: firstOrDefault(results[0]?.rows || [], {}),
      recentReports: results[1]?.rows || [],
      churches: results[2]?.rows || [],
      currentPeriod: firstOrDefault(results[3]?.rows || [], {}),
      funds: firstOrDefault(results[4]?.rows || [], {}),
      trends: results[5]?.rows || []
    };

    return jsonResponse(origin, responseBody);
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    return jsonResponse(
      origin,
      { error: (error as Error).message || 'Error loading dashboard data' },
      (error as Error).message.includes('Authentication') ? 401 : 500
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  return jsonResponse(origin, { error: 'Method not allowed' }, 405);
}
