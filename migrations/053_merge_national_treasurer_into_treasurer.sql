-- Migration 053: Merge national_treasurer into treasurer Role
-- Created: 2025-10-06
-- Purpose: Consolidate national_treasurer and treasurer into single treasurer role
-- Context: User clarified treasurer is NATIONALLY scoped. No need for separate roles.
--          Pastor handles all local church operations (including finances).
--
-- Updated Role Hierarchy (6 roles → 5 roles):
-- NATIONAL: admin (level 7), treasurer (level 6), fund_director (level 5)
-- CHURCH: pastor (level 4), church_manager (level 2), secretary (level 1)
--
-- Changes:
-- 1. Delete old church-scoped treasurer permissions (scope='own')
-- 2. Copy national_treasurer permissions to treasurer (scope='all')
-- 3. Update get_role_level() function
-- 4. Remove national_treasurer from all RLS policies
-- 5. Update role check constraints

BEGIN;

-- =============================================================================
-- PHASE 1: UPDATE ROLE PERMISSIONS
-- =============================================================================

-- Step 1: Delete old church-scoped treasurer permissions
DELETE FROM role_permissions
WHERE role = 'treasurer';

-- Step 2: Copy all national_treasurer permissions to treasurer
INSERT INTO role_permissions (role, permission, scope, description)
SELECT 
  'treasurer' as role,
  permission,
  scope,
  description
FROM role_permissions
WHERE role = 'national_treasurer';

-- Step 3: Delete national_treasurer permissions (no longer needed)
DELETE FROM role_permissions
WHERE role = 'national_treasurer';

-- =============================================================================
-- PHASE 2: UPDATE ROLE LEVEL FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION get_role_level(role_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'admin' THEN 7
    WHEN 'treasurer' THEN 6              -- National treasury role (merged from national_treasurer)
    WHEN 'fund_director' THEN 5
    WHEN 'pastor' THEN 4
    WHEN 'church_manager' THEN 2
    WHEN 'secretary' THEN 1
    ELSE 0
  END;
END $$;

COMMENT ON FUNCTION get_role_level IS
  'Returns hierarchical level for role (7=highest). Treasurer is national-level role handling all treasury operations.';

-- =============================================================================
-- PHASE 3: UPDATE PROFILES TABLE CONSTRAINT
-- =============================================================================

-- Drop old constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint (remove national_treasurer)
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'treasurer', 'fund_director', 'pastor', 'church_manager', 'secretary'));

-- =============================================================================
-- PHASE 4: UPDATE RLS HELPER FUNCTIONS
-- =============================================================================

-- Update app_user_has_fund_access (INTEGER overload)
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles always have access
  -- Merged: national_treasurer → treasurer
  IF app_current_user_role() IN ('admin', 'treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Non-fund-directors have no fund access
  IF NOT app_user_is_fund_director() THEN
    RETURN FALSE;
  END IF;

  -- Fund director: check specific assignment OR all-funds assignment
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
  'Returns true if user has access to specified fund. National roles (admin, treasurer) always have access.';

-- Update app_user_has_fund_access (BIGINT overload)
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles always have access
  -- Merged: national_treasurer → treasurer
  IF app_current_user_role() IN ('admin', 'treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Non-fund-directors have no fund access
  IF NOT app_user_is_fund_director() THEN
    RETURN FALSE;
  END IF;

  -- Fund director: check specific assignment OR all-funds assignment
  RETURN (
    p_fund_id IN (SELECT * FROM app_user_assigned_funds()) OR
    EXISTS (
      SELECT 1 FROM fund_director_assignments
      WHERE profile_id = app_current_user_id()
      AND fund_id IS NULL
    )
  );
END $$;

COMMENT ON FUNCTION app_user_has_fund_access(p_fund_id BIGINT) IS
  'Legacy BIGINT overload. National roles (admin, treasurer) always have access.';

-- =============================================================================
-- PHASE 5: UPDATE ALL RLS POLICIES
-- =============================================================================

-- fund_director_assignments table (2 policies)
DROP POLICY IF EXISTS "Fund director assignments: national admins full access" ON fund_director_assignments;
CREATE POLICY "Fund director assignments: national admins full access"
  ON fund_director_assignments FOR ALL
  USING (app_current_user_role() IN ('admin', 'treasurer'));

DROP POLICY IF EXISTS "Fund director assignments: fund directors manage own" ON fund_director_assignments;
CREATE POLICY "Fund director assignments: fund directors manage own"
  ON fund_director_assignments FOR ALL
  USING (
    app_user_is_fund_director() AND
    profile_id = app_current_user_id()
  );

-- providers table (4 policies)
DROP POLICY IF EXISTS "Providers: national roles full access" ON providers;
CREATE POLICY "Providers: national roles full access"
  ON providers FOR ALL
  USING (app_current_user_role() IN ('admin', 'treasurer'));

DROP POLICY IF EXISTS "Providers: fund directors by fund" ON providers;
CREATE POLICY "Providers: fund directors by fund"
  ON providers FOR SELECT
  USING (
    app_user_is_fund_director() AND
    app_user_has_fund_access(fund_id)
  );

DROP POLICY IF EXISTS "Providers: fund directors insert to assigned funds" ON providers;
CREATE POLICY "Providers: fund directors insert to assigned funds"
  ON providers FOR INSERT
  WITH CHECK (
    app_user_is_fund_director() AND
    app_user_has_fund_access(fund_id)
  );

DROP POLICY IF EXISTS "Providers: fund directors update own assigned" ON providers;
CREATE POLICY "Providers: fund directors update own assigned"
  ON providers FOR UPDATE
  USING (
    app_user_is_fund_director() AND
    app_user_has_fund_access(fund_id)
  );

-- fund_events table (2 policies)
DROP POLICY IF EXISTS "Fund events: national roles full access" ON fund_events;
CREATE POLICY "Fund events: national roles full access"
  ON fund_events FOR ALL
  USING (app_current_user_role() IN ('admin', 'treasurer'));

DROP POLICY IF EXISTS "Fund events: fund directors by assignment" ON fund_events;
CREATE POLICY "Fund events: fund directors by assignment"
  ON fund_events FOR ALL
  USING (
    app_user_is_fund_director() AND
    app_user_has_fund_access(fund_id)
  );

-- fund_event_budget_items table (2 policies)
DROP POLICY IF EXISTS "Budget items: national roles full access" ON fund_event_budget_items;
CREATE POLICY "Budget items: national roles full access"
  ON fund_event_budget_items FOR ALL
  USING (app_current_user_role() IN ('admin', 'treasurer'));

DROP POLICY IF EXISTS "Budget items: fund directors via event" ON fund_event_budget_items;
CREATE POLICY "Budget items: fund directors via event"
  ON fund_event_budget_items FOR ALL
  USING (
    app_user_is_fund_director() AND
    EXISTS (
      SELECT 1 FROM fund_events
      WHERE id = event_id
      AND app_user_has_fund_access(fund_id)
    )
  );

-- fund_event_actuals table (2 policies)  
DROP POLICY IF EXISTS "Actuals: national roles full access" ON fund_event_actuals;
CREATE POLICY "Actuals: national roles full access"
  ON fund_event_actuals FOR ALL
  USING (app_current_user_role() IN ('admin', 'treasurer'));

DROP POLICY IF EXISTS "Actuals: fund directors via event" ON fund_event_actuals;
CREATE POLICY "Actuals: fund directors via event"
  ON fund_event_actuals FOR ALL
  USING (
    app_user_is_fund_director() AND
    EXISTS (
      SELECT 1 FROM fund_events
      WHERE id = event_id
      AND app_user_has_fund_access(fund_id)
    )
  );

-- monthly_reports table (1 policy)
DROP POLICY IF EXISTS "National roles view all monthly reports" ON monthly_reports;
CREATE POLICY "National roles view all monthly reports"
  ON monthly_reports FOR SELECT
  USING (app_current_user_role() IN ('admin', 'treasurer'));

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Test 1: Verify treasurer has all national permissions
-- SELECT role, permission, scope FROM role_permissions WHERE role = 'treasurer' ORDER BY permission;

-- Test 2: Verify national_treasurer permissions deleted
-- SELECT COUNT(*) FROM role_permissions WHERE role = 'national_treasurer';
-- Expected: 0

-- Test 3: Verify get_role_level updated
-- SELECT get_role_level('treasurer') as treasurer_level, get_role_level('national_treasurer') as removed_role;
-- Expected: treasurer_level = 6, removed_role = 0

-- Test 4: Verify treasurer can access fund events
-- SET app.current_user_role = 'treasurer';
-- SET app.current_user_id = '00000000-0000-0000-0000-000000000001';
-- SELECT app_user_has_fund_access(1::INTEGER) as can_access;
-- Expected: TRUE
