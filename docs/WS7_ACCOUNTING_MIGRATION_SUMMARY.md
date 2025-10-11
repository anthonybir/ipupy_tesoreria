# WS-7 Accounting Migration - Executive Summary

**Date:** October 10, 2025
**Status:** 📋 **READY FOR EXECUTION**
**Priority:** **HIGH** - Blocking Supabase/PostgreSQL removal
**Estimated Effort:** 24-35 hours (3-4 work days)

---

> **Update · 2025-10-10:** The `USE_CONVEX_ACCOUNTING` feature flag has been
> removed. Convex accounting is now always enabled in the application.

## Overview

This work stream migrates the **most complex PostgreSQL dependency** - the `/api/accounting` endpoint - to Convex. The accounting system handles:

- **Monthly ledger management** with stateful open/close workflows
- **Expense tracking** with provider integration
- **Double-entry accounting** system with balance validation
- **Financial summaries** with cross-table aggregations

---

## Why This is Complex

1. **Stateful workflows:** Ledger status transitions (open → closed → reconciled)
2. **Cross-table aggregations:** Closing ledgers requires summing from `reports` + `expense_records`
3. **Double-entry constraint:** Must enforce `SUM(debit) = SUM(credit)`
4. **Trigger-based logic:** PostgreSQL auto-updates balances via triggers
5. **Large data volume:** ~6,000+ accounting records to migrate
6. **Financial data integrity:** Zero tolerance for data loss or corruption

---

## Migration Strategy

### ✅ What We're Doing

1. **Schema-First Design** - Define all Convex collections before writing code
2. **Read-Path First** - Migrate queries before mutations (lower risk)
3. **Feature Flags** - _Retired_: Convex is now the default (flag removed Oct 10, 2025)
4. **Data Backfill** - One-time migration scripts with validation
5. **Parallel Testing** - Compare results between implementations
6. **Incremental Cutover** - One operation at a time
7. **Rollback Ready** - Keep PostgreSQL as backup for 1 month

### ❌ What We're NOT Doing

- ❌ Big Bang Migration (too risky)
- ❌ Dual-Write Pattern (Convex doesn't support cross-DB transactions)
- ❌ Schema changes to PostgreSQL (we're decommissioning it)

---

## 8-Phase Plan

### **Phase 1: Schema Design** (2-3 hours)

**Deliverables:**
- ✅ 6 new Convex collections defined in `convex/schema.ts`
- ✅ Updated `expense_records` with accounting API compatibility fields
- ✅ Proper indexes for efficient queries

**New Collections:**
- `monthlyLedgers` - Financial period management
- `accountingEntries` - Double-entry bookkeeping
- `transactionCategories` - Chart of accounts (reference data)
- `churchAccounts` - Bank/cash account management
- `churchTransactions` - Transaction ledger
- `churchBudgets` - Budget planning

**Commands:**
```bash
npx convex dev      # Deploy schema to dev
npx convex deploy   # Deploy to production
```

---

### **Phase 2: Reference Data Migration** (1-2 hours)

**Deliverables:**
- ✅ 30+ transaction categories migrated from PostgreSQL
- ✅ Parent-child relationships preserved
- ✅ System categories flagged correctly

**Scripts:**
- `scripts/migrate-transaction-categories.ts`

**Convex Functions:**
- `convex/accounting.ts` - Category CRUD mutations

**Commands:**
```bash
npm run migrate-categories  # One-time migration
```

---

### **Phase 3: Read-Only Queries** (4-6 hours)

**Deliverables:**
- ✅ `convex/monthlyLedger.ts` - Ledger list/get queries
- ✅ `convex/accountingEntries.ts` - Entry list + trial balance
- ✅ `convex/expenseRecords.ts` - Expense list + category totals
- ✅ All queries match PostgreSQL results

**Key Queries:**
- `listLedgers` - Filter by church/period/status
- `listEntries` - Filter by church/period + trial balance aggregation
- `listExpenses` - Filter by church/period + category totals
- `getAccountingSummary` - Comprehensive financial summary

---

### **Phase 4: Data Backfill** (3-4 hours)

**Deliverables:**
- ✅ All monthly ledgers migrated (~264 records)
- ✅ All accounting entries migrated (~4,000+ records)
- ✅ 100% data validation passed

**Scripts:**
- `scripts/migrate-monthly-ledgers.ts`
- `scripts/migrate-accounting-entries.ts`
- `scripts/validate-accounting-migration.ts`

**Validation Checks:**
- Record count matches (PostgreSQL vs Convex)
- Sample data comparison
- Aggregation totals match
- Double-entry balance check (`SUM(debit) = SUM(credit)`)

**Commands:**
```bash
npm run migrate-ledgers     # Migrate ledgers
npm run migrate-entries     # Migrate entries
npm run validate-accounting-migration  # Verify success
```

---

### **Phase 5: Write Operations (Mutations)** (6-8 hours)

**Deliverables:**
- ✅ Ledger open/close mutations with business logic
- ✅ Expense creation with auto-generated accounting entry
- ✅ Accounting entry creation with debit/credit validation
- ✅ Audit logging via `userActivity` table

**Key Mutations:**
- `openLedger` - Create new monthly ledger with opening balance
- `closeLedger` - Aggregate income/expenses and lock ledger
- `createExpenseWithEntry` - Create expense + accounting entry atomically
- `createEntries` - Batch create entries with balance validation

**Business Rules Enforced:**
- ❌ Cannot open duplicate ledger for same period
- ❌ Cannot close already-closed ledger
- ❌ Must validate `SUM(debit) = SUM(credit)` (tolerance ±0.01)
- ✅ Ledger close is immutable (status = 'closed')
- ✅ Opening balance = previous month's closing balance

---

### **Phase 6: API Route Migration** (2-3 hours)

**Deliverables:**
- ✅ Feature flag implementation (`USE_CONVEX_ACCOUNTING`) _(legacy; flag removed 2025-10-10)_
- ✅ API route calls Convex queries/mutations when flag enabled
- ✅ Backward compatibility with existing frontend

**Updated Files:**
- `src/app/api/accounting/route.ts` - Toggle between PostgreSQL/Convex

**Environment Variable:**
```bash
# Legacy: USE_CONVEX_ACCOUNTING flag removed Oct 10, 2025
```

**API Compatibility:**
- `GET /api/accounting?type=ledger` → `api.monthlyLedger.listLedgers`
- `GET /api/accounting?type=expenses` → `api.expenseRecords.listExpenses`
- `GET /api/accounting?type=entries` → `api.accountingEntries.listEntries`
- `GET /api/accounting?type=summary` → `api.monthlyLedger.getAccountingSummary`
- `POST /api/accounting type=expense` → `api.accountingEntries.createExpenseWithEntry`
- `POST /api/accounting type=entry` → `api.accountingEntries.createEntries`
- `POST /api/accounting type=open_ledger` → `api.monthlyLedger.openLedger`
- `POST /api/accounting type=close_ledger` → `api.monthlyLedger.closeLedger`

---

### **Phase 7: Testing & Validation** (4-6 hours)

**Deliverables:**
- ✅ All manual test checklist items passed
- ✅ Unit tests for critical mutations
- ✅ Parallel testing (Convex vs PostgreSQL comparison)
- ✅ Performance benchmarks met

**Test Coverage:**
- Ledger open/close workflows
- Expense creation with auto-entry
- Accounting entry batch creation
- Double-entry constraint enforcement
- Aggregation accuracy (trial balance, category totals)
- Edge cases (duplicates, invalid data, race conditions)

**Scripts:**
- `tests/unit/accounting.test.ts` - Unit tests (optional)
- `scripts/compare-accounting-results.ts` - Parallel testing

**Performance Targets:**
- List 1000+ entries: < 2 seconds
- Close ledger: < 5 seconds
- Trial balance aggregation: < 1 second

---

### **Phase 8: Cutover & Cleanup** (2-3 hours)

**Deliverables:**
- ✅ Production deployment with feature flag enabled
- ✅ 1 week monitoring period with <1% error rate
- ✅ PostgreSQL deprecation (after 1 month backup period)

**Deployment Steps:**
```bash
# 1. Deploy Convex to production
npx convex deploy

# 2. Run production migrations
npm run migrate-categories
npm run migrate-ledgers
npm run migrate-entries
npm run validate-accounting-migration

# 3. Enable feature flag (legacy – skip)
# USE_CONVEX_ACCOUNTING was removed Oct 10, 2025. No action required.

# 4. Deploy Next.js
vercel --prod
```

**Monitoring (Week 1):**
- Convex dashboard error tracking
- Vercel logs for `/api/accounting` failures
- Daily PostgreSQL vs Convex comparison
- User feedback on data accuracy

**Cleanup (After 1 month):**
```bash
# Remove feature flag (make Convex default)
# Delete PostgreSQL code paths
# Drop PostgreSQL tables (backup first!)
npm uninstall pg @types/pg
```

---

## Key Files Created/Modified

### New Files (Created)

**Documentation:**
- `docs/WS7_ACCOUNTING_MIGRATION_PLAN.md` - Phases 1-3 detailed plan
- `docs/WS7_ACCOUNTING_MIGRATION_PLAN_PART2.md` - Phases 4-8 detailed plan
- `docs/WS7_ACCOUNTING_MIGRATION_SUMMARY.md` - This file

**Scripts:**
- `scripts/migrate-transaction-categories.ts` - Migrate reference data
- `scripts/migrate-monthly-ledgers.ts` - Migrate ledgers
- `scripts/migrate-accounting-entries.ts` - Migrate entries
- `scripts/validate-accounting-migration.ts` - Validation checks
- `scripts/compare-accounting-results.ts` - Parallel testing

**Convex Functions:**
- `convex/accounting.ts` - Category management
- `convex/monthlyLedger.ts` - Ledger queries/mutations
- `convex/accountingEntries.ts` - Entry queries/mutations
- `convex/expenseRecords.ts` - Expense queries

**Tests (Optional):**
- `tests/unit/accounting.test.ts` - Unit tests

**Hooks (Optional):**
- `src/hooks/useAccounting.ts` - Convex-native React hooks

### Modified Files

**Schema:**
- `convex/schema.ts` - Add 6 new collections + update `expense_records`

**API Routes:**
- `src/app/api/accounting/route.ts` - Add Convex toggle logic

**Package Scripts:**
- `package.json` - Add migration scripts

---

## Risk Management

### High Risk (🔴 CRITICAL)

| Risk | Mitigation |
|------|------------|
| **Double-entry constraint violation** | Validate `SUM(debit) = SUM(credit)` in mutation |
| **Ledger close aggregation mismatch** | Parallel testing + validation script |
| **Migration data loss** | Count checks + rollback plan |

### Rollback Triggers

**Immediate rollback if:**
- Data corruption detected
- >5% error rate in production
- Financial discrepancies reported by users
- Critical mutation failures

**Rollback Steps:**
1. (Legacy) Switch feature flag — no longer available; rollbacks require code change
2. Redeploy Next.js
3. Verify PostgreSQL path is active (manual toggle)
4. Investigate and fix Convex issues

---

## Success Criteria

**Phase Completion:**
- ✅ All schemas deployed without errors
- ✅ 100% data migrated with validation passing
- ✅ All queries return matching results vs PostgreSQL
- ✅ All mutations functional (create/update operations work)
- ✅ API routes toggle cleanly between implementations
- ✅ All test checklist items pass
- ✅ 1 week production use with <1% error rate

**Overall Success:**
- 🎯 Zero data loss or corruption
- 🎯 All accounting operations functional in Convex
- 🎯 Performance equal or better than PostgreSQL
- 🎯 PostgreSQL can be safely decommissioned

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Schema Design | 2-3 hours | None |
| 2. Reference Data | 1-2 hours | Phase 1 complete |
| 3. Read Queries | 4-6 hours | Phase 1 complete |
| 4. Data Backfill | 3-4 hours | Phases 1-3 complete |
| 5. Mutations | 6-8 hours | Phases 1-4 complete |
| 6. API Migration | 2-3 hours | Phases 1-5 complete |
| 7. Testing | 4-6 hours | Phases 1-6 complete |
| 8. Cutover | 2-3 hours | All phases complete |

**Total:** 24-35 hours (3-4 work days)

**Suggested schedule:**
- **Day 1:** Phases 1-2 (schema + reference data)
- **Day 2:** Phases 3-4 (queries + data backfill)
- **Day 3:** Phase 5 (mutations) + Phase 6 (API migration)
- **Day 4:** Phases 7-8 (testing + deployment)

---

## Next Steps After Accounting

Once accounting migration is complete, the remaining PostgreSQL routes are:

1. ⚠️ `/api/worship-records` - Worship attendance (medium complexity)
2. ⚠️ `/api/data` - Dashboard summaries (low complexity)
3. ⚠️ `/api/financial/fund-movements` - Fund transfers (medium complexity)

**Suggested order:** Complete accounting first (highest complexity), then apply same pattern to remaining routes.

---

## Quick Start

**To begin execution:**

1. **Read detailed plans:**
   - [WS7_ACCOUNTING_MIGRATION_PLAN.md](./WS7_ACCOUNTING_MIGRATION_PLAN.md) - Phases 1-3
   - [WS7_ACCOUNTING_MIGRATION_PLAN_PART2.md](./WS7_ACCOUNTING_MIGRATION_PLAN_PART2.md) - Phases 4-8

2. **Start with Phase 1:**
   ```bash
   # Edit convex/schema.ts (add new collections from plan)
   npx convex dev
   ```

3. **Follow phases sequentially** - Each phase builds on previous

4. **Test thoroughly** - Financial data requires 100% accuracy

---

## Questions or Issues?

**Contact:** Technical Lead / Database Administrator

**Resources:**
- Convex Documentation: https://docs.convex.dev
- Migration Plan Details: [WS7_ACCOUNTING_MIGRATION_PLAN.md](./WS7_ACCOUNTING_MIGRATION_PLAN.md)
- Schema Reference: [CONVEX_SCHEMA.md](./CONVEX_SCHEMA.md)

---

**Last Updated:** October 10, 2025
**Status:** ✅ **READY FOR EXECUTION**
