-- Migration 049: Add national_treasurer Role to RLS Policies
-- Created: 2025-10-06
-- Purpose: Patch existing RLS policies to include national_treasurer role
-- Context: Migration 040 added national_treasurer role (level 6) but did not update
--          RLS policies created in migrations 010, 026, 027, 044
--
-- Critical Gap: national_treasurer role currently blocked by RLS despite
--               having permissions in role_permissions table
--
-- Tables Affected:
-- - providers (migration 027)
-- - fund_events, fund_event_budget_items, fund_event_actuals (migration 026)
-- - reports (migration 044)
-- - fund_director_assignments (migration 026)
-- - Helper functions (migration 010, 026)

BEGIN;

-- =============================================================================
-- PHASE 1: UPDATE RLS HELPER FUNCTIONS
-- =============================================================================

-- Update existing helper: app_user_has_fund_access()
-- Migration 026 version only checks admin + treasurer
-- Now include national_treasurer at same level as admin/treasurer
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- National-level roles always have access (admin, national_treasurer, treasurer)
  IF app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer') THEN
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
  'Returns true if user has access to specified fund. National roles (admin, national_treasurer, treasurer) always have access. Fund directors checked against assignments table.';

-- =============================================================================
-- PHASE 2: FUND_DIRECTOR_ASSIGNMENTS TABLE (Migration 026)
-- =============================================================================

-- Update view policy: national_treasurer can view assignments
DROP POLICY IF EXISTS "Admins/treasurers can view all fund director assignments" ON fund_director_assignments;
CREATE POLICY "Admins/treasurers can view all fund director assignments"
ON fund_director_assignments FOR SELECT TO authenticated
USING (
  app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')
  OR profile_id = app_current_user_id()
);

-- Update manage policy: national_treasurer can manage assignments
DROP POLICY IF EXISTS "Only admins can manage fund director assignments" ON fund_director_assignments;
CREATE POLICY "Only admins can manage fund director assignments"
ON fund_director_assignments FOR ALL TO authenticated
USING (app_current_user_role() IN ('admin', 'national_treasurer'))
WITH CHECK (app_current_user_role() IN ('admin', 'national_treasurer'));

-- =============================================================================
-- PHASE 3: PROVIDERS TABLE (Migration 027)
-- =============================================================================

-- View policy: All transaction creators can view providers
DROP POLICY IF EXISTS "Transaction creators can view providers" ON providers;
CREATE POLICY "Transaction creators can view providers" ON providers
  FOR SELECT
  USING (
    app_current_user_role() IN (
      'admin',
      'national_treasurer',  -- ADDED
      'treasurer',
      'pastor',
      'fund_director',
      'secretary'
    )
  );

-- Insert policy: Transaction creators can add providers
DROP POLICY IF EXISTS "Transaction creators can create providers" ON providers;
CREATE POLICY "Transaction creators can create providers" ON providers
  FOR INSERT
  WITH CHECK (
    app_current_user_role() IN (
      'admin',
      'national_treasurer',  -- ADDED
      'treasurer',
      'pastor',
      'fund_director',
      'secretary'
    )
  );

-- Update/Delete policies remain admin/treasurer only (per original design)
DROP POLICY IF EXISTS "Admin and treasurer can update providers" ON providers;
CREATE POLICY "Admin and treasurer can update providers" ON providers
  FOR UPDATE
  USING (app_current_user_role() IN ('admin', 'treasurer'))
  WITH CHECK (app_current_user_role() IN ('admin', 'treasurer'));

DROP POLICY IF EXISTS "Only admin can delete providers" ON providers;
CREATE POLICY "Only admin can delete providers" ON providers
  FOR DELETE
  USING (app_current_user_role() = 'admin');

-- =============================================================================
-- PHASE 4: FUND EVENTS TABLE (Migration 026)
-- =============================================================================

-- View policy: national_treasurer sees all events (like admin/treasurer)
DROP POLICY IF EXISTS "Fund directors view all their events" ON fund_events;
CREATE POLICY "Fund directors view all their events"
ON fund_events FOR SELECT TO authenticated
USING (
  (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
  OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
);

-- Full access policy: national_treasurer has same access as admin/treasurer
DROP POLICY IF EXISTS "Treasurers manage all events" ON fund_events;
CREATE POLICY "Treasurers manage all events"
ON fund_events FOR ALL TO authenticated
USING (app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer'))  -- ADDED national_treasurer
WITH CHECK (app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer'));

-- =============================================================================
-- PHASE 5: FUND EVENT BUDGET ITEMS (Migration 026)
-- =============================================================================

-- Budget items inherit event access - national_treasurer inherits via app_user_has_fund_access()
DROP POLICY IF EXISTS "Budget items inherit event access - read" ON fund_event_budget_items;
CREATE POLICY "Budget items inherit event access - read"
ON fund_event_budget_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

DROP POLICY IF EXISTS "Budget items inherit event access - write" ON fund_event_budget_items;
CREATE POLICY "Budget items inherit event access - write"
ON fund_event_budget_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND status IN ('draft', 'pending_revision')
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

DROP POLICY IF EXISTS "Budget items inherit event access - update" ON fund_event_budget_items;
CREATE POLICY "Budget items inherit event access - update"
ON fund_event_budget_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND status IN ('draft', 'pending_revision')
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

DROP POLICY IF EXISTS "Budget items inherit event access - delete" ON fund_event_budget_items;
CREATE POLICY "Budget items inherit event access - delete"
ON fund_event_budget_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND status IN ('draft', 'pending_revision')
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

-- =============================================================================
-- PHASE 6: FUND EVENT ACTUALS (Migration 026)
-- =============================================================================

DROP POLICY IF EXISTS "Event actuals inherit event access - read" ON fund_event_actuals;
CREATE POLICY "Event actuals inherit event access - read"
ON fund_event_actuals FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

DROP POLICY IF EXISTS "Event actuals inherit event access - write" ON fund_event_actuals;
CREATE POLICY "Event actuals inherit event access - write"
ON fund_event_actuals FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

DROP POLICY IF EXISTS "Event actuals inherit event access - update/delete" ON fund_event_actuals;
CREATE POLICY "Event actuals inherit event access - update/delete"
ON fund_event_actuals FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

-- =============================================================================
-- PHASE 7: FUND EVENT AUDIT (Migration 026)
-- =============================================================================

DROP POLICY IF EXISTS "Event audit trail - read" ON fund_event_audit;
CREATE POLICY "Event audit trail - read"
ON fund_event_audit FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

DROP POLICY IF EXISTS "Event audit trail - write" ON fund_event_audit;
CREATE POLICY "Event audit trail - write"
ON fund_event_audit FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'national_treasurer', 'treasurer')  -- ADDED national_treasurer
    )
  )
);

-- =============================================================================
-- PHASE 8: REPORTS TABLE (Migration 044)
-- =============================================================================

-- Approved report modification: national_treasurer can correct approved reports
DROP POLICY IF EXISTS "prevent_approved_report_modification" ON reports;
CREATE POLICY "prevent_approved_report_modification" ON reports
  FOR UPDATE
  USING (
    estado != 'procesado'
    OR
    app_current_user_role() IN ('admin', 'national_treasurer')  -- ADDED national_treasurer
  );

COMMENT ON POLICY "prevent_approved_report_modification" ON reports IS
  'Prevents modification of approved reports (estado=procesado) except by admin or national_treasurer';

COMMIT;

-- =============================================================================
-- MANUAL TESTING QUERIES (Run after migration to verify)
-- =============================================================================

-- Test 1: Verify national_treasurer can view providers
-- SET app.current_user_role = 'national_treasurer';
-- SET app.current_user_id = '<test-uuid>';
-- SELECT COUNT(*) FROM providers;
-- Expected: Returns count successfully (no permission denied)

-- Test 2: Verify national_treasurer can view fund_events
-- SELECT COUNT(*) FROM fund_events;
-- Expected: Returns count successfully

-- Test 3: Verify national_treasurer can modify approved reports
-- UPDATE reports SET observaciones = 'Test correction' WHERE estado = 'procesado' LIMIT 1 RETURNING id;
-- Expected: Returns updated row

-- Test 4: Verify church treasurer CANNOT view fund_events
-- SET app.current_user_role = 'treasurer';
-- SET app.current_user_church_id = '1';
-- SELECT * FROM fund_events;
-- Expected: Returns 0 rows (church treasurer blocked from national fund events)
