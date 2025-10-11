# WS-7 Accounting Migration - Next Steps

**Date**: 2025-10-10
**Current Status**: 🟢 **Phase 6 COMPLETE** - API Migration Done
**Next Phase**: Phase 4 Data Backfill Verification + Phase 7 Testing
**Priority**: HIGH - Validation before production deployment

---

## Current State Assessment

### ✅ Completed Phases (1-6)

| Phase | Status | Evidence |
|-------|--------|----------|
| **Phase 1: Schema Design** | ✅ COMPLETE | 6 collections exist in `convex/schema.ts` |
| **Phase 2: Reference Data** | ✅ COMPLETE | 19 categories migrated (WS7_PHASE2_COMPLETE.md) |
| **Phase 3: Read Queries** | ✅ COMPLETE | `monthlyLedgers.ts`, `accountingEntries.ts`, `expenseRecords.ts` |
| **Phase 4: Data Backfill** | ⚠️ **UNCERTAIN** | Scripts exist but **execution status unknown** |
| **Phase 5: Mutations** | ✅ COMPLETE | `openLedger`, `closeLedger`, `createExpenseWithEntry` exist |
| **Phase 6: API Migration** | ✅ COMPLETE | `/api/accounting` fully on Convex (code review confirmed) |

### ⚠️ Critical Gap: Phase 4 Validation

**The only unknown**: Has the bulk data migration been executed?

**What's at risk**:
- If data migration **NOT run**: Production deployment will show empty ledgers/entries
- If data migration **was run**: Need to validate data integrity before going live

**Required Action**: Verify Phase 4 execution status (see Step 1 below)

---

## Recommended Execution Path

### Option A: Data Migration Already Complete ✅

**If you've already run**:
```bash
npm run migrate-ledgers        # Monthly ledger migration
npm run migrate-entries        # Accounting entries migration
npm run validate-accounting-migration  # Validation script
```

**Then proceed directly to**: [Step 2 - Phase 7 Testing](#step-2-phase-7-comprehensive-testing)

---

### Option B: Data Migration NOT Run ⚠️

**If you have NOT run the migration scripts**, you MUST complete Phase 4 first:

#### Step 1: Phase 4 Data Backfill Execution (REQUIRED)

**Estimated Time**: 2-3 hours
**Risk**: HIGH (data integrity critical)

##### 1.1 Verify Migration Scripts Exist

```bash
ls -la scripts/migrate-*
```

**Expected Files**:
- ✅ `migrate-transaction-categories.ts` (already run - Phase 2)
- ✅ `migrate-categories-rest.ts` (already run - Phase 2)
- ✅ `migrate-monthly-ledgers.ts` (Phase 4 - pending?)
- ✅ `migrate-accounting-entries.ts` (Phase 4 - pending?)
- ✅ `validate-accounting-migration.ts` (Phase 4 - pending?)

##### 1.2 Check Current Convex Data State

```bash
# Open Convex dashboard
npx convex dashboard
```

**Navigate to**: Data → Tables

**Check counts**:
| Table | Expected Count | Current Count | Status |
|-------|---------------|---------------|--------|
| `transactionCategories` | ~19 | ? | ✅ (Phase 2 done) |
| `monthlyLedgers` | ~264 (22 churches × 12 months) | ? | ❓ |
| `accountingEntries` | ~4,000+ | ? | ❓ |

**Decision Tree**:
- If `monthlyLedgers.count > 0` → **Data migration already run** → Go to Step 1.3 (validation)
- If `monthlyLedgers.count == 0` → **Data migration NOT run** → Go to Step 1.2.1 (execute)

##### 1.2.1 Execute Monthly Ledger Migration

**Prerequisites**:
- ✅ Convex dev server running (`npx convex dev`)
- ✅ `.env.local` has `DATABASE_URL` (Supabase connection)
- ✅ `.env.local` has `CONVEX_URL` and `CONVEX_ADMIN_KEY`

**Execution**:
```bash
# Dry-run first (safe)
npm run migrate-ledgers -- --dry-run

# Review output, then execute
npm run migrate-ledgers
```

**Expected Output**:
```
📊 Fetching monthly ledgers from PostgreSQL...
Found 264 monthly ledgers
✅ Migrated ledger: Central Asunción 1/2025 (1)
✅ Migrated ledger: Central Asunción 2/2025 (2)
...
✅ Monthly ledger migration complete!
   Success: 264
   Failed: 0
   Total: 264
```

**Validation**:
- [ ] Success count matches PostgreSQL count
- [ ] No "Failed" errors
- [ ] Check Convex dashboard: `monthlyLedgers` table has records

##### 1.2.2 Execute Accounting Entries Migration

**Execution**:
```bash
# Dry-run first
npm run migrate-entries -- --dry-run

# Execute migration
npm run migrate-entries
```

**Expected Output**:
```
📊 Fetching accounting entries from PostgreSQL...
Found 4,237 accounting entries
✅ Migrated entry: Church=1 Ledger=1 (1)
...
✅ Accounting entry migration complete!
   Success: 4,237
   Failed: 0
   Total: 4,237
```

**Validation**:
- [ ] Success count = PostgreSQL count
- [ ] No errors
- [ ] Convex dashboard: `accountingEntries` table populated

##### 1.3 Run Data Validation Script

**Purpose**: Ensures data integrity (debit = credit, balances match, etc.)

**Execution**:
```bash
npm run validate-accounting-migration
```

**Expected Output**:
```
🔍 Validating Accounting Migration...

Record Count Verification:
✅ Categories: 19 (PostgreSQL) vs 19 (Convex)
✅ Ledgers: 264 (PostgreSQL) vs 264 (Convex)
✅ Entries: 4,237 (PostgreSQL) vs 4,237 (Convex)

Double-Entry Balance Check:
✅ Total Debit: ₲ 1,234,567,890
✅ Total Credit: ₲ 1,234,567,890
✅ Difference: ₲ 0.00 (tolerance: ±₲ 1.00)

Sample Data Verification:
✅ Ledger 1 (Central Asunción 1/2025): Opening ₲50,000 Closing ₲48,500
✅ Entry 1 (Church=1): Debit ₲10,000 Credit ₲10,000

✅ All validation checks PASSED
```

**If Errors Found**:
1. **Record count mismatch** → Re-run migration with `--force` flag
2. **Debit ≠ Credit** → Check PostgreSQL data integrity first
3. **Sample data errors** → Investigate specific records in Convex dashboard

**Checklist**:
- [ ] All record counts match
- [ ] Double-entry balance passes (difference < ₲1.00)
- [ ] Sample data verification passes
- [ ] No critical errors

---

### Step 2: Phase 7 Comprehensive Testing

**Status**: 🟡 IN PROGRESS (based on your recent work)
**Estimated Time**: 4-6 hours
**Priority**: HIGH

#### 2.1 Manual Testing Checklist

##### Ledger Operations

**Test**: Open New Ledger
```bash
# API Test
curl -X POST http://localhost:3000/api/accounting \
  -H "Content-Type: application/json" \
  -d '{
    "type": "open_ledger",
    "church_id": 1,
    "month": 11,
    "year": 2025
  }'
```

**Expected**:
- ✅ Status 200
- ✅ Ledger created with correct opening balance
- ✅ Convex dashboard shows new ledger

**Edge Case Test**: Duplicate Open
```bash
# Repeat same request - should fail
curl -X POST http://localhost:3000/api/accounting ...
```

**Expected**:
- ✅ Status 400 or 409 (conflict)
- ✅ Error message: "Ledger already exists for this period"

---

**Test**: Close Ledger
```bash
curl -X POST http://localhost:3000/api/accounting \
  -H "Content-Type: application/json" \
  -d '{
    "type": "close_ledger",
    "church_id": 1,
    "month": 11,
    "year": 2025
  }'
```

**Expected**:
- ✅ Status 200
- ✅ Ledger status → "closed"
- ✅ Aggregations correct: `total_income`, `total_expenses`, `closing_balance`
- ✅ Verify calculation: `opening_balance + total_income - total_expenses = closing_balance`

**Edge Case Test**: Close Already Closed
```bash
# Repeat same request
```

**Expected**:
- ✅ Status 400 (Bad Request)
- ✅ Error: "Ledger already closed"

---

##### GET Operations

**Test**: Summary Endpoint
```bash
# Admin - All churches
curl "http://localhost:3000/api/accounting?type=summary"

# Scoped - Specific church and period
curl "http://localhost:3000/api/accounting?type=summary&church_id=1&month=10&year=2025"
```

**Validation**:
- [ ] Income totals match reports
- [ ] Expense totals match expense_records
- [ ] Ledger snapshot shows correct status
- [ ] Net result = income - expenses

---

**Test**: Ledger List
```bash
curl "http://localhost:3000/api/accounting?type=ledger&church_id=1&year=2025"
```

**Validation**:
- [ ] Returns 12 ledgers (one per month, if all exist)
- [ ] Filtered by church_id
- [ ] Filtered by year
- [ ] Proper status values (open/closed)

---

**Test**: Expense List
```bash
curl "http://localhost:3000/api/accounting?type=expenses&church_id=1&month=10&year=2025"
```

**Validation**:
- [ ] Returns expenses for specified period
- [ ] Includes category information
- [ ] `categoryTotals` object present
- [ ] Totals match individual expense sums

---

##### Authorization Tests

**Test**: Non-Treasurer Access
```bash
# Login as pastor role, then:
curl "http://localhost:3000/api/accounting?type=summary"
```

**Expected**:
- ✅ Status 403 (Forbidden)
- ✅ Error: "Unauthorized" or "Insufficient permissions"

---

**Test**: Cross-Church Access (Non-Admin)
```bash
# Login as treasurer of Church 1, then:
curl "http://localhost:3000/api/accounting?type=summary&church_id=2"
```

**Expected**:
- ✅ Status 403
- ✅ Error: "Access denied to church 2"

---

**Test**: Admin Cross-Church Access
```bash
# Login as admin, then:
curl "http://localhost:3000/api/accounting?type=summary&church_id=2"
```

**Expected**:
- ✅ Status 200
- ✅ Data returned for church 2

---

##### Edge Cases

**Test**: Invalid Parameters
```bash
# Invalid month
curl "http://localhost:3000/api/accounting?type=summary&month=13"

# Invalid year
curl "http://localhost:3000/api/accounting?type=summary&year=-1"

# Invalid church_id
curl "http://localhost:3000/api/accounting?type=summary&church_id=999"
```

**Expected**:
- ✅ Status 400 for invalid parameters
- ✅ Status 404 for non-existent church
- ✅ Clear error messages

---

**Test**: Large Data Sets
```bash
# All churches, no filters (admin only)
curl "http://localhost:3000/api/accounting?type=summary"
```

**Performance Target**:
- ✅ Response time < 2 seconds
- ✅ No timeout errors
- ✅ Convex function logs show < 1s execution

---

#### 2.2 UI Testing in Browser

**Navigate to**: Admin Dashboard → Accounting Section

**Test Flows**:
1. **Church Ledger View**:
   - [ ] Select church from dropdown
   - [ ] View transactions table
   - [ ] Verify balances display correctly (from `record.amounts.balance`)
   - [ ] Check for cumulative sum errors (should not exist)

2. **Open/Close Ledger UI**:
   - [ ] Open ledger button works
   - [ ] Close ledger button works
   - [ ] Status updates in real-time (Convex reactivity)
   - [ ] Aggregations display correctly

3. **Expense Management**:
   - [ ] Create new expense
   - [ ] Verify accounting entry auto-created
   - [ ] Check category totals update
   - [ ] Delete expense (if supported)

4. **Filters**:
   - [ ] Church filter works
   - [ ] Month/year filter works
   - [ ] Status filter works (open/closed/all)

---

#### 2.3 Performance Benchmarking

**Tools**: Browser DevTools Network tab, Convex Dashboard

**Benchmarks**:
| Operation | Target | Measured | Status |
|-----------|--------|----------|--------|
| Summary (single church) | <500ms | ? | ⏳ |
| Summary (all churches) | <2s | ? | ⏳ |
| Ledger list (year) | <300ms | ? | ⏳ |
| Expense list (month) | <500ms | ? | ⏳ |
| Open ledger | <1s | ? | ⏳ |
| Close ledger | <2s | ? | ⏳ |

**How to Measure**:
1. Open Convex Dashboard → Functions
2. Find function (e.g., `accounting:getSummary`)
3. Check "Avg Execution Time"

**If performance is slow**:
- Add indexes to `convex/schema.ts` (if missing)
- Review query filters (avoid full table scans)
- Consider pagination for large result sets

---

### Step 3: Address Code Review Recommendations

**Estimated Time**: 1 hour
**Priority**: HIGH (before production)

#### 3.1 Add Request Logging

**File**: `src/app/api/accounting/route.ts`

**Add at line 270** (start of `handleGetConvex`):
```typescript
async function handleGetConvex({
  type,
  churchIdParam,
  monthParam,
  yearParam,
  statusParam,
}: ConvexQueryParams): Promise<NextResponse> {
  // 🆕 ADD THIS
  console.log(`[Accounting API] GET type=${type} church=${churchIdParam} month=${monthParam} year=${yearParam}`);

  try {
    // ... existing code
  }
}
```

**Benefit**: Debugging production issues via Vercel logs.

---

#### 3.2 Type Ledger Status

**File**: `convex/accounting.ts`

**Change line 174**:
```typescript
// Before:
status: string;

// After:
status: "open" | "closed" | "reconciled" | "not_created";
```

**Benefit**: TypeScript enforces valid status values.

---

#### 3.3 Add API Documentation

**File**: `src/app/api/accounting/route.ts`

**Add at top of file** (after imports):
```typescript
/**
 * Accounting API - Convex-native endpoint for financial operations
 *
 * GET /api/accounting
 * Query parameters:
 *   - type: "summary" | "ledger" | "expenses" | "entries"
 *   - church_id?: number (Supabase ID, optional for admin)
 *   - month?: number (1-12, optional)
 *   - year?: number (e.g., 2025, optional)
 *   - status?: "open" | "closed" | "reconciled" (ledger only)
 *
 * POST /api/accounting
 * Body:
 *   - type: "open_ledger" | "close_ledger" | "expense" | "entry"
 *   - ... (type-specific fields)
 *
 * Authorization: Requires treasurer role minimum
 * Church scoping: Non-admin users restricted to their church
 */
```

**Benefit**: Clear API contract for frontend developers.

---

### Step 4: Pre-Production Deployment Checklist

**Estimated Time**: 1 hour
**Priority**: CRITICAL

#### 4.1 Code Quality Checks

```bash
# TypeScript compilation
npm run typecheck

# ESLint (strict mode)
npm run lint:strict

# Production build
npm run build
```

**All must pass** before deploying.

---

#### 4.2 Commit Changes

```bash
git status
git add -A
git commit -m "feat(accounting): complete WS-7 Phase 6 - API migration to Convex

- Added getSummary query for accounting dashboard
- Migrated /api/accounting GET handlers to Convex
- Removed USE_CONVEX_ACCOUNTING feature flag
- Updated balance propagation (adapters, normalizers, UI)
- Deleted legacy SupabaseAuth component

Phases complete: 1-6
Next: Phase 7 testing + Phase 4 validation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

#### 4.3 Deploy Convex Schema/Functions

```bash
# Deploy to production Convex
npx convex deploy
```

**Validation**:
- [ ] Deployment succeeds
- [ ] Check Convex dashboard (prod environment)
- [ ] All functions visible: `accounting:getSummary`, `monthlyLedgers:listLedgers`, etc.

---

#### 4.4 Run Production Data Migration (If Phase 4 Not Done)

**⚠️ CRITICAL**: Only run if Phase 4 was skipped earlier.

```bash
# Set production environment variables
export DATABASE_URL="<production-supabase-url>"
export CONVEX_URL="<production-convex-url>"
export CONVEX_ADMIN_KEY="<production-admin-key>"

# Run migrations
npm run migrate-ledgers
npm run migrate-entries

# Validate
npm run validate-accounting-migration
```

**Checklist**:
- [ ] All migrations succeed
- [ ] Validation passes
- [ ] Production Convex dashboard shows data

---

#### 4.5 Deploy Next.js to Vercel

```bash
# Deploy to production
vercel --prod
```

**Wait for deployment**, then verify:
- [ ] Deployment succeeds (no build errors)
- [ ] Vercel logs show no startup errors
- [ ] Environment variables set correctly

---

### Step 5: Production Smoke Testing

**Estimated Time**: 30 minutes
**Priority**: CRITICAL

#### 5.1 Production API Tests

```bash
# Replace with your production URL
PROD_URL="https://ipupytesoreria.vercel.app"

# Test summary (should require auth)
curl "$PROD_URL/api/accounting?type=summary"

# Test ledger list
curl "$PROD_URL/api/accounting?type=ledger&church_id=1&year=2025"
```

**Expected**:
- ✅ Requires authentication (401 if no auth cookie)
- ✅ Returns data if authenticated
- ✅ No 500 errors

---

#### 5.2 UI Smoke Test

**Login to production** as treasurer/admin:

**Test Flows**:
1. Navigate to Accounting section
2. Select church from dropdown
3. View ledger (should show transactions)
4. Check balances display correctly
5. Try opening/closing a ledger (test period)
6. Verify no console errors

**Checklist**:
- [ ] UI loads without errors
- [ ] Data displays correctly
- [ ] Balances match expectations
- [ ] No infinite loops or crashes

---

#### 5.3 Monitor Production Logs

**Vercel Logs**:
```bash
vercel logs --prod
```

**Watch for**:
- ❌ 500 errors
- ❌ Convex connection errors
- ❌ "Unauthorized" errors (should be rare)

**Convex Dashboard** (prod):
- Go to Functions → Logs
- Check for errors in `accounting:getSummary`, `monthlyLedgers:listLedgers`

**Monitoring Period**: First 24 hours after deployment

**Success Criteria**:
- ✅ Error rate < 1%
- ✅ No user-reported data issues
- ✅ Performance acceptable (<2s for most queries)

---

## Phase 8: Cleanup (After 1 Month)

**Status**: 🔵 FUTURE WORK
**Trigger**: 1 month of successful Convex operation

**Tasks**:
1. Remove PostgreSQL handler functions from `/api/accounting`
2. Delete `src/lib/db.ts`, `src/lib/db-context.ts` (if unused)
3. Remove `pg` package from `package.json`
4. Drop PostgreSQL accounting tables (BACKUP FIRST!)
5. Update documentation to reflect Convex-only architecture

**See**: [WS7_EXECUTION_CHECKLIST.md](./WS7_EXECUTION_CHECKLIST.md#post-migration-cleanup-after-1-month-) for details.

---

## Rollback Plan (If Needed)

**Trigger**: Critical errors, data corruption, or >5% error rate

### Immediate Rollback Steps

**⚠️ Note**: Since `USE_CONVEX_ACCOUNTING` flag was removed, rollback requires code deployment.

1. **Revert Git Commit**:
   ```bash
   git revert HEAD~1  # Or specific commit SHA
   git push origin main
   ```

2. **Redeploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Verify PostgreSQL Path Active**:
   ```bash
   curl https://ipupytesoreria.vercel.app/api/accounting?type=ledger
   # Should hit PostgreSQL (check response structure)
   ```

4. **Investigate Convex Errors**:
   - Check Convex dashboard logs
   - Review error patterns
   - Fix issues before re-enabling

---

## Success Criteria

**Phase 7 Complete When**:
- ✅ All manual tests pass
- ✅ Production smoke tests pass
- ✅ No data discrepancies found
- ✅ Performance meets targets (<2s for queries)
- ✅ Error rate < 1% for 1 week

**Phase 8 Ready When**:
- ✅ 1 month of stable Convex operation
- ✅ Zero data corruption reports
- ✅ User acceptance confirmed
- ✅ Final PostgreSQL backup created

---

## Timeline Estimate

| Step | Description | Estimated Time | Priority |
|------|-------------|---------------|----------|
| **Step 1** | Phase 4 Data Validation/Migration | 2-3 hours | 🔴 CRITICAL |
| **Step 2** | Phase 7 Comprehensive Testing | 4-6 hours | 🟡 HIGH |
| **Step 3** | Code Review Recommendations | 1 hour | 🟡 HIGH |
| **Step 4** | Pre-Production Checklist | 1 hour | 🔴 CRITICAL |
| **Step 5** | Production Smoke Testing | 30 minutes | 🔴 CRITICAL |
| **Total** | **9-11.5 hours** (1-2 work days) | | |

---

## Next Immediate Action

**START HERE**:

1. **Verify Phase 4 Status** (5 minutes):
   ```bash
   npx convex dashboard
   # Check: Data → monthlyLedgers (count should be ~264)
   # Check: Data → accountingEntries (count should be ~4,000+)
   ```

2. **If Phase 4 NOT complete**:
   - Go to [Step 1.2.1 - Execute Monthly Ledger Migration](#121-execute-monthly-ledger-migration)

3. **If Phase 4 IS complete**:
   - Go to [Step 2 - Phase 7 Testing](#step-2-phase-7-comprehensive-testing)

---

**Document Status**: ✅ READY FOR EXECUTION
**Last Updated**: 2025-10-10
**Owner**: IPU PY Development Team
