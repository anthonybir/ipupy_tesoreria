-- Migration 038: Fix Permissions Based on Actual Business Model
-- Date: 2025-10-05
-- Description: Complete permissions overhaul based on CORRECT_PERMISSIONS_MODEL.md
--
-- BUSINESS MODEL SUMMARY:
-- - NATIONAL LEVEL: admin (god mode), fund_director (manages national fund events)
-- - CHURCH LEVEL: pastor, treasurer, church_manager, secretary (local church operations)
-- - 38 churches exist, ZERO have users (admin fills forms for offline churches)
-- - Events are NATIONAL (created by fund_director, approved by admin)
-- - Reports are CHURCH-LEVEL (submitted by pastor/treasurer, approved by admin)

BEGIN;

-- ============================================================================
-- PHASE 1: VERIFICATION - Log current state
-- ============================================================================

DO $$
DECLARE
  v_treasurer_count INTEGER;
  v_fund_director_count INTEGER;
  v_secretary_count INTEGER;
BEGIN
  RAISE NOTICE '=== MIGRATION 038: FIX PERMISSIONS CORRECTLY ===';
  RAISE NOTICE 'Date: 2025-10-05';

  -- Count incorrect permissions
  SELECT COUNT(*) INTO v_treasurer_count
  FROM role_permissions
  WHERE role = 'treasurer' AND permission IN ('events.approve', 'events.create', 'events.manage');

  SELECT COUNT(*) INTO v_fund_director_count
  FROM role_permissions
  WHERE role = 'fund_director' AND permission IN ('churches.view', 'dashboard.view', 'reports.view');

  SELECT COUNT(*) INTO v_secretary_count
  FROM role_permissions
  WHERE role = 'secretary' AND permission = 'events.manage';

  RAISE NOTICE 'Current incorrect permissions:';
  RAISE NOTICE '  - treasurer (events): %', v_treasurer_count;
  RAISE NOTICE '  - fund_director (church-level): %', v_fund_director_count;
  RAISE NOTICE '  - secretary (events): %', v_secretary_count;
END $$;

-- ============================================================================
-- PHASE 2: REMOVE INCORRECT PERMISSIONS
-- ============================================================================

RAISE NOTICE '=== PHASE 2: Removing incorrect permissions ===';

-- Remove event permissions from treasurer (events are NATIONAL, not church-level)
DELETE FROM role_permissions
WHERE role = 'treasurer'
AND permission IN ('events.approve', 'events.create', 'events.manage');

RAISE NOTICE '  ✓ Removed event permissions from treasurer (church role cannot approve national events)';

-- Remove church-level permissions from fund_director (they manage FUNDS, not churches)
DELETE FROM role_permissions
WHERE role = 'fund_director'
AND permission IN ('churches.view', 'reports.view');

RAISE NOTICE '  ✓ Removed church permissions from fund_director (fund directors manage national funds)';

-- Remove dashboard.view from fund_director (needs to be fund-specific, not general)
-- We'll add it back with correct scope
DELETE FROM role_permissions
WHERE role = 'fund_director'
AND permission = 'dashboard.view';

RAISE NOTICE '  ✓ Removed general dashboard.view from fund_director (will add fund-specific version)';

-- Remove event permissions from secretary (events are NATIONAL, secretary is church-level)
DELETE FROM role_permissions
WHERE role = 'secretary'
AND permission = 'events.manage';

RAISE NOTICE '  ✓ Removed event permissions from secretary (secretary is church-level support)';

-- ============================================================================
-- PHASE 3: ADD MISSING PERMISSIONS
-- ============================================================================

RAISE NOTICE '=== PHASE 3: Adding correct permissions ===';

-- Add fund_director permissions (national fund management)
INSERT INTO role_permissions (role, permission, scope, description) VALUES
  ('fund_director', 'events.submit', 'assigned_funds', 'Enviar eventos para aprobación del administrador'),
  ('fund_director', 'dashboard.view', 'assigned_funds', 'Ver panel de fondos asignados')
ON CONFLICT (role, permission) DO NOTHING;

RAISE NOTICE '  ✓ Added fund_director permissions (events.submit, dashboard for assigned funds)';

-- Add treasurer permissions (church-level financial management)
INSERT INTO role_permissions (role, permission, scope, description) VALUES
  ('treasurer', 'transactions.create', 'own', 'Registrar transacciones de la iglesia local')
ON CONFLICT (role, permission) DO NOTHING;

RAISE NOTICE '  ✓ Added treasurer permissions (transactions.create for church finances)';

-- ============================================================================
-- PHASE 4: UPDATE SYSTEM CONFIGURATION (UI)
-- ============================================================================

RAISE NOTICE '=== PHASE 4: Updating system configuration (role descriptions) ===';

UPDATE system_configuration
SET value = jsonb_build_array(
  jsonb_build_object(
    'id', 'admin',
    'name', 'Administrador',
    'description', 'Acceso completo al sistema. Administra reportes, eventos nacionales, y completa formularios para iglesias sin usuarios',
    'editable', false
  ),
  jsonb_build_object(
    'id', 'fund_director',
    'name', 'Director de Fondos',
    'description', 'Gestiona eventos y presupuestos de fondos nacionales asignados (Misiones, APY, etc.)',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'pastor',
    'name', 'Pastor',
    'description', 'Gestiona su iglesia local y envía reportes mensuales',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'treasurer',
    'name', 'Tesorero de Iglesia',
    'description', 'Gestiona finanzas de su iglesia local (no aprueba eventos nacionales)',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'church_manager',
    'name', 'Gerente de Iglesia',
    'description', 'Acceso de solo lectura a información de su iglesia local',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'secretary',
    'name', 'Secretario',
    'description', 'Apoya tareas administrativas de su iglesia local',
    'editable', true
  )
)
WHERE section = 'roles'
AND key = 'definitions';

RAISE NOTICE '  ✓ Updated role descriptions to reflect national vs church scope';

-- Update fund_director metadata to clarify scope
UPDATE system_configuration
SET value = jsonb_build_object(
  'name', 'Director de Fondos',
  'level', 5,
  'can_assign', true,
  'scope', 'national',
  'description', 'Gestiona eventos y presupuestos de fondos nacionales específicos asignados por el administrador. No tiene acceso a datos de iglesias locales.'
)
WHERE section = 'roles'
AND key = 'fund_director';

RAISE NOTICE '  ✓ Updated fund_director metadata to clarify national scope';

-- ============================================================================
-- PHASE 5: VERIFICATION - Confirm correct state
-- ============================================================================

DO $$
DECLARE
  v_admin_count INTEGER;
  v_fund_director_count INTEGER;
  v_pastor_count INTEGER;
  v_treasurer_count INTEGER;
  v_church_manager_count INTEGER;
  v_secretary_count INTEGER;
  v_total_perms INTEGER;
BEGIN
  RAISE NOTICE '=== PHASE 5: VERIFICATION ===';

  -- Count permissions per role
  SELECT COUNT(*) INTO v_admin_count FROM role_permissions WHERE role = 'admin';
  SELECT COUNT(*) INTO v_fund_director_count FROM role_permissions WHERE role = 'fund_director';
  SELECT COUNT(*) INTO v_pastor_count FROM role_permissions WHERE role = 'pastor';
  SELECT COUNT(*) INTO v_treasurer_count FROM role_permissions WHERE role = 'treasurer';
  SELECT COUNT(*) INTO v_church_manager_count FROM role_permissions WHERE role = 'church_manager';
  SELECT COUNT(*) INTO v_secretary_count FROM role_permissions WHERE role = 'secretary';
  SELECT COUNT(*) INTO v_total_perms FROM role_permissions;

  RAISE NOTICE 'Permission counts by role:';
  RAISE NOTICE '  - admin: % (full system access)', v_admin_count;
  RAISE NOTICE '  - fund_director: % (national fund management)', v_fund_director_count;
  RAISE NOTICE '  - pastor: % (church leadership)', v_pastor_count;
  RAISE NOTICE '  - treasurer: % (church finances)', v_treasurer_count;
  RAISE NOTICE '  - church_manager: % (church view-only)', v_church_manager_count;
  RAISE NOTICE '  - secretary: % (church admin support)', v_secretary_count;
  RAISE NOTICE '  - TOTAL: %', v_total_perms;

  -- Verify no incorrect permissions remain
  IF EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = 'treasurer' AND permission IN ('events.approve', 'events.create', 'events.manage')
  ) THEN
    RAISE EXCEPTION 'ERROR: treasurer still has event permissions';
  END IF;

  IF EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = 'fund_director' AND permission IN ('churches.view', 'reports.view')
  ) THEN
    RAISE EXCEPTION 'ERROR: fund_director still has church permissions';
  END IF;

  IF EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = 'secretary' AND permission = 'events.manage'
  ) THEN
    RAISE EXCEPTION 'ERROR: secretary still has event permissions';
  END IF;

  -- Verify new permissions added
  IF NOT EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = 'fund_director' AND permission = 'events.submit'
  ) THEN
    RAISE EXCEPTION 'ERROR: fund_director missing events.submit permission';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = 'treasurer' AND permission = 'transactions.create'
  ) THEN
    RAISE EXCEPTION 'ERROR: treasurer missing transactions.create permission';
  END IF;

  RAISE NOTICE '✅ ALL VERIFICATIONS PASSED';
  RAISE NOTICE '=== MIGRATION 038 COMPLETE ===';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- To rollback this migration:
--
-- BEGIN;
--
-- -- Restore old incorrect permissions
-- INSERT INTO role_permissions (role, permission, scope, description) VALUES
--   ('treasurer', 'events.approve', 'own', 'Aprobar eventos de fondos'),
--   ('treasurer', 'events.create', 'own', 'Crear eventos'),
--   ('treasurer', 'events.manage', 'own', 'Gestionar eventos'),
--   ('fund_director', 'churches.view', 'own', 'Ver información de iglesias'),
--   ('fund_director', 'reports.view', 'own', 'Ver reportes'),
--   ('secretary', 'events.manage', 'own', 'Gestionar eventos de iglesia');
--
-- -- Remove new permissions
-- DELETE FROM role_permissions
-- WHERE (role = 'fund_director' AND permission IN ('events.submit', 'dashboard.view'))
--    OR (role = 'treasurer' AND permission = 'transactions.create');
--
-- COMMIT;
