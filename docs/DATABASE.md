# Database Layer Documentation

## Overview

The IPU PY Treasury system uses a sophisticated database layer built on PostgreSQL with Supabase, featuring advanced connection pooling, Row Level Security (RLS), transaction support, and robust error handling.

## Architecture

The database layer (`src/lib/db.ts`) provides three main execution patterns:

1. **Basic Execution** (`execute`) - Simple queries without RLS context
2. **Context-Aware Execution** (`executeWithContext`) - Queries with RLS context
3. **Transaction Execution** (`executeTransaction`) - ACID-compliant transactions

## Connection Management

### Connection Pool Configuration

```typescript
const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: sslRequired ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,    // Increased for Vercel cold starts
  idleTimeoutMillis: 10000,          // Faster connection cleanup
  max: process.env.VERCEL ? 1 : 10,  // Limited connections on Vercel
  allowExitOnIdle: true,
  application_name: 'ipupy-tesoreria'
});
```

### Connection String Optimization

```typescript
const getConnectionString = (): string => {
  let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  const url = new URL(connectionString);

  // Force pooler mode for Vercel deployments
  if (process.env.VERCEL) {
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '0');
  }

  return url.toString();
};
```

### Pool Health Management

```typescript
const shouldRecreatePool = (): boolean => {
  if (!pool) return false;

  // Recreate on consecutive errors
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) return true;

  // Recreate on age limit
  if (poolCreatedAt && Date.now() - poolCreatedAt > POOL_MAX_AGE) return true;

  // Recreate if no active connections
  if (pool.totalCount === 0 && pool.idleCount === 0) return true;

  return false;
};
```

## Row Level Security (RLS)

### RLS Context Configuration

The system implements comprehensive RLS by setting PostgreSQL configuration variables before each query:

```typescript
// Set RLS context before query execution
if (authContext) {
  await client.query("SELECT set_config('app.current_user_id', $1, true)",
    [authContext.userId || '00000000-0000-0000-0000-000000000000']);
  await client.query("SELECT set_config('app.current_user_role', $1, true)",
    [authContext.role || '']);  // Empty string for unauthenticated users
  await client.query("SELECT set_config('app.current_user_church_id', $1, true)",
    [String(authContext.churchId || 0)]);
}
```

### RLS Helper Functions

PostgreSQL functions that read the context variables:

```sql
-- Get current user ID from context
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), ''),
    '00000000-0000-0000-0000-000000000000'
  )::UUID;
$$;

-- Get current user role from context
CREATE OR REPLACE FUNCTION app_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(current_setting('app.current_user_role', true), '');
$$;

-- Get current user church ID from context
CREATE OR REPLACE FUNCTION app_current_user_church_id()
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_church_id', true), ''),
    '0'
  )::BIGINT;
$$;
```

### RLS Security Fallback

```typescript
// SECURITY FIX: Use empty string instead of 'member' for unauthenticated users
// This prevents privilege escalation where unauthenticated users could gain member access
await client.query("SELECT set_config('app.current_user_role', $1, true)",
  [authContext.role || '']);  // Empty string = no access
```

## Database Execution Methods

### 1. Basic Execution

For queries that don't require RLS context (system-level queries):

```typescript
export const execute = async <T extends QueryResultRow = QueryResultRow>(
  statement: Statement,
  params?: unknown,
  retries = 3
): Promise<QueryResult<T>> => {
  // ... connection management and retry logic
  return await client.query<T>(text, boundParams);
};

// Usage example
const systemStats = await execute(
  'SELECT COUNT(*) as total_users FROM profiles'
);
```

**⚠️ Security Warning**: This method bypasses RLS. Use only for system-level queries.

### 2. Context-Aware Execution

For queries that require user context and RLS enforcement:

```typescript
export const executeWithContext = async <T extends QueryResultRow = QueryResultRow>(
  authContext: { userId?: string; role?: string; churchId?: number | null } | null,
  statement: Statement,
  params?: unknown,
  retries = 3
): Promise<QueryResult<T>> => {
  // Set RLS context before query
  if (authContext) {
    await client.query("SELECT set_config('app.current_user_id', $1, true)",
      [authContext.userId || '00000000-0000-0000-0000-000000000000']);
    await client.query("SELECT set_config('app.current_user_role', $1, true)",
      [authContext.role || '']);
    await client.query("SELECT set_config('app.current_user_church_id', $1, true)",
      [String(authContext.churchId || 0)]);
  }

  return await client.query<T>(text, boundParams);
};

// Usage example
const userReports = await executeWithContext(
  auth,
  'SELECT * FROM monthly_reports WHERE church_id = $1',
  [churchId]
);
```

### 3. Transaction Execution

For complex operations requiring ACID compliance:

```typescript
export const executeTransaction = async (
  authContext: { userId?: string; role?: string; churchId?: number | null } | null,
  callback: (client: PoolClient) => Promise<void>
): Promise<void> => {
  const client = await poolRef.connect();

  try {
    // Set RLS context once for entire transaction
    if (authContext) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)",
        [authContext.userId || '00000000-0000-0000-0000-000000000000']);
      await client.query("SELECT set_config('app.current_user_role', $1, true)",
        [authContext.role || '']);
      await client.query("SELECT set_config('app.current_user_church_id', $1, true)",
        [String(authContext.churchId || 0)]);
    }

    await client.query('BEGIN');
    await callback(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Clear context before releasing connection
    if (authContext) {
      await client.query("SELECT set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true)");
      await client.query("SELECT set_config('app.current_user_role', '', true)");
      await client.query("SELECT set_config('app.current_user_church_id', '0', true)");
    }
    client.release();
  }
};

// Usage example
await executeTransaction(auth, async (client) => {
  // Create report
  await client.query(`
    INSERT INTO monthly_reports (church_id, month, year, status)
    VALUES ($1, $2, $3, 'draft')
  `, [churchId, month, year]);

  // Update fund balances
  await client.query(`
    UPDATE fund_balances
    SET balance = balance + $1
    WHERE church_id = $2 AND fund_name = $3
  `, [amount, churchId, fundName]);

  // Log activity
  await client.query(`
    INSERT INTO user_activity (user_id, action, details)
    VALUES ($1, $2, $3)
  `, [userId, 'report.create', JSON.stringify({ churchId, month, year })]);
});
```

## Error Handling and Resilience

### Connection Error Detection

```typescript
const isConnectionError = (error: unknown): boolean => {
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
    err.message?.includes(msg) || err.code === msg
  );
};
```

### Retry Logic with Exponential Backoff

```typescript
for (let attempt = 1; attempt <= retries; attempt += 1) {
  try {
    // ... query execution
    return result;
  } catch (error) {
    consecutiveErrors += 1;

    if (attempt === retries) {
      await destroyPool();
      throw error;
    }

    if (isConnectionError(error)) {
      await destroyPool();
    }

    // Exponential backoff with jitter
    const baseDelay = attempt * 1000;
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, 3000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### Pool Health Monitoring

```typescript
pool.on('error', (err, client) => {
  console.error('Unexpected pool error:', err);
  consecutiveErrors += 1;

  if (client && !client._released) {
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
```

## Query Statement Normalization

The system supports multiple query formats:

```typescript
type Statement = string | QueryConfig<unknown[]> & { sql?: string; values?: unknown[] };

const normalizeStatement = (statement: Statement, maybeParams?: unknown): NormalizedStatement => {
  if (typeof statement === 'string') {
    return { text: statement, params: toArray(maybeParams) };
  }

  const config = statement;
  const resolvedText = config.text ?? config.sql;

  return { text: resolvedText, params: toArray(config.values ?? maybeParams) };
};

// Usage examples:

// String format
await executeWithContext(auth, 'SELECT * FROM reports WHERE id = $1', [reportId]);

// Object format
await executeWithContext(auth, {
  text: 'SELECT * FROM reports WHERE id = $1',
  values: [reportId]
});

// Legacy SQL property
await executeWithContext(auth, {
  sql: 'SELECT * FROM reports WHERE id = $1',
  values: [reportId]
});
```

## Performance Monitoring

### Pool Statistics

```typescript
export const getPoolStats = () => ({
  total: pool?.totalCount ?? 0,      // Total connections
  idle: pool?.idleCount ?? 0,        // Idle connections
  waiting: pool?.waitingCount ?? 0,  // Waiting requests
  age: poolCreatedAt ? Date.now() - poolCreatedAt : 0,  // Pool age
  errors: consecutiveErrors,         // Consecutive error count
  exists: Boolean(pool)              // Pool exists
});

// Usage in monitoring
app.get('/api/health/db', (req, res) => {
  const stats = getPoolStats();
  res.json({
    status: stats.errors < 3 ? 'healthy' : 'degraded',
    stats
  });
});
```

### Query Timeout Protection

```typescript
return await Promise.race([
  client.query<T>(text, boundParams),
  new Promise<QueryResult<T>>((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), 30000);
  })
]);
```

## Migration Management

### Migration Pattern

```typescript
// Migration file: migrations/024_new_feature.sql
BEGIN;

-- Create new tables
CREATE TABLE new_feature (
  id SERIAL PRIMARY KEY,
  -- ... columns
);

-- Enable RLS
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "new_feature_access" ON new_feature
  FOR ALL TO authenticated
  USING (app_user_can_access_church(church_id));

-- Update existing data
UPDATE existing_table SET new_column = default_value;

COMMIT;
```

### Database Initialization

```typescript
export const initDatabase = async (): Promise<void> => {
  console.log('✅ Using Supabase Postgres - migrations managed via scripts');
  // Migrations are managed externally via SQL files
};
```

## API Integration Patterns

### Standard API Route Pattern

```typescript
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use executeWithContext for RLS enforcement
    const result = await executeWithContext<ReportRow>(
      auth,
      'SELECT * FROM monthly_reports WHERE church_id = $1',
      [auth.churchId]
    );

    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Transaction API Route Pattern

```typescript
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const body = await req.json();

    await executeTransaction(auth, async (client) => {
      // Multiple related operations
      const reportResult = await client.query(
        'INSERT INTO monthly_reports (...) VALUES (...) RETURNING id',
        [...]
      );

      const reportId = reportResult.rows[0].id;

      await client.query(
        'INSERT INTO report_funds (...) VALUES (...)',
        [reportId, ...]
      );

      await client.query(
        'UPDATE fund_balances SET balance = balance + $1 WHERE ...',
        [...]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Transaction Error:', error);
    return NextResponse.json(
      { error: 'Transaction failed' },
      { status: 500 }
    );
  }
}
```

## Security Best Practices

### 1. Always Use RLS Context

```typescript
// ✅ CORRECT: Use executeWithContext for user queries
const userReports = await executeWithContext(
  auth,
  'SELECT * FROM monthly_reports',
  []
);

// ❌ INCORRECT: Using execute bypasses RLS
const userReports = await execute(
  'SELECT * FROM monthly_reports',
  []
);
```

### 2. Validate Authentication Context

```typescript
const auth = await getAuthContext(req);
if (!auth || !auth.userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Validate role for sensitive operations
if (auth.role !== 'admin' && operation === 'delete') {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

### 3. Use Transactions for Complex Operations

```typescript
// ✅ CORRECT: Use transaction for related operations
await executeTransaction(auth, async (client) => {
  await client.query('INSERT INTO reports ...');
  await client.query('UPDATE balances ...');
  await client.query('INSERT INTO audit_log ...');
});

// ❌ INCORRECT: Separate queries can lead to inconsistency
await executeWithContext(auth, 'INSERT INTO reports ...');
await executeWithContext(auth, 'UPDATE balances ...');
await executeWithContext(auth, 'INSERT INTO audit_log ...');
```

## Performance Optimization

### 1. Connection Pool Tuning

```typescript
// Vercel-optimized settings
max: process.env.VERCEL ? 1 : 10,  // Limit connections on serverless
connectionTimeoutMillis: 15000,     // Handle cold starts
idleTimeoutMillis: 10000,           // Release connections quickly
allowExitOnIdle: true,              // Allow pool to close
```

### 2. Query Optimization

```sql
-- Use specific indexes for common queries
CREATE INDEX CONCURRENTLY idx_monthly_reports_church_date
ON monthly_reports (church_id, year, month);

-- Use partial indexes for filtered queries
CREATE INDEX CONCURRENTLY idx_reports_pending
ON monthly_reports (church_id)
WHERE status = 'pending';
```

### 3. Batch Operations

```typescript
// ✅ CORRECT: Batch related inserts
await executeTransaction(auth, async (client) => {
  const values = funds.map((fund, i) =>
    `($1, $${i*3+2}, $${i*3+3}, $${i*3+4})`
  ).join(',');

  await client.query(`
    INSERT INTO report_funds (report_id, fund_name, amount, percentage)
    VALUES ${values}
  `, [reportId, ...funds.flat()]);
});

// ❌ INCORRECT: Multiple individual inserts
for (const fund of funds) {
  await executeWithContext(auth,
    'INSERT INTO report_funds (...) VALUES (...)',
    [reportId, fund.name, fund.amount, fund.percentage]
  );
}
```

## Troubleshooting

### Common Database Issues

**Connection Pool Exhaustion:**
```typescript
// Check pool stats
const stats = getPoolStats();
console.log('Pool stats:', stats);

// If waiting count is high, increase pool size or decrease idle timeout
```

**RLS Context Issues:**
```sql
-- Check if RLS context is set correctly
SELECT
  current_setting('app.current_user_id', true) as user_id,
  current_setting('app.current_user_role', true) as role,
  current_setting('app.current_user_church_id', true) as church_id;
```

**Transaction Deadlocks:**
```typescript
// Add retry logic for deadlock errors
if (error.code === '40P01') { // serialization_failure
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
  return executeTransaction(auth, callback); // Retry
}
```

**Query Performance:**
```sql
-- Analyze slow queries
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM monthly_reports WHERE ...;

-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;
```

## Future Enhancements

### Planned Database Improvements

1. **Read Replicas**: Separate read/write operations for better performance
2. **Query Caching**: Redis-based query result caching
3. **Connection Pooling**: pgBouncer integration for better connection management
4. **Monitoring**: Comprehensive database monitoring with alerts
5. **Backup Strategy**: Automated backup with point-in-time recovery
6. **Partitioning**: Table partitioning for large datasets (reports, transactions)

### Migration to Advanced Features

```typescript
// Future: Read replica support
export const executeRead = async <T extends QueryResultRow = QueryResultRow>(
  authContext: AuthContext,
  statement: Statement,
  params?: unknown
): Promise<QueryResult<T>> => {
  // Route to read replica for SELECT queries
  const pool = isSelectQuery(statement) ? readPool : writePool;
  // ... execution logic
};

// Future: Query caching
export const executeCached = async <T extends QueryResultRow = QueryResultRow>(
  authContext: AuthContext,
  statement: Statement,
  params?: unknown,
  cacheKey?: string
): Promise<QueryResult<T>> => {
  if (cacheKey) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const result = await executeWithContext(authContext, statement, params);

  if (cacheKey) {
    await redis.setex(cacheKey, 300, JSON.stringify(result));
  }

  return result;
};
```

This comprehensive database layer provides a robust, secure, and performant foundation for the IPU PY Treasury system, with proper RLS enforcement, transaction support, and resilient connection management.