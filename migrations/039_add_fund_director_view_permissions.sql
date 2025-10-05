-- Migration 039: Add Missing fund_director View Permissions
-- Created: 2025-10-05
-- Purpose: Grant fund_director the documented view permissions missing from migration 038
--
-- Context:
-- - Migration 038 only added events.submit and dashboard.view
-- - ROLES_AND_PERMISSIONS.md documents 9 total permissions for fund_director
-- - Missing: funds.view, transactions.view, events.actuals, reports.view, churches.view
--
-- This migration aligns database reality with documented permissions

BEGIN;

-- ============================================================================
-- PHASE 1: VERIFY CURRENT STATE
-- ============================================================================

DO $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM role_permissions
  WHERE role = 'fund_director';

  RAISE NOTICE '=== MIGRATION 039: Add fund_director View Permissions ===';
  RAISE NOTICE 'Current fund_director permissions: %', current_count;
END $$;

-- ============================================================================
-- PHASE 2: ADD MISSING VIEW PERMISSIONS
-- ============================================================================

-- Fund directors manage NATIONAL funds for events
-- They need visibility into:
-- 1. Fund balances (funds.view)
-- 2. Transaction history (transactions.view)
-- 3. Actual expenses post-event (events.actuals)
-- 4. Monthly reports context (reports.view)
-- 5. Church data for event planning (churches.view)

INSERT INTO role_permissions (role, permission, scope, description) VALUES
  -- Core fund visibility
  ('fund_director', 'funds.view', 'assigned_funds', 'Ver balances de fondos asignados'),
  ('fund_director', 'transactions.view', 'assigned_funds', 'Ver transacciones de fondos asignados'),

  -- Event lifecycle management
  ('fund_director', 'events.actuals', 'assigned_funds', 'Registrar gastos reales post-evento'),

  -- Context for fund management decisions
  ('fund_director', 'reports.view', 'assigned_funds', 'Ver reportes mensuales relacionados a fondos'),
  ('fund_director', 'churches.view', 'all', 'Ver iglesias para planificación de eventos')
ON CONFLICT (role, permission) DO NOTHING;

-- ============================================================================
-- PHASE 3: VERIFY FINAL STATE
-- ============================================================================

DO $$
DECLARE
  final_count INTEGER;
  expected_count CONSTANT INTEGER := 9; -- Per ROLES_AND_PERMISSIONS.md v3.0
BEGIN
  SELECT COUNT(*) INTO final_count
  FROM role_permissions
  WHERE role = 'fund_director';

  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'fund_director permissions: % (expected: %)', final_count, expected_count;

  IF final_count < expected_count THEN
    RAISE WARNING 'fund_director has fewer permissions than documented (%/%)', final_count, expected_count;
  END IF;

  -- List all fund_director permissions for audit
  RAISE NOTICE '';
  RAISE NOTICE 'Current fund_director permissions:';
  FOR r IN (
    SELECT permission, scope, description
    FROM role_permissions
    WHERE role = 'fund_director'
    ORDER BY permission
  ) LOOP
    RAISE NOTICE '  - % (scope: %) - %', r.permission, r.scope, r.description;
  END LOOP;
END $$;

COMMIT;
