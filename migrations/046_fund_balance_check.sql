-- Migration 046: Fund Balance Non-Negative Constraint
-- Adds CHECK constraint to ensure funds.current_balance is never negative
-- Related: BUSINESS_LOGIC_AUDIT_2025-01-06.md MEDIUM Issue #12
-- Depends on: migration 045 (indexes), src/lib/fund-transfers.ts

-- =============================================================================
-- PART 1: Validate Current Data
-- =============================================================================

-- Check for any existing negative balances before adding constraint
DO $$
DECLARE
  v_negative_count INTEGER;
  v_fund_details TEXT;
BEGIN
  -- Count funds with negative balances
  SELECT COUNT(*) INTO v_negative_count
  FROM funds
  WHERE current_balance < 0;

  -- If negative balances exist, show details and abort
  IF v_negative_count > 0 THEN
    -- Build detailed error message
    SELECT string_agg(
      format('Fund #%s "%s": ₲%s', id, name, current_balance::text),
      E'\n'
    ) INTO v_fund_details
    FROM funds
    WHERE current_balance < 0;

    RAISE EXCEPTION E'Cannot add non-negative constraint: % funds have negative balances:\n%',
      v_negative_count,
      v_fund_details
    USING HINT = 'Reconcile negative balances before applying migration 046. ' ||
                 'Use fund transfers or manual corrections to bring all balances >= 0.';
  END IF;

  RAISE NOTICE 'Pre-migration validation passed: All % fund balances are non-negative',
    (SELECT COUNT(*) FROM funds);
END $$;

-- =============================================================================
-- PART 2: Add CHECK Constraint
-- =============================================================================

-- Add constraint to prevent negative balances at database level
-- This is a CRITICAL defense-in-depth layer that complements:
-- 1. Application-level validation in fund-transfers.ts (InsufficientFundsError)
-- 2. Migration 043 balance checks in process_fund_event_approval()
-- 3. Existing transaction-level balance calculations

ALTER TABLE funds
  ADD CONSTRAINT funds_balance_non_negative
  CHECK (current_balance >= 0);

COMMENT ON CONSTRAINT funds_balance_non_negative ON funds IS
  'Database-level enforcement: Fund balances must never be negative. ' ||
  'Prevents overdrafts via direct SQL manipulation or application bugs. ' ||
  'Complements application-level validation in src/lib/fund-transfers.ts.';

-- =============================================================================
-- PART 3: Verification
-- =============================================================================

-- Verify constraint was created
DO $$
DECLARE
  v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'funds_balance_non_negative'
      AND conrelid = 'funds'::regclass
  ) INTO v_constraint_exists;

  IF NOT v_constraint_exists THEN
    RAISE EXCEPTION 'Constraint funds_balance_non_negative was not created';
  END IF;

  RAISE NOTICE 'Migration 046 applied successfully: funds.current_balance >= 0 constraint active';
END $$;

-- =============================================================================
-- PART 4: Test Constraint (Optional - Commented Out)
-- =============================================================================

-- Uncomment to test constraint enforcement (will fail as expected):

/*
-- This should FAIL with constraint violation
INSERT INTO funds (name, type, description, current_balance)
VALUES ('Test Fund', 'nacional', 'Should fail', -100);

-- This should SUCCEED
INSERT INTO funds (name, type, description, current_balance)
VALUES ('Test Fund', 'nacional', 'Should succeed', 100);

-- Cleanup test data
DELETE FROM funds WHERE name = 'Test Fund';
*/

-- =============================================================================
-- PART 5: Migration Notes
-- =============================================================================

COMMENT ON TABLE funds IS
  'National funds for IPU Paraguay treasury management. ' ||
  'Migration 046 added CHECK constraint ensuring current_balance >= 0. ' ||
  'All balance mutations must validate non-negative before UPDATE/INSERT.';

-- Migration complete
RAISE NOTICE 'Migration 046 complete: Fund balance non-negative constraint enforced';
