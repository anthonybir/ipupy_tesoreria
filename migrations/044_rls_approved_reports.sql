-- Migration 044: Add RLS policy to prevent modification of approved reports
-- Date: 2025-01-06
-- Purpose: Database-level enforcement of approved report immutability
-- Related: BUSINESS_LOGIC_AUDIT_2025-01-06.md HIGH Issue #1

-- =============================================================================
-- HIGH PRIORITY FIX: Approved Reports Immutability
-- =============================================================================
-- Current state: Only application code prevents modification of approved reports
-- Required state: RLS policy should block UPDATE on estado='procesado' reports
-- Business rule: Once approved, reports cannot be modified (except by admin for corrections)
-- Risk: Direct database queries could bypass application-level checks

BEGIN;

-- Add restrictive UPDATE policy for approved reports
-- This works alongside existing 'reports_church_isolation' policy (FOR ALL)
-- PostgreSQL evaluates policies with OR logic for permissive policies

CREATE POLICY "prevent_approved_report_modification" ON reports
  FOR UPDATE
  USING (
    -- Allow UPDATE if report is NOT approved yet
    estado != 'procesado'
    OR
    -- OR if user is admin (can make corrections to approved reports)
    (SELECT current_setting('app.current_user_role', true) = 'admin')
  );

-- Add comment documenting the policy
COMMENT ON POLICY "prevent_approved_report_modification" ON reports IS
  'Prevents modification of approved reports (estado=procesado) except by admin. Enforces immutability requirement from BUSINESS_LOGIC.md:75';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Test 1: Verify policy exists
-- SELECT policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'reports' AND policyname = 'prevent_approved_report_modification';
-- Expected: 1 row showing USING clause with estado check

-- Test 2: Try to modify approved report as non-admin (should fail)
-- SET app.current_user_role = 'treasurer';
-- SET app.current_user_id = '<some-user-uuid>';
-- SET app.current_user_church_id = '1';
-- UPDATE reports SET diezmos = 999999 WHERE estado = 'procesado' LIMIT 1;
-- Expected: 0 rows updated (RLS blocks the update)

-- Test 3: Try to modify pending report as treasurer (should succeed)
-- UPDATE reports SET diezmos = 100000 WHERE estado = 'pendiente_admin' LIMIT 1;
-- Expected: 1 row updated (RLS allows modification of non-approved reports)

-- Test 4: Verify admin can still modify approved reports (corrections)
-- SET app.current_user_role = 'admin';
-- UPDATE reports SET observaciones = 'Corrección administrativa' WHERE estado = 'procesado' LIMIT 1;
-- Expected: 1 row updated (admin override works)

-- =============================================================================
-- IMPORTANT NOTES
-- =============================================================================
-- 1. This policy is PERMISSIVE (default), meaning it OR's with existing policies
-- 2. The existing 'reports_church_isolation' policy (FOR ALL) still applies
-- 3. Both policies must allow the operation for it to succeed
-- 4. This creates a layered security approach:
--    - Church isolation (can only see own reports)
--    - Status immutability (cannot modify approved reports)
-- 5. Admins bypass BOTH restrictions (can see all + modify approved)
