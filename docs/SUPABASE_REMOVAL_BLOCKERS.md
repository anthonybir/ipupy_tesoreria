# Supabase Removal Blockers

**Date**: 2025-10-09
**Status**: ⚠️ **BLOCKED** - Cannot remove Supabase dependencies yet

---

## Summary

The Convex Auth migration (WS-4 Phase 6) is **complete**, but **Supabase PostgreSQL removal is blocked** because:
- Database layer still uses direct PostgreSQL connections via `pg` package
- Multiple API routes use `src/lib/db.ts` for PostgreSQL queries
- Some components still import from `src/lib/supabase/client.ts`
- Dashboard initialization route (`/api/dashboard-init`) migrated to Convex on Oct 10, 2025

---

## Active Supabase/PostgreSQL Usage

### Core Database Files (ACTIVE - DO NOT DELETE)

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/db.ts` | PostgreSQL connection pooling | ✅ **ACTIVE** - Used by ~15 API routes |
| `src/lib/db-context.ts` | DB context helpers with RLS | ✅ **ACTIVE** |
| `src/lib/db-helpers.ts` | DB query utilities | ✅ **ACTIVE** |
| `src/lib/db-admin.ts` | Admin DB operations | ✅ **ACTIVE** |
| `src/lib/db-church.ts` | Church DB operations | ❌ **REMOVED** (Oct 10, 2025) |
| `src/lib/fund-transfers.ts` | Fund transfer logic | ✅ **ACTIVE** |

### Supabase Client Files (ACTIVE - DO NOT DELETE)

| File | Purpose | Imported By |
|------|---------|-------------|
| `src/lib/supabase/client.ts` | Supabase browser client | ⚠️ **Orphaned** (no active imports; delete after verification) |
| `src/lib/supabase/server.ts` | Supabase server client | (Check usage) |
| `src/lib/supabase/middleware.ts` | Supabase middleware | (Check usage) |

### API Routes Using PostgreSQL

The following routes still use direct PostgreSQL connections via `src/lib/db.ts`:

1. `/api/accounting` - Accounting data
2. `/api/worship-records` - Worship attendance
3. `/api/people` - People management (**migrated to Convex Oct 10, 2025**)
4. `/api/data` - General data queries
5. `/api/financial/fund-movements` - Fund transfers
6. `/api/dashboard-init` - Dashboard initialization (**migrated to Convex Oct 10, 2025**)
7. `/api/donors` - Donor management (**migrated to Convex Oct 10, 2025**)
8. `/api/reports` (helpers) - Report operations

### Components Using Supabase

| Component | Imports | Status |
|-----------|---------|--------|
| `ChurchLedgerView.tsx` | (none) | ✅ **MIGRATED** (Convex admin hooks) |
| `SupabaseAuth.tsx` | (none) | ❌ **REMOVED** (Oct 10, 2025) |

---

## Dependencies That Cannot Be Removed

**package.json dependencies**:
```json
{
  "@supabase/ssr": "^0.7.0",           // Used by supabase/server.ts
  "@supabase/supabase-js": "^2.57.4",  // Used by supabase/client.ts
  "pg": "^8.16.3"                      // Used by db.ts (PostgreSQL client)
}
```

**package.json devDependencies**:
```json
{
  "@types/pg": "^8.15.5"  // TypeScript types for pg
}
```

---

## Files Safe to Delete (Dead Code)

The following files are **not imported** anywhere and can be safely deleted:

1. ✅ `src/components/Auth/SupabaseAuth.tsx` - Old Supabase auth component (replaced by Convex Auth)

**Already deleted** (good!):
- ✅ `src/lib/auth-supabase.ts` - Old Supabase auth helper
- ✅ `src/components/Auth/SupabaseAuthProvider.tsx` - Old provider

---

## What Needs to Happen Before Removal

### Phase 1: Migrate PostgreSQL to Convex

**Affected files**: All files in "Active Supabase/PostgreSQL Usage" section above

**Steps**:
1. Review each API route using `src/lib/db.ts`
2. Convert PostgreSQL queries to Convex queries/mutations
3. Update components to use Convex React hooks instead of Supabase client
4. Test thoroughly to ensure no data loss

**Estimated effort**: 20-30 hours (major undertaking)

### Phase 2: Remove Dependencies

**Only after Phase 1 is complete**:
```bash
npm uninstall @supabase/ssr @supabase/supabase-js pg
npm uninstall -D @types/pg
```

### Phase 3: Delete Files

**Only after Phase 1 and 2 are complete**:
```bash
rm -rf src/lib/supabase/
rm src/lib/db.ts
rm src/lib/db-context.ts
rm src/lib/db-helpers.ts
rm src/lib/db-admin.ts
rm src/lib/db-church.ts
rm src/lib/fund-transfers.ts
```

---

## Current Migration Status

| Layer | Status | Notes |
|-------|--------|-------|
| **Auth** | ✅ **COMPLETE** | Migrated to Convex Auth |
| **Convex Functions** | ✅ **COMPLETE** | All queries/mutations in `convex/*.ts` |
| **API Routes** | ⚠️ **PARTIAL** | Some use Convex, some use PostgreSQL |
| **Components** | ⚠️ **PARTIAL** | Mix of Convex hooks and direct DB |
| **Database** | ❌ **NOT STARTED** | Still using PostgreSQL via `pg` |

**Overall Migration**: ~70% complete

---

## Recommendations

1. **Do NOT remove Supabase dependencies** until PostgreSQL usage is eliminated
2. **Complete Convex Auth migration first** (WS-4 Phase 6 - nearly done)
3. **Plan Phase 2 migration**: PostgreSQL → Convex (WS-5 or later)
4. **Keep migration scripts** (`npm run export-supabase`, etc.) for reference

---

## For Future Reference

When planning the PostgreSQL → Convex migration (Phase 2):

### High-Risk Areas
- `/api/accounting` - Complex financial queries
- `/api/reports` - Report aggregations
- `/api/financial/fund-movements` - Transaction logic
- `ChurchLedgerView.tsx` - Real-time ledger display

### Low-Risk Areas
- `/api/donors` - Simple CRUD operations
- `/api/people` - Person management
- Dead code files (can delete immediately)

---

## Decision

**Skip Supabase removal** for now. Focus on:
1. ✅ Complete Convex Auth migration
2. ✅ Validate typecheck and build
3. ✅ Deploy Convex Auth to production
4. 📅 Plan Phase 2 migration in separate workstream

**Estimated timeline for Phase 2**: 3-4 weeks of focused development
