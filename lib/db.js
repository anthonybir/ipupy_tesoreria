const db = require('./db-supabase');

/**
 * Crea un pool de conexiones (compatibilidad con PostgreSQL)
 * @returns {Object} Conexión a la base de datos
 */
const createPool = () => {
  return db.createConnection();
};

/**
 * Inicializa la base de datos con las tablas necesarias
 * @returns {Promise<void>}
 */
const initDatabase = async () => {
  return await db.initDatabase();
};

/**
 * Ejecuta una consulta SQL con parámetros (compatibilidad PostgreSQL)
 * @param {string} sql - La consulta SQL a ejecutar
 * @param {Array} params - Parámetros para la consulta
 * @returns {Promise<{rows: Array, rowCount: number}>} Resultado de la consulta
 * @throws {Error} Error de base de datos
 */
const query = async (sql, params = []) => {
  try {
    const result = await db.execute(sql, params);
    return {
      rows: result.rows || [],
      rowCount: result.rowCount || result.changes || (result.rows ? result.rows.length : 0)
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