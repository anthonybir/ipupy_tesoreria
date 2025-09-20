/**
 * API: Database Test Endpoint
 * ABSD Treasury System - IPU PY
 */

const { execute } = require('../../src/lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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
