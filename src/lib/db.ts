import { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | undefined;
let poolCreatedAt: number | undefined;
let consecutiveErrors = 0;

const MAX_CONSECUTIVE_ERRORS = 3;
const POOL_MAX_AGE = 30 * 60 * 1000; // 30 minutes

const getConnectionString = (): string => {
  const raw = (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
  if (!raw) {
    throw new Error('SUPABASE_DB_URL (or DATABASE_URL) environment variable is required');
  }

  if (!raw.startsWith('postgresql://') && !raw.startsWith('postgres://')) {
    throw new Error('Database connection string must start with postgresql:// or postgres://');
  }

  let connectionString = raw;

  // Use connection pooler for Supabase in production
  const url = new URL(connectionString);

  // Force pooler mode for Vercel deployments
  if (process.env.VERCEL) {
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '0');
  }

  connectionString = url.toString();

  return connectionString;
};
const shouldRecreatePool = (): boolean => {
  if (!pool) {
    return false;
  }

  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    return true;
  }

  if (poolCreatedAt && Date.now() - poolCreatedAt > POOL_MAX_AGE) {
    return true;
  }

  if (pool.totalCount === 0 && pool.idleCount === 0) {
    return true;
  }

  return false;
};

const destroyPool = async (): Promise<void> => {
  const poolRef = pool;
  if (!poolRef) {
    return;
  }

  pool = undefined;
  poolCreatedAt = undefined;

  try {
    await poolRef.end();
  } catch (error) {
    console.error('Error ending pool', error);
  }
};
const isConnectionError = (error: unknown): boolean => {
  if (typeof error !== 'object' || !error) {
    return false;
  }

  const err = error as { message?: string; code?: string };
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

  return connectionErrors.some((msg) => err.message?.includes(msg) || err.code === msg);
};

export const createConnection = (): Pool => {
  if (shouldRecreatePool()) {
    void destroyPool();
  }

  if (!pool) {
    const connectionString = getConnectionString();
    const sslRequired = process.env.SUPABASE_SSL_DISABLED !== 'true';

    pool = new Pool({
      connectionString,
      ssl: sslRequired ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15000, // Increase timeout for Vercel cold starts
      idleTimeoutMillis: 10000, // Reduce idle timeout to free connections faster
      max: process.env.VERCEL ? 1 : 10, // Reduce connections on Vercel to avoid pool exhaustion
      allowExitOnIdle: true,
      application_name: 'ipupy-tesoreria'
    });

    pool.on('error', (err, client) => {
      console.error('Unexpected pool error:', err);
      consecutiveErrors += 1;
      if (client && !(client as PoolClient & { _released?: boolean })._released) {
        try {
          client.release();
        } catch (releaseError) {
          console.warn('Client release error:', releaseError);
        }
      }
    });
    pool.on('connect', () => {
      if (consecutiveErrors > 0) {
        consecutiveErrors = Math.max(0, consecutiveErrors - 1);
      }
    });

    pool.on('remove', () => {
      // no-op logging hook kept for parity
    });

    poolCreatedAt = Date.now();
    consecutiveErrors = 0;
  }

  return pool;
};

type StatementConfig = QueryConfig<unknown[]> & { sql?: string; values?: unknown[] };

type Statement = string | StatementConfig;

type NormalizedStatement = { text: string; params: unknown[] };

const toArray = (params?: unknown): unknown[] => {
  if (!params) {
    return [];
  }
  return Array.isArray(params) ? params : [params];
};

const normalizeStatement = (statement: Statement, maybeParams?: unknown): NormalizedStatement => {
  if (typeof statement === 'string') {
    return { text: statement, params: toArray(maybeParams) };
  }

  const config = statement;
  const resolvedText = config.text ?? config.sql;
  if (!resolvedText) {
    throw new Error('SQL statement must include a text or sql property');
  }

  return { text: resolvedText, params: toArray(config.values ?? maybeParams) };
};
export const execute = async <T extends QueryResultRow = QueryResultRow>(
  statement: Statement,
  params?: unknown,
  retries = 3
): Promise<QueryResult<T>> => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      if (shouldRecreatePool()) {
        await destroyPool();
      }

      const poolRef = createConnection();
      const client = await Promise.race([
        poolRef.connect(),
        new Promise<PoolClient>((_, reject) => {
          setTimeout(() => reject(new Error('Pool connect timeout')), 15000);
        })
      ]);

      const { text, params: boundParams } = normalizeStatement(statement, params);

      try {
        // CRITICAL SECURITY TODO: Set RLS context before executing query
        // This is required for Row Level Security policies to work!
        // Without this, RLS policies cannot identify the current user.
        // Implementation blocked: Need to pass AuthContext through execute()
        // await setDatabaseContext(client, authContext);

        return await Promise.race([
          client.query<T>(text, boundParams),
          new Promise<QueryResult<T>>((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout')), 30000);
          })
        ]);
      } finally {
        client.release();
      }
    } catch (error) {
      consecutiveErrors += 1;

      if (attempt === retries) {
        await destroyPool();
        throw error;
      }

      if (isConnectionError(error) || (error as { message?: string }).message?.includes('timeout')) {
        await destroyPool();
      }

      const baseDelay = attempt * 1000;
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, 3000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable execute retry loop');
};
export const query = execute;

/**
 * Execute a database query with RLS context
 * This is the SECURE version that sets user context for Row Level Security
 *
 * @param authContext - Authentication context from auth-supabase
 * @param statement - SQL statement to execute
 * @param params - Query parameters
 * @param retries - Number of retry attempts
 */
/**
 * Execute multiple queries within a transaction using the same connection
 * This ensures ACID compliance for complex operations
 *
 * @param authContext - Authentication context from auth-supabase
 * @param callback - Async function that receives the client and performs queries
 */
export const executeTransaction = async (
  authContext: { userId?: string; role?: string; churchId?: number | null } | null,
  callback: (client: PoolClient) => Promise<void>
): Promise<void> => {
  const poolRef = createConnection();
  const client = await Promise.race([
    poolRef.connect(),
    new Promise<PoolClient>((_, reject) => {
      setTimeout(() => reject(new Error('Pool connect timeout')), 15000);
    })
  ]);

  try {
    // Set RLS context once for the entire transaction (batched for performance)
    if (authContext) {
      await client.query(
        `SELECT
          set_config('app.current_user_id', $1, true),
          set_config('app.current_user_role', $2, true),
          set_config('app.current_user_church_id', $3, true)`,
        [
          authContext.userId || '00000000-0000-0000-0000-000000000000',
          authContext.role || '',
          String(authContext.churchId || 0)
        ]
      );
    }

    // Start transaction
    await client.query('BEGIN');

    // Execute the callback with the same client
    await callback(client);

    // Commit transaction
    await client.query('COMMIT');
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Clear context before releasing connection (batched for performance)
    if (authContext) {
      await client.query(
        `SELECT
          set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true),
          set_config('app.current_user_role', '', true),
          set_config('app.current_user_church_id', '0', true)`
      );
    }
    client.release();
  }
};

export const executeWithContext = async <T extends QueryResultRow = QueryResultRow>(
  authContext: { userId?: string; role?: string; churchId?: number | null } | null,
  statement: Statement,
  params?: unknown,
  retries = 3
): Promise<QueryResult<T>> => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      if (shouldRecreatePool()) {
        await destroyPool();
      }

      const poolRef = createConnection();
      const client = await Promise.race([
        poolRef.connect(),
        new Promise<PoolClient>((_, reject) => {
          setTimeout(() => reject(new Error('Pool connect timeout')), 15000);
        })
      ]);

      const { text, params: boundParams } = normalizeStatement(statement, params);

      try {
        // Set RLS context BEFORE executing the query (batched for performance)
        if (authContext) {
          await client.query(
            `SELECT
              set_config('app.current_user_id', $1, true),
              set_config('app.current_user_role', $2, true),
              set_config('app.current_user_church_id', $3, true)`,
            [
              authContext.userId || '00000000-0000-0000-0000-000000000000',
              authContext.role || '',
              String(authContext.churchId || 0)
            ]
          );
        }

        return await Promise.race([
          client.query<T>(text, boundParams),
          new Promise<QueryResult<T>>((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout')), 30000);
          })
        ]);
      } finally {
        // Clear context before releasing connection (batched for performance)
        if (authContext) {
          await client.query(
            `SELECT
              set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true),
              set_config('app.current_user_role', '', true),
              set_config('app.current_user_church_id', '0', true)`
          );
        }
        client.release();
      }
    } catch (error) {
      consecutiveErrors += 1;

      if (attempt === retries) {
        await destroyPool();
        throw error;
      }

      if (isConnectionError(error) || (error as { message?: string }).message?.includes('timeout')) {
        await destroyPool();
      }

      const baseDelay = attempt * 1000;
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, 3000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable execute retry loop');
};

export const batch = async (statements: Statement[]): Promise<QueryResult[]> => {
  const results: QueryResult[] = [];
  for (const statement of statements) {
    const result = await execute(statement);
    results.push(result);
  }
  return results;
};

export const initDatabase = async (): Promise<void> => {
  console.log('✅ Using Supabase Postgres - migrations managed via scripts');
};

if (process.env.VERCEL) {
  setInterval(() => {
    if (pool && pool.totalCount === 0 && pool.idleCount === 0) {
      void destroyPool();
    }
  }, 60000);
}

process.on('SIGTERM', () => {
  void destroyPool().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  void destroyPool().then(() => process.exit(0));
});

export const getPoolStats = () => ({
  total: pool?.totalCount ?? 0,
  idle: pool?.idleCount ?? 0,
  waiting: pool?.waitingCount ?? 0,
  age: poolCreatedAt ? Date.now() - poolCreatedAt : 0,
  errors: consecutiveErrors,
  exists: Boolean(pool)
});
