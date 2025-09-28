-- Migration: Providers Table (Proveedores)
-- Purpose: Centralized provider management for all transaction types
-- Author: System Architecture
-- Date: 2025-09-28
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: CREATE PROVIDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS providers (
  id BIGSERIAL PRIMARY KEY,
  ruc TEXT NOT NULL,
  nombre TEXT NOT NULL,
  tipo_identificacion TEXT NOT NULL CHECK (tipo_identificacion IN ('RUC', 'NIS', 'ISSAN', 'CI')),
  razon_social TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  categoria TEXT CHECK (categoria IN ('servicios_publicos', 'honorarios', 'suministros', 'construccion', 'otros')),
  notas TEXT,
  es_activo BOOLEAN DEFAULT TRUE,
  es_especial BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- ⚠️ UNIQUE constraint prevents RUC duplication
  CONSTRAINT providers_ruc_unique UNIQUE (ruc)
);

COMMENT ON TABLE providers IS 'Centralized provider/vendor registry for all transaction types';
COMMENT ON COLUMN providers.ruc IS 'RUC or special identifier (NIS for ANDE, ISSAN for ESSAP) - UNIQUE to prevent duplicates';
COMMENT ON COLUMN providers.tipo_identificacion IS 'Type of identification: RUC (standard), NIS (ANDE), ISSAN (ESSAP), CI (individual)';
COMMENT ON COLUMN providers.categoria IS 'Provider category for filtering and reporting';
COMMENT ON COLUMN providers.es_especial IS 'Special utility providers (ANDE, ESSAP) with non-standard identification';

-- ============================================================================
-- PHASE 2: CREATE INDEXES
-- ============================================================================

-- Enforce RUC uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_ruc ON providers(ruc);

-- Full-text search on provider name
CREATE INDEX IF NOT EXISTS idx_providers_nombre ON providers USING GIN (to_tsvector('spanish', nombre));

-- Filter by category
CREATE INDEX IF NOT EXISTS idx_providers_categoria ON providers(categoria) WHERE categoria IS NOT NULL;

-- Filter active providers
CREATE INDEX IF NOT EXISTS idx_providers_es_activo ON providers(es_activo) WHERE es_activo = TRUE;

-- Special providers flag
CREATE INDEX IF NOT EXISTS idx_providers_es_especial ON providers(es_especial) WHERE es_especial = TRUE;

-- Audit: who created this provider
CREATE INDEX IF NOT EXISTS idx_providers_created_by ON providers(created_by) WHERE created_by IS NOT NULL;

-- ============================================================================
-- PHASE 3: SEED SPECIAL PROVIDERS
-- ============================================================================

INSERT INTO providers (
  ruc,
  nombre,
  tipo_identificacion,
  razon_social,
  categoria,
  es_especial,
  notas,
  created_by
) VALUES
  (
    'NIS-VARIABLE',
    'ANDE',
    'NIS',
    'Administración Nacional de Electricidad',
    'servicios_publicos',
    TRUE,
    'Proveedor especial de energía eléctrica. El RUC es el NIS del medidor.',
    NULL
  ),
  (
    'ISSAN-VARIABLE',
    'ESSAP',
    'ISSAN',
    'Empresa de Servicios Sanitarios del Paraguay S.A.',
    'servicios_publicos',
    TRUE,
    'Proveedor especial de agua potable. El RUC es el ISSAN del servicio.',
    NULL
  )
ON CONFLICT (ruc) DO NOTHING;

-- ============================================================================
-- PHASE 4: ADD PROVIDER RELATIONSHIPS TO EXISTING TABLES
-- ============================================================================

-- Add provider_id to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS provider_id BIGINT REFERENCES providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_id) WHERE provider_id IS NOT NULL;

-- Add provider_id to expense_records table
ALTER TABLE expense_records
ADD COLUMN IF NOT EXISTS provider_id BIGINT REFERENCES providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_records_provider_id ON expense_records(provider_id) WHERE provider_id IS NOT NULL;

-- Add provider_id to church_transactions table
ALTER TABLE church_transactions
ADD COLUMN IF NOT EXISTS provider_id BIGINT REFERENCES providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_church_transactions_provider_id ON church_transactions(provider_id) WHERE provider_id IS NOT NULL;

COMMENT ON COLUMN transactions.provider_id IS 'Reference to centralized provider registry (preferred over text provider field)';
COMMENT ON COLUMN expense_records.provider_id IS 'Reference to centralized provider registry (preferred over proveedor field)';
COMMENT ON COLUMN church_transactions.provider_id IS 'Reference to centralized provider registry (replaces vendor_customer text field)';

-- ============================================================================
-- PHASE 5: ENABLE RLS ON PROVIDERS TABLE
-- ============================================================================

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 6: CREATE RLS POLICIES
-- ============================================================================

-- Read Access: All transaction creators can view providers
CREATE POLICY "Transaction creators can view providers"
ON providers FOR SELECT TO authenticated
USING (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Create Access: All transaction creators can create providers
-- (UNIQUE constraint on RUC prevents duplication at database level)
CREATE POLICY "Transaction creators can create providers"
ON providers FOR INSERT TO authenticated
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Update Access: Only admin and treasurer can modify providers
CREATE POLICY "Only admin/treasurer can update providers"
ON providers FOR UPDATE TO authenticated
USING (app_current_user_role() IN ('admin', 'treasurer'))
WITH CHECK (app_current_user_role() IN ('admin', 'treasurer'));

-- Delete Access: Only admin and treasurer can delete providers (soft delete recommended)
CREATE POLICY "Only admin/treasurer can delete providers"
ON providers FOR DELETE TO authenticated
USING (app_current_user_role() IN ('admin', 'treasurer'));

-- ============================================================================
-- PHASE 7: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to find provider by RUC (for duplicate prevention)
CREATE OR REPLACE FUNCTION find_provider_by_ruc(p_ruc TEXT)
RETURNS TABLE (
  id BIGINT,
  ruc TEXT,
  nombre TEXT,
  tipo_identificacion TEXT,
  razon_social TEXT,
  categoria TEXT,
  es_especial BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.ruc,
    p.nombre,
    p.tipo_identificacion,
    p.razon_social,
    p.categoria,
    p.es_especial
  FROM providers p
  WHERE p.ruc = p_ruc AND p.es_activo = TRUE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION find_provider_by_ruc(TEXT) IS 'Check if provider exists by RUC (for duplicate prevention)';

-- Function to search providers by name or RUC (for autocomplete)
CREATE OR REPLACE FUNCTION search_providers(p_query TEXT, p_categoria TEXT DEFAULT NULL, p_limit INT DEFAULT 20)
RETURNS TABLE (
  id BIGINT,
  ruc TEXT,
  nombre TEXT,
  tipo_identificacion TEXT,
  razon_social TEXT,
  categoria TEXT,
  es_especial BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.ruc,
    p.nombre,
    p.tipo_identificacion,
    p.razon_social,
    p.categoria,
    p.es_especial
  FROM providers p
  WHERE p.es_activo = TRUE
    AND (
      p.nombre ILIKE '%' || p_query || '%' OR
      p.ruc ILIKE '%' || p_query || '%' OR
      p.razon_social ILIKE '%' || p_query || '%'
    )
    AND (p_categoria IS NULL OR p.categoria = p_categoria)
  ORDER BY
    p.es_especial DESC,  -- Special providers first
    p.nombre ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION search_providers(TEXT, TEXT, INT) IS 'Search providers by name, RUC, or razon_social with optional category filter';

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 8: DATA MIGRATION - EXTRACT EXISTING PROVIDERS
-- ============================================================================

-- Migrate unique providers from transactions table
INSERT INTO providers (ruc, nombre, tipo_identificacion, categoria, notas, created_by)
SELECT DISTINCT
  COALESCE(provider, 'UNKNOWN-' || gen_random_uuid()::TEXT) AS ruc,
  COALESCE(provider, 'Proveedor sin nombre') AS nombre,
  'RUC' AS tipo_identificacion,
  'otros' AS categoria,
  'Migrado desde transactions' AS notas,
  NULL AS created_by
FROM transactions
WHERE provider IS NOT NULL
  AND provider != ''
  AND provider NOT IN (SELECT nombre FROM providers)
ON CONFLICT (ruc) DO NOTHING;

-- Migrate unique providers from expense_records table
INSERT INTO providers (ruc, nombre, tipo_identificacion, categoria, notas, created_by)
SELECT DISTINCT
  COALESCE(ruc_ci_proveedor, 'UNKNOWN-' || gen_random_uuid()::TEXT) AS ruc,
  proveedor AS nombre,
  CASE
    WHEN ruc_ci_proveedor IS NOT NULL THEN 'RUC'
    ELSE 'CI'
  END AS tipo_identificacion,
  CASE
    WHEN es_honorario_pastoral THEN 'honorarios'
    ELSE 'otros'
  END AS categoria,
  'Migrado desde expense_records' AS notas,
  NULL AS created_by
FROM expense_records
WHERE proveedor IS NOT NULL
  AND proveedor != ''
  AND proveedor NOT IN (SELECT nombre FROM providers)
ON CONFLICT (ruc) DO NOTHING;

-- ============================================================================
-- PHASE 9: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  provider_count INTEGER;
  special_provider_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count providers
  SELECT COUNT(*) INTO provider_count FROM providers;
  SELECT COUNT(*) INTO special_provider_count FROM providers WHERE es_especial = TRUE;

  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_providers%';

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'providers';

  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN ('find_provider_by_ruc', 'search_providers');

  RAISE NOTICE '';
  RAISE NOTICE '=== Migration 027: Providers Table ===';
  RAISE NOTICE 'Providers created: % (including % special)', provider_count, special_provider_count;
  RAISE NOTICE 'Indexes created: % (expected 6)', index_count;
  RAISE NOTICE 'RLS policies created: % (expected 4)', policy_count;
  RAISE NOTICE 'Functions created: % (expected 2)', function_count;
  RAISE NOTICE '';

  IF index_count >= 6 AND policy_count = 4 AND function_count = 2 THEN
    RAISE NOTICE '✅ Migration completed successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'Special providers loaded:';
    RAISE NOTICE '  - ANDE (NIS-based)';
    RAISE NOTICE '  - ESSAP (ISSAN-based)';
  ELSE
    RAISE WARNING '⚠️  Some objects may not have been created correctly';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Save as 027_providers_table_rollback.sql)
-- ============================================================================
/*
BEGIN;

-- Remove foreign keys from related tables
ALTER TABLE transactions DROP COLUMN IF EXISTS provider_id;
ALTER TABLE expense_records DROP COLUMN IF EXISTS provider_id;
ALTER TABLE church_transactions DROP COLUMN IF EXISTS provider_id;

-- Drop functions
DROP FUNCTION IF EXISTS find_provider_by_ruc(TEXT);
DROP FUNCTION IF EXISTS search_providers(TEXT, TEXT, INT);

-- Drop table (cascades to all dependent objects)
DROP TABLE IF EXISTS providers CASCADE;

COMMIT;
*/