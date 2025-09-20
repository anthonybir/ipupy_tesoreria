const { setCORSHeaders } = require('../lib/cors');
const { validateAndTrimEnvVars } = require('../lib/env-validator');

module.exports = async (req, res) => {
  setCORSHeaders(req, res);

  try {
    // Validate and trim environment variables
    const validation = validateAndTrimEnvVars();

    // Test environment variables
    const envTest = {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasSupabaseUrl: !!process.env.SUPABASE_DB_URL,
      nodeEnv: process.env.NODE_ENV,
      validation: validation
    };

    // Test database connection
    const { execute } = require('../lib/db');
    await execute('SELECT 1 as test');

    res.json({
      status: 'OK',
      environment: envTest,
      database: 'Connected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};