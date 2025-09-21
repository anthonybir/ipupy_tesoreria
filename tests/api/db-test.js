/**
 * API: Database Test Endpoint
 * ABSD Treasury System - IPU PY
 */

const { execute } = require('../../src/lib/db');
const { setSecureCORSHeaders } = require('../../src/lib/cors-handler');

module.exports = async (req, res) => {
  // Configure secure CORS (no wildcards)
  const isPreflightHandled = setSecureCORSHeaders(req, res);

  if (isPreflightHandled) {
    return; // Preflight request handled securely
  }

  try {
    const result = await execute('SELECT COUNT(*) AS count FROM churches');
    res.status(200).json({
      message: 'Database connection successful',
      churches: Number(result.rows?.[0]?.count || 0),
      timestamp: new Date().toISOString(),
      database: 'Supabase (PostgreSQL)'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
