-- Migration 054: Fix Data Issues from Migration 053
-- Created: 2025-10-06
-- Purpose: Address critical data migration gaps from 053
--
-- FIXES:
-- 1. Migrate any existing national_treasurer users to treasurer
-- 2. Update system_configuration to remove obsolete role definition
-- 3. Clean up any stale references

BEGIN;

-- =============================================================================
-- PHASE 1: MIGRATE EXISTING DATA (should have been in 053)
-- =============================================================================

-- Update any profiles still using national_treasurer role
-- This ensures constraint won't fail on deployment
UPDATE profiles
SET role = 'treasurer'
WHERE role = 'national_treasurer';

-- =============================================================================
-- PHASE 2: UPDATE SYSTEM CONFIGURATION
-- =============================================================================

-- Normalize role definitions:
-- 1. Remove national_treasurer (merged into treasurer)
-- 2. Remove any church-scoped treasurer definitions
-- 3. Append canonical national treasurer with full permissions payload
UPDATE system_configuration
SET value = COALESCE(
  (
    SELECT jsonb_agg(role_def)
    FROM jsonb_array_elements(value) role_def
    WHERE role_def->>'id' NOT IN ('national_treasurer', 'treasurer')
  ),
  '[]'::jsonb
) || jsonb_build_array(
  jsonb_build_object(
    'id', 'treasurer',
    'name', 'Tesorero Nacional',
    'description', 'Supervisa todos los fondos nacionales y aprueba eventos (posición electa)',
    'permissions', jsonb_build_array(
      'events.approve', 'events.view', 'events.edit', 'events.create',
      'funds.view', 'funds.manage',
      'transactions.view', 'transactions.create',
      'dashboard.view', 'churches.view', 'reports.view'
    ),
    'editable', false
  )
)
WHERE section = 'roles'
  AND key = 'definitions';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Test 1: Verify no national_treasurer profiles remain
-- SELECT COUNT(*) FROM profiles WHERE role = 'national_treasurer';
-- Expected: 0

-- Test 2: Verify system_configuration has exactly one treasurer (national-scoped)
-- SELECT 
--   role_def->>'id' as role_id,
--   role_def->>'name' as name,
--   role_def->>'description' as description,
--   jsonb_array_length(role_def->'permissions') as permission_count
-- FROM system_configuration,
--      jsonb_array_elements(value) role_def
-- WHERE section = 'roles' AND key = 'definitions'
--   AND role_def->>'id' = 'treasurer';
-- Expected: 1 row with name='Tesorero Nacional', 11 permissions

-- Test 3: Verify no duplicate treasurer or national_treasurer entries
-- SELECT role_def->>'id', COUNT(*)
-- FROM system_configuration,
--      jsonb_array_elements(value) role_def
-- WHERE section = 'roles' AND key = 'definitions'
--   AND role_def->>'id' IN ('treasurer', 'national_treasurer')
-- GROUP BY role_def->>'id';
-- Expected: Only 'treasurer' with count=1
