-- Migration 042: Convert fondo_nacional to GENERATED ALWAYS column
-- Date: 2025-01-06
-- Purpose: Enforce 10% calculation at database level, prevent manual override
-- Related: BUSINESS_LOGIC_AUDIT_2025-01-06.md Critical Bug #1

-- =============================================================================
-- CRITICAL FIX: fondo_nacional Auto-Calculation
-- =============================================================================
-- Current state: fondo_nacional is a regular NUMERIC column that can be manually overridden
-- Required state: fondo_nacional should be GENERATED ALWAYS AS (diezmos * 0.10) STORED
-- Business rule: fondo_nacional must ALWAYS be exactly 10% of diezmos (no exceptions)
-- Risk: Direct SQL queries could bypass application-level calculation

BEGIN;

-- Step 1: Create temporary backup table with current data
CREATE TEMP TABLE reports_backup AS
SELECT id, church_id, month, year, diezmos, fondo_nacional,
       (diezmos * 0.10) AS calculated_fondo_nacional
FROM reports;

-- Step 2: Drop existing fondo_nacional column
ALTER TABLE reports DROP COLUMN fondo_nacional;

-- Step 3: Add fondo_nacional as GENERATED column
-- STORED ensures value is persisted and indexed efficiently
ALTER TABLE reports
  ADD COLUMN fondo_nacional NUMERIC(18,2)
  GENERATED ALWAYS AS (diezmos * 0.10) STORED;

-- Step 4: Verify calculations match for all existing reports
-- This ensures no data was lost and calculations are correct
DO $$
DECLARE
  mismatch_count INT;
  total_count INT;
  max_difference NUMERIC;
BEGIN
  -- Count total reports
  SELECT COUNT(*) INTO total_count FROM reports;

  -- Check for mismatches (tolerance: ₲0.01 for floating point precision)
  SELECT COUNT(*), COALESCE(MAX(ABS(r.fondo_nacional - rb.fondo_nacional)), 0)
  INTO mismatch_count, max_difference
  FROM reports r
  JOIN reports_backup rb ON r.id = rb.id
  WHERE ABS(r.fondo_nacional - rb.fondo_nacional) > 0.01;

  -- Log verification results
  RAISE NOTICE 'Migration 042 Verification:';
  RAISE NOTICE '  Total reports: %', total_count;
  RAISE NOTICE '  Mismatches found: %', mismatch_count;
  RAISE NOTICE '  Max difference: ₲%', max_difference;

  -- Fail migration if any mismatches detected
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'fondo_nacional calculation mismatch detected: % rows differ by up to ₲%. Migration aborted.',
      mismatch_count, max_difference
    USING HINT = 'Review calculation logic: fondo_nacional should equal diezmos * 0.10';
  END IF;

  RAISE NOTICE 'Migration 042 successful: All fondo_nacional values verified correct';
END $$;

-- Step 5: Add comment documenting the business rule
COMMENT ON COLUMN reports.fondo_nacional IS
  'Auto-calculated as 10% of diezmos. GENERATED column prevents manual override. Business rule enforced at database level per BUSINESS_LOGIC.md:386-387';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify GENERATED column is working:
-- SELECT id, diezmos, fondo_nacional, (diezmos * 0.10) AS expected
-- FROM reports
-- WHERE ABS(fondo_nacional - (diezmos * 0.10)) > 0.01
-- LIMIT 10;
-- Expected: 0 rows (no mismatches)

-- Test that manual override is prevented:
-- UPDATE reports SET fondo_nacional = 999999 WHERE id = 1;
-- Expected: ERROR: column "fondo_nacional" can only be updated to DEFAULT

-- Verify calculation on new insert:
-- INSERT INTO reports (church_id, month, year, diezmos, ofrendas, ...) VALUES (...);
-- SELECT fondo_nacional FROM reports WHERE id = LASTVAL();
-- Expected: fondo_nacional = diezmos * 0.10 automatically
