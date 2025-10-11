# WS-7 Accounting Migration - Execution Checklist

**Date Started:** _____________
**Expected Completion:** _____________
**Executed By:** _____________

---

> **Update · 2025-10-10:** The `USE_CONVEX_ACCOUNTING` feature flag is no longer
> present. Skip any steps that reference toggling this variable.

## Pre-Flight Checklist

- [ ] Read [WS7_ACCOUNTING_MIGRATION_SUMMARY.md](./WS7_ACCOUNTING_MIGRATION_SUMMARY.md)
- [ ] Read [WS7_ACCOUNTING_MIGRATION_PLAN.md](./WS7_ACCOUNTING_MIGRATION_PLAN.md) (Phases 1-3)
- [ ] Read [WS7_ACCOUNTING_MIGRATION_PLAN_PART2.md](./WS7_ACCOUNTING_MIGRATION_PLAN_PART2.md) (Phases 4-8)
- [ ] Backup PostgreSQL database: `pg_dump > backup-$(date +%Y%m%d).sql`
- [ ] Verify Convex dev environment is running: `npx convex dev`
- [ ] Create feature branch: `git checkout -b feat/ws7-accounting-migration`

---

## Phase 1: Schema Design ✅ (2-3 hours)

**Started:** __________ **Completed:** __________

### Step 1.1: Add Collections to Schema

- [ ] Open `convex/schema.ts`
- [ ] Add `monthlyLedgers` collection (see plan for schema)
- [ ] Add `accountingEntries` collection
- [ ] Add `transactionCategories` collection
- [ ] Add `churchAccounts` collection
- [ ] Add `churchTransactions` collection
- [ ] Add `churchBudgets` collection
- [ ] Verify all indexes defined correctly

### Step 1.2: Update Existing Schema

- [ ] Update `expense_records` collection
- [ ] Add fields: `category`, `approved_by`, `date`, `amount`, `provider`, `document_number`, `notes`, `provider_id`
- [ ] Add indexes: `by_provider`, `by_category`, `by_date`

### Step 1.3: Deploy Schema

- [ ] Run `npx convex dev` (should auto-deploy)
- [ ] Check Convex dashboard → Data → Tables
- [ ] Verify all 6 new tables exist
- [ ] Verify all indexes created
- [ ] No errors in console

**Validation:**
- [ ] `monthlyLedgers` table exists
- [ ] `accountingEntries` table exists
- [ ] `transactionCategories` table exists
- [ ] `churchAccounts` table exists
- [ ] `churchTransactions` table exists
- [ ] `churchBudgets` table exists
- [ ] Updated `expense_records` has new fields

---

## Phase 2: Reference Data Migration ✅ (1-2 hours)

**Started:** __________ **Completed:** __________

### Step 2.1: Create Category Migration Script

- [ ] Create `scripts/migrate-transaction-categories.ts`
- [ ] Copy script from plan (Phase 2)
- [ ] Update database connection string if needed

### Step 2.2: Create Category Mutations

- [ ] Create `convex/accounting.ts`
- [ ] Add `createCategory` mutation
- [ ] Add `updateCategoryParent` mutation
- [ ] Add `listCategories` query

### Step 2.3: Run Migration

- [ ] Add script to `package.json`: `"migrate-categories": "tsx scripts/migrate-transaction-categories.ts"`
- [ ] Run `npm run migrate-categories`
- [ ] Check output: All categories migrated successfully

**Validation:**
- [ ] Check Convex dashboard → `transactionCategories` table
- [ ] Count matches PostgreSQL: ~30 categories
- [ ] Parent-child relationships preserved
- [ ] System categories marked `is_system: true`

---

## Phase 3: Read-Only Queries ✅ (4-6 hours)

**Started:** __________ **Completed:** __________

### Step 3.1: Monthly Ledger Queries

- [ ] Create `convex/monthlyLedger.ts`
- [ ] Add `listLedgers` query
- [ ] Add `getLedgerByPeriod` query
- [ ] Test queries in Convex dashboard

### Step 3.2: Accounting Entry Queries

- [ ] Create `convex/accountingEntries.ts`
- [ ] Add `listEntries` query
- [ ] Add `getTrialBalance` query (aggregation)
- [ ] Test queries in Convex dashboard

### Step 3.3: Expense Record Queries

- [ ] Create `convex/expenseRecords.ts` (or update existing)
- [ ] Add `listExpenses` query
- [ ] Add `getCategoryTotals` query (aggregation)
- [ ] Test queries in Convex dashboard

**Validation:**
- [ ] Queries return data (empty is OK at this stage)
- [ ] No TypeScript errors
- [ ] Filters work correctly (church_id, month, year)
- [ ] Aggregations calculate correctly (trial balance, category totals)

---

## Phase 4: Data Backfill ✅ (3-4 hours)

**Started:** __________ **Completed:** __________

### Step 4.1: Ledger Migration

- [ ] Create `scripts/migrate-monthly-ledgers.ts`
- [ ] Copy script from plan
- [ ] Add `createLedgerFromMigration` mutation to `convex/monthlyLedger.ts`
- [ ] Add script to `package.json`: `"migrate-ledgers": "tsx scripts/migrate-monthly-ledgers.ts"`
- [ ] Run `npm run migrate-ledgers`
- [ ] Check output: Success count

**Validation:**
- [ ] Convex dashboard → `monthlyLedgers` count = PostgreSQL count (~264)
- [ ] Sample ledger data matches
- [ ] No duplicate errors

### Step 4.2: Accounting Entry Migration

- [ ] Create `scripts/migrate-accounting-entries.ts`
- [ ] Copy script from plan
- [ ] Add `createEntryFromMigration` mutation to `convex/accountingEntries.ts`
- [ ] Add script to `package.json`: `"migrate-entries": "tsx scripts/migrate-accounting-entries.ts"`
- [ ] Run `npm run migrate-entries`
- [ ] Check output: Success count (~4,000+)

**Validation:**
- [ ] Convex dashboard → `accountingEntries` count = PostgreSQL count
- [ ] Sample entry data matches
- [ ] No migration errors

### Step 4.3: Validation Script

- [ ] Create `scripts/validate-accounting-migration.ts`
- [ ] Copy script from plan
- [ ] Add script to `package.json`: `"validate-accounting-migration": "tsx scripts/validate-accounting-migration.ts"`
- [ ] Run `npm run validate-accounting-migration`

**Validation Checks:**
- [ ] Record counts match (ledgers, entries, categories)
- [ ] Sample data verification passed
- [ ] Total debit = Total credit (difference < 1.00)
- [ ] All aggregations match

---

## Phase 5: Write Operations (Mutations) ✅ (6-8 hours)

**Started:** __________ **Completed:** __________

### Step 5.1: Ledger Open/Close Mutations

- [ ] Add `openLedger` mutation to `convex/monthlyLedger.ts`
- [ ] Add `closeLedger` mutation to `convex/monthlyLedger.ts`
- [ ] Test `openLedger` in Convex dashboard
- [ ] Test `closeLedger` in Convex dashboard

**Test Cases:**
- [ ] Open ledger succeeds with correct opening balance
- [ ] Cannot open duplicate ledger (error)
- [ ] Close ledger aggregates income/expenses correctly
- [ ] Cannot close already-closed ledger (error)

### Step 5.2: Expense & Entry Mutations

- [ ] Add `createExpenseWithEntry` mutation to `convex/accountingEntries.ts`
- [ ] Add `createEntries` mutation to `convex/accountingEntries.ts`
- [ ] Test expense creation in Convex dashboard
- [ ] Test batch entry creation in Convex dashboard

**Test Cases:**
- [ ] Create expense auto-generates accounting entry
- [ ] Expense and entry linked via `expense_record_id`
- [ ] Batch entries validate debit = credit
- [ ] Unbalanced entries rejected (error)

### Step 5.3: Summary Query

- [ ] Add `getAccountingSummary` query to `convex/monthlyLedger.ts`
- [ ] Test summary query in Convex dashboard
- [ ] Verify aggregations match PostgreSQL

---

## Phase 6: API Route Migration ✅ (2-3 hours)

**Started:** __________ **Completed:** __________

### Step 6.1: Update API Route

- [ ] Open `src/app/api/accounting/route.ts`
- [ ] (Legacy) Feature flag check removed — ensure Convex handlers always run
- [ ] Implement Convex GET handler (see plan)
- [ ] Implement Convex POST handler (see plan)
- [ ] Keep legacy PostgreSQL handlers intact

### Step 6.2: Local Testing

- [ ] (Legacy) `.env.local` flag no longer needed
- [ ] Restart Next.js dev server
- [ ] Test GET `/api/accounting?type=ledger` (should use Convex)
- [ ] Test GET `/api/accounting?type=expenses`
- [ ] Test GET `/api/accounting?type=entries`
- [ ] Test GET `/api/accounting?type=summary`
- [ ] Test POST `/api/accounting` type=open_ledger
- [ ] Test POST `/api/accounting` type=close_ledger
- [ ] Test POST `/api/accounting` type=expense
- [ ] Test POST `/api/accounting` type=entry

**Validation:**
- [ ] All GET requests return Convex data
- [ ] All POST requests create Convex records
- [ ] No errors in browser console
- [ ] No errors in Convex logs

---

## Phase 7: Testing & Validation ✅ (4-6 hours)

**Started:** __________ **Completed:** __________

### Step 7.1: Manual Testing Checklist

**Ledger Operations:**
- [ ] Open new ledger (various churches, months)
- [ ] Close ledger (verify aggregations)
- [ ] List ledgers (test all filters)
- [ ] Get ledger by period
- [ ] Attempt duplicate open (should fail)
- [ ] Attempt close already-closed (should fail)

**Expense Operations:**
- [ ] Create expense (verify auto-entry created)
- [ ] List expenses (test all filters)
- [ ] Get category totals
- [ ] Create expense with missing fields (should fail)

**Accounting Entries:**
- [ ] Create batch entries (balanced)
- [ ] Create unbalanced entries (should fail)
- [ ] List entries (test all filters)
- [ ] Get trial balance

**Summary:**
- [ ] Get summary for period
- [ ] Verify income/expense totals
- [ ] Verify ledger status

**Edge Cases:**
- [ ] Large data sets (1000+ records)
- [ ] Concurrent operations
- [ ] Invalid church/fund IDs
- [ ] Missing required fields

### Step 7.2: Parallel Testing

- [ ] Create `scripts/compare-accounting-results.ts`
- [ ] Run comparison: Convex vs PostgreSQL results
- [ ] Verify aggregations match (tolerance ±0.01)

**Validation:**
- [ ] All test cases passed
- [ ] No data discrepancies found
- [ ] Performance acceptable (<2s for most queries)

---

## Phase 8: Cutover & Cleanup ✅ (2-3 hours)

**Started:** __________ **Completed:** __________

### Step 8.1: Production Deployment

**Pre-deployment:**
- [ ] All previous phases completed and validated
- [ ] Code committed to git
- [ ] Pull request created and reviewed
- [ ] Backup PostgreSQL database one more time

**Deploy Convex:**
- [ ] Run `npx convex deploy` (production)
- [ ] Verify schema deployed successfully
- [ ] Check Convex dashboard (production environment)

**Run Production Migrations:**
- [ ] Set production DATABASE_URL
- [ ] Run `npm run migrate-categories` (production)
- [ ] Run `npm run migrate-ledgers` (production)
- [ ] Run `npm run migrate-entries` (production)
- [ ] Run `npm run validate-accounting-migration` (production)

**Validation Checks:**
- [ ] Production record counts match
- [ ] Aggregation totals match
- [ ] Double-entry balance verified

**Enable Feature Flag (legacy – skip):**
- [ ] (Legacy) Skip `vercel env add USE_CONVEX_ACCOUNTING production`
- [ ] (Legacy) Flag no longer appears in `vercel env ls`

**Deploy Next.js:**
- [ ] Run `vercel --prod`
- [ ] Wait for deployment to complete
- [ ] Check deployment logs (no errors)

### Step 8.2: Production Validation

- [ ] Test GET `/api/accounting?type=ledger` (production)
- [ ] Test GET `/api/accounting?type=expenses` (production)
- [ ] Test GET `/api/accounting?type=entries` (production)
- [ ] Test GET `/api/accounting?type=summary` (production)
- [ ] Create test expense (production)
- [ ] Open/close test ledger (production)

**Monitoring (Week 1):**
- [ ] Day 1: Check Convex logs (no errors)
- [ ] Day 1: Check Vercel logs (no errors)
- [ ] Day 2: Verify user operations work
- [ ] Day 3: Run comparison script (PostgreSQL vs Convex)
- [ ] Day 5: Check with users (any data issues?)
- [ ] Day 7: Final validation before cleanup

**Error Tracking:**
- [ ] Error rate < 1%
- [ ] No data corruption reported
- [ ] No user complaints about data accuracy

---

## Rollback Plan (If Needed) ⚠️

**Trigger:** Critical errors, data corruption, or >5% failure rate

**Steps:**
1. [ ] Redeploy previous production build (feature flag removed)
   ```bash
   vercel --prod
   ```
2. [ ] Verify PostgreSQL path active
   ```bash
   curl https://ipupytesoreria.vercel.app/api/accounting?type=ledger
   ```
3. [ ] Investigate Convex errors
4. [ ] Fix issues before re-enabling Convex release

---

## Post-Migration Cleanup (After 1 Month) 🧹

**Prerequisites:**
- [ ] 1 month of successful Convex operation
- [ ] Zero data discrepancies
- [ ] User acceptance confirmed
- [ ] Final PostgreSQL backup created

**Cleanup Steps:**
- [ ] Remove feature flag logic from `src/app/api/accounting/route.ts`
- [ ] Delete PostgreSQL handler functions
- [ ] Delete `src/lib/db.ts` (if no other routes use it)
- [ ] Delete `src/lib/db-context.ts`
- [ ] Delete `src/lib/db-helpers.ts`
- [ ] Remove `pg` and `@types/pg` from `package.json`
- [ ] Drop PostgreSQL tables (BACKUP FIRST!)
  ```sql
  DROP TABLE accounting_entries;
  DROP TABLE monthly_ledger;
  DROP TABLE church_transaction_categories;
  DROP TABLE expense_records; -- if fully migrated
  ```

---

## Final Sign-Off ✅

**Migration Completed By:** _____________
**Date:** _____________
**Production Deployment Date:** _____________
**Final Validation Date:** _____________

**Checklist:**
- [ ] All 8 phases completed
- [ ] Production deployment successful
- [ ] 1 week monitoring period passed
- [ ] Error rate < 1%
- [ ] User acceptance confirmed
- [ ] Documentation updated

**Notes:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed/Rollback
