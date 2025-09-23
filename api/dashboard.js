const { execute } = require('../lib/db-supabase');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

module.exports = async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get summary statistics
    const [churches, reports, recentReports, fundOverview, statusCounts, monthlySummary] = await Promise.all([
      execute('SELECT COUNT(*) as count FROM churches'),
      execute(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(diezmos), 0) as total_tithes,
          COALESCE(SUM(ofrendas), 0) as total_offerings,
          COALESCE(SUM(fondo_nacional), 0) as total_national_fund
        FROM reports
      `),
      execute(`
        SELECT
          r.*,
          c.name as church_name,
          c.city as church_city
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        ORDER BY r.created_at DESC
        LIMIT 5
      `),
      execute('SELECT name, current_balance FROM funds ORDER BY name'),
      execute('SELECT estado, COUNT(*) AS count FROM reports GROUP BY estado'),
      execute(`
        SELECT
          year,
          month,
          COALESCE(SUM(total_entradas), 0) as total_entradas,
          COALESCE(SUM(fondo_nacional), 0) as total_fondo_nacional
        FROM reports
        GROUP BY year, month
        ORDER BY year DESC, month DESC
        LIMIT 12
      `)
    ]);

    // Get current month statistics
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const currentMonthStats = await execute(`
      SELECT
        COUNT(*) as reports_this_month,
        COALESCE(SUM(diezmos), 0) as tithes_this_month,
        COALESCE(SUM(ofrendas), 0) as offerings_this_month,
        COALESCE(SUM(fondo_nacional), 0) as national_fund_this_month
      FROM reports
      WHERE month = $1 AND year = $2
    `, [currentMonth, currentYear]);

    // Get reported churches count for current month
    const reportedChurches = await execute(`
      SELECT COUNT(DISTINCT church_id) as count
      FROM reports
      WHERE month = $1 AND year = $2
    `, [currentMonth, currentYear]);

    // Calculate current month totals
    const monthTotal = parseFloat(currentMonthStats.rows[0].tithes_this_month || 0) +
                      parseFloat(currentMonthStats.rows[0].offerings_this_month || 0);

    // Format response to match frontend expectations
    const response = {
      // Main dashboard metrics (camelCase as expected by frontend)
      totalChurches: parseInt(churches.rows[0].count),
      reportedChurches: parseInt(reportedChurches.rows[0].count),
      monthTotal: monthTotal,
      nationalFund: parseFloat(currentMonthStats.rows[0].national_fund_this_month || 0),

      // Recent reports with proper formatting
      recentReports: recentReports.rows.map(report => ({
        ...report,
        churchName: report.church_name,
        churchCity: report.church_city,
        total: parseFloat(report.diezmos || 0) + parseFloat(report.ofrendas || 0),
        fondoNacional: parseFloat(report.fondo_nacional || 0)
      })),

      // Additional data
      overview: {
        total_churches: parseInt(churches.rows[0].count),
        total_reports: parseInt(reports.rows[0].total),
        total_tithes: parseFloat(reports.rows[0].total_tithes || 0),
        total_offerings: parseFloat(reports.rows[0].total_offerings || 0),
        total_national_fund: parseFloat(reports.rows[0].total_national_fund || 0)
      },
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        reports_count: parseInt(currentMonthStats.rows[0].reports_this_month),
        tithes: parseFloat(currentMonthStats.rows[0].tithes_this_month || 0),
        offerings: parseFloat(currentMonthStats.rows[0].offerings_this_month || 0),
        national_fund: parseFloat(currentMonthStats.rows[0].national_fund_this_month || 0)
      },
      monthlySummary: monthlySummary.rows,
      fundOverview: fundOverview.rows,
      statusCounts: statusCounts.rows
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      error: 'Error loading dashboard',
      details: error.message
    });
  }
};