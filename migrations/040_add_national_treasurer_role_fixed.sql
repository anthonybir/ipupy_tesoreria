-- Migration 040: Add National Treasurer Role (FIXED)
-- Created: 2025-10-05
-- Purpose: Add elected "Tesorero Nacional" role to supervise all fund directors and manage all national funds
--
-- Fix: Corrected system_configuration update to match actual table structure (section+key, not nested JSONB)
--
-- Context:
-- - New role sits between admin (7) and fund_director (5)
-- - Elected position that supervises ALL fund directors
-- - Has access to ALL 9 national funds (vs fund_director who gets 1 fund)
-- - Can approve fund events, manage fund balances
-- - CANNOT manage users, system config, or approve church reports

BEGIN;

-- ============================================================================
-- PHASE 1: UPDATE ROLE CONSTRAINT
-- ============================================================================

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

-- ============================================================================
-- PHASE 2: UPDATE ROLE HIERARCHY FUNCTION
-- ============================================================================

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

-- ============================================================================
-- PHASE 3: ADD NATIONAL TREASURER PERMISSIONS
-- ============================================================================

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

-- ============================================================================
-- PHASE 4: UPDATE SYSTEM CONFIGURATION (FIXED)
-- ============================================================================

-- Update role definitions in system_configuration
-- Structure: section='roles', key='definitions', value=jsonb array
UPDATE system_configuration
SET value = (
  SELECT jsonb_agg(
    role_def
    ORDER BY
      CASE role_def->>'id'
        WHEN 'admin' THEN 1
        WHEN 'national_treasurer' THEN 2
        WHEN 'fund_director' THEN 3
        WHEN 'pastor' THEN 4
        WHEN 'treasurer' THEN 5
        WHEN 'church_manager' THEN 6
        WHEN 'secretary' THEN 7
        ELSE 99
      END
  )
  FROM (
    -- Keep all existing roles
    SELECT jsonb_array_elements(value) as role_def
    FROM system_configuration
    WHERE section = 'roles' AND key = 'definitions'

    UNION ALL

    -- Add national_treasurer role
    SELECT jsonb_build_object(
      'id', 'national_treasurer',
      'name', 'Tesorero Nacional',
      'description', 'Supervisa todos los fondos nacionales y directores de fondos (posición electa)',
      'editable', true
    ) as role_def
  ) combined_roles
)
WHERE section = 'roles' AND key = 'definitions';

COMMIT;
