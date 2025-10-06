-- Migration 047: Convert Report Totals to GENERATED Columns
-- Makes total_entradas, total_salidas, saldo_mes computed columns
-- Related: BUSINESS_LOGIC_AUDIT_2025-01-06.md MEDIUM Issue #13
-- Depends on: migration 042 (fondo_nacional GENERATED)
--
-- ⚠️ IMPORTANT: This migration changes INSERT/UPDATE behavior for reports table.
-- Application code MUST NOT provide values for total_entradas, total_salidas, saldo_mes.
-- These columns will be automatically calculated by the database.

-- =============================================================================
-- PART 1: Backup and Validation
-- =============================================================================

-- Create backup of current totals for verification
CREATE TEMP TABLE reports_totals_backup AS
SELECT
  id,
  total_entradas,
  total_salidas,
  saldo_mes,
  -- Manually calculate what GENERATED columns should be
  (
    COALESCE(diezmos, 0) +
    COALESCE(ofrendas, 0) +
    COALESCE(anexos, 0) +
    COALESCE(caballeros, 0) +
    COALESCE(damas, 0) +
    COALESCE(jovenes, 0) +
    COALESCE(ninos, 0) +
    COALESCE(otros, 0)
  ) AS calculated_entradas,
  (
    COALESCE(honorarios_pastoral, 0) +
    COALESCE(fondo_nacional, 0) +
    COALESCE(energia_electrica, 0) +
    COALESCE(agua, 0) +
    COALESCE(recoleccion_basura, 0) +
    COALESCE(otros_gastos, 0)
  ) AS calculated_salidas
FROM reports;

-- Validate current data consistency
DO $$
DECLARE
  v_mismatch_count INTEGER;
  v_details TEXT;
BEGIN
  -- Check for mismatches in total_entradas
  SELECT COUNT(*) INTO v_mismatch_count
  FROM reports_totals_backup
  WHERE ABS(total_entradas - calculated_entradas) > 0.01;

  IF v_mismatch_count > 0 THEN
    SELECT string_agg(
      format('Report #%s: stored=₲%s, calculated=₲%s',
             id, total_entradas::text, calculated_entradas::text),
      E'\n'
    ) INTO v_details
    FROM reports_totals_backup
    WHERE ABS(total_entradas - calculated_entradas) > 0.01
    LIMIT 10;

    RAISE WARNING E'Found % reports with total_entradas mismatches:\n%',
      v_mismatch_count, v_details;
  END IF;

  -- Check for mismatches in total_salidas
  SELECT COUNT(*) INTO v_mismatch_count
  FROM reports_totals_backup
  WHERE ABS(total_salidas - calculated_salidas) > 0.01;

  IF v_mismatch_count > 0 THEN
    SELECT string_agg(
      format('Report #%s: stored=₲%s, calculated=₲%s',
             id, total_salidas::text, calculated_salidas::text),
      E'\n'
    ) INTO v_details
    FROM reports_totals_backup
    WHERE ABS(total_salidas - calculated_salidas) > 0.01
    LIMIT 10;

    RAISE WARNING E'Found % reports with total_salidas mismatches:\n%',
      v_mismatch_count, v_details;
  END IF;

  RAISE NOTICE 'Pre-migration validation complete. Reviewed % reports.',
    (SELECT COUNT(*) FROM reports);
END $$;

-- =============================================================================
-- PART 2: Convert total_entradas to GENERATED Column
-- =============================================================================

-- Drop existing column
ALTER TABLE reports DROP COLUMN IF EXISTS total_entradas;

-- Recreate as GENERATED ALWAYS column
-- Formula: sum of all income components
ALTER TABLE reports
  ADD COLUMN total_entradas NUMERIC(18,2)
  GENERATED ALWAYS AS (
    COALESCE(diezmos, 0) +
    COALESCE(ofrendas, 0) +
    COALESCE(anexos, 0) +
    COALESCE(caballeros, 0) +
    COALESCE(damas, 0) +
    COALESCE(jovenes, 0) +
    COALESCE(ninos, 0) +
    COALESCE(otros, 0)
  ) STORED;

COMMENT ON COLUMN reports.total_entradas IS
  'GENERATED column (migration 047): Sum of all monthly income components. ' ||
  'Calculated as: diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros. ' ||
  'Cannot be manually overridden. Application code MUST NOT provide value on INSERT/UPDATE.';

-- =============================================================================
-- PART 3: Convert total_salidas to GENERATED Column
-- =============================================================================

-- Drop existing column
ALTER TABLE reports DROP COLUMN IF EXISTS total_salidas;

-- Recreate as GENERATED ALWAYS column
-- Formula: sum of all expense components
ALTER TABLE reports
  ADD COLUMN total_salidas NUMERIC(18,2)
  GENERATED ALWAYS AS (
    COALESCE(honorarios_pastoral, 0) +
    COALESCE(fondo_nacional, 0) +
    COALESCE(energia_electrica, 0) +
    COALESCE(agua, 0) +
    COALESCE(recoleccion_basura, 0) +
    COALESCE(otros_gastos, 0)
  ) STORED;

COMMENT ON COLUMN reports.total_salidas IS
  'GENERATED column (migration 047): Sum of all monthly expense components. ' ||
  'Calculated as: honorarios_pastoral + fondo_nacional + energia_electrica + agua + recoleccion_basura + otros_gastos. ' ||
  'Cannot be manually overridden. Application code MUST NOT provide value on INSERT/UPDATE.';

-- =============================================================================
-- PART 4: Convert saldo_mes to GENERATED Column
-- =============================================================================

-- Drop existing column if it exists
ALTER TABLE reports DROP COLUMN IF EXISTS saldo_mes;

-- Recreate as GENERATED ALWAYS column
-- Formula: total_entradas - total_salidas
ALTER TABLE reports
  ADD COLUMN saldo_mes NUMERIC(18,2)
  GENERATED ALWAYS AS (
    total_entradas - total_salidas
  ) STORED;

COMMENT ON COLUMN reports.saldo_mes IS
  'GENERATED column (migration 047): Net balance for the month. ' ||
  'Calculated as: total_entradas - total_salidas. ' ||
  'Depends on other GENERATED columns. Cannot be manually overridden.';

-- =============================================================================
-- PART 5: Verification
-- =============================================================================

DO $$
DECLARE
  v_mismatch_count INTEGER;
  v_total_reports INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_reports FROM reports;

  -- Verify total_entradas matches backup
  SELECT COUNT(*) INTO v_mismatch_count
  FROM reports r
  JOIN reports_totals_backup b ON r.id = b.id
  WHERE ABS(r.total_entradas - b.calculated_entradas) > 0.01;

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'total_entradas mismatch after migration: % reports affected', v_mismatch_count;
  END IF;

  -- Verify total_salidas matches backup
  SELECT COUNT(*) INTO v_mismatch_count
  FROM reports r
  JOIN reports_totals_backup b ON r.id = b.id
  WHERE ABS(r.total_salidas - b.calculated_salidas) > 0.01;

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'total_salidas mismatch after migration: % reports affected', v_mismatch_count;
  END IF;

  -- Verify saldo_mes is calculated correctly
  SELECT COUNT(*) INTO v_mismatch_count
  FROM reports
  WHERE ABS(saldo_mes - (total_entradas - total_salidas)) > 0.01;

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'saldo_mes calculation error: % reports affected', v_mismatch_count;
  END IF;

  RAISE NOTICE 'Migration 047 verification PASSED: All % reports have correct calculated totals', v_total_reports;
END $$;

-- =============================================================================
-- PART 6: Test GENERATED Columns (Commented Out)
-- =============================================================================

/*
-- Test: Try to manually set total_entradas (should FAIL)
INSERT INTO reports (
  church_id, month, year,
  diezmos, ofrendas,
  total_entradas  -- This will cause error
) VALUES (
  1, 1, 2025,
  100000, 50000,
  999999  -- Cannot override GENERATED
);

-- Test: Valid insert without totals (should SUCCEED)
INSERT INTO reports (
  church_id, month, year,
  diezmos, ofrendas, anexos
) VALUES (
  1, 1, 2025,
  100000, 50000, 20000
);

-- Verify calculated values
SELECT
  id,
  diezmos,
  ofrendas,
  anexos,
  total_entradas,  -- Should be 170000
  total_salidas,   -- Should be calculated
  saldo_mes        -- Should be total_entradas - total_salidas
FROM reports
WHERE church_id = 1 AND month = 1 AND year = 2025;

-- Cleanup test data
DELETE FROM reports WHERE church_id = 1 AND month = 1 AND year = 2025;
*/

-- =============================================================================
-- PART 7: Application Code Migration Notes
-- =============================================================================

COMMENT ON TABLE reports IS
  'Monthly financial reports from local churches. ' ||
  'Migration 042: fondo_nacional is GENERATED (diezmos * 0.10). ' ||
  'Migration 047: total_entradas, total_salidas, saldo_mes are GENERATED. ' ||
  'Application code MUST NOT provide values for GENERATED columns on INSERT/UPDATE. ' ||
  'See src/app/api/reports/route.ts for calculation logic that needs updating.';

-- Migration complete
RAISE NOTICE 'Migration 047 complete: total_entradas, total_salidas, saldo_mes are now GENERATED columns';
RAISE NOTICE 'IMPORTANT: Update application code to remove total_entradas, total_salidas, saldo_mes from INSERT/UPDATE statements';
