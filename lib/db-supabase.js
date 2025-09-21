const { Pool } = require('pg');

// Pool health management state
let pool;
let poolCreatedAt;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;
const POOL_MAX_AGE = 30 * 60 * 1000; // 30 minutes

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

// Pool health check function
const shouldRecreatePool = () => {
  if (!pool) {return false;}

  // Check conditions for recreation
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    console.log('Pool recreation: Too many consecutive errors');
    return true;
  }

  if (Date.now() - poolCreatedAt > POOL_MAX_AGE) {
    console.log('Pool recreation: Age limit exceeded');
    return true;
  }

  if (pool.totalCount === 0 && pool.idleCount === 0) {
    console.log('Pool recreation: No connections available');
    return true;
  }

  return false;
};

// Safe pool destruction
const destroyPool = async () => {
  if (pool) {
    try {
      console.log('Destroying pool...');
      await pool.end();
    } catch (err) {
      console.error('Error ending pool:', err);
    }
    pool = null;
    poolCreatedAt = null;
  }
};

// Error classification helper
const isConnectionError = (error) => {
  const connectionErrors = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'Connection terminated',
    'Client has encountered a connection error',
    'terminating connection due to administrator command',
    'SSL connection has been closed unexpectedly',
    'Connection terminated unexpectedly'
  ];

  return connectionErrors.some(msg =>
    error.message?.includes(msg) || error.code === msg
  );
};

// Event handlers
const handlePoolError = (err, client) => {
  console.error('Unexpected pool error:', err);
  consecutiveErrors++;

  // Release the client if it exists and hasn't been released already
  if (client && !client._released) {
    try {
      client.release();
    } catch (releaseError) {
      console.warn('Client already released:', releaseError.message);
    }
  }
};

const handlePoolConnect = (_client) => {
  // Reset error count on successful connection
  if (consecutiveErrors > 0) {
    consecutiveErrors = Math.max(0, consecutiveErrors - 1);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('Pool connection established');
  }
};

const handlePoolRemove = (_client) => {
  // Log when connections are removed (useful for debugging)
  if (process.env.NODE_ENV === 'development') {
    console.log('Pool connection removed');
  }
};

// Enhanced pool creation with error handlers
const createConnection = () => {
  // Check if pool needs recreation
  if (shouldRecreatePool()) {
    destroyPool();
  }

  if (!pool) {
    const connectionString = getConnectionString();
    const sslRequired = process.env.SUPABASE_SSL_DISABLED !== 'true';

    pool = new Pool({
      connectionString,
      ssl: sslRequired ? { rejectUnauthorized: false } : false,

      // Connection settings
      connectionTimeoutMillis: 10000,
      idle_timeout: 30000,           // Close idle connections after 30s
      max: 20,                       // Max pool size

      // Health settings
      allowExitOnIdle: true,         // Allow process to exit when idle
      max_lifetime: 1800,            // Max connection lifetime: 30 min
      statement_timeout: 60000      // Statement timeout: 60s
    });

    // Add error handlers
    pool.on('error', handlePoolError);
    pool.on('connect', handlePoolConnect);
    pool.on('remove', handlePoolRemove);

    poolCreatedAt = Date.now();
    consecutiveErrors = 0;

    console.log('Created new database pool');
  }

  return pool;
};

const toArray = (params) => {
  if (!params) {return [];}
  if (Array.isArray(params)) {return params;}
  return [params];
};

const normalizeStatement = (statement, maybeParams) => {
  if (typeof statement === 'string') {
    return { text: statement, params: toArray(maybeParams) };
  }

  if (typeof statement === 'object' && statement !== null) {
    const text = statement.text || statement.sql;
    if (!text) {
      throw new Error('SQL statement must include a text/sql property');
    }
    const params = toArray(statement.params || statement.args || maybeParams);
    return { text, params };
  }

  throw new Error('Invalid SQL statement provided');
};

// Enhanced execute function with retry logic
const execute = async (statement, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Force pool recreation if we've had issues
      if (shouldRecreatePool()) {
        console.log(`Force pool recreation before attempt ${attempt}`);
        await destroyPool();
      }

      const pool = createConnection();

      // Add timeout to pool.connect() to catch hanging connections
      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Pool connect timeout')), 8000)
        )
      ]);

      const { text, params: boundParams } = normalizeStatement(statement, params);

      try {
        // Add query timeout as well
        const result = await Promise.race([
          client.query(text, boundParams),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 30000)
          )
        ]);

        consecutiveErrors = 0; // Reset error count on success
        console.log(`✅ Database query successful (attempt ${attempt})`);
        return {
          rows: result.rows,
          rowCount: result.rowCount,
          changes: result.rowCount
        };
      } finally {
        client.release();
      }
    } catch (error) {
      consecutiveErrors++;
      console.error(`❌ Database error (attempt ${attempt}/${retries}):`, {
        message: error.message,
        code: error.code,
        consecutiveErrors
      });

      if (attempt === retries) {
        // Final attempt failed - force aggressive pool cleanup
        console.error(`🚨 All ${retries} attempts failed, forcing pool cleanup`);
        consecutiveErrors = MAX_CONSECUTIVE_ERRORS;
        await destroyPool();
        throw error;
      }

      // Always destroy pool on connection errors before retry
      if (isConnectionError(error) || error.message?.includes('timeout')) {
        console.log(`🔄 Destroying pool before retry (connection/timeout error)`);
        await destroyPool();
      }

      // Exponential backoff with jitter
      const baseDelay = attempt * 1000;
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
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

// Graceful shutdown handlers
const handleShutdown = async (signal) => {
  console.log(`${signal} received, closing database pool...`);
  await destroyPool();
  process.exit(0);
};

// Handle process termination
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// For serverless/Vercel - don't keep process alive unnecessarily
if (process.env.VERCEL) {
  // Clean up idle pools in serverless
  setInterval(() => {
    if (pool && pool.totalCount === 0 && pool.idleCount === 0) {
      destroyPool();
    }
  }, 60000); // Check every minute
}

// Debug function for pool statistics
const getPoolStats = () => ({
  total: pool?.totalCount || 0,
  idle: pool?.idleCount || 0,
  waiting: pool?.waitingCount || 0,
  age: poolCreatedAt ? Date.now() - poolCreatedAt : 0,
  errors: consecutiveErrors,
  exists: !!pool
});

module.exports = {
  createConnection,
  execute,
  query,
  batch,
  initDatabase,
  // Export for testing/debugging
  _destroyPool: destroyPool,
  _getPoolStats: getPoolStats
};