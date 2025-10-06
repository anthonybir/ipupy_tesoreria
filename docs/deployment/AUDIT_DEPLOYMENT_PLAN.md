# Business Logic Audit - Deployment Plan

**Source**: BUSINESS_LOGIC_AUDIT_2025-01-06.md
**Status**: 13/21 tasks complete (62%) - Ready to ship Phase 1
**Last Updated**: 2025-01-06

---

## 🚢 Phase 1: Ready to Deploy NOW

### ✅ Code Commit: b6e720c (Migration 047 Compatibility)

**File**: `src/app/api/reports/route.ts`
**Changes**: Removed GENERATED columns from INSERT/UPDATE
**Risk**: ✅ Low - Backward compatible
**Dependencies**: None
**Verification**: TypeScript ✅ ESLint ✅

**Deploy Command**:
```bash
git push origin main
# Vercel auto-deploys
```

**Post-Deploy Verification**:
1. Test report creation via UI
2. Test report update via admin panel
3. Verify calculations still correct
4. Check error logs (should be clean)

---

## 🗄️ Phase 2: Migration 047 (After Code Deployed)

### ✅ Migration: 047_report_totals_generated.sql

**Status**: Ready (depends on Phase 1 complete)
**File**: `migrations/047_report_totals_generated.sql`
**Changes**: Convert total_entradas, total_salidas, saldo_mes to GENERATED

**Prerequisites**:
- ✅ Code commit b6e720c deployed to production
- ✅ Report creation/update verified working
- ✅ No errors in production logs

**Deploy Steps**:
```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_047_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration via Supabase dashboard
# OR via psql:
psql $DATABASE_URL < migrations/047_report_totals_generated.sql

# 3. Verify GENERATED columns created
psql $DATABASE_URL -c "
  SELECT column_name, is_generated
  FROM information_schema.columns
  WHERE table_name = 'reports'
    AND column_name IN ('total_entradas', 'total_salidas', 'saldo_mes');
"
```

**Post-Migration Verification**:
```sql
-- Test auto-calculation
INSERT INTO reports (church_id, month, year, diezmos, ofrendas)
VALUES (1, 12, 2099, 100000, 50000);

SELECT total_entradas, total_salidas, saldo_mes
FROM reports WHERE month = 12 AND year = 2099;
-- Should show auto-calculated values

DELETE FROM reports WHERE month = 12 AND year = 2099;
```

---

## ⏸️ Phase 3: Migration 046 (BLOCKED - Reconciliation Required)

### ⚠️ Migration: 046_fund_balance_check.sql

**Status**: ⚠️ **BLOCKED** - Cannot deploy until reconciliation
**Blocker**: General fund has negative balance
**Runbook**: [MIGRATION_046_DEPLOYMENT.md](./MIGRATION_046_DEPLOYMENT.md)

**Action Required BEFORE Deployment**:
```sql
-- 1. Check current state
SELECT id, name, current_balance
FROM funds
WHERE current_balance < 0;

-- 2. Reconcile negative balances (see runbook for options)
-- 3. Get National Treasurer approval
-- 4. Verify all balances >= 0
-- 5. ONLY THEN deploy migration 046
```

**DO NOT DEPLOY** migration 046 until all funds have non-negative balances.

---

## 📊 Completed Work (Safe in Production)

### CRITICAL Fixes (4/4) ✅
- Event approval authorization (commit 75c1e5b)
- Bank deposit validation (commit 75c1e5b)
- GENERATED fondo_nacional (migration 042)
- Negative balance prevention (migration 043)

### HIGH Priority Fixes (6/6) ✅
- RLS policy for approved reports (migration 044, commit b70971b)
- Pre-commit hook enforcement (commit b70971b)
- Race condition fix (commit cdf726b)
- Documentation updates (commit b70971b)
- Performance indexes (migration 045, commit b70971b)
- RLS compliance audit (commit b70971b)

### MEDIUM Technical Debt (3/8) ✅
- Fund transfer helper library (commit 6641d2f)
- Fund balance constraint (migration 046 - blocked)
- Report totals GENERATED (migration 047 - ready)

---

## 🎯 Deployment Sequence Summary

**Today (Safe to deploy)**:
1. ✅ Deploy code commit b6e720c
2. ⏳ Verify production works
3. ⏳ Deploy migration 047
4. ⏳ Verify GENERATED columns work

**Later (After reconciliation)**:
5. ⏳ Reconcile General fund negative balance
6. ⏳ Get treasurer approval
7. ⏳ Deploy migration 046

---

## 📈 Overall Progress

**13/21 tasks complete (62%)**
- CRITICAL: 4/4 (100%) ✅
- HIGH: 6/6 (100%) ✅
- MEDIUM: 3/8 (38%) - 2 ready, 1 blocked
- LOW: 0/3 (0%)

**Remaining Work** (5 MEDIUM + 3 LOW tasks):
- Workflow tests
- Migration 029 audit
- API documentation
- Provider RUC validation
- Error-handling tests
- GraphQL API (low priority)
- Real-time notifications (low priority)
- Export scheduler (low priority)

---

## 🆘 Rollback Procedures

**If migration 047 fails**:
```sql
-- Drop GENERATED columns
ALTER TABLE reports DROP COLUMN IF EXISTS total_entradas;
ALTER TABLE reports DROP COLUMN IF EXISTS total_salidas;
ALTER TABLE reports DROP COLUMN IF EXISTS saldo_mes;

-- Restore from backup
psql $DATABASE_URL < backup_047_YYYYMMDD_HHMMSS.sql
```

**If code deployment breaks**:
```bash
# Vercel: Roll back to previous deployment via dashboard
# OR redeploy previous commit:
git revert b6e720c
git push origin main
```

---

**Last Updated**: 2025-01-06
**Next Steps**: Deploy Phase 1 (code commit b6e720c)
