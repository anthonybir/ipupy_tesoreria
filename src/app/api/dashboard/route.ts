import { NextRequest, NextResponse } from 'next/server';

import { executeWithContext } from '@/lib/db';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthContext, AuthContext } from '@/lib/auth-context';
const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toInt = (value: unknown): number => Math.trunc(toNumber(value));
const loadDashboardSummary = async (auth: AuthContext | null) => {
  const [churches, reports, recentReports, fundOverview, statusCounts, monthlySummary] = await Promise.all([
    executeWithContext<{ count: string }>(auth, 'SELECT COUNT(*) as count FROM churches'),
    executeWithContext<{
      total: string;
      total_tithes: string | null;
      total_offerings: string | null;
      total_national_fund: string | null;
    }>(
      auth,
      `
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(diezmos), 0) as total_tithes,
          COALESCE(SUM(ofrendas), 0) as total_offerings,
          COALESCE(SUM(fondo_nacional), 0) as total_national_fund
        FROM reports
      `
    ),
    executeWithContext<{
      church_name: string;
      church_city: string;
      diezmos: string | null;
      ofrendas: string | null;
      fondo_nacional: string | null;
      [key: string]: unknown;
    }>(
      auth,
      `
        SELECT
          r.*,
          c.name as church_name,
          c.city as church_city
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        ORDER BY r.created_at DESC
        LIMIT 5
      `
    ),
    executeWithContext<{ name: string; current_balance: string | null }>(auth, 'SELECT name, current_balance FROM funds ORDER BY name'),
    executeWithContext<{ estado: string; count: string }>(auth, 'SELECT estado, COUNT(*) AS count FROM reports GROUP BY estado'),
    executeWithContext<{
      year: number;
      month: number;
      total_entradas: string | null;
      total_fondo_nacional: string | null;
    }>(
      auth,
      `
        SELECT
          year,
          month,
          COALESCE(SUM(total_entradas), 0) as total_entradas,
          COALESCE(SUM(fondo_nacional), 0) as total_fondo_nacional
        FROM reports
        GROUP BY year, month
        ORDER BY year DESC, month DESC
        LIMIT 12
      `
    )
  ]);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [currentMonthStats, reportedChurches] = await Promise.all([
    executeWithContext<{
      reports_this_month: string;
      tithes_this_month: string | null;
      offerings_this_month: string | null;
      national_fund_this_month: string | null;
    }>(
      auth,
      `
        SELECT
          COUNT(*) as reports_this_month,
          COALESCE(SUM(diezmos), 0) as tithes_this_month,
          COALESCE(SUM(ofrendas), 0) as offerings_this_month,
          COALESCE(SUM(fondo_nacional), 0) as national_fund_this_month
        FROM reports
        WHERE month = $1 AND year = $2
      `,
      [currentMonth, currentYear]
    ),
    executeWithContext<{ count: string }>(
      auth,
      `
        SELECT COUNT(DISTINCT church_id) as count
        FROM reports
        WHERE month = $1 AND year = $2
      `,
      [currentMonth, currentYear]
    )
  ]);

  const monthTotals = toNumber(currentMonthStats.rows[0]?.tithes_this_month) +
    toNumber(currentMonthStats.rows[0]?.offerings_this_month);

  return {
    totalChurches: toInt(churches.rows[0]?.count),
    reportedChurches: toInt(reportedChurches.rows[0]?.count),
    monthTotal: monthTotals,
    nationalFund: toNumber(currentMonthStats.rows[0]?.national_fund_this_month),
    recentReports: recentReports.rows.map((report) => ({
      ...report,
      churchName: report.church_name,
      churchCity: report.church_city,
      total: toNumber(report.diezmos) + toNumber(report.ofrendas),
      fondoNacional: toNumber(report.fondo_nacional)
    })),
    overview: {
      total_churches: toInt(churches.rows[0]?.count),
      total_reports: toInt(reports.rows[0]?.total),
      total_tithes: toNumber(reports.rows[0]?.total_tithes),
      total_offerings: toNumber(reports.rows[0]?.total_offerings),
      total_national_fund: toNumber(reports.rows[0]?.total_national_fund)
    },
    currentMonth: {
      month: currentMonth,
      year: currentYear,
      reports_count: toInt(currentMonthStats.rows[0]?.reports_this_month),
      tithes: toNumber(currentMonthStats.rows[0]?.tithes_this_month),
      offerings: toNumber(currentMonthStats.rows[0]?.offerings_this_month),
      national_fund: toNumber(currentMonthStats.rows[0]?.national_fund_this_month)
    },
    monthlySummary: monthlySummary.rows,
    fundOverview: fundOverview.rows,
    statusCounts: statusCounts.rows
  };
};
const loadDashboardInit = async (auth: AuthContext) => {
  const queries = [
    executeWithContext<{
      total_churches: string;
      total_reports: string;
      current_month_reports: string;
      current_month_total: string | null;
      average_amount: string | null;
    }>(
      auth,
      `
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
      `
    ),
    executeWithContext(
      auth,
      `
        SELECT
          r.id, r.church_id, r.month, r.year,
          r.diezmos, r.ofrendas, r.fondo_nacional,
          r.created_at, r.estado,
          c.name as church_name, c.city as church_city
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        ORDER BY r.created_at DESC
        LIMIT 10
      `
    ),
    executeWithContext(
      auth,
      `
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
      `
    ),
    executeWithContext(
      auth,
      `
        SELECT
          EXTRACT(YEAR FROM CURRENT_DATE) as current_year,
          EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
          to_char(CURRENT_DATE, 'Month YYYY') as current_period
      `
    ),
    executeWithContext(
      auth,
      `
        SELECT
          COUNT(*) as total_funds,
          COUNT(CASE WHEN active = true THEN 1 END) as active_funds,
          COALESCE(SUM(current_balance), 0) as total_balance
        FROM funds
      `
    ).catch(() => ({ rows: [{ total_funds: 0, active_funds: 0, total_balance: 0 }] })),
    executeWithContext(
      auth,
      `
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
      `
    )
  ];

  const [metrics, recentReports, churches, period, funds, trends] = await Promise.all(queries);

  return {
    success: true,
    user: {
      email: auth.email,
      role: auth.role ?? 'user',
      name: auth.fullName ?? auth.email,
      churchId: auth.churchId ?? null
    },
    metrics: metrics.rows[0] || {},
    recentReports: recentReports.rows,
    churches: churches.rows,
    currentPeriod: period.rows[0] || {},
    funds: funds.rows[0] || {},
    trends: trends.rows
  };
};
const jsonResponse = (data: unknown, origin: string | null) => {
  const headers = buildCorsHeaders(origin);
  return NextResponse.json(data, { headers });
};

const jsonError = (status: number, message: string, origin: string | null) => {
  const headers = buildCorsHeaders(origin);
  return NextResponse.json({ error: message }, { status, headers });
};
export async function OPTIONS(request: NextRequest) {
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }
  return jsonError(405, 'Method not allowed', request.headers.get('origin'));
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  try {
    const view = request.nextUrl.searchParams.get('view') ?? request.nextUrl.searchParams.get('mode');

    // Check for Supabase authentication
    const authContext = await getAuthContext(request);

    if (view === 'summary' || !authContext) {
      const summary = await loadDashboardSummary(authContext);
      return jsonResponse(summary, origin);
    }

    const initData = await loadDashboardInit(authContext);
    const summary = await loadDashboardSummary(authContext);

    return jsonResponse({ summary, init: initData }, origin);
  } catch (error) {
    console.error('Dashboard API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message.includes('autenticación') || message.includes('Autenticación') ? 401 : 500;
    return jsonError(status, message, origin);
  }
}
