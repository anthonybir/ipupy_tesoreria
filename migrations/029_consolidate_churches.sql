-- Migration 029: Consolidate duplicate church entries
-- Fixes: Caacupé duplicate, Edelira duplicates (4 → 2 churches)
-- Date: 2025-09-30

-- ============================================================================
-- CONSOLIDATION MAPPING
-- ============================================================================
-- Caacupé:  ID 43 → ID 8 (standardize with accent)
-- Edelira:  ID 37 → ID 2 (same pastor Venancio, consolidate to KM 48)
--           ID 56 → DELETE (empty duplicate of ID 21)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Update foreign key references for Caacupé consolidation
-- ============================================================================

-- Update reports: Merge ID 43 → ID 8
UPDATE reports
SET church_id = 8
WHERE church_id = 43;

-- Update profiles: Merge ID 43 → ID 8 (if any exist in future)
UPDATE profiles
SET church_id = 8
WHERE church_id = 43;

-- Note: fund_balances, fund_transactions, fund_events don't exist yet in schema


-- ============================================================================
-- STEP 2: Update foreign key references for Edelira consolidation
-- ============================================================================

-- Edelira: Merge ID 37 → ID 2 (both have same pastor, consolidate to main church)
UPDATE reports
SET church_id = 2
WHERE church_id = 37;

UPDATE profiles
SET church_id = 2
WHERE church_id = 37;

-- ID 56 has no data, will be deleted in Step 4


-- ============================================================================
-- STEP 3: Rename duplicate to avoid conflict, then soft-delete
-- ============================================================================

-- Rename ID 56 first to avoid UNIQUE constraint conflict
-- (ID 56 "IPU EDELIRA KM 28" conflicts with renaming ID 21)
UPDATE churches
SET name = 'IPU EDELIRA KM 28 (DUPLICADO)'
WHERE id = 56;

-- Now soft-delete duplicate churches
-- Caacupé duplicate (no accent)
UPDATE churches
SET active = false
WHERE id = 43;

-- Edelira duplicates
UPDATE churches
SET active = false
WHERE id IN (37, 56);


-- ============================================================================
-- STEP 4: Standardize church names for clarity
-- ============================================================================

-- Edelira churches: Add KM designation for clarity
UPDATE churches
SET name = 'IPU EDELIRA KM 48'
WHERE id = 2;

-- ID 21 currently "IPU EDELIRA 28", update to standard "KM" format
UPDATE churches
SET name = 'IPU EDELIRA KM 28'
WHERE id = 21;


-- ============================================================================
-- STEP 5: Add audit log for consolidation
-- ============================================================================

-- Log church consolidation activity
INSERT INTO user_activity (
  user_id,
  action,
  details,
  created_at
) VALUES
  -- Caacupé consolidation
  (
    (SELECT id FROM profiles WHERE email = 'administracion@ipupy.org.py' LIMIT 1),
    'church_consolidation',
    jsonb_build_object(
      'migration', '029',
      'action', 'merge',
      'from_id', 43,
      'from_name', 'IPU CAACUPE',
      'to_id', 8,
      'to_name', 'IPU CAACUPÉ'
    ),
    NOW()
  ),
  -- Edelira consolidation
  (
    (SELECT id FROM profiles WHERE email = 'administracion@ipupy.org.py' LIMIT 1),
    'church_consolidation',
    jsonb_build_object(
      'migration', '029',
      'action', 'merge',
      'from_id', 37,
      'from_name', 'IPU EDELIRA',
      'to_id', 2,
      'to_name', 'IPU EDELIRA KM 48'
    ),
    NOW()
  ),
  -- Edelira duplicate deletion
  (
    (SELECT id FROM profiles WHERE email = 'administracion@ipupy.org.py' LIMIT 1),
    'church_consolidation',
    jsonb_build_object(
      'migration', '029',
      'action', 'deactivate',
      'church_id', 56,
      'church_name', 'IPU EDELIRA KM 28 (duplicate)'
    ),
    NOW()
  );


-- ============================================================================
-- STEP 6: Verification queries
-- ============================================================================

-- Verify consolidation results (run after migration)
DO $$
DECLARE
  caacupe_count INTEGER;
  edelira_active_count INTEGER;
  edelira_inactive_count INTEGER;
BEGIN
  -- Check Caacupé consolidation
  SELECT COUNT(*) INTO caacupe_count
  FROM churches
  WHERE name ILIKE '%caacup%' AND active = true;

  IF caacupe_count != 1 THEN
    RAISE WARNING 'Expected 1 active Caacupé church, found %', caacupe_count;
  END IF;

  -- Check Edelira consolidation
  SELECT COUNT(*) INTO edelira_active_count
  FROM churches
  WHERE name ILIKE '%edelira%' AND active = true;

  SELECT COUNT(*) INTO edelira_inactive_count
  FROM churches
  WHERE name ILIKE '%edelira%' AND active = false;

  IF edelira_active_count != 2 THEN
    RAISE WARNING 'Expected 2 active Edelira churches, found %', edelira_active_count;
  END IF;

  IF edelira_inactive_count != 2 THEN
    RAISE WARNING 'Expected 2 inactive Edelira churches, found %', edelira_inactive_count;
  END IF;

  RAISE NOTICE 'Migration 029 verification complete:';
  RAISE NOTICE '  - Caacupé active churches: %', caacupe_count;
  RAISE NOTICE '  - Edelira active churches: %', edelira_active_count;
  RAISE NOTICE '  - Edelira inactive churches: %', edelira_inactive_count;
END $$;

COMMIT;


-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- To rollback this migration, create a new migration with:
--
-- BEGIN;
-- -- Restore church names
-- UPDATE churches SET name = 'IPU EDELIRA 48' WHERE id = 2;
-- UPDATE churches SET name = 'IPU EDELIRA 28' WHERE id = 21;
--
-- -- Reactivate churches
-- UPDATE churches SET active = true WHERE id IN (37, 43, 56);
--
-- -- Note: Foreign key changes are safe to keep (all point to primary churches)
-- COMMIT;
-- ============================================================================