-- Migration 050: Fix app_user_has_fund_access() to Block Church Roles
-- Created: 2025-10-06
-- Purpose: CRITICAL FIX - Close RLS vulnerability where church roles bypass fund event restrictions
--
-- Issue: Migration 049 updated helper function but left 'treasurer' with access
--        Treasurer is a CHURCH-SCOPED role (migration 038 removed events.approve)
--        Church roles (treasurer, pastor, church_manager, secretary) should NOT access national funds
--
-- Root Cause: Two overloads of app_user_has_fund_access() exist:
--   1. BIGINT version (older) - returns TRUE for treasurer + "other roles"
--   2. INTEGER version (migration 049) - returns TRUE for treasurer
--
-- Security Impact:
--   - BEFORE: Church treasurers can query fund_events directly via SQL despite UI/API blocks
--   - AFTER: Only national roles (admin, national_treasurer) + fund_director have access
--
-- Related: Migration 038 (removed treasurer events.approve permission)
-- Related: Migration 040 (national_treasurer role - level 6, above treasurer level 3)
-- Related: Migration 049 (attempted fix but missed treasurer classification)

BEGIN;

-- =============================================================================
-- FIX 1: Update INTEGER overload (migration 049 version)
-- =============================================================================

-- Remove 'treasurer' from national-level roles
-- Only admin + national_treasurer should have unrestricted fund access
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles with unrestricted fund access
  -- REMOVED: 'treasurer' (church-scoped role, not national)
  IF app_current_user_role() IN ('admin', 'national_treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Fund directors: check assignments
  IF app_user_is_fund_director() THEN
    RETURN (
      p_fund_id = ANY(app_user_assigned_funds()) OR
      EXISTS (
        SELECT 1 FROM fund_director_assignments
        WHERE profile_id = app_current_user_id()
        AND fund_id IS NULL  -- NULL = all funds assignment
      )
    );
  END IF;

  -- Church-scoped roles (treasurer, pastor, church_manager, secretary):
  -- NO ACCESS to national fund events
  RETURN FALSE;
END $$;

COMMENT ON FUNCTION app_user_has_fund_access(p_fund_id INTEGER) IS
  'Returns true if user can access specified fund. National roles (admin, national_treasurer) have unrestricted access. Fund directors checked via assignments. Church roles (treasurer, pastor, etc.) blocked.';

-- =============================================================================
-- FIX 2: Update BIGINT overload (legacy version)
-- =============================================================================

-- Align with INTEGER version logic
-- Remove SECURITY DEFINER to use session context (safer)
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  -- Get user context
  v_user_id := COALESCE(
    (current_setting('app.current_user_id', true))::uuid,
    auth.uid()
  );

  -- Get user role from profiles
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id;

  -- National-level roles with unrestricted access
  -- FIXED: Removed 'treasurer', added 'national_treasurer'
  IF v_role IN ('admin', 'national_treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Fund directors: check assignments
  IF v_role = 'fund_director' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.fund_director_assignments
      WHERE profile_id = v_user_id
      AND (fund_id = p_fund_id OR fund_id IS NULL)  -- Match specific fund or all-funds assignment
    );
  END IF;

  -- Church-scoped roles: BLOCKED from national fund access
  -- FIXED: Changed from "RETURN TRUE" to "RETURN FALSE"
  -- Roles: treasurer, pastor, church_manager, secretary
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION app_user_has_fund_access(p_fund_id BIGINT) IS
  'Legacy BIGINT overload. Returns true if user can access specified fund. National roles (admin, national_treasurer) have unrestricted access. Church roles blocked.';

COMMIT;

-- =============================================================================
-- VERIFICATION TESTS
-- =============================================================================

-- Test 1: Verify admin still has access
-- SET app.current_user_role = 'admin';
-- SET app.current_user_id = '00000000-0000-0000-0000-000000000001';
-- SELECT app_user_has_fund_access(1);
-- Expected: TRUE

-- Test 2: Verify national_treasurer has access
-- SET app.current_user_role = 'national_treasurer';
-- SELECT app_user_has_fund_access(1);
-- Expected: TRUE

-- Test 3: CRITICAL - Verify treasurer is NOW BLOCKED
-- SET app.current_user_role = 'treasurer';
-- SET app.current_user_church_id = '1';
-- SELECT app_user_has_fund_access(1);
-- Expected: FALSE (CHANGED from TRUE)

-- Test 4: Verify pastor is blocked
-- SET app.current_user_role = 'pastor';
-- SELECT app_user_has_fund_access(1);
-- Expected: FALSE

-- Test 5: Verify fund_director with assignment has access
-- SET app.current_user_role = 'fund_director';
-- -- Assuming user has assignment for fund 1
-- SELECT app_user_has_fund_access(1);
-- Expected: TRUE (if assigned), FALSE (if not assigned)

-- Test 6: END-TO-END - Verify treasurer cannot query fund_events
-- SET app.current_user_role = 'treasurer';
-- SET app.current_user_id = '<some-treasurer-uuid>';
-- SET app.current_user_church_id = '1';
-- SELECT COUNT(*) FROM fund_events;
-- Expected: 0 (RLS blocks via helper function)
