# Migration 033: Rename ordination_level to grado

**Status**: ✅ Complete
**Date**: Octubre 2025
**Type**: Schema Refactor + Terminology Alignment

## Overview

Renamed `ordination_level` column to `grado` in the `pastors` table and enforced valid grade values aligned with IPU Paraguay ministerial terminology.

## Changes Made

### 1. Database Migration

**File**: [migrations/033_rename_ordination_to_grado.sql](../../migrations/033_rename_ordination_to_grado.sql)

#### Column Rename
```sql
ALTER TABLE pastors
  RENAME COLUMN ordination_level TO grado;
```

#### Valid Values Constraint
```sql
ALTER TABLE pastors
  ADD CONSTRAINT pastors_grado_check
  CHECK (grado IS NULL OR grado IN ('ordenación', 'general', 'local'));
```

**Grade Hierarchy** (highest to lowest):
1. **ordenación** - Highest ministerial grade
2. **general** - Mid-level ministerial grade
3. **local** - Lowest/entry ministerial grade

#### View Updates
- **church_primary_pastors** - Updated to use `grado` field
- **pastor_user_access** - Updated to include `grado` in output

#### Data Migration
Existing data normalized to new terminology:
```sql
UPDATE pastors
SET grado = CASE
  WHEN grado ILIKE '%ordenación%' OR grado ILIKE '%ordenacion%' THEN 'ordenación'
  WHEN grado ILIKE '%general%' THEN 'general'
  WHEN grado ILIKE '%local%' THEN 'local'
  ELSE grado
END
WHERE grado IS NOT NULL;
```

### 2. TypeScript Type Updates

**File**: [src/types/api.ts](../../src/types/api.ts)

#### Updated Types
```typescript
// Raw database column
export type RawPrimaryPastor = {
  primary_pastor_grado?: string | null;  // Changed from primary_pastor_ordination_level
  // ... other fields
};

// Normalized TypeScript type
export type PastorRecord = {
  grado?: 'ordenación' | 'general' | 'local' | null;  // Strongly typed with valid values
  // ... other fields
};
```

#### Normalizer Function
Added validation logic to ensure only valid grades are accepted:
```typescript
const rawGrado = raw.primary_pastor_grado;
const validGrados: ReadonlyArray<NonNullable<PastorRecord['grado']>> = ['ordenación', 'general', 'local'];
const grado = rawGrado && validGrados.includes(rawGrado as NonNullable<PastorRecord['grado']>)
  ? (rawGrado as NonNullable<PastorRecord['grado']>)
  : null;
```

### 3. API Routes Updated

**Files Modified**:
- [src/app/api/churches/route.ts](../../src/app/api/churches/route.ts) - All SELECT, INSERT, UPDATE queries
- [src/app/api/data/route.ts](../../src/app/api/data/route.ts) - Excel import/export
- [src/app/api/admin/pastors/access/route.ts](../../src/app/api/admin/pastors/access/route.ts) - Pastor access view

**Changes**:
- All SQL queries updated from `ordination_level` → `grado`
- All TypeScript references changed from `ordinationLevel` → `grado`
- Normalizer functions updated to use `grado`

### 4. UI Components Updated

**Files Modified**:
- [src/app/admin/configuration/page.tsx](../../src/app/admin/configuration/page.tsx)
- [src/components/Churches/ChurchesView.tsx](../../src/components/Churches/ChurchesView.tsx)
- [src/components/Churches/ChurchEditDialog.tsx](../../src/components/Churches/ChurchEditDialog.tsx)
- [src/components/Churches/ChurchForm.tsx](../../src/components/Churches/ChurchForm.tsx)
- [src/hooks/useChurchMutations.ts](../../src/hooks/useChurchMutations.ts)

**Changes**:
- All component props updated to use `grado`
- Form fields reference `grado` property
- Display logic uses `grado` values

## Migration Steps

### To Apply Migration

```bash
# Via Supabase CLI (recommended)
supabase db push migrations/033_rename_ordination_to_grado.sql

# Or via psql
psql -h <host> -U <user> -d <database> -f migrations/033_rename_ordination_to_grado.sql
```

### Rollback (if needed)

```sql
BEGIN;

-- Revert constraint
ALTER TABLE pastors DROP CONSTRAINT IF EXISTS pastors_grado_check;

-- Revert column name
ALTER TABLE pastors RENAME COLUMN grado TO ordination_level;

-- Revert views (run original view definitions from migration 031/032)

COMMIT;
```

## Testing Checklist

✅ **Database**: Column renamed and constraint applied
✅ **TypeScript**: No type errors (`npx tsc --noEmit`)
✅ **ESLint**: No linting errors (`npm run lint`)
✅ **API Routes**: All queries reference `grado`
✅ **UI Components**: All references updated to `grado`
✅ **Data Migration**: Existing data normalized to valid values

## Validation

### Verify Column Exists
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pastors' AND column_name = 'grado';
```

### Verify Constraint
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'pastors_grado_check';
```

### Check Data Distribution
```sql
SELECT grado, COUNT(*) as count
FROM pastors
WHERE status = 'active'
GROUP BY grado
ORDER BY count DESC;
```

## Breaking Changes

⚠️ **API Response Format Changed**:
- Old: `{ ordinationLevel: 'ordenación' }`
- New: `{ grado: 'ordenación' }`

**Impact**: Any external systems consuming the API must update their parsers.

⚠️ **Database Column Renamed**:
- Old: `pastors.ordination_level`
- New: `pastors.grado`

**Impact**: Direct SQL queries must be updated.

## Benefits

✅ **Terminology Alignment**: Uses standard IPU Paraguay ministerial terms
✅ **Type Safety**: Strong TypeScript typing prevents invalid values
✅ **Database Validation**: CHECK constraint enforces valid grades
✅ **Consistent Naming**: Aligns with Spanish/Paraguay conventions throughout codebase

## Related Documentation

- [Migration 031](../../migrations/031_create_pastors_table.sql) - Original pastors table creation
- [Migration 032](../../migrations/032_pastor_profile_linkage.sql) - Pastor-profile linkage
- [DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) - Schema documentation (needs update)
- [PASTOR_USER_MANAGEMENT.md](../guides/PASTOR_USER_MANAGEMENT.md) - Pastor access management

## Notes

- Migration is **non-destructive** - existing data preserved
- All views automatically updated with new column name
- Foreign key relationships unaffected
- RLS policies unaffected (use column name agnostic context)

---

**Migration 033 Complete** ✅

All code references updated, TypeScript types aligned, and database schema properly constrained.
