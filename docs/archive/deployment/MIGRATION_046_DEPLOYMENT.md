# Migration 046 Deployment Guide

**Migration**: `046_fund_balance_check.sql`
**Purpose**: Add CHECK constraint enforcing `funds.current_balance >= 0`
**Status**: ⚠️ **BLOCKED - Requires Pre-Deployment Reconciliation**
**Blocker**: General fund currently has negative balance

---

## 🚨 Pre-Deployment Requirements

### Step 1: Check for Negative Balances

Run this query in production database:

```sql
SELECT
  id,
  name,
  current_balance,
  type,
  updated_at
FROM funds
WHERE current_balance < 0
ORDER BY current_balance ASC;
```

**Expected Issue**: General fund (id=1) has negative balance.

### Step 2: Reconciliation Options

Choose **ONE** of the following approaches:

#### Option A: Manual Correction (Recommended for Production)

If the negative balance is a data error or accounting discrepancy:

```sql
-- Record the correction as a manual adjustment transaction
INSERT INTO transactions (
  date,
  church_id,
  fund_id,
  concept,
  document_number,
  amount_in,
  amount_out,
  balance,
  created_by
) VALUES (
  CURRENT_DATE,
  NULL,                              -- National-level transaction
  1,                                 -- General fund ID
  'Corrección contable - Ajuste de saldo negativo para migration 046',
  'ADJ-2025-001',
  <ABSOLUTE_VALUE_OF_NEGATIVE>,      -- Replace with actual amount
  0,
  0,                                 -- New balance = 0
  'administracion@ipupy.org.py'
);

-- Update fund balance
UPDATE funds
SET current_balance = 0,
    updated_at = NOW()
WHERE id = 1;

-- Create audit trail
INSERT INTO fund_movements_enhanced (
  fund_id,
  transaction_id,
  previous_balance,
  movement,
  new_balance
) VALUES (
  1,
  (SELECT id FROM transactions WHERE document_number = 'ADJ-2025-001'),
  <CURRENT_NEGATIVE_BALANCE>,        -- Replace with actual current balance
  <ABSOLUTE_VALUE_OF_NEGATIVE>,      -- Positive movement
  0
);
```

#### Option B: Fund Transfer from Another Fund

If another fund has surplus that can cover the deficit:

```typescript
// Use the new fund-transfers.ts helper
import { transferFunds } from '@/lib/fund-transfers';

const result = await transferFunds(
  {
    sourceChurchId: null,             // National-level
    sourceFundId: <SURPLUS_FUND_ID>,  // Fund with positive balance
    destinationFundId: 1,             // General fund
    amount: <DEFICIT_AMOUNT>,         // Amount to cover deficit
    description: 'Transferencia para cubrir déficit antes de migration 046',
    documentNumber: 'TRANS-MIG046-001'
  },
  auth
);
```

#### Option C: Postpone Migration 046

If reconciliation cannot be completed immediately:

1. **DO NOT** deploy migration 046 yet
2. Add reconciliation task to financial operations backlog
3. Schedule monthly review of fund balances
4. Deploy migration 046 only after **ALL** funds have `current_balance >= 0`

---

## 📋 Deployment Checklist

### Pre-Migration Verification

- [ ] Run negative balance check query (Step 1)
- [ ] Document all funds with `current_balance < 0`
- [ ] Choose reconciliation approach (A, B, or C)
- [ ] Execute reconciliation transactions
- [ ] **Re-run** negative balance check to verify `current_balance >= 0` for ALL funds
- [ ] Get approval from National Treasurer (`tesorero_nacional@ipupy.org.py`)

### Migration Execution

- [ ] Back up production database
  ```bash
  pg_dump $DATABASE_URL > backup_before_046_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Apply migration 046
  ```bash
  psql $DATABASE_URL < migrations/046_fund_balance_check.sql
  ```
- [ ] Verify constraint created
  ```sql
  SELECT
    conname,
    pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conname = 'funds_balance_non_negative';
  ```

### Post-Migration Validation

- [ ] Test constraint enforcement (should FAIL):
  ```sql
  -- This should raise constraint violation error
  UPDATE funds SET current_balance = -100 WHERE id = 1;
  ```
- [ ] Verify existing balances unchanged:
  ```sql
  SELECT id, name, current_balance
  FROM funds
  ORDER BY id;
  ```
- [ ] Test fund transfer helper still works:
  - Create small test transfer between two funds
  - Verify balances update correctly
  - Verify transaction records created

### Rollback Plan (If Migration Fails)

```sql
-- Drop constraint if needed
ALTER TABLE funds DROP CONSTRAINT IF EXISTS funds_balance_non_negative;

-- Restore from backup if data corrupted
psql $DATABASE_URL < backup_before_046_YYYYMMDD_HHMMSS.sql
```

---

## 🔍 Current State (as of 2025-01-06)

**Known Issue**: General fund has negative balance

**Root Cause Analysis Needed**:
1. Review recent transactions on General fund:
   ```sql
   SELECT * FROM transactions
   WHERE fund_id = 1
   ORDER BY date DESC, created_at DESC
   LIMIT 50;
   ```
2. Check for missing deposits or incorrect expense records
3. Reconcile against physical bank statements
4. Identify if data entry error or actual deficit

**Recommended Action**:
- Schedule reconciliation meeting with National Treasurer
- Review transaction history for General fund
- Determine if deficit is real or accounting error
- Apply appropriate correction (Option A or B)
- **Only then** deploy migration 046

---

## 📝 Migration Notes

**Why This Constraint Matters**:
- Prevents overdraft scenarios at database level
- Complements application-level validation (fund-transfers.ts)
- Protects against direct SQL manipulation
- Essential for financial data integrity

**Dependencies**:
- Requires src/lib/fund-transfers.ts (deployed in commit 6641d2f)
- Requires migration 045 (performance indexes)
- Assumes all fund balances are reconciled and non-negative

**Related Migrations**:
- Migration 043: Event approval balance check
- Migration 045: Performance indexes
- Future: Migration 047 (report totals GENERATED)

---

## 🆘 Support

**Questions**: `administracion@ipupy.org.py`
**National Treasurer**: `tesorero_nacional@ipupy.org.py`
**Database Admin**: Via Supabase dashboard

---

**Last Updated**: 2025-01-06
**Status**: Awaiting reconciliation before deployment
