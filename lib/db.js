/**
 * Database wrapper to fix import paths for Vercel serverless functions
 * Re-exports the actual database module from src/lib/db
 */

module.exports = require('../src/lib/db');