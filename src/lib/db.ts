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
  if (connectionString.includes('supabase.co:6543') || connectionString.includes('pooler.supabase.com')) {
    const url = new URL(connectionString);
    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    connectionString = url.toString();
  }

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
  if (!pool) {
    return;
  }

  try {
    await pool.end();
  } catch (error) {
    console.error('Error ending pool', error);
  }

  pool = undefined;
  poolCreatedAt = undefined;
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
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000,
      max: process.env.VERCEL ? 3 : 10,
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
          setTimeout(() => reject(new Error('Pool connect timeout')), 8000);
        })
      ]);

      const { text, params: boundParams } = normalizeStatement(statement, params);

      try {
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
