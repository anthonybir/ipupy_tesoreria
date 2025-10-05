# Migration: PostgreSQL Direct Connection → Supabase Client

**Status**: 📋 Planned
**Priority**: Medium
**Effort**: ~8-12 hours
**Date Identified**: 2025-10-05

## Problem

Currently the application uses a **hybrid database approach**:

1. ✅ **Supabase Auth** - Using `@supabase/ssr` (correct)
2. ❌ **Direct PostgreSQL** - Using `pg` library with connection pool (legacy)

This hybrid approach causes:
- **Connection timeouts** on Vercel serverless (15s timeout limit)
- **Complexity** - Two different database access patterns
- **RLS context management** - Manual `executeWithContext()` calls required
- **Connection pool issues** - Only 1 connection allowed on Vercel, causing bottlenecks

## Current Workaround (2025-10-05)

**Quick fix applied**: Changed `SUPABASE_DB_URL` from port 5432 (direct) to port 6543 (pgBouncer pooler)

This reduces timeouts but doesn't solve the architectural issue.

## Recommended Solution

**Migrate to Supabase JavaScript client exclusively** - This is the Next.js + Supabase best practice.

### Benefits

1. **No connection timeouts** - Uses Supabase's PostgREST API (HTTP)
2. **Automatic RLS** - No manual context setting needed
3. **Serverless-friendly** - No connection pools, perfect for Vercel
4. **Simpler code** - Single database access pattern
5. **TypeScript types** - Auto-generated from database schema
6. **Better performance** - Supabase's edge network + caching

### Migration Steps

#### 1. Install Dependencies (if not already present)

```bash
# Should already be installed
npm list @supabase/supabase-js @supabase/ssr
```

#### 2. Identify All pg Library Usage

Files currently using `executeWithContext` and direct SQL:

```bash
grep -r "executeWithContext\|executeTransaction" src/app/api --include="*.ts" -l
```

Expected files (~20-30):
- `src/app/api/admin/configuration/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/churches/route.ts`
- `src/app/api/reports/route.ts`
- `src/lib/db-admin.ts`
- And many more...

#### 3. Migration Pattern

**Before (Current - pg library)**:
```typescript
import { executeWithContext } from '@/lib/db';

const result = await executeWithContext(auth, `
  SELECT * FROM churches WHERE active = TRUE ORDER BY name
`);

return result.rows;
```

**After (Supabase client)**:
```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data, error } = await supabase
  .from('churches')
  .select('*')
  .eq('active', true)
  .order('name');

if (error) throw error;
return data;
```

#### 4. RLS Automatic Enforcement

**Before**: Manual context setting
```typescript
await executeWithContext(auth, 'SELECT ...');
// RLS context set manually via app.current_user_id
```

**After**: Automatic (via Supabase session)
```typescript
const supabase = await createClient();
// RLS uses authenticated user automatically
```

#### 5. Complex Queries Migration

For complex SQL queries not easily expressible in Supabase query builder:

**Option A: Database Functions**
```sql
-- Create PostgreSQL function
CREATE OR REPLACE FUNCTION get_church_summary(church_id INT)
RETURNS TABLE(...) AS $$
  -- Complex SQL here
$$ LANGUAGE sql SECURITY DEFINER;
```

```typescript
// Call from TypeScript
const { data } = await supabase.rpc('get_church_summary', { church_id: 1 });
```

**Option B: PostgREST Views**
```sql
CREATE VIEW church_summaries AS
  SELECT ... -- Complex query
```

```typescript
const { data } = await supabase.from('church_summaries').select('*');
```

#### 6. Transactions

**Before (pg)**:
```typescript
await executeTransaction(auth, async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
});
```

**After (Database functions with transactions)**:
```sql
CREATE OR REPLACE FUNCTION create_church_with_pastor(...)
RETURNS ... AS $$
BEGIN
  -- Transaction handled automatically
  INSERT INTO churches ...;
  INSERT INTO pastors ...;
  RETURN ...;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```typescript
const { data } = await supabase.rpc('create_church_with_pastor', params);
```

#### 7. Files to Remove After Migration

- `src/lib/db.ts` - Connection pool and executeWithContext
- `src/lib/db-admin.ts` - Admin database operations
- `src/lib/db-context.ts` - RLS context management
- `src/lib/db-helpers.ts` - Database helper utilities

#### 8. Environment Variables to Remove

- `SUPABASE_DB_URL` or `DATABASE_URL` - No longer needed
- Keep: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

#### 9. Dependencies to Remove

```json
{
  "dependencies": {
    "pg": "^8.11.3"  // Remove this
  }
}
```

### Migration Checklist

- [ ] Audit all API routes using `executeWithContext`
- [ ] Create database functions for complex queries
- [ ] Migrate simple queries to Supabase client
- [ ] Test RLS policies work with Supabase client
- [ ] Update all API routes one by one
- [ ] Remove `pg` library and related files
- [ ] Update documentation (CLAUDE.md, README.md)
- [ ] Performance testing (should be faster)
- [ ] Remove unused environment variables

### Testing Strategy

1. **Create feature branch**: `feature/migrate-to-supabase-client`
2. **Migrate one API route at a time** (e.g., start with `/api/churches`)
3. **Test each route thoroughly** before moving to next
4. **Keep both implementations** until migration complete
5. **Deploy to preview environment** first
6. **Monitor Vercel logs** for errors
7. **Full production testing** before removing pg library

### Estimated Timeline

- **Preparation**: 1 hour (audit, create database functions)
- **Migration**: 6-8 hours (20-30 API routes)
- **Testing**: 2-3 hours (comprehensive testing)
- **Cleanup**: 1 hour (remove old code, update docs)

**Total**: ~10-12 hours

### Resources

- [Supabase Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [PostgREST API Reference](https://postgrest.org/en/stable/api.html)
- [Supabase TypeScript Support](https://supabase.com/docs/guides/api/generating-types)

### Notes

- This migration aligns with **Next.js + Supabase best practices**
- Eliminates connection pool issues entirely
- Makes the codebase more maintainable
- Better suited for Vercel serverless architecture
- RLS enforcement becomes simpler and more reliable

---

**Created**: 2025-10-05
**Author**: Claude Code
**Related Issue**: Configuration page timeouts (#issue-number-here)
