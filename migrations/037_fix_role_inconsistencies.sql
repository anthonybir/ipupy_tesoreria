-- Migration: Fix Role System Inconsistencies
-- Purpose: Fix church_manager permissions, update get_role_level(), remove obsolete roles
-- Author: System Audit & Cleanup
-- Date: 2025-10-05
-- ============================================================================
--
-- Issues Fixed:
-- 1. church_manager role has NO permissions defined (but can be assigned)
-- 2. get_role_level() missing fund_director and church_manager
-- 3. district_supervisor and member have permissions but can't be assigned
-- 4. Role hierarchy incomplete
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: VERIFY CURRENT STATE
-- ============================================================================

DO $$
DECLARE
  v_constraint TEXT;
  v_church_manager_perms INTEGER;
  v_obsolete_perms INTEGER;
BEGIN
  -- Check constraint
  SELECT pg_get_constraintdef(oid) INTO v_constraint
  FROM pg_constraint
  WHERE conname = 'profiles_role_check';

  RAISE NOTICE '=== Migration 037: Fix Role Inconsistencies ===';
  RAISE NOTICE 'Current constraint: %', v_constraint;

  -- Count church_manager permissions (should be 0)
  SELECT COUNT(*) INTO v_church_manager_perms
  FROM role_permissions
  WHERE role = 'church_manager';

  RAISE NOTICE 'church_manager permissions: % (expected: 0)', v_church_manager_perms;

  -- Count obsolete role permissions
  SELECT COUNT(*) INTO v_obsolete_perms
  FROM role_permissions
  WHERE role IN ('district_supervisor', 'member');

  RAISE NOTICE 'Obsolete role permissions: % (to be removed)', v_obsolete_perms;
END $$;

-- ============================================================================
-- PHASE 2: ADD church_manager PERMISSIONS
-- ============================================================================

INSERT INTO role_permissions (role, permission, scope, description) VALUES
  ('church_manager', 'church.view', 'own', 'Ver información de la iglesia asignada'),
  ('church_manager', 'reports.view', 'own', 'Ver reportes de la iglesia'),
  ('church_manager', 'members.view', 'own', 'Ver miembros de la iglesia'),
  ('church_manager', 'events.view', 'own', 'Ver eventos de la iglesia'),
  ('church_manager', 'dashboard.view', 'own', 'Ver panel de control de la iglesia')
ON CONFLICT (role, permission) DO NOTHING;

COMMENT ON TABLE role_permissions IS 'Permission matrix for all assignable roles (admin, fund_director, pastor, treasurer, church_manager, secretary)';

-- ============================================================================
-- PHASE 3: REMOVE OBSOLETE ROLE PERMISSIONS
-- ============================================================================

-- district_supervisor and member can't be assigned (not in constraint)
-- but have permissions defined - clean up

DELETE FROM role_permissions
WHERE role IN ('district_supervisor', 'member');

-- ============================================================================
-- PHASE 4: UPDATE get_role_level() FUNCTION
-- ============================================================================

-- Old function was missing fund_director (level 5) and church_manager (level 2)
CREATE OR REPLACE FUNCTION get_role_level(user_role TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE user_role
    WHEN 'admin' THEN 6           -- Full system control
    WHEN 'fund_director' THEN 5   -- Fund-specific management (NEW)
    WHEN 'pastor' THEN 4          -- Church leadership
    WHEN 'treasurer' THEN 3       -- Financial operations
    WHEN 'church_manager' THEN 2  -- Church administration (NEW)
    WHEN 'secretary' THEN 1       -- Administrative support
    ELSE 0
  END;
$$;

COMMENT ON FUNCTION get_role_level(TEXT) IS 'Get hierarchical level of role (6=admin to 1=secretary). Updated 2025-10-05 to include fund_director and church_manager.';

-- ============================================================================
-- PHASE 5: ENSURE fund_director HAS COMPLETE PERMISSIONS
-- ============================================================================

-- Verify fund_director has all necessary permissions
INSERT INTO role_permissions (role, permission, scope, description) VALUES
  ('fund_director', 'dashboard.view', 'assigned', 'Ver panel de fondos asignados'),
  ('fund_director', 'churches.view', 'assigned', 'Ver iglesias con fondos asignados'),
  ('fund_director', 'reports.view', 'assigned', 'Ver reportes de fondos asignados')
ON CONFLICT (role, permission) DO NOTHING;

-- ============================================================================
-- PHASE 6: UPDATE SYSTEM CONFIGURATION (UI)
-- ============================================================================

-- Update role definitions in system_configuration table
-- This fixes the UI to show only the 6 active roles
UPDATE system_configuration
SET value = jsonb_build_array(
  jsonb_build_object(
    'id', 'admin',
    'name', 'Administrador',
    'description', 'Acceso completo al sistema',
    'editable', false
  ),
  jsonb_build_object(
    'id', 'fund_director',
    'name', 'Director de Fondos',
    'description', 'Gestiona eventos y presupuestos de fondos asignados',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'pastor',
    'name', 'Pastor',
    'description', 'Gestiona su iglesia local',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'treasurer',
    'name', 'Tesorero de Iglesia',
    'description', 'Gestiona finanzas de su iglesia local',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'church_manager',
    'name', 'Gerente de Iglesia',
    'description', 'Acceso de solo lectura a información de la iglesia',
    'editable', true
  ),
  jsonb_build_object(
    'id', 'secretary',
    'name', 'Secretario',
    'description', 'Apoya tareas administrativas de la iglesia',
    'editable', true
  )
)
WHERE section = 'roles'
AND key = 'definitions';

-- Update fund_director metadata configuration
UPDATE system_configuration
SET value = jsonb_build_object(
  'name', 'Director de Fondos',
  'level', 5,
  'can_assign', true,
  'description', 'Gestiona eventos y presupuestos de fondos específicos asignados'
)
WHERE section = 'roles'
AND key = 'fund_director';

COMMENT ON TABLE system_configuration IS 'System configuration with corrected role definitions (updated in migration 037)';

-- ============================================================================
-- PHASE 7: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_church_manager_perms INTEGER;
  v_fund_director_perms INTEGER;
  v_obsolete_perms INTEGER;
  v_role_level_admin INTEGER;
  v_role_level_fund_director INTEGER;
  v_role_level_church_manager INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Verification Results ===';

  -- Count permissions
  SELECT COUNT(*) INTO v_church_manager_perms
  FROM role_permissions WHERE role = 'church_manager';

  SELECT COUNT(*) INTO v_fund_director_perms
  FROM role_permissions WHERE role = 'fund_director';

  SELECT COUNT(*) INTO v_obsolete_perms
  FROM role_permissions WHERE role IN ('district_supervisor', 'member');

  -- Test role levels
  v_role_level_admin := get_role_level('admin');
  v_role_level_fund_director := get_role_level('fund_director');
  v_role_level_church_manager := get_role_level('church_manager');

  RAISE NOTICE 'church_manager permissions: % (expected: 5)', v_church_manager_perms;
  RAISE NOTICE 'fund_director permissions: % (expected: 10+)', v_fund_director_perms;
  RAISE NOTICE 'Obsolete role permissions: % (expected: 0)', v_obsolete_perms;
  RAISE NOTICE '';
  RAISE NOTICE 'Role levels:';
  RAISE NOTICE '  admin: % (expected: 6)', v_role_level_admin;
  RAISE NOTICE '  fund_director: % (expected: 5)', v_role_level_fund_director;
  RAISE NOTICE '  church_manager: % (expected: 2)', v_role_level_church_manager;

  IF v_church_manager_perms = 5 AND
     v_obsolete_perms = 0 AND
     v_role_level_fund_director = 5 AND
     v_role_level_church_manager = 2 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 037 completed successfully';
  ELSE
    RAISE WARNING '⚠️  Some checks failed - manual review required';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Save as 037_fix_role_inconsistencies_rollback.sql)
-- ============================================================================
/*
BEGIN;

-- Restore old get_role_level function (without fund_director and church_manager)
CREATE OR REPLACE FUNCTION get_role_level(user_role TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE user_role
    WHEN 'admin' THEN 6
    WHEN 'district_supervisor' THEN 5
    WHEN 'pastor' THEN 4
    WHEN 'treasurer' THEN 3
    WHEN 'secretary' THEN 2
    WHEN 'member' THEN 1
    ELSE 0
  END;
$$;

-- Remove church_manager permissions
DELETE FROM role_permissions WHERE role = 'church_manager';

-- Restore obsolete role permissions
INSERT INTO role_permissions (role, permission, scope, description) VALUES
  ('district_supervisor', 'churches.view', 'district', 'View churches in district'),
  ('district_supervisor', 'reports.approve', 'district', 'Approve district reports'),
  ('district_supervisor', 'reports.view', 'district', 'View district reports'),
  ('district_supervisor', 'members.view', 'district', 'View district members'),
  ('member', 'profile.edit', 'own', 'Edit own profile'),
  ('member', 'contributions.view', 'own', 'View own contributions'),
  ('member', 'events.view', 'own', 'View church events')
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;
*/
