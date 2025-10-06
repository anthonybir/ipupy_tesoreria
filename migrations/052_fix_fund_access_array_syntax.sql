-- Migration 052: Fix app_user_has_fund_access() Array Syntax Error
-- Created: 2025-10-06
-- Purpose: Fix "op ANY/ALL (array) requires array on right side" error
-- Context: Migration 051 used app_user_assigned_funds() which returns SETOF bigint,
--          not an array. Need to convert to array or use EXISTS instead.
--
-- Root Cause: app_user_assigned_funds() returns SETOF bigint (table function)
--             ANY() operator requires an actual array type
--
-- Solution: Use EXISTS with IN subquery instead of ANY()

BEGIN;

-- Fix INTEGER overload
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles always have access (admin, treasurer, national_treasurer)
  IF app_current_user_role() IN ('admin', 'treasurer', 'national_treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Non-fund-directors have no fund access
  IF NOT app_user_is_fund_director() THEN
    RETURN FALSE;
  END IF;

  -- Fund director: check specific assignment OR all-funds assignment
  -- Fixed: Use IN (SELECT ...) instead of ANY() for SETOF return type
  RETURN (
    p_fund_id IN (SELECT * FROM app_user_assigned_funds()) OR
    EXISTS (
      SELECT 1 FROM fund_director_assignments
      WHERE profile_id = app_current_user_id()
      AND fund_id IS NULL  -- NULL means access to all funds
    )
  );
END $$;

COMMENT ON FUNCTION app_user_has_fund_access(p_fund_id INTEGER) IS
  'Returns true if user has access to specified fund. National roles (admin, treasurer, national_treasurer) always have access. Fund directors checked against assignments table.';

-- Fix BIGINT overload (legacy compatibility)
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles always have access (admin, treasurer, national_treasurer)
  IF app_current_user_role() IN ('admin', 'treasurer', 'national_treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Non-fund-directors have no fund access
  IF NOT app_user_is_fund_director() THEN
    RETURN FALSE;
  END IF;

  -- Fund director: check specific assignment OR all-funds assignment
  -- Fixed: Use IN (SELECT ...) instead of ANY() for SETOF return type
  RETURN (
    p_fund_id IN (SELECT * FROM app_user_assigned_funds()) OR
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
