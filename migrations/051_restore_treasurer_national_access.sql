-- Migration 051: Restore treasurer to National-Level Access in RLS Policies
-- Created: 2025-10-06
-- Purpose: REVERT migration 050 - treasurer is NATIONALLY scoped, NOT church-scoped
-- Context: Migration 050 incorrectly blocked treasurer from fund events based on
--          misunderstanding of role hierarchy. User clarified:
--          "the treasurer is a NATIONALLY scoped role, sitting JUST below the admin"
--
-- Role Hierarchy (CORRECTED):
-- NATIONAL ROLES: admin (level 7), treasurer (level 6), national_treasurer (level 6), fund_director (level 5)
-- CHURCH ROLES: pastor (level 4), church_manager (level 2), secretary (level 1)
--
-- Critical Fix: Restore 'treasurer' to app_user_has_fund_access() function
-- Both overloads (BIGINT legacy + INTEGER current) must include treasurer

BEGIN;

-- =============================================================================
-- PHASE 1: RESTORE TREASURER TO RLS HELPER FUNCTIONS
-- =============================================================================

-- Restore INTEGER overload (current, migration 049)
-- This is the primary overload used by all fund event RLS policies
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles always have access (admin, treasurer, national_treasurer)
  -- RESTORED: 'treasurer' is NATIONAL-scoped, NOT church-scoped
  IF app_current_user_role() IN ('admin', 'treasurer', 'national_treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Non-fund-directors have no fund access
  IF NOT app_user_is_fund_director() THEN
    RETURN FALSE;
  END IF;

  -- Fund director: check specific assignment OR all-funds assignment
  RETURN (
    p_fund_id = ANY(app_user_assigned_funds()) OR
    EXISTS (
      SELECT 1 FROM fund_director_assignments
      WHERE profile_id = app_current_user_id()
      AND fund_id IS NULL  -- NULL means access to all funds
    )
  );
END $$;

COMMENT ON FUNCTION app_user_has_fund_access(p_fund_id INTEGER) IS
  'Returns true if user has access to specified fund. National roles (admin, treasurer, national_treasurer) always have access. Fund directors checked against assignments table.';

-- Restore BIGINT overload (legacy compatibility)
-- Some older policies may still reference this signature
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles always have access (admin, treasurer, national_treasurer)
  -- RESTORED: 'treasurer' is NATIONAL-scoped, NOT church-scoped
  IF app_current_user_role() IN ('admin', 'treasurer', 'national_treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Non-fund-directors have no fund access
  IF NOT app_user_is_fund_director() THEN
    RETURN FALSE;
  END IF;

  -- Fund director: check specific assignment OR all-funds assignment
  RETURN (
    p_fund_id = ANY(app_user_assigned_funds()) OR
    EXISTS (
      SELECT 1 FROM fund_director_assignments
      WHERE profile_id = app_current_user_id()
      AND fund_id IS NULL  -- NULL means access to all funds
    )
  );
END $$;

COMMENT ON FUNCTION app_user_has_fund_access(p_fund_id BIGINT) IS
  'Legacy BIGINT overload. Returns true if user has access to specified fund. National roles (admin, treasurer, national_treasurer) always have access.';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration to verify)
-- =============================================================================

-- Test 1: Verify treasurer can view fund_events
-- SET app.current_user_role = 'treasurer';
-- SET app.current_user_id = '<test-uuid>';
-- SELECT COUNT(*) FROM fund_events;
-- Expected: Returns count successfully (no permission denied)

-- Test 2: Verify treasurer can view providers
-- SELECT COUNT(*) FROM providers;
-- Expected: Returns count successfully

-- Test 3: Verify pastor CANNOT view fund_events
-- SET app.current_user_role = 'pastor';
-- SET app.current_user_church_id = '1';
-- SELECT * FROM fund_events;
-- Expected: Returns 0 rows (church roles blocked from national fund events)

-- Test 4: Verify both function overloads work
-- SELECT app_user_has_fund_access(1::INTEGER) as int_overload,
--        app_user_has_fund_access(1::BIGINT) as bigint_overload;
-- Expected: Both return TRUE for treasurer role
