# Database Helpers Migration Guide

## Overview

This guide documents the pattern for migrating unsafe database query result access to type-safe helpers using `src/lib/db-helpers.ts`.

**Problem**: Direct array access like `result.rows[0]` violates TypeScript's `noUncheckedIndexedAccess` strict setting because arrays can be undefined.

**Solution**: Use type-safe helper functions that explicitly handle null/undefined cases.

## Import Statement

Add to the top of every API route file:

```typescript
import { expectOne, firstOrNull, firstOrDefault, expectAtLeastOne } from '@/lib/db-helpers';
```

## Migration Patterns

### Pattern 1: Single Row Expected (INSERT/UPDATE RETURNING)

**Before** (unsafe):
```typescript
const result = await client.query('INSERT INTO churches (...) RETURNING *', [params]);
const church = result.rows[0]; // ❌ Could be undefined
```

**After** (safe):
```typescript
const result = await client.query('INSERT INTO churches (...) RETURNING *', [params]);
const church = expectOne(result.rows); // ✅ Throws if not exactly 1 row
```

**When to use**: INSERT/UPDATE with RETURNING clause where you expect exactly one row.

---

### Pattern 2: Single Row Optional (SELECT by ID)

**Before** (unsafe with redundant checks):
```typescript
const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE id = $1', [id]);
if (result.rowCount === 0) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
const church = result.rows[0]; // ❌ Still unsafe despite check
if (!church) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

**After** (safe and cleaner):
```typescript
const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE id = $1', [id]);
const church = firstOrNull(result.rows); // ✅ Returns Church | null

if (!church) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
// church is now Church (narrowed type)
```

**When to use**: SELECT queries that may or may not return data.

---

### Pattern 3: Aggregation with Default Value

**Before** (unsafe):
```typescript
const statsResult = await executeWithContext(auth, 'SELECT COUNT(*) as total FROM churches');
const stats = statsResult.rows[0]; // ❌ Could be undefined
const total = parseInt(stats?.['total'] ?? '0'); // Messy fallback
```

**After** (safe):
```typescript
const statsResult = await executeWithContext(auth, 'SELECT COUNT(*) as total FROM churches');
const stats = firstOrDefault(statsResult.rows, { total: 0 });
const total = parseInt(String(stats.total));
```

**When to use**: COUNT, SUM, aggregate queries that should always return a row.

---

### Pattern 4: Multiple Rows Expected

**Before** (unsafe):
```typescript
const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE active = true');
if (result.rows.length === 0) {
  throw new Error('No active churches found');
}
const churches = result.rows; // ❌ No type safety on empty check
```

**After** (safe):
```typescript
const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE active = true');
const churches = expectAtLeastOne(result.rows); // ✅ Throws if empty
```

**When to use**: Queries where you MUST have at least one result.

---

### Pattern 5: Update/Delete Check

**Before** (unsafe):
```typescript
const result = await client.query('UPDATE churches SET active = false WHERE id = $1 RETURNING *', [id]);
if (result.rows.length === 0) {
  return null;
}
const church = result.rows[0]; // ❌ Unsafe
```

**After** (safe):
```typescript
const result = await client.query('UPDATE churches SET active = false WHERE id = $1 RETURNING *', [id]);
const church = firstOrNull(result.rows); // ✅ Returns Church | null
if (!church) {
  return null;
}
```

---

## Real-World Examples

### Example 1: churches/route.ts (POST endpoint)

**Fixed**:
```typescript
const record = await executeTransaction(auth, async (client) => {
  const churchInsert = await client.query(/* INSERT query */);
  const church = expectOne(churchInsert.rows); // ✅ Must return exactly 1

  const pastorInsert = await client.query(/* INSERT query */);
  const pastorRow = expectOne(pastorInsert.rows); // ✅ Must return exactly 1

  const directory = await client.query(DIRECTORY_BY_ID_QUERY, [church.id]);
  return expectOne(directory.rows); // ✅ Must return exactly 1
});
```

### Example 2: fund-events/route.ts (GET with stats)

**Fixed**:
```typescript
const statsResult = await executeWithContext(auth, statsQuery, statsParams);
const stats = firstOrDefault(statsResult.rows, {
  total: 0,
  draft: 0,
  submitted: 0,
  approved: 0,
  rejected: 0,
  pending_revision: 0
}); // ✅ Always returns an object with default values
```

### Example 3: fund-events/[id]/route.ts (GET single event)

**Fixed**:
```typescript
const result = await executeWithContext(auth, query, [eventId]);
const event = firstOrNull(result.rows); // ✅ Returns Event | null

if (!event) {
  return NextResponse.json({ error: 'Event not found' }, { status: 404 });
}
```

## Helper Function Reference

| Function | Use Case | Returns | Throws on Empty |
|----------|----------|---------|-----------------|
| `expectOne<T>(rows)` | INSERT/UPDATE RETURNING | `T` | ✅ Yes |
| `expectAtLeastOne<T>(rows)` | Must have data | `T[]` | ✅ Yes |
| `firstOrNull<T>(rows)` | May or may not have data | `T \| null` | ❌ No |
| `firstOrDefault<T>(rows, default)` | Aggregate queries | `T` | ❌ No |
| `extractNumber(result, 'field')` | COUNT/SUM extraction | `number` | ✅ Yes if empty |

## Migration Checklist

For each API route file:

- [ ] Add import for `db-helpers` functions
- [ ] Find all `.rows[0]` accesses (use grep: `grep -n "\.rows\[0\]" filename.ts`)
- [ ] Find all `.rows[index]` accesses (use grep: `grep -n "\.rows\[" filename.ts`)
- [ ] Replace each with appropriate helper:
  - INSERT/UPDATE → `expectOne()`
  - SELECT by ID → `firstOrNull()`
  - Aggregates → `firstOrDefault()`
  - Lists → Keep `.rows` or use `expectAtLeastOne()` if must have data
- [ ] Remove redundant `if (result.rowCount === 0)` checks
- [ ] Run `npx tsc --noEmit` to verify type safety
- [ ] Test the endpoint

## Files Completed

✅ `src/app/api/churches/route.ts` (7 instances)
✅ `src/app/api/fund-events/route.ts` (2 instances)
✅ `src/app/api/fund-events/[id]/route.ts` (5 instances)

## Files Remaining (~100 instances)

Priority order:

1. **High Priority** (data mutation):
   - `src/app/api/fund-events/[id]/budget/route.ts` (2 instances)
   - `src/app/api/fund-events/[id]/budget/[budgetItemId]/route.ts` (3 instances)
   - `src/app/api/fund-events/[id]/actuals/route.ts` (2 instances)
   - `src/app/api/fund-events/[id]/actuals/[actualId]/route.ts` (3 instances)

2. **Medium Priority** (reports & admin):
   - `src/app/api/reports/route.ts` (7 instances)
   - `src/app/api/reports/route-helpers.ts` (5 instances)
   - `src/app/api/admin/reports/route.ts` (1 instance)
   - `src/app/api/admin/pastors/link-profile/route.ts` (4 instances)
   - `src/app/api/admin/funds/route.ts` (1 instance)
   - `src/app/api/admin/transactions/route.ts` (2 instances)

3. **Lower Priority** (read-heavy):
   - `src/app/api/data/route.ts` (1 instance)
   - `src/app/api/dashboard/route.ts` (17 instances)
   - `src/app/api/dashboard-init/route.ts` (3 instances)
   - `src/app/api/people/route.ts` (3 instances)
   - `src/app/api/worship-records/route.ts` (3 instances)
   - `src/app/api/financial/**/*.ts` (15 instances)
   - `src/app/api/donors/route.ts` (5 instances)
   - `src/app/api/providers/*.ts` (4 instances)

## Common Mistakes to Avoid

1. ❌ **Don't mix patterns**:
   ```typescript
   // Bad: Mixing firstOrNull with expectOne
   const result = firstOrNull(rows);
   if (!result) throw new Error(); // Just use expectOne!
   ```

2. ❌ **Don't keep redundant checks**:
   ```typescript
   // Bad: Redundant rowCount check
   if (result.rowCount === 0) return null;
   const row = firstOrNull(result.rows); // Already handles empty!
   ```

3. ❌ **Don't use optional chaining after expectOne**:
   ```typescript
   // Bad: expectOne guarantees non-null
   const church = expectOne(result.rows);
   return church?.id; // Unnecessary ?., church is always defined
   ```

## Verification

After migration, verify:

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. ESLint (should pass with typed rules)
npm run lint

# 3. Check for remaining unsafe access
grep -r "\.rows\[" src/app/api --include="*.ts" | wc -l  # Should be 0

# 4. Pre-commit hooks enabled
cat .husky/pre-commit  # Should include 'tsc --noEmit'
```

## Benefits

- ✅ **Type Safety**: Compiler catches potential undefined errors
- ✅ **Cleaner Code**: Removes redundant null checks
- ✅ **Better Errors**: Descriptive error messages when data missing
- ✅ **Maintainability**: Consistent pattern across all API routes
- ✅ **Documentation**: Function names self-document intent
