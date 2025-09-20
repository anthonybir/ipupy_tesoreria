const { Pool } = require('pg');

let pool;

const getConnectionString = () => {
  // IMPORTANT: Trim environment variables to remove newlines/whitespace
  const connectionString = (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL (or DATABASE_URL) environment variable is required');
  }

  // Validate the connection string format
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    console.error('Invalid connection string format:', connectionString);
    throw new Error('Database connection string must start with postgresql:// or postgres://');
  }

  return connectionString;
};

const createConnection = () => {
  if (!pool) {
    const connectionString = getConnectionString();
    const sslRequired = process.env.SUPABASE_SSL_DISABLED !== 'true';

    pool = new Pool({
      connectionString,
      ssl: sslRequired ? { rejectUnauthorized: false } : false,
      // Add connection timeout for Vercel
      connectionTimeoutMillis: 10000,
      // Pooler handles connection management
      max: 20 // Max pool size
    });
  }
  return pool;
};

const toArray = (params) => {
  if (!params) return [];
  if (Array.isArray(params)) return params;
  return [params];
};

const normalizeStatement = (statement, maybeParams = []) => {
  if (typeof statement === 'string') {
    return { text: statement, params: toArray(maybeParams) };
  }

  if (statement && typeof statement === 'object') {
    const text = statement.text || statement.sql;
    if (!text) {
      throw new Error('SQL statement must include a text/sql property');
    }
    const params = toArray(statement.params || statement.args || maybeParams);
    return { text, params };
  }

  throw new Error('Invalid SQL statement provided');
};

const execute = async (statement, params = []) => {
  const pool = createConnection();
  const client = await pool.connect();
  const { text, params: boundParams } = normalizeStatement(statement, params);

  try {
    const result = await client.query(text, boundParams);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      changes: result.rowCount
    };
  } finally {
    client.release();
  }
};

const query = (statement, params = []) => execute(statement, params);

const batch = async (statements = []) => {
  const results = [];
  for (const statement of statements) {
    results.push(await execute(statement));
  }
  return results;
};

const initDatabase = async () => {
  console.log('✅ Using Supabase Postgres - migrations managed via scripts');
};

module.exports = {
  createConnection,
  execute,
  query,
  batch,
  initDatabase
};