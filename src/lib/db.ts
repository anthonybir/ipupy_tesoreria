import { Pool, type PoolClient, type QueryConfig, type QueryResult, type QueryResultRow } from 'pg';
import { logger, startTimer } from '@/lib/logger';

let pool: Pool | undefined;
let poolCreatedAt: number | undefined;
let consecutiveErrors = 0;

const MAX_CONSECUTIVE_ERRORS = 3;
const POOL_MAX_AGE = 30 * 60 * 1000; // 30 minutes

// Connection monitoring
let totalConnections = 0;
let totalErrors = 0;
let totalQueries = 0;

const getConnectionString = (): string => {
  const raw = (process.env['SUPABASE_DB_URL'] || process.env['DATABASE_URL'] || '').trim();
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
  if (process.env['VERCEL']) {
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
    logger.warn('Pool recreation triggered: max consecutive errors reached', {
      consecutiveErrors,
      maxErrors: MAX_CONSECUTIVE_ERRORS,
    });
    return true;
  }

  if (poolCreatedAt && Date.now() - poolCreatedAt > POOL_MAX_AGE) {
    logger.info('Pool recreation triggered: max age reached', {
      ageMs: Date.now() - poolCreatedAt,
      maxAgeMs: POOL_MAX_AGE,
    });
    return true;
  }

  if (pool.totalCount === 0 && pool.idleCount === 0) {
    logger.warn('Pool recreation triggered: no active connections', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
    });
    return true;
  }

  return false;
};

const destroyPool = async (): Promise<void> => {
  const poolRef = pool;
  if (!poolRef) {
    return;
  }

  const stats = {
    totalCount: poolRef.totalCount,
    idleCount: poolRef.idleCount,
    waitingCount: poolRef.waitingCount,
  };

  pool = undefined;
  poolCreatedAt = undefined;

  try {
    logger.info('Destroying connection pool', stats);
    await poolRef.end();
  } catch (error) {
    logger.error('Error ending pool', error instanceof Error ? error : undefined, stats);
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
    const sslRequired = process.env['SUPABASE_SSL_DISABLED'] !== 'true';

    pool = new Pool({
      connectionString,
      ssl: sslRequired ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15000, // Increase timeout for Vercel cold starts
      idleTimeoutMillis: 10000, // Reduce idle timeout to free connections faster
      max: process.env['VERCEL'] ? 1 : 10, // Reduce connections on Vercel to avoid pool exhaustion
      allowExitOnIdle: true,
      application_name: 'ipupy-tesoreria'
    });

    pool.on('error', (err, client) => {
      totalErrors += 1;
      consecutiveErrors += 1;
      logger.error('Unexpected pool error', err, {
        totalErrors,
        consecutiveErrors,
      });

      if (client && !(client as PoolClient & { _released?: boolean })._released) {
        try {
          client.release();
        } catch (releaseError) {
          logger.warn('Client release error', {
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        }
      }
    });

    pool.on('connect', () => {
      totalConnections += 1;
      if (consecutiveErrors > 0) {
        consecutiveErrors = Math.max(0, consecutiveErrors - 1);
        logger.info('Connection established, resetting error counter', {
          totalConnections,
          consecutiveErrors,
        });
      }
    });

    pool.on('remove', () => {
      logger.debug('Client removed from pool', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
      });
    });

    poolCreatedAt = Date.now();
    consecutiveErrors = 0;

    logger.info('Database connection pool created', {
      maxConnections: pool.options.max,
      connectionTimeout: pool.options.connectionTimeoutMillis,
      idleTimeout: pool.options.idleTimeoutMillis,
      isVercel: Boolean(process.env['VERCEL']),
    });
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
export const executeTransaction = async <T = void>(
  authContext: { userId?: string | undefined; role?: string | undefined; churchId?: number | null | undefined } | null,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
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
    const result = await callback(client);

    // Commit transaction
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // Rollback on error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    throw error;
  } finally {
    // Clear context before releasing connection (batched for performance)
    if (authContext) {
      try {
        await client.query(
          `SELECT
            set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true),
            set_config('app.current_user_role', '', true),
            set_config('app.current_user_church_id', '0', true)`
        );
      } catch (clearError) {
        console.error('Error clearing RLS context:', clearError);
      }
    }
    client.release();
  }
};

export const executeWithContext = async <T extends QueryResultRow = QueryResultRow>(
  authContext: { userId?: string | undefined; role?: string | undefined; churchId?: number | null | undefined } | null,
  statement: Statement,
  params?: unknown,
  retries = 3
): Promise<QueryResult<T>> => {
  const timer = startTimer('db_query_with_context');
  totalQueries += 1;

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

        const result = await Promise.race([
          client.query<T>(text, boundParams),
          new Promise<QueryResult<T>>((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout')), 30000);
          })
        ]);

        const duration = timer.end({
          ...(authContext?.userId && { userId: authContext.userId }),
          ...(authContext?.role && { role: authContext.role }),
          rowCount: result.rowCount ?? 0,
        });

        // Log slow queries
        if (duration > 1000) {
          logger.warn('Slow query detected', {
            duration,
            rowCount: result.rowCount ?? 0,
            query: text.substring(0, 100),
          });
        }

        return result;
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
      totalErrors += 1;

      logger.error(
        `Query failed (attempt ${attempt}/${retries})`,
        error instanceof Error ? error : undefined,
        {
          ...(authContext?.userId && { userId: authContext.userId }),
          ...(authContext?.role && { role: authContext.role }),
          consecutiveErrors,
          totalErrors,
        }
      );

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
  logger.info('✅ Using Supabase Postgres - migrations managed via scripts');
};

if (process.env['VERCEL']) {
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
  age_ms: poolCreatedAt ? Date.now() - poolCreatedAt : 0,
  errors: consecutiveErrors,
  exists: Boolean(pool),
  totalConnections,
  totalErrors,
  totalQueries,
});

/**
 * Log current pool health status
 */
export const logPoolHealth = (): void => {
  const stats = getPoolStats();
  const utilizationPercent = stats.total > 0 ? (stats.total - stats.idle) / stats.total * 100 : 0;

  const level = utilizationPercent > 80 ? 'warn' : 'debug';

  logger[level]('Connection pool health check', {
    ...stats,
    utilizationPercent: utilizationPercent.toFixed(1),
  });
};
