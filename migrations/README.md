# ⚠️ LEGACY: PostgreSQL Migrations (Archive)

**Status**: 🗄️ **ARCHIVED** - Reference Only  
**Last Active**: January 2025  
**Migration Date**: 2025-01-08  
**Current Database**: Convex Document Database

---

## ⚠️ IMPORTANT NOTICE

**These SQL migrations are NO LONGER ACTIVE** and are preserved for historical reference only.

The IPU PY Tesorería system **migrated from Supabase PostgreSQL to Convex** in January 2025. This directory contains the legacy PostgreSQL migration history used during the Supabase era (September 2024 - January 2025).

### What This Means

- ❌ **Do NOT run these migrations** - They are for PostgreSQL, not Convex
- ❌ **Do NOT create new .sql files here** - Convex uses TypeScript schema
- ✅ **Use for reference** - Understand historical data structure
- ✅ **Consult for data mapping** - See how PostgreSQL tables map to Convex collections

### Current Schema Location

The active database schema is now defined in:
- **`convex/schema.ts`** - TypeScript schema with validators
- See [docs/CONVEX_SCHEMA.md](../docs/CONVEX_SCHEMA.md) for documentation

---

## Migration History Overview

### Timeline

**September 2024 - January 2025**: PostgreSQL/Supabase Era
- 54 total migrations applied
- Database: PostgreSQL 15 on Supabase
- Authorization: Row Level Security (RLS)

**January 2025**: Migration to Convex
- All data exported from Supabase
- Transformed to Convex format (see `convex-data/`)
- Schema redefined in TypeScript (`convex/schema.ts`)
- Authorization moved to code-based functions

### Total Migrations: 54

| Range | Description |
|-------|-------------|
| 000-010 | Initial schema, RLS implementation |
| 011-020 | Data integrity, profiles, auth sync |
| 021-030 | Manual reports, provider registry, reconciliation |
| 031-040 | Enhanced features, role simplification |
| 041-054 | Performance, treasurer consolidation, final fixes |

---

## Key Migrations (Historical Reference)

### Foundation (000-010)

| Migration | Description | Impact |
|-----------|-------------|--------|
| **000** | Migration tracking | Created `migration_history` table |
| **001** | Initial schema | Core tables: churches, reports, funds |
| **002** | Member management | Members, families, attendance |
| **003** | Analytics tables | KPIs, trends, insights |
| **004** | Seed data | 22 IPU Paraguay churches |
| **005** | Dual-level accounting | National + church-level funds |
| **006** | Google Auth | OAuth integration |
| **007** | Fund management | Transaction ledger |
| **008** | Reports portal | Church report submission |
| **009** | Audit log | `user_activity` table |
| **010** | Implement RLS | Row Level Security policies |

### Core Features (011-020)

| Migration | Description | Convex Equivalent |
|-----------|-------------|-------------------|
| **013** | Donor registry | `donors` collection |
| **014** | National fund allocation | Calculated in mutations |
| **015** | Recalculate fund balances | Convex transactions auto-calculate |
| **016** | Profiles and auth sync | `profiles` collection with NextAuth |
| **017** | Enhanced fund tracking | `fundTransactions` collection |
| **018** | Report tithers | `reportTithers` embedded in reports |

### Major Updates (021-030)

| Migration | Description | Convex Equivalent |
|-----------|-------------|-------------------|
| **021** | Manual reports | `submission_source` field in `monthlyReports` |
| **022** | Reconciliation transactions | Manual entries in `fundTransactions` |
| **023** | Role simplification (8→6) | 7 roles in Convex `profiles.role` |
| **024** | RLS UUID fixes | Convex uses typed IDs (`Id<"collection">`) |
| **026** | Fund director events | `fundEvents` collection |
| **027** | Provider registry | `providers` collection with RUC dedup |
| **028** | Provider backfill | Data migration (completed) |

### Final Phase (031-054)

| Migration | Description | Convex Equivalent |
|-----------|-------------|-------------------|
| **037** | Role system fixes | Role hierarchy in code |
| **040** | National treasurer role | `national_treasurer` role |
| **042** | Generated columns | Calculated in mutations |
| **045** | Performance indexes | Convex `.index()` in schema |
| **053-054** | Treasurer consolidation | 6→5 roles (deprecated church roles) |

---

## PostgreSQL to Convex Mapping

### Table → Collection Mapping

| PostgreSQL Table | Convex Collection | Notes |
|------------------|-------------------|-------|
| `churches` | `churches` | Direct mapping |
| `reports` (monthly_reports) | `monthlyReports` | Renamed to camelCase |
| `profiles` | `profiles` | Added `supabase_id` for legacy compat |
| `funds` | `funds` | Direct mapping |
| `fund_balances` | `fundBalances` | camelCase |
| `fund_transactions` | `fundTransactions` | camelCase |
| `fund_events` | `fundEvents` | camelCase |
| `fund_event_budget_items` | `fundEventBudgetItems` | camelCase |
| `fund_event_actuals` | `fundEventActuals` | camelCase |
| `providers` | `providers` | Direct mapping |
| `donors` | `donors` | Direct mapping |
| `user_activity` | `userActivity` | camelCase |
| `system_configuration` | `systemConfiguration` | camelCase |
| `report_status_history` | `reportStatusHistory` | camelCase |
| `fund_event_audit` | `fundEventAudit` | camelCase |

### Authorization Migration

| PostgreSQL RLS | Convex Code |
|----------------|-------------|
| `CREATE POLICY "users_view_own_church"` | `requireChurchAccess(ctx, churchId)` |
| `app.current_user_role` | `user.role` check in function |
| `app.current_user_church_id` | `user.churchId` check in function |
| `has_fund_access(fund_id)` | `requireFundAccess(ctx, fundId)` |
| `get_role_level(role)` | Role hierarchy in TypeScript |

### Data Type Migration

| PostgreSQL Type | Convex Validator | Notes |
|-----------------|------------------|-------|
| `UUID` | `v.id("collection")` | Convex auto-generates IDs |
| `TEXT` | `v.string()` | Direct mapping |
| `INTEGER` | `v.number()` | JavaScript number |
| `NUMERIC` | `v.number()` | JavaScript number |
| `BOOLEAN` | `v.boolean()` | Direct mapping |
| `TIMESTAMP` | `v.number()` | Unix milliseconds |
| `ENUM` | `v.union(v.literal(...))` | TypeScript union types |
| `JSONB` | `v.any()` or nested validators | Flexible schema |

---

## Migration Files Reference

### Complete List (54 Files)

```
000_migration_history.sql
001_initial_schema.sql
002_member_management.sql
003_analytics_tables.sql
004_seed_data.sql
005_dual_level_accounting_enhancement.sql
006_add_google_auth.sql
007_fund_management_tables.sql
008_reports_portal_enhancement.sql
009_audit_log.sql
010_implement_rls.sql
011_data_integrity.sql.disabled
012_performance_indexes.sql.disabled
013_donor_registry_enhancement.sql
014_fix_national_fund_allocation.sql
015_recalculate_fund_balances.sql
016_create_profiles_and_auth_sync.sql
017_enhanced_fund_tracking.sql
018_add_report_tithers.sql
019_fix_fund_balances_cascades.sql
020_update_national_fund_in_reports.sql
021_add_manual_report_source.sql
022_reconciliation_transactions.sql
023_simplify_roles.sql
024_fix_rls_uuid_casting.sql
025_revert_role_simplification.sql
026_fund_director_events_system.sql
027_provider_registry.sql
028_backfill_providers.sql
029_optimize_report_queries.sql
030_add_church_indexes.sql
031_add_fund_event_indexes.sql
032_optimize_user_activity.sql
033_add_report_status_index.sql
034_optimize_fund_transactions.sql
035_add_provider_search_indexes.sql
036_optimize_donor_queries.sql
037_fix_role_system.sql
038_add_fund_balance_constraints.sql
039_optimize_church_queries.sql
040_national_treasurer_role.sql
041_add_transaction_metadata.sql
042_add_generated_columns.sql
043_optimize_report_aggregates.sql
044_add_event_budget_constraints.sql
045_final_performance_indexes.sql
046_add_audit_indexes.sql
047_optimize_provider_ruc_lookup.sql
048_add_report_validation.sql
049_optimize_fund_event_queries.sql
050_add_church_active_index.sql
051_optimize_user_role_checks.sql
052_final_rls_optimizations.sql
053_consolidate_treasurer_role.sql
054_fix_treasurer_data.sql
```

### Disabled Migrations

Files ending in `.disabled` were NOT applied:
- `011_data_integrity.sql.disabled` - Superseded by later migrations
- `012_performance_indexes.sql.disabled` - Replaced by 045

---

## How to Use This Directory

### For Historical Reference

```bash
# View migration history
cat migrations/000_migration_history.sql

# Understand old schema
cat migrations/001_initial_schema.sql

# See RLS policies (archived)
cat migrations/010_implement_rls.sql

# Check role evolution
cat migrations/023_simplify_roles.sql
cat migrations/053_consolidate_treasurer_role.sql
```

### For Data Mapping

When migrating custom queries or understanding legacy data:

1. **Find equivalent Convex collection**:
   ```sql
   -- Old PostgreSQL query
   SELECT * FROM reports WHERE church_id = $1;
   
   -- New Convex query
   await ctx.db
     .query("monthlyReports")
     .withIndex("by_church", (q) => q.eq("churchId", churchId))
     .collect();
   ```

2. **Map authorization logic**:
   ```sql
   -- Old RLS policy
   CREATE POLICY "users_own_church" ON reports
   FOR SELECT USING (church_id = app_current_user_church_id());
   
   -- New Convex authorization
   const user = await requireAuth(ctx);
   if (user.churchId !== report.churchId) {
     throw new Error("Unauthorized");
   }
   ```

---

## Data Export Reference

### Export Process (January 2025)

All data was exported from Supabase before migration:

```bash
# Export scripts used
scripts/export-supabase.ts      # Export all tables to JSON
scripts/transform-for-convex.ts # Transform to Convex format

# Output location
convex-data/*.jsonl             # JSONL format for Convex import
```

### Data Preserved

- ✅ All 22 churches
- ✅ All user profiles
- ✅ All monthly reports (historical data)
- ✅ All fund transactions
- ✅ All fund events and budgets
- ✅ All providers
- ✅ All donors
- ✅ Audit trail (user activity)

### Legacy Compatibility

Every Convex collection includes `supabase_id` field:

```typescript
// convex/schema.ts
churches: defineTable({
  name: v.string(),
  // ... other fields
  supabase_id: v.optional(v.string()), // Original PostgreSQL UUID
})
.index("by_supabase_id", ["supabase_id"]);

// Query by legacy ID
const church = await ctx.db
  .query("churches")
  .withIndex("by_supabase_id", (q) => 
    q.eq("supabase_id", "550e8400-e29b-41d-a716-446655440000")
  )
  .unique();
```

---

## Related Documentation

### Current Architecture

- **[docs/CONVEX_SCHEMA.md](../docs/CONVEX_SCHEMA.md)** - Current database schema
- **[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** - System architecture
- **[docs/SECURITY.md](../docs/SECURITY.md)** - Authorization patterns
- **[docs/database/README.md](../docs/database/README.md)** - Database overview

### Migration Documentation

- **[docs/CONVEX_MIGRATION_PLAN.md](../docs/CONVEX_MIGRATION_PLAN.md)** - Migration strategy
- **[docs/CONVEX_MIGRATION_STATUS.md](../docs/CONVEX_MIGRATION_STATUS.md)** - Migration progress
- **[docs/Arquitectura propuesta.md](../docs/Arquitectura%20propuesta%20(Next.js%2015%20%2B%20Vercel%20%2B%20Convex).md)** - Architecture proposal

### Legacy Documentation (Archived)

- **[docs/database/legacy/RLS_POLICIES.md](../docs/database/legacy/RLS_POLICIES.md)** - PostgreSQL RLS policies
- **[docs/database/legacy/SCHEMA_REFERENCE.md](../docs/database/legacy/SCHEMA_REFERENCE.md)** - PostgreSQL schema

---

## FAQs

### Q: Can I still use these migrations?

**A**: No. These migrations are for PostgreSQL/Supabase only. The system now uses Convex with TypeScript schema. See `convex/schema.ts` for the current schema.

### Q: How do I make schema changes?

**A**: Edit `convex/schema.ts` and run `npx convex dev`. Convex automatically applies schema changes.

Example:
```typescript
// convex/schema.ts
export default defineSchema({
  churches: defineTable({
    name: v.string(),
    city: v.string(),
    newField: v.optional(v.string()), // Add new field
  }),
});

// Run: npx convex dev (auto-applies)
```

### Q: Where is the migration history stored now?

**A**: Convex doesn't use migration files. Schema changes are applied automatically when you update `convex/schema.ts`. There's no `migration_history` table - just Git history of `convex/schema.ts`.

### Q: What if I need to reference old RLS policies?

**A**: See `docs/database/legacy/RLS_POLICIES.md` for archived RLS documentation. Most policies are now implemented as authorization functions in `convex/lib/auth.ts`.

### Q: How do I query historical data?

**A**: All historical data was migrated to Convex. Query using Convex queries:

```typescript
// Get all reports (historical + new)
const reports = await ctx.db.query("monthlyReports").collect();

// Query preserves all dates, amounts, and relationships
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-08 | Created LEGACY notice after Convex migration |

---

**Status**: 🗄️ ARCHIVED  
**Maintained By**: Historical Reference Only  
**Last Active Migration**: 054_fix_treasurer_data.sql (January 2025)  
**Current Schema**: convex/schema.ts
