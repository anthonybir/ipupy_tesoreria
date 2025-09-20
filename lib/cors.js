/**
 * CORS wrapper to fix import paths for Vercel serverless functions
 * Re-exports the actual CORS module from src/lib/cors
 */

module.exports = require('../src/lib/cors');