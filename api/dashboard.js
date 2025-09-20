const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get summary statistics
    const [churches, reports, recentReports] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM churches'),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(tithes), 0) as total_tithes,
          COALESCE(SUM(offerings), 0) as total_offerings,
          COALESCE(SUM(national_fund), 0) as total_national_fund
        FROM reports
      `),
      pool.query(`
        SELECT
          r.*,
          c.name as church_name,
          c.city as church_city
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        ORDER BY r.created_at DESC
        LIMIT 5
      `)
    ]);

    // Get current month statistics
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const currentMonthStats = await pool.query(`
      SELECT
        COUNT(*) as reports_this_month,
        COALESCE(SUM(tithes), 0) as tithes_this_month,
        COALESCE(SUM(offerings), 0) as offerings_this_month,
        COALESCE(SUM(national_fund), 0) as national_fund_this_month
      FROM reports
      WHERE month = $1 AND year = $2
    `, [currentMonth, currentYear]);

    const response = {
      success: true,
      data: {
        overview: {
          total_churches: parseInt(churches.rows[0].count),
          total_reports: parseInt(reports.rows[0].total),
          total_tithes: parseFloat(reports.rows[0].total_tithes || 0),
          total_offerings: parseFloat(reports.rows[0].total_offerings || 0),
          total_national_fund: parseFloat(reports.rows[0].total_national_fund || 0)
        },
        current_month: {
          month: currentMonth,
          year: currentYear,
          reports_count: parseInt(currentMonthStats.rows[0].reports_this_month),
          tithes: parseFloat(currentMonthStats.rows[0].tithes_this_month || 0),
          offerings: parseFloat(currentMonthStats.rows[0].offerings_this_month || 0),
          national_fund: parseFloat(currentMonthStats.rows[0].national_fund_this_month || 0)
        },
        recent_reports: recentReports.rows
      }
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