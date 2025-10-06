# Troubleshooting Guide - IPU PY Tesorería

Comprehensive debug guide for common issues encountered during development and deployment.

**Target Audience**: Developers debugging errors and unexpected behavior.

---

## Table of Contents

1. [TypeScript Compilation Errors](#typescript-compilation-errors)
2. [Database Connection Issues](#database-connection-issues)
3. [RLS Access Denied Errors](#rls-access-denied-errors)
4. [Authentication Problems](#authentication-problems)
5. [Build and Deployment Failures](#build-and-deployment-failures)
6. [Runtime Errors](#runtime-errors)
7. [Pre-Commit Hook Failures](#pre-commit-hook-failures)
8. [Performance Issues](#performance-issues)
9. [Environment Variable Issues](#environment-variable-issues)
10. [API Route Errors](#api-route-errors)

---

## TypeScript Compilation Errors

### Error: `noUncheckedIndexedAccess` - Object is possibly 'undefined'

**Symptom**:
```typescript
const first = array[0];
// Error: Object is possibly 'undefined'

const value = obj['key'];
// Error: Element implicitly has an 'any' type
```

**Root Cause**: TypeScript cannot guarantee array/object access will succeed

**Fix**:

```typescript
// Option 1: Use nullish coalescing
const first = array[0] ?? null;
const value = obj['key'] ?? defaultValue;

// Option 2: Check before accessing
if (array.length > 0) {
  const first = array[0]; // Safe
}

if ('key' in obj) {
  const value = obj['key']; // Safe
}

// Option 3: Optional chaining
const first = array[0]?.property;
```

**Prevention**:
- Always handle potential `undefined` values
- Check array length before accessing indices
- Use optional chaining for nested access

---

### Error: `exactOptionalPropertyTypes` - Type 'undefined' not assignable

**Symptom**:
```typescript
<Component optional={undefined} />
// Error: Type 'undefined' is not assignable to type 'string | null'
```

**Root Cause**: `exactOptionalPropertyTypes` prevents explicit `undefined` assignment

**Fix**:

```typescript
// Option 1: Don't pass the prop
<Component />

// Option 2: Explicitly allow undefined in type
type Props = {
  optional?: string | undefined;
};

// Option 3: Use null instead
<Component optional={value ?? null} />

// Option 4: Conditional rendering
{value && <Component optional={value} />}
```

**Prevention**:
- Use optional props without explicit `undefined`
- Use `null` for explicit "no value"
- Design APIs that don't require explicit undefined

---

### Error: `noPropertyAccessFromIndexSignature` - Must use bracket notation

**Symptom**:
```typescript
const value = obj.dynamicProperty;
// Error: Property 'dynamicProperty' comes from index signature
```

**Root Cause**: TypeScript detects property from index signature, not explicit type

**Fix**:

```typescript
// Option 1: Use bracket notation
const value = obj['dynamicProperty'];

// Option 2: Define explicit type (preferred)
type MyObject = {
  dynamicProperty: string;
  anotherProp: number;
};
const obj: MyObject = getObject();
const value = obj.dynamicProperty; // Now works

// Option 3: Type assertion (use cautiously)
const value = (obj as { dynamicProperty: string }).dynamicProperty;
```

**Prevention**:
- Define explicit types for objects
- Use bracket notation for truly dynamic access
- Avoid index signatures when possible

---

### Error: Missing Return Type on Exported Function

**Symptom**:
```typescript
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}
// Warning: Missing return type annotation
```

**Root Cause**: ESLint rule requires explicit return types on exported functions

**Fix**:

```typescript
// Add explicit return type
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

// For async functions
export async function fetchData(id: string): Promise<Data | null> {
  const response = await fetch(`/api/data/${id}`);
  return response.json();
}

// For void functions
export function logMessage(message: string): void {
  console.log(message);
}
```

**Prevention**:
- Always add return types to exported functions
- Use TypeScript's type inference for internal functions only
- Enable ESLint rule: `@typescript-eslint/explicit-module-boundary-types`

---

### Error: useState Without Generic Type

**Symptom**:
```typescript
const [user, setUser] = useState(null);
// Type inferred as: never
```

**Root Cause**: TypeScript infers literal type from initial value

**Fix**:

```typescript
// Always provide generic type
const [user, setUser] = useState<User | null>(null);
const [items, setItems] = useState<Item[]>([]);
const [loading, setLoading] = useState<boolean>(false);

// For complex initial state
const [state, setState] = useState<{
  data: Data | null;
  loading: boolean;
  error: Error | null;
}>({
  data: null,
  loading: false,
  error: null,
});
```

**Prevention**:
- Never call `useState` without generic type
- Add ESLint rule to enforce this
- Review all useState calls in code review

---

### Debugging TypeScript Errors

```bash
# Run type checker
npm run typecheck

# Watch mode for continuous checking
npm run typecheck:watch

# Get detailed error information
npx tsc --noEmit --pretty --incremental false

# Check specific file
npx tsc --noEmit src/path/to/file.ts
```

**Common Commands**:

```bash
# Find all type errors in project
npm run typecheck 2>&1 | grep "error TS"

# Count type errors
npm run typecheck 2>&1 | grep -c "error TS"

# Filter specific error code
npm run typecheck 2>&1 | grep "TS2339" # Property does not exist
```

---

## Database Connection Issues

### Error: Connection Timeout on Vercel

**Symptom**:
```
Error: Connection terminated unexpectedly
Error: timeout exceeded when trying to connect
```

**Root Cause**: Vercel serverless functions have 10-15s execution limit, direct PostgreSQL connections can timeout

**Fix**:

```bash
# Use connection pooler (pgBouncer) on port 6543
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres

# NOT port 5432 (direct connection)
```

**Update Environment Variables**:

1. Vercel Dashboard → Settings → Environment Variables
2. Update `DATABASE_URL` to use port `:6543`
3. Redeploy: `vercel --prod --force`

**Testing**:

```bash
# Test connection locally
psql "postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres" -c "SELECT 1"
# Should return: 1
```

**Prevention**:
- Always use connection pooler for serverless
- Port 5432: Local development only
- Port 6543: Production (Vercel, serverless)

---

### Error: Too Many Connections

**Symptom**:
```
Error: remaining connection slots are reserved for non-replication superuser connections
FATAL: sorry, too many clients already
```

**Root Cause**: Connection pool exhausted, connections not being released

**Fix**:

```typescript
// Ensure executeWithContext releases connections
import { executeWithContext } from '@/lib/db-admin';

// ✅ Correct - connection auto-released
const result = await executeWithContext(auth, async (client) => {
  return await client.query('SELECT * FROM table');
});

// ❌ Wrong - connection leaked
const client = await pool.connect();
const result = await client.query('SELECT * FROM table');
// Missing: client.release()
```

**Check Active Connections**:

```sql
-- Show active connections
SELECT
  COUNT(*) as active_connections,
  state,
  wait_event_type
FROM pg_stat_activity
WHERE datname = 'postgres'
GROUP BY state, wait_event_type;

-- Kill idle connections (if needed)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'postgres'
AND state = 'idle'
AND state_change < NOW() - INTERVAL '5 minutes';
```

**Prevention**:
- Always use `executeWithContext()` wrapper
- Never call `pool.connect()` directly
- Monitor connection pool usage

---

### Error: SSL Connection Required

**Symptom**:
```
Error: no pg_hba.conf entry for host
Error: connection requires SSL
```

**Root Cause**: Supabase requires SSL connections

**Fix**:

```typescript
// Add SSL mode to connection string
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres?sslmode=require

// Or in pool config
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
});
```

**Prevention**:
- Always include SSL in production connection strings
- Use environment variables for connection config

---

## RLS Access Denied Errors

### Error: Permission Denied for Table

**Symptom**:
```
Error: permission denied for table monthly_reports
```

**Root Cause**: RLS context not set before query execution

**Diagnosis**:

```sql
-- Check if RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'monthly_reports';
-- Output: rowsecurity = true

-- Check current context
SELECT
  current_setting('app.current_user_id', true) as user_id,
  current_setting('app.current_user_role', true) as role,
  current_setting('app.current_user_church_id', true) as church_id;
-- If all empty, context not set
```

**Fix**:

```typescript
// Always use executeWithContext wrapper
import { executeWithContext } from '@/lib/db-admin';

// ❌ Wrong - no context
const result = await pool.query('SELECT * FROM monthly_reports');

// ✅ Correct - sets RLS context
const result = await executeWithContext(auth, async (client) => {
  return await client.query('SELECT * FROM monthly_reports');
});
```

**Verification**:

```typescript
// Add logging to verify context
console.log('Auth context:', {
  userId: auth.userId,
  role: auth.role,
  churchId: auth.churchId,
});
```

**Prevention**:
- Never query database without `executeWithContext()`
- Always pass auth context to database functions
- Add tests to verify RLS enforcement

---

### Error: Empty Result Set (Data Exists)

**Symptom**: Query returns no rows, but data visible in Supabase Studio

**Root Cause**: RLS policy blocking access based on context

**Diagnosis**:

```sql
-- Test query with specific context
SELECT set_config('app.current_user_id', 'test-uuid', false);
SELECT set_config('app.current_user_role', 'treasurer', false);
SELECT set_config('app.current_user_church_id', '1', false);

-- Run failing query
SELECT * FROM monthly_reports WHERE church_id = 1;
-- If still empty, check policy logic

-- Try as admin (should always work)
SELECT set_config('app.current_user_role', 'admin', false);
SELECT * FROM monthly_reports;
-- If works as admin, policy is restricting access
```

**Check Policy Logic**:

```sql
-- View active policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'monthly_reports';

-- Check if user meets policy conditions
SELECT app_current_user_role() = 'admin'; -- Should be true/false
SELECT app_user_owns_church(1); -- Should be true/false
```

**Fix**:

```typescript
// Verify auth context matches query
const auth = await getAuthContext(request);
console.log('User church:', auth.churchId);
console.log('Query church:', requestedChurchId);

// Ensure church_id matches user's assigned church
if (auth.role !== 'admin' && auth.churchId !== requestedChurchId) {
  return NextResponse.json(
    { error: 'No tienes acceso a esta iglesia' },
    { status: 403 }
  );
}
```

**Prevention**:
- Test RLS policies with different roles in SQL Editor
- Log auth context in API routes during development
- Add integration tests for each role

---

### Error: Fund Director Cannot Access Assigned Funds

**Symptom**: Fund director user cannot see fund transactions despite assignment

**Diagnosis**:

```sql
-- Check assignment exists
SELECT * FROM fund_director_assignments
WHERE profile_id = '[fund-director-uuid]';
-- Should return at least one row

-- Check helper function
SELECT set_config('app.current_user_id', '[fund-director-uuid]', false);
SELECT set_config('app.current_user_role', 'fund_director', false);

SELECT app_user_has_fund_access(1);
-- Should return: true if assigned to fund_id = 1
```

**Fix**:

```sql
-- Create assignment if missing
INSERT INTO fund_director_assignments (profile_id, fund_id, assigned_by, created_at)
VALUES ('[fund-director-uuid]', 1, 'admin-uuid', NOW());

-- Verify assignment
SELECT * FROM fund_director_assignments WHERE profile_id = '[fund-director-uuid]';
```

**Application Fix**:

```typescript
// Ensure fund director context includes assigned funds
const auth = await getAuthContext(request);

if (auth.role === 'fund_director') {
  console.log('Assigned funds:', auth.assignedFunds);
  // Should be array of fund IDs: [1, 2, 3]

  if (!auth.assignedFunds?.includes(requestedFundId)) {
    return NextResponse.json(
      { error: 'No tienes acceso a este fondo' },
      { status: 403 }
    );
  }
}
```

**Prevention**:
- Create assignments when assigning fund_director role
- Verify assignments in auth context loading
- Add UI to show assigned funds

---

## Authentication Problems

### Error: OAuth Redirect URI Mismatch

**Symptom**:
```
Error: redirect_uri_mismatch
The redirect URI in the request: http://localhost:3000/auth/callback
does not match the ones authorized for the OAuth client
```

**Root Cause**: OAuth client not configured with local development URL

**Fix**:

1. **Google Cloud Console** → APIs & Services → Credentials
2. Select OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/api/auth/callback`
   - `https://ipupytesoreria.vercel.app/auth/callback`
4. Save changes
5. Wait ~5 minutes for changes to propagate
6. Try authentication again

**Testing**:

```bash
# Check OAuth config
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=[CLIENT_ID]" \
  -d "client_secret=[CLIENT_SECRET]" \
  -d "redirect_uri=http://localhost:3000/auth/callback" \
  -d "grant_type=authorization_code" \
  -d "code=test"
# Should not return redirect_uri_mismatch
```

**Prevention**:
- Add all environment URLs to OAuth config
- Document OAuth setup in README
- Use environment-specific OAuth clients

---

### Error: Domain Not Allowed (@ipupy.org.py)

**Symptom**: User with non-@ipupy.org.py email cannot log in

**Root Cause**: Domain restriction enforced in auth code

**Expected Behavior**: This is intentional security feature

**Diagnosis**:

```typescript
// Check domain restriction logic
// src/lib/auth-supabase.ts

const allowedDomain = '@ipupy.org.py';
const userEmail = user.email?.toLowerCase() || '';

if (!userEmail.endsWith(allowedDomain)) {
  // User rejected
  await supabase.auth.signOut();
  return null;
}
```

**Bypass (Development Only)**:

```typescript
// TEMPORARY - for local testing only
const allowedDomains = ['@ipupy.org.py', '@gmail.com']; // Add test domain
const userEmail = user.email?.toLowerCase() || '';

if (!allowedDomains.some(domain => userEmail.endsWith(domain))) {
  await supabase.auth.signOut();
  return null;
}

// IMPORTANT: Remove before deploying to production!
```

**Production Solution**:
- Request test account: administracion@ipupy.org.py
- Create user directly in Supabase: Dashboard → Authentication → Users
- Use magic link instead of Google OAuth

---

### Error: Session Cookie Not Set

**Symptom**: User authenticates but session not persisted, redirected back to login

**Root Cause**: Cookie settings incompatible with browser/domain

**Diagnosis**:

```typescript
// Check cookie settings
// Browser DevTools → Application → Cookies
// Look for: sb-[project-ref]-auth-token

// If missing, check:
// 1. SameSite policy
// 2. Secure flag
// 3. Domain restrictions
```

**Fix**:

```typescript
// src/lib/supabase/server.ts

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              sameSite: 'lax', // Important for OAuth
              secure: process.env['NODE_ENV'] === 'production',
            })
          );
        },
      },
    }
  );
};
```

**Testing**:

```bash
# Check cookies in browser
# DevTools → Application → Cookies → http://localhost:3000
# Should see: sb-[project-ref]-auth-token

# Verify cookie value
# Should be JWT token starting with: eyJhbGciOiJ...
```

**Prevention**:
- Use correct SameSite policy for OAuth
- Test cookies in different browsers
- Check browser privacy settings

---

## Build and Deployment Failures

### Error: Build Fails with Environment Variable Missing

**Symptom**:
```
Error: NEXT_PUBLIC_SUPABASE_URL is required
Build failed
```

**Root Cause**: Environment variables not set in Vercel

**Fix**:

1. **Vercel Dashboard** → Project → Settings → Environment Variables
2. Add missing variables for each environment:
   - Production
   - Preview (optional)
   - Development (optional)
3. Redeploy: `vercel --prod --force`

**Verify Locally**:

```bash
# Check .env.local
cat .env.local | grep NEXT_PUBLIC_SUPABASE_URL
# Should output: NEXT_PUBLIC_SUPABASE_URL=https://...

# Test build locally
npm run build
# Should complete without errors
```

**Debugging**:

```typescript
// Add env validation at build time
// src/lib/env-validation.ts

if (!process.env['NEXT_PUBLIC_SUPABASE_URL']) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is required');
  process.exit(1);
}
```

**Prevention**:
- Use `.env.example` as checklist
- Add env validation in CI/CD
- Document all required variables

---

### Error: TypeScript Build Errors

**Symptom**:
```
Type error: Property 'X' does not exist on type 'Y'
Build failed
```

**Root Cause**: TypeScript strict mode errors not caught in development

**Fix**:

```bash
# Run type check locally
npm run typecheck

# Fix all type errors
# Follow patterns in [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md)

# Verify build succeeds
npm run build
```

**Common Build Errors**:

1. **Missing return types**:
```typescript
// Add explicit return types to exported functions
export function getData(): Promise<Data[]> {
  // ...
}
```

2. **useState without generic**:
```typescript
// Add generic type parameter
const [data, setData] = useState<Data[]>([]);
```

3. **Unhandled undefined**:
```typescript
// Handle potential undefined
const item = items[0] ?? null;
```

**Prevention**:
- Run `npm run typecheck` before committing
- Enable pre-commit hooks (Husky)
- Fix type errors immediately, don't accumulate

---

### Error: Vercel Deployment Timeout

**Symptom**:
```
Error: Build exceeded maximum duration of 45 minutes
Deployment failed
```

**Root Cause**: Build process hanging or very slow

**Diagnosis**:

```bash
# Check build time locally
time npm run build
# Should complete in < 2 minutes

# Check for hanging processes
ps aux | grep node

# Check for infinite loops in build scripts
cat package.json | grep scripts
```

**Fix**:

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules
npm install

# Rebuild
npm run build
```

**Optimize Build**:

```javascript
// next.config.ts

export default {
  typescript: {
    // Skip type checking in build (do it in CI separately)
    ignoreBuildErrors: false,
  },
  eslint: {
    // Skip linting in build (do it in CI separately)
    ignoreDuringBuilds: false,
  },
  // Enable SWC minification
  swcMinify: true,
};
```

**Prevention**:
- Monitor build times in Vercel dashboard
- Optimize dependencies (remove unused)
- Use build caching

---

## Runtime Errors

### Error: process.stdout in Browser

**Symptom**:
```
TypeError: Cannot read properties of undefined (reading 'write')
process.stdout.write is not a function
```

**Root Cause**: Server-only code running in browser

**Diagnosis**:

```typescript
// Check if code runs in browser
console.log('Environment:', typeof window);
// Output: 'undefined' in Node.js, 'object' in browser
```

**Fix**:

```typescript
// Add proper environment check
if (typeof window === 'undefined' && typeof process.stdout !== 'undefined') {
  process.stdout.write('Server-only code\n');
}

// Or use logger utility
import { logger } from '@/lib/logger';
logger.info('Message'); // Handles environment automatically
```

**Logger Implementation**:

```typescript
// src/lib/logger.ts

export const logger = {
  info: (message: string) => {
    if (typeof window === 'undefined' && process.stdout) {
      process.stdout.write(`${message}\n`);
    } else {
      console.log(message);
    }
  },
};
```

**Prevention**:
- Use logger utility instead of direct process.stdout
- Add 'use client' directive to client components
- Check environment before using Node.js APIs

---

### Error: Hydration Mismatch

**Symptom**:
```
Error: Hydration failed because the initial UI does not match what was rendered on the server
Warning: Text content did not match. Server: "X" Client: "Y"
```

**Root Cause**: Server-rendered HTML differs from client-rendered HTML

**Common Causes**:

1. **Date/Time Formatting**:
```typescript
// ❌ Wrong - uses local timezone
<div>{new Date().toLocaleDateString()}</div>

// ✅ Correct - consistent formatting
<div>{formatDate(date, 'yyyy-MM-dd')}</div>
```

2. **Random Values**:
```typescript
// ❌ Wrong - generates different value on server/client
<div>{Math.random()}</div>

// ✅ Correct - use useEffect for client-only values
const [random, setRandom] = useState<number | null>(null);
useEffect(() => {
  setRandom(Math.random());
}, []);
```

3. **Browser-Only APIs**:
```typescript
// ❌ Wrong - localStorage not available on server
const stored = localStorage.getItem('key');

// ✅ Correct - check environment
const [stored, setStored] = useState<string | null>(null);
useEffect(() => {
  setStored(localStorage.getItem('key'));
}, []);
```

**Fix**:

```typescript
// Use client-only rendering for problematic components
'use client';

import { useEffect, useState } from 'react';

export function ClientOnlyComponent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Or loading skeleton
  }

  return <div>{/* Client-only content */}</div>;
}
```

**Prevention**:
- Avoid Date objects in server components
- Use ISO 8601 format for dates
- Test with server-side rendering enabled

---

### Error: TanStack Query Not Working

**Symptom**: Query hooks return `undefined` or don't refetch

**Root Cause**: QueryClient provider missing or misconfigured

**Diagnosis**:

```typescript
// Check if provider exists
// src/app/layout.tsx

import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers> {/* Required */}
      </body>
    </html>
  );
}
```

**Fix**:

```typescript
// Ensure QueryClientProvider wraps app
// src/app/providers.tsx

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Testing**:

```typescript
// Add React Query DevTools (development only)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env['NODE_ENV'] === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

**Prevention**:
- Always wrap app in QueryClientProvider
- Use DevTools to debug query state
- Check query keys are consistent

---

## Pre-Commit Hook Failures

### Error: Pre-Commit Hook Blocks Commit

**Symptom**:
```
husky - pre-commit hook failed
npm run typecheck failed
```

**Root Cause**: TypeScript or ESLint errors exist

**Fix**:

```bash
# Run validation manually
npm run validate

# Output shows specific errors:
# TypeScript: 3 errors
# ESLint: 5 warnings

# Fix TypeScript errors
npm run typecheck
# Fix each error following [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md)

# Fix ESLint warnings
npm run lint --fix

# Retry commit
git commit -m "fix: resolve type errors"
```

**Bypass Hook (Emergency Only)**:

```bash
# Skip pre-commit hook (use sparingly!)
git commit --no-verify -m "emergency fix"

# IMPORTANT: Fix issues in next commit
```

**Debugging Hook**:

```bash
# Check hook exists
ls -la .husky/
# Should show: pre-commit

# View hook contents
cat .husky/pre-commit

# Test hook manually
npm run validate
```

**Prevention**:
- Run `npm run validate` before committing
- Fix errors immediately, don't accumulate
- Use IDE integration for real-time feedback

---

### Error: Lint-Staged Fails

**Symptom**:
```
husky - pre-commit hook failed
✖ eslint --fix --max-warnings 0 failed
```

**Root Cause**: Linting errors in staged files

**Fix**:

```bash
# Check which files are staged
git status

# Run lint on specific file
npx eslint src/path/to/file.ts --fix

# Check remaining issues
npx eslint src/path/to/file.ts --max-warnings 0

# Fix manually and retry commit
git add src/path/to/file.ts
git commit -m "fix: resolve linting issues"
```

**Common Lint Errors**:

1. **Unused variables**:
```typescript
// Remove or prefix with underscore
const _unused = value; // Tells ESLint it's intentionally unused
```

2. **Missing return types**:
```typescript
// Add explicit return type
export function getData(): Promise<Data[]> {
  // ...
}
```

3. **Console statements**:
```typescript
// Remove console.log from production code
// Or use logger utility
import { logger } from '@/lib/logger';
logger.info('Message');
```

**Prevention**:
- Enable ESLint in IDE (VS Code extension)
- Run `npm run lint` regularly
- Fix linting issues as you code

---

## Performance Issues

### Issue: Slow Database Queries

**Symptom**: API requests take > 2 seconds to respond

**Diagnosis**:

```sql
-- Check slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
AND tablename IN ('monthly_reports', 'fund_transactions')
ORDER BY n_distinct DESC;
```

**Fix - Add Indexes**:

```sql
-- Create index on frequently queried columns
CREATE INDEX CONCURRENTLY idx_reports_church_year_month
ON monthly_reports(church_id, year, month);

-- Create index on foreign keys
CREATE INDEX CONCURRENTLY idx_transactions_fund_id
ON fund_transactions(fund_id);

-- Create partial index for active records
CREATE INDEX CONCURRENTLY idx_churches_active
ON churches(name) WHERE active = true;
```

**Fix - Optimize Query**:

```typescript
// ❌ Slow - N+1 query problem
const churches = await getChurches();
for (const church of churches) {
  const reports = await getReports(church.id);
}

// ✅ Fast - single query with JOIN
const churchesWithReports = await executeWithContext(auth, async (client) => {
  return await client.query(`
    SELECT
      c.*,
      json_agg(r.*) as reports
    FROM churches c
    LEFT JOIN monthly_reports r ON r.church_id = c.id
    GROUP BY c.id
  `);
});
```

**Prevention**:
- Add indexes on foreign keys
- Use JOINs instead of multiple queries
- Monitor query performance in production

---

### Issue: Large Bundle Size

**Symptom**: Initial page load > 5 seconds

**Diagnosis**:

```bash
# Analyze bundle size
npm run build

# Output shows route sizes:
# Route (app)                    Size     First Load JS
# ├ ○ /                         5.2 kB         120 kB
# ├ ○ /churches                 8.4 kB         135 kB  ⚠️

# Check for large dependencies
npx webpack-bundle-analyzer .next/analyze/client.json
```

**Fix - Code Splitting**:

```typescript
// Use dynamic imports for large components
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false, // Optional: disable SSR for this component
});

export default function Page() {
  return <HeavyComponent />;
}
```

**Fix - Remove Unused Dependencies**:

```bash
# Find unused dependencies
npx depcheck

# Remove unused packages
npm uninstall unused-package-1 unused-package-2

# Rebuild
npm run build
```

**Prevention**:
- Use dynamic imports for heavy components
- Remove unused dependencies regularly
- Monitor bundle size in CI/CD

---

## Environment Variable Issues

### Error: NEXT_PUBLIC_* Variable Not Defined

**Symptom**:
```
Error: NEXT_PUBLIC_SUPABASE_URL is undefined
```

**Root Cause**: Environment variable not loaded or incorrect prefix

**Diagnosis**:

```bash
# Check variable exists
cat .env.local | grep NEXT_PUBLIC_SUPABASE_URL

# Check it's in .env.example
cat .env.example | grep NEXT_PUBLIC_SUPABASE_URL

# Verify Next.js loaded it
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

**Fix**:

```bash
# Ensure variable has NEXT_PUBLIC_ prefix
NEXT_PUBLIC_SUPABASE_URL=https://... # ✅ Correct
SUPABASE_URL=https://...             # ❌ Wrong (not public)

# Restart dev server after adding variables
npm run dev
```

**Inline Access Pattern** (Required for NEXT_PUBLIC_ vars):

```typescript
// ✅ Correct - inline access in object literal
const config = {
  url: process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
};

// ❌ Wrong - intermediate variable breaks Next.js replacement
const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const config = { url };
```

**Prevention**:
- Always use `NEXT_PUBLIC_` prefix for client-side vars
- Use inline access pattern for proper replacement
- Document required variables in .env.example

---

### Error: Secret Exposed in Client Bundle

**Symptom**: API keys visible in browser console

**Root Cause**: Using `NEXT_PUBLIC_` prefix for secret value

**Fix**:

```bash
# Remove NEXT_PUBLIC_ prefix from secrets
# ❌ Wrong - exposed to browser
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=secret-key

# ✅ Correct - server-only
SUPABASE_SERVICE_ROLE_KEY=secret-key

# Update code to use server-only
// Server route only
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
```

**Check for Exposed Secrets**:

```bash
# Search for secret variables with public prefix
grep -r "NEXT_PUBLIC_.*SECRET" .env.*
grep -r "NEXT_PUBLIC_.*KEY" .env.* | grep -v "ANON"

# Should return empty (no public secrets)
```

**Prevention**:
- Never use NEXT_PUBLIC_ for secrets
- Use server-only env vars for API keys
- Review .env.example for proper prefixes

---

## API Route Errors

### Error: API Route Returns 500

**Symptom**: API request fails with 500 Internal Server Error

**Diagnosis**:

```bash
# Check Vercel logs
vercel logs https://ipupytesoreria.vercel.app --since=5m

# Or local logs
npm run dev
# Check terminal output

# Check browser Network tab
# DevTools → Network → [failed request] → Response
```

**Common Causes**:

1. **Uncaught exception**:
```typescript
// Add try-catch to all routes
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Route logic
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

2. **Missing await**:
```typescript
// ❌ Wrong - forgot await
const result = executeWithContext(auth, async (client) => {
  return client.query('SELECT * FROM table');
});

// ✅ Correct
const result = await executeWithContext(auth, async (client) => {
  return await client.query('SELECT * FROM table');
});
```

3. **Invalid JSON response**:
```typescript
// ❌ Wrong - returning undefined
return NextResponse.json(undefined);

// ✅ Correct - return valid object
return NextResponse.json({ data: null });
```

**Prevention**:
- Always use try-catch in API routes
- Use handleApiError utility
- Test API routes with curl

---

### Error: CORS Error

**Symptom**:
```
Access to fetch at 'https://api.example.com' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Root Cause**: CORS headers not set correctly

**Fix**:

```typescript
// src/app/api/example/route.ts
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request) ?? NextResponse.json({}, { status: 405 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');

  // Handle preflight
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  // Return with CORS headers
  return NextResponse.json(data, {
    headers: buildCorsHeaders(origin),
  });
}
```

**Test CORS**:

```bash
# Test OPTIONS request
curl -X OPTIONS http://localhost:3000/api/example \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Check for CORS headers in response:
# Access-Control-Allow-Origin: http://localhost:3000
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Prevention**:
- Always include OPTIONS handler
- Use CORS utilities for consistency
- Test with different origins

---

## Getting Help

### When Stuck

1. **Check this guide** - Most common issues covered
2. **Review error message** - Often contains solution hints
3. **Search documentation** - `/docs` directory
4. **Check GitHub issues** - Similar problems may exist
5. **Ask team** - Slack: #dev-ipupy-tesoreria
6. **Contact admin** - administracion@ipupy.org.py

### Reporting Bugs

Include in bug report:

- Error message (full text)
- Steps to reproduce
- Environment (local/production)
- Browser/Node.js version
- Screenshots/logs
- What you've tried

### Improving This Guide

Found a solution not documented here?

1. Update this guide with your solution
2. Submit PR with changes
3. Help future developers avoid the same issue

---

## Related Documentation

- [GETTING_STARTED.md](../development/GETTING_STARTED.md) - Setup guide
- [COMMON_TASKS.md](../development/COMMON_TASKS.md) - Development recipes
- [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md) - TypeScript patterns
- [RLS_POLICIES.md](../database/RLS_POLICIES.md) - Database security
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design

---

**Remember**: Most issues are fixable with systematic debugging. Stay calm, check logs, and follow the diagnosis steps.
