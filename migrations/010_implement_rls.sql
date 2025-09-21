-- Migration: Implement Row Level Security (RLS)
-- CRITICAL SECURITY ENHANCEMENT: Church data isolation and admin controls
-- Created: 2025-09-20

-- =============================================================================
-- SECURITY WARNING: This migration implements Row Level Security to prevent
-- data leakage between churches. Failure to apply this migration means
-- ANY authenticated user can access ALL church financial data.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. APPLICATION USER CONTEXT FUNCTIONS
-- =============================================================================

-- Function to get current application user ID from JWT context
-- This is set by the application when processing requests
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_id', true)::BIGINT,
    0
  );
$$;

-- Function to get current application user role
CREATE OR REPLACE FUNCTION app_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_role', true),
    'anonymous'
  );
$$;

-- Function to get current application user's church ID
CREATE OR REPLACE FUNCTION app_current_user_church_id()
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_church_id', true)::BIGINT,
    0
  );
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION app_user_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() = 'admin';
$$;

-- Function to check if current user owns a church record
CREATE OR REPLACE FUNCTION app_user_owns_church(church_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT (
    app_user_is_admin() OR
    app_current_user_church_id() = church_id
  );
$$;

-- =============================================================================
-- 2. ENABLE ROW LEVEL SECURITY ON CRITICAL TABLES
-- =============================================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on churches table
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;

-- Enable RLS on reports table (critical financial data)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Enable RLS on church accounts (banking information)
ALTER TABLE church_accounts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on church transactions (detailed financial records)
ALTER TABLE church_transactions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on church budgets if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'church_budgets') THEN
    EXECUTE 'ALTER TABLE church_budgets ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Enable RLS on church financial goals if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'church_financial_goals') THEN
    EXECUTE 'ALTER TABLE church_financial_goals ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- =============================================================================
-- 3. USERS TABLE POLICIES
-- =============================================================================

-- Users can only see their own user record
CREATE POLICY users_self_access ON users
  FOR ALL
  USING (
    app_user_is_admin() OR
    id = app_current_user_id()
  );

-- Admins can manage all users
CREATE POLICY users_admin_access ON users
  FOR ALL
  USING (app_user_is_admin());

-- =============================================================================
-- 4. CHURCHES TABLE POLICIES
-- =============================================================================

-- Churches: Admins see all, church users see only their own
CREATE POLICY churches_access ON churches
  FOR ALL
  USING (
    app_user_is_admin() OR
    id = app_current_user_church_id()
  );

-- =============================================================================
-- 5. REPORTS TABLE POLICIES (CRITICAL FINANCIAL DATA)
-- =============================================================================

-- Monthly reports: Church isolation is CRITICAL
CREATE POLICY reports_church_isolation ON reports
  FOR ALL
  USING (
    app_user_is_admin() OR
    app_user_owns_church(church_id)
  );

-- =============================================================================
-- 6. CHURCH ACCOUNTS POLICIES (BANKING INFORMATION)
-- =============================================================================

-- Bank accounts: Church users can only see their own church's accounts
CREATE POLICY church_accounts_isolation ON church_accounts
  FOR ALL
  USING (
    app_user_is_admin() OR
    app_user_owns_church(church_id)
  );

-- =============================================================================
-- 7. CHURCH TRANSACTIONS POLICIES (DETAILED FINANCIAL RECORDS)
-- =============================================================================

-- Transactions: Church users can only see their own church's transactions
CREATE POLICY church_transactions_isolation ON church_transactions
  FOR ALL
  USING (
    app_user_is_admin() OR
    app_user_owns_church(church_id)
  );

-- =============================================================================
-- 8. OPTIONAL TABLES POLICIES (IF THEY EXIST)
-- =============================================================================

-- Church budgets policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'church_budgets') THEN
    EXECUTE 'CREATE POLICY church_budgets_isolation ON church_budgets
      FOR ALL
      USING (
        app_user_is_admin() OR
        app_user_owns_church(church_id)
      )';
  END IF;
END $$;

-- Church financial goals policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'church_financial_goals') THEN
    EXECUTE 'CREATE POLICY church_financial_goals_isolation ON church_financial_goals
      FOR ALL
      USING (
        app_user_is_admin() OR
        app_user_owns_church(church_id)
      )';
  END IF;
END $$;

-- =============================================================================
-- 9. SHARED/GLOBAL TABLES (NO RLS NEEDED)
-- =============================================================================

-- The following tables remain accessible to all authenticated users:
-- - fund_categories (shared across all churches)
-- - church_transaction_categories (shared categories)
-- - families (member management - may need RLS in future)
-- - members (member management - may need RLS in future)

-- =============================================================================
-- 10. SECURITY AUDIT FUNCTIONS
-- =============================================================================

-- Function to audit RLS policies
CREATE OR REPLACE FUNCTION audit_rls_policies()
RETURNS TABLE (
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count BIGINT
)
LANGUAGE SQL
AS $$
  SELECT
    t.tablename::TEXT,
    t.rowsecurity::BOOLEAN,
    COUNT(p.policyname)::BIGINT
  FROM pg_tables t
  LEFT JOIN pg_policies p ON t.tablename = p.tablename
  WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'users', 'churches', 'reports', 'church_accounts',
    'church_transactions', 'church_budgets', 'church_financial_goals'
  )
  GROUP BY t.tablename, t.rowsecurity
  ORDER BY t.tablename;
$$;

-- Function to test RLS context
CREATE OR REPLACE FUNCTION test_rls_context()
RETURNS TABLE (
  setting_name TEXT,
  setting_value TEXT
)
LANGUAGE SQL
AS $$
  SELECT 'current_user_id'::TEXT, app_current_user_id()::TEXT
  UNION ALL
  SELECT 'current_user_role'::TEXT, app_current_user_role()::TEXT
  UNION ALL
  SELECT 'current_user_church_id'::TEXT, app_current_user_church_id()::TEXT
  UNION ALL
  SELECT 'user_is_admin'::TEXT, app_user_is_admin()::TEXT;
$$;

-- =============================================================================
-- 11. MIGRATION VERIFICATION
-- =============================================================================

-- Verify that RLS is enabled on critical tables
DO $$
DECLARE
  critical_tables TEXT[] := ARRAY['users', 'churches', 'reports', 'church_accounts', 'church_transactions'];
  table_name TEXT;
  rls_enabled BOOLEAN;
BEGIN
  FOREACH table_name IN ARRAY critical_tables
  LOOP
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables
    WHERE tablename = table_name AND schemaname = 'public';

    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'CRITICAL SECURITY ERROR: RLS not enabled on table %', table_name;
    END IF;

    RAISE NOTICE 'RLS successfully enabled on table: %', table_name;
  END LOOP;

  RAISE NOTICE 'Row Level Security implementation completed successfully!';
  RAISE NOTICE 'IMPORTANT: Applications MUST set user context before queries:';
  RAISE NOTICE '  SELECT set_config(''app.current_user_id'', ''123'', true);';
  RAISE NOTICE '  SELECT set_config(''app.current_user_role'', ''church'', true);';
  RAISE NOTICE '  SELECT set_config(''app.current_user_church_id'', ''456'', true);';
END $$;

COMMIT;

-- =============================================================================
-- USAGE INSTRUCTIONS FOR APPLICATION DEVELOPERS
-- =============================================================================

/*
CRITICAL: The application MUST set user context before executing queries:

// In your authentication middleware:
await execute(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
await execute(`SELECT set_config('app.current_user_role', $1, true)`, [userRole]);
await execute(`SELECT set_config('app.current_user_church_id', $1, true)`, [churchId]);

// After setting context, all queries will automatically respect RLS policies
const reports = await execute('SELECT * FROM reports'); // Only user's church data

// To verify RLS is working:
const context = await execute('SELECT * FROM test_rls_context()');
const audit = await execute('SELECT * FROM audit_rls_policies()');

SECURITY NOTES:
1. Users with role 'admin' can access all data
2. Users with role 'church' can only access their own church's data
3. Unauthenticated users (no context set) cannot access any data
4. All financial tables are protected: reports, church_accounts, church_transactions
5. Banking information is isolated between churches
6. User records are isolated (users can only see themselves)

TESTING RLS:
-- Set context as church user
SELECT set_config('app.current_user_id', '1', true);
SELECT set_config('app.current_user_role', 'church', true);
SELECT set_config('app.current_user_church_id', '5', true);

-- Should only return reports for church_id = 5
SELECT * FROM reports;

-- Set context as admin
SELECT set_config('app.current_user_role', 'admin', true);

-- Should return all reports
SELECT * FROM reports;
*/