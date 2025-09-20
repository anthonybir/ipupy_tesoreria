/**
 * API: Test Endpoint
 * ABSD Treasury System - IPU PY
 */

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    message: 'ABSD Treasury API is running',
    timestamp: new Date().toISOString(),
    status: 'online',
    environment: process.env.NODE_ENV || 'development'
  });
};