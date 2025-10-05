-- Migration 040: Add National Treasurer Role
-- Created: 2025-10-05
-- Purpose: Add elected "Tesorero Nacional" role to supervise all fund directors and manage all national funds
--
-- Context:
-- - New role sits between admin (7) and fund_director (5)
-- - Elected position that supervises ALL fund directors
-- - Has access to ALL 9 national funds (vs fund_director who gets 1 fund)
-- - Can approve fund events, manage fund balances
-- - CANNOT manage users, system config, or approve church reports
--
-- Business Logic:
-- - fund_director creates events → submits to national_treasurer
-- - national_treasurer approves events → transactions created
-- - national_treasurer oversees all fund operations
-- - admin retains ultimate authority over system

BEGIN;

-- ============================================================================
-- PHASE 1: UPDATE ROLE CONSTRAINT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== MIGRATION 040: Add National Treasurer Role ===';
  RAISE NOTICE '';
  RAISE NOTICE '=== PHASE 1: Updating role constraint ===';
END $$;

-- Drop existing constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with national_treasurer
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN (
  'admin',
  'national_treasurer',  -- NEW: Elected national treasurer position
  'fund_director',
  'pastor',
  'treasurer',
  'church_manager',
  'secretary'
));

RAISE NOTICE '  ✓ Added national_treasurer to profiles_role_check constraint';

-- ============================================================================
-- PHASE 2: UPDATE ROLE HIERARCHY FUNCTION
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== PHASE 2: Updating get_role_level() function ===';

CREATE OR REPLACE FUNCTION get_role_level(user_role TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE user_role
    WHEN 'admin' THEN 7                    -- System administrator (highest)
    WHEN 'national_treasurer' THEN 6       -- National treasurer (elected, supervises funds)
    WHEN 'fund_director' THEN 5            -- Fund director (manages assigned fund)
    WHEN 'pastor' THEN 4                   -- Church pastor
    WHEN 'treasurer' THEN 3                -- Church treasurer
    WHEN 'church_manager' THEN 2           -- Church manager
    WHEN 'secretary' THEN 1                -- Secretary (lowest)
    ELSE 0
  END;
$$;

RAISE NOTICE '  ✓ Updated get_role_level() with new hierarchy';
RAISE NOTICE '    admin: 7 → 7 (unchanged)';
RAISE NOTICE '    national_treasurer: NEW → 6';
RAISE NOTICE '    fund_director: 5 → 5 (unchanged)';
RAISE NOTICE '    pastor: 4 → 4 (unchanged)';
RAISE NOTICE '    treasurer: 3 → 3 (unchanged)';
RAISE NOTICE '    church_manager: 2 → 2 (unchanged)';
RAISE NOTICE '    secretary: 1 → 1 (unchanged)';

-- ============================================================================
-- PHASE 3: ADD NATIONAL TREASURER PERMISSIONS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== PHASE 3: Adding national_treasurer permissions ===';

-- National treasurer has comprehensive fund and event management powers
-- but NO system/user/church management capabilities
INSERT INTO role_permissions (role, permission, scope, description) VALUES
  -- Event management (supervise all fund directors)
  ('national_treasurer', 'events.approve', 'all', 'Aprobar eventos de todos los fondos nacionales'),
  ('national_treasurer', 'events.view', 'all', 'Ver todos los eventos de fondos'),
  ('national_treasurer', 'events.edit', 'all', 'Editar cualquier evento de fondo'),
  ('national_treasurer', 'events.create', 'all', 'Crear eventos de fondos nacionales'),

  -- Fund management (all 9 national funds)
  ('national_treasurer', 'funds.view', 'all', 'Ver todos los fondos nacionales'),
  ('national_treasurer', 'funds.manage', 'all', 'Gestionar balances de fondos'),

  -- Transaction oversight (complete visibility)
  ('national_treasurer', 'transactions.view', 'all', 'Ver todas las transacciones de fondos'),
  ('national_treasurer', 'transactions.create', 'all', 'Crear transacciones de fondos'),

  -- Dashboard and context
  ('national_treasurer', 'dashboard.view', 'all', 'Ver dashboard de tesorería nacional'),
  ('national_treasurer', 'churches.view', 'all', 'Ver iglesias para contexto de eventos'),
  ('national_treasurer', 'reports.view', 'all', 'Ver reportes mensuales (solo lectura, no aprobación)')
ON CONFLICT (role, permission) DO NOTHING;

RAISE NOTICE '  ✓ Added 11 permissions for national_treasurer';
RAISE NOTICE '    - events.approve, events.view, events.edit, events.create';
RAISE NOTICE '    - funds.view, funds.manage';
RAISE NOTICE '    - transactions.view, transactions.create';
RAISE NOTICE '    - dashboard.view, churches.view, reports.view';

-- ============================================================================
-- PHASE 4: UPDATE SYSTEM CONFIGURATION
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== PHASE 4: Updating system_configuration ===';

-- Update fund_director description to reflect new reporting structure
UPDATE system_configuration
SET value = jsonb_set(
  value,
  '{roles}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'id' = 'fund_director' THEN
          jsonb_set(
            elem,
            '{description}',
            '"Gestiona eventos de fondos asignados (reporta a Tesorero Nacional)"'::jsonb
          )
        ELSE elem
      END
      ORDER BY
        CASE elem->>'id'
          WHEN 'admin' THEN 1
          WHEN 'fund_director' THEN 3
          WHEN 'pastor' THEN 4
          WHEN 'treasurer' THEN 5
          WHEN 'church_manager' THEN 6
          WHEN 'secretary' THEN 7
          ELSE 99
        END
    )
    FROM jsonb_array_elements(value->'roles') elem
  )
)
WHERE section = 'roles';

RAISE NOTICE '  ✓ Updated fund_director description';

-- Insert national_treasurer role definition (after admin, before fund_director)
DO $$
DECLARE
  current_roles jsonb;
  new_roles jsonb;
BEGIN
  -- Get current roles array
  SELECT value->'roles' INTO current_roles
  FROM system_configuration
  WHERE section = 'roles';

  -- Build new array with national_treasurer inserted at position 1 (after admin)
  new_roles := jsonb_build_array(
    current_roles->0,  -- admin
    jsonb_build_object(
      'id', 'national_treasurer',
      'name', 'Tesorero Nacional',
      'description', 'Supervisa todos los fondos nacionales y directores de fondos (posición electa)',
      'permissions', jsonb_build_array(
        'events.approve',
        'events.view',
        'events.edit',
        'events.create',
        'funds.view',
        'funds.manage',
        'transactions.view',
        'transactions.create',
        'dashboard.view',
        'churches.view',
        'reports.view'
      ),
      'editable', true
    )
  );

  -- Append remaining roles (fund_director onwards)
  FOR i IN 1..(jsonb_array_length(current_roles) - 1) LOOP
    new_roles := new_roles || jsonb_build_array(current_roles->i);
  END LOOP;

  -- Update system_configuration
  UPDATE system_configuration
  SET value = jsonb_set(value, '{roles}', new_roles)
  WHERE section = 'roles';

  RAISE NOTICE '  ✓ Added national_treasurer to system_configuration';
END $$;

-- ============================================================================
-- PHASE 5: VERIFICATION
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '=== VERIFICATION ===';

DO $$
DECLARE
  constraint_check text;
  role_level_check integer;
  permission_count integer;
  config_check jsonb;
BEGIN
  -- Verify constraint includes national_treasurer
  SELECT pg_get_constraintdef(oid) INTO constraint_check
  FROM pg_constraint
  WHERE conname = 'profiles_role_check';

  IF constraint_check LIKE '%national_treasurer%' THEN
    RAISE NOTICE '  ✓ Constraint verification: national_treasurer present';
  ELSE
    RAISE WARNING '  ✗ Constraint verification: national_treasurer MISSING';
  END IF;

  -- Verify get_role_level() returns 6
  SELECT get_role_level('national_treasurer') INTO role_level_check;

  IF role_level_check = 6 THEN
    RAISE NOTICE '  ✓ Hierarchy verification: national_treasurer = level 6';
  ELSE
    RAISE WARNING '  ✗ Hierarchy verification: national_treasurer = level % (expected 6)', role_level_check;
  END IF;

  -- Verify permission count
  SELECT COUNT(*) INTO permission_count
  FROM role_permissions
  WHERE role = 'national_treasurer';

  IF permission_count = 11 THEN
    RAISE NOTICE '  ✓ Permissions verification: 11 permissions added';
  ELSE
    RAISE WARNING '  ✗ Permissions verification: % permissions (expected 11)', permission_count;
  END IF;

  -- Verify system_configuration includes national_treasurer
  SELECT value->'roles'
  INTO config_check
  FROM system_configuration
  WHERE section = 'roles';

  IF config_check::text LIKE '%national_treasurer%' THEN
    RAISE NOTICE '  ✓ Configuration verification: national_treasurer in system_configuration';
  ELSE
    RAISE WARNING '  ✗ Configuration verification: national_treasurer MISSING from system_configuration';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL STATUS ===';
  RAISE NOTICE 'Roles now available: 7 (admin, national_treasurer, fund_director, pastor, treasurer, church_manager, secretary)';
  RAISE NOTICE 'Total permissions: % (across all roles)', (SELECT COUNT(*) FROM role_permissions);
  RAISE NOTICE 'national_treasurer permissions: %', permission_count;
END $$;

COMMIT;
