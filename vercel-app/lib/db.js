// Legacy PostgreSQL version - Now using Turso SQLite
// Use db-turso.js for new implementation
const db = require('./db-turso');

// Compatibility wrapper for existing code
const createPool = () => {
  return db.createConnection();
};

const initDatabase = async () => {
  return await db.initDatabase();
};

// Compatibility wrapper for PostgreSQL-style queries
const query = async (sql, params = []) => {
  try {
    const result = await db.execute(sql, params);
    // Convert Turso result format to PostgreSQL-style
    return {
      rows: result.rows || [],
      rowCount: result.changes || 0
    };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

module.exports = {
  initDatabase,
  query,
  execute: db.execute,
  batch: db.batch,
  pool: createPool,
  createConnection: db.createConnection
};