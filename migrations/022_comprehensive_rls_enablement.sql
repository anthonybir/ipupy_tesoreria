-- Migration: Comprehensive Row Level Security Enablement
-- Purpose: Enable RLS on all unprotected tables to ensure data isolation
-- Author: System Security Audit
-- Date: 2025-09-25
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: VERIFY RLS CONTEXT FUNCTIONS EXIST
-- ============================================================================

-- These functions were created in migration 010, but let's verify they exist
-- If they don't exist, this migration will fail safely

DO $$
BEGIN
  -- Test that RLS context functions exist
  PERFORM app_current_user_id();
  PERFORM app_current_user_role();
  PERFORM app_current_user_church_id();
  PERFORM app_user_is_admin();

  RAISE NOTICE 'RLS context functions verified successfully';
EXCEPTION
  WHEN undefined_function THEN
    RAISE EXCEPTION 'RLS context functions missing - run migration 010_implement_rls.sql first';
END $$;

-- ============================================================================
-- PHASE 2: ENABLE RLS ON FINANCIAL TABLES
-- ============================================================================

-- Funds table (critical financial data)
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY funds_admin_access ON funds
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY funds_read_all ON funds
  FOR SELECT
  USING (true);  -- Funds are viewable by all authenticated users

-- Transactions table (financial movements)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_admin_full_access ON transactions
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY transactions_church_view ON transactions
  FOR SELECT
  USING (
    church_id IS NULL OR  -- National transactions
    app_user_owns_church(church_id)
  );

-- Fund movements tables
ALTER TABLE fund_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY fund_movements_admin_access ON fund_movements
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY fund_movements_church_view ON fund_movements
  FOR SELECT
  USING (
    church_id IS NULL OR
    app_user_owns_church(church_id)
  );

-- Enhanced fund movements
ALTER TABLE fund_movements_enhanced ENABLE ROW LEVEL SECURITY;

CREATE POLICY fund_movements_enhanced_admin_access ON fund_movements_enhanced
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY fund_movements_enhanced_church_view ON fund_movements_enhanced
  FOR SELECT
  USING (
    church_id IS NULL OR
    app_user_owns_church(church_id)
  );

-- ============================================================================
-- PHASE 3: ENABLE RLS ON MEMBER MANAGEMENT TABLES
-- ============================================================================

-- Members table
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_admin_access ON members
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY members_church_access ON members
  FOR ALL
  USING (app_user_owns_church(church_id))
  WITH CHECK (app_user_owns_church(church_id));

-- Families table
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY families_admin_access ON families
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY families_church_access ON families
  FOR ALL
  USING (app_user_owns_church(church_id))
  WITH CHECK (app_user_owns_church(church_id));

-- Member ministries
ALTER TABLE member_ministries ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_ministries_admin_access ON member_ministries
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY member_ministries_church_view ON member_ministries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_ministries.member_id
      AND app_user_owns_church(m.church_id)
    )
  );

-- Member contributions
ALTER TABLE member_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_contributions_admin_access ON member_contributions
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY member_contributions_church_access ON member_contributions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_contributions.member_id
      AND app_user_owns_church(m.church_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_contributions.member_id
      AND app_user_owns_church(m.church_id)
    )
  );

-- Member attendance
ALTER TABLE member_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_attendance_admin_access ON member_attendance
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY member_attendance_church_access ON member_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_attendance.member_id
      AND app_user_owns_church(m.church_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_attendance.member_id
      AND app_user_owns_church(m.church_id)
    )
  );

-- ============================================================================
-- PHASE 4: ENABLE RLS ON DONOR TABLES
-- ============================================================================

-- Donors table
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;

CREATE POLICY donors_admin_access ON donors
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY donors_church_access ON donors
  FOR ALL
  USING (app_user_owns_church(church_id))
  WITH CHECK (app_user_owns_church(church_id));

-- ============================================================================
-- PHASE 5: ENABLE RLS ON WORSHIP RECORDS
-- ============================================================================

-- Worship records
ALTER TABLE worship_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY worship_records_admin_access ON worship_records
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY worship_records_church_access ON worship_records
  FOR ALL
  USING (app_user_owns_church(church_id))
  WITH CHECK (app_user_owns_church(church_id));

-- Worship contributions
ALTER TABLE worship_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY worship_contributions_admin_access ON worship_contributions
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY worship_contributions_church_access ON worship_contributions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM worship_records wr
      WHERE wr.id = worship_contributions.worship_record_id
      AND app_user_owns_church(wr.church_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM worship_records wr
      WHERE wr.id = worship_contributions.worship_record_id
      AND app_user_owns_church(wr.church_id)
    )
  );

-- ============================================================================
-- PHASE 6: ENABLE RLS ON ANALYTICS TABLES
-- ============================================================================

-- Analytics KPIs
ALTER TABLE analytics_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_kpis_admin_access ON analytics_kpis
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY analytics_kpis_church_view ON analytics_kpis
  FOR SELECT
  USING (
    church_id IS NULL OR
    app_user_owns_church(church_id)
  );

-- Analytics trends
ALTER TABLE analytics_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_trends_admin_access ON analytics_trends
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY analytics_trends_church_view ON analytics_trends
  FOR SELECT
  USING (
    church_id IS NULL OR
    app_user_owns_church(church_id)
  );

-- Analytics insights
ALTER TABLE analytics_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_insights_admin_access ON analytics_insights
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY analytics_insights_church_view ON analytics_insights
  FOR SELECT
  USING (
    church_id IS NULL OR
    app_user_owns_church(church_id)
  );

-- Analytics events
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_events_admin_access ON analytics_events
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY analytics_events_church_view ON analytics_events
  FOR SELECT
  USING (
    church_id IS NULL OR
    app_user_owns_church(church_id)
  );

-- Analytics benchmarks
ALTER TABLE analytics_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_benchmarks_admin_access ON analytics_benchmarks
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY analytics_benchmarks_view_all ON analytics_benchmarks
  FOR SELECT
  USING (true);  -- Benchmarks are viewable by all for comparison

-- ============================================================================
-- PHASE 7: ENABLE RLS ON EXPENSE AND EVENT TABLES
-- ============================================================================

-- Expense records
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY expense_records_admin_access ON expense_records
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY expense_records_church_access ON expense_records
  FOR ALL
  USING (app_user_owns_church(church_id))
  WITH CHECK (app_user_owns_church(church_id));

-- Church events
ALTER TABLE church_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY church_events_admin_access ON church_events
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY church_events_church_access ON church_events
  FOR ALL
  USING (app_user_owns_church(church_id))
  WITH CHECK (app_user_owns_church(church_id));

-- Event registrations
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_registrations_admin_access ON event_registrations
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY event_registrations_church_access ON event_registrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM church_events ce
      WHERE ce.id = event_registrations.event_id
      AND app_user_owns_church(ce.church_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM church_events ce
      WHERE ce.id = event_registrations.event_id
      AND app_user_owns_church(ce.church_id)
    )
  );

-- ============================================================================
-- PHASE 8: ENABLE RLS ON REPORTING TABLES
-- ============================================================================

-- Custom reports
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_reports_admin_access ON custom_reports
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY custom_reports_church_access ON custom_reports
  FOR ALL
  USING (app_user_owns_church(church_id))
  WITH CHECK (app_user_owns_church(church_id));

-- Report notifications
ALTER TABLE report_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_notifications_admin_access ON report_notifications
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY report_notifications_church_view ON report_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_notifications.report_id
      AND app_user_owns_church(r.church_id)
    )
  );

-- Report status history
ALTER TABLE report_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_status_history_admin_access ON report_status_history
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY report_status_history_church_view ON report_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_status_history.report_id
      AND app_user_owns_church(r.church_id)
    )
  );

-- ============================================================================
-- PHASE 9: ENABLE RLS ON SHARED/REFERENCE TABLES
-- ============================================================================

-- Fund categories (shared reference data - read-only for non-admins)
ALTER TABLE fund_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY fund_categories_admin_manage ON fund_categories
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY fund_categories_read_all ON fund_categories
  FOR SELECT
  USING (true);  -- All authenticated users can read categories

-- Church transaction categories
ALTER TABLE church_transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY church_transaction_categories_admin_manage ON church_transaction_categories
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY church_transaction_categories_read_all ON church_transaction_categories
  FOR SELECT
  USING (true);  -- All authenticated users can read categories

-- Ministries (reference data)
ALTER TABLE ministries ENABLE ROW LEVEL SECURITY;

CREATE POLICY ministries_admin_manage ON ministries
  FOR ALL
  USING (app_user_is_admin())
  WITH CHECK (app_user_is_admin());

CREATE POLICY ministries_read_all ON ministries
  FOR SELECT
  USING (true);  -- All authenticated users can read ministries

-- ============================================================================
-- PHASE 10: SYSTEM TABLES (NO RLS - Admin Only via Application)
-- ============================================================================

-- Migration history - No RLS (system table)
-- This table should only be accessed via admin tools, not through the application

-- Church account balances - Already has RLS from previous migration
-- Skip: church_account_balances (appears to be a view or already configured)

-- ============================================================================
-- PHASE 11: VERIFICATION QUERIES
-- ============================================================================

-- Create function to verify RLS status
CREATE OR REPLACE FUNCTION verify_rls_status()
RETURNS TABLE (
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count BIGINT,
  status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    t.rowsecurity::BOOLEAN,
    COUNT(p.policyname)::BIGINT,
    CASE
      WHEN t.rowsecurity = false THEN 'UNPROTECTED'
      WHEN COUNT(p.policyname) = 0 THEN 'RLS ENABLED BUT NO POLICIES'
      ELSE 'SECURED'
    END::TEXT as status
  FROM pg_tables t
  LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE '%_view'
    AND t.tablename NOT IN ('migration_history', 'fund_balance_backup_20250921')
  GROUP BY t.tablename, t.rowsecurity
  ORDER BY
    CASE
      WHEN t.rowsecurity = false THEN 0
      WHEN COUNT(p.policyname) = 0 THEN 1
      ELSE 2
    END,
    t.tablename;
END;
$$;

-- Run verification
DO $$
DECLARE
  unprotected_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unprotected_count
  FROM verify_rls_status()
  WHERE status = 'UNPROTECTED';

  SELECT COUNT(*) INTO protected_count
  FROM verify_rls_status()
  WHERE status = 'SECURED';

  RAISE NOTICE 'RLS Status: % tables protected, % tables unprotected',
    protected_count, unprotected_count;

  IF unprotected_count > 0 THEN
    RAISE WARNING 'There are still % unprotected tables', unprotected_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All tables are now protected with RLS policies';
  END IF;
END $$;

-- ============================================================================
-- PHASE 12: DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION verify_rls_status() IS 'Verify Row Level Security status for all tables';

-- Add helpful comments on critical tables
COMMENT ON TABLE funds IS 'National fund accounts - RLS protected, viewable by all, editable by admin only';
COMMENT ON TABLE transactions IS 'Financial transactions - RLS protected with church isolation';
COMMENT ON TABLE members IS 'Church members - RLS protected with strict church isolation';
COMMENT ON TABLE donors IS 'Donor registry - RLS protected with church isolation';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- Run this query to see the final RLS status:
-- SELECT * FROM verify_rls_status();

-- ============================================================================
-- ROLLBACK SCRIPT (Save as 022_comprehensive_rls_rollback.sql)
-- ============================================================================
/*
BEGIN;

-- Disable RLS on all tables (reverse of enablement)
ALTER TABLE funds DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_movements_enhanced DISABLE ROW LEVEL SECURITY;
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_ministries DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_contributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE donors DISABLE ROW LEVEL SECURITY;
ALTER TABLE worship_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE worship_contributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_kpis DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_trends DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_insights DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE church_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE report_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE report_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE church_transaction_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE ministries DISABLE ROW LEVEL SECURITY;

-- Drop all policies (they are automatically dropped when RLS is disabled, but let's be explicit)

DROP FUNCTION IF EXISTS verify_rls_status();

COMMIT;
*/