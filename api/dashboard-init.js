const { execute } = require('../lib/db-supabase');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');
const jwt = require('jsonwebtoken');

// Shared auth middleware
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Authentication required');
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = async (req, res) => {
  // Configure CORS
  setCORSHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(res);
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req);

    // Prepare all queries to run in parallel
    const queries = [
      // Dashboard metrics
      execute(`
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

      // Recent reports
      execute(`
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

      // All churches
      execute(`
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

      // Current year/month info
      execute(`
        SELECT
          EXTRACT(YEAR FROM CURRENT_DATE) as current_year,
          EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
          to_char(CURRENT_DATE, 'Month YYYY') as current_period
      `),

      // Fund summary (if funds table exists)
      execute(`
        SELECT
          COUNT(*) as total_funds,
          COUNT(CASE WHEN active = true THEN 1 END) as active_funds,
          COALESCE(SUM(current_balance), 0) as total_balance
        FROM funds
      `).catch(() => ({
        rows: [{ total_funds: 0, active_funds: 0, total_balance: 0 }]
      })),

      // Monthly trends for chart (last 6 months)
      execute(`
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

    // Execute all queries in parallel
    const results = await Promise.all(queries);

    // Structure the response
    const response = {
      success: true,
      user: {
        email: decoded.email,
        role: decoded.role || 'user',
        name: decoded.name || decoded.email
      },
      metrics: results[0].rows[0] || {},
      recentReports: results[1].rows || [],
      churches: results[2].rows || [],
      currentPeriod: results[3].rows[0] || {},
      funds: results[4].rows[0] || {},
      trends: results[5].rows || []
    };

    // Return consolidated data
    return res.status(200).json(response);

  } catch (error) {
    console.error('Dashboard initialization error:', error);
    return res.status(error.message.includes('Authentication') ? 401 : 500).json({
      error: error.message || 'Error loading dashboard data'
    });
  }
};