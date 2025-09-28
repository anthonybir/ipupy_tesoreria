-- Migration: Backfill provider_id in Existing Transactions
-- Purpose: Link existing transaction records to the centralized provider registry
-- Author: System Architecture
-- Date: 2025-09-28
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: CREATE PROVIDER ENTRIES FROM EXISTING DATA
-- ============================================================================

-- Extract unique providers from transactions (where provider is not null/empty)
INSERT INTO providers (
  ruc,
  nombre,
  tipo_identificacion,
  categoria,
  notas,
  es_activo,
  created_by
)
SELECT DISTINCT
  COALESCE(
    NULLIF(TRIM(provider), ''),
    'LEGACY-' || md5(TRIM(LOWER(provider)))
  ) AS ruc,
  TRIM(provider) AS nombre,
  'RUC' AS tipo_identificacion,
  'otros' AS categoria,
  'Migrado automáticamente desde transactions (legacy data)' AS notas,
  TRUE AS es_activo,
  NULL::UUID AS created_by
FROM transactions
WHERE provider IS NOT NULL
  AND TRIM(provider) != ''
  AND provider NOT IN ('Sistema', 'system', 'legacy-import', 'system-reconciliation')
  AND NOT EXISTS (
    SELECT 1 FROM providers p
    WHERE p.nombre = TRIM(transactions.provider)
  )
ON CONFLICT (ruc) DO NOTHING;

-- Extract unique providers from expense_records
INSERT INTO providers (
  ruc,
  nombre,
  tipo_identificacion,
  categoria,
  notas,
  es_activo,
  created_by
)
SELECT DISTINCT
  COALESCE(
    NULLIF(TRIM(ruc_ci_proveedor), ''),
    'LEGACY-' || md5(TRIM(LOWER(proveedor)))
  ) AS ruc,
  TRIM(proveedor) AS nombre,
  CASE
    WHEN ruc_ci_proveedor IS NOT NULL AND TRIM(ruc_ci_proveedor) != '' THEN 'RUC'
    ELSE 'CI'
  END AS tipo_identificacion,
  CASE
    WHEN es_honorario_pastoral THEN 'honorarios'
    ELSE 'otros'
  END AS categoria,
  'Migrado automáticamente desde expense_records (legacy data)' AS notas,
  TRUE AS es_activo,
  NULL::UUID AS created_by
FROM expense_records
WHERE proveedor IS NOT NULL
  AND TRIM(proveedor) != ''
  AND NOT EXISTS (
    SELECT 1 FROM providers p
    WHERE p.nombre = TRIM(expense_records.proveedor)
  )
ON CONFLICT (ruc) DO NOTHING;

-- Extract unique providers from church_transactions (vendor_customer field)
INSERT INTO providers (
  ruc,
  nombre,
  tipo_identificacion,
  categoria,
  notas,
  es_activo,
  created_by
)
SELECT DISTINCT
  'LEGACY-' || md5(TRIM(LOWER(vendor_customer))) AS ruc,
  TRIM(vendor_customer) AS nombre,
  'RUC' AS tipo_identificacion,
  'otros' AS categoria,
  'Migrado automáticamente desde church_transactions (legacy data)' AS notas,
  TRUE AS es_activo,
  NULL::UUID AS created_by
FROM church_transactions
WHERE vendor_customer IS NOT NULL
  AND TRIM(vendor_customer) != ''
  AND NOT EXISTS (
    SELECT 1 FROM providers p
    WHERE p.nombre = TRIM(church_transactions.vendor_customer)
  )
ON CONFLICT (ruc) DO NOTHING;

-- ============================================================================
-- PHASE 2: BACKFILL provider_id IN EXISTING RECORDS
-- ============================================================================

-- Update transactions table
UPDATE transactions t
SET provider_id = p.id
FROM providers p
WHERE t.provider_id IS NULL
  AND t.provider IS NOT NULL
  AND TRIM(t.provider) != ''
  AND TRIM(t.provider) = p.nombre;

-- Update expense_records table
UPDATE expense_records e
SET provider_id = p.id
FROM providers p
WHERE e.provider_id IS NULL
  AND e.proveedor IS NOT NULL
  AND TRIM(e.proveedor) != ''
  AND TRIM(e.proveedor) = p.nombre;

-- Update church_transactions table
UPDATE church_transactions ct
SET provider_id = p.id
FROM providers p
WHERE ct.provider_id IS NULL
  AND ct.vendor_customer IS NOT NULL
  AND TRIM(ct.vendor_customer) != ''
  AND TRIM(ct.vendor_customer) = p.nombre;

-- ============================================================================
-- PHASE 3: SPECIAL PROVIDERS - MANUAL MAPPING EXAMPLES
-- ============================================================================

-- Map ANDE transactions (look for electricity-related entries)
UPDATE transactions t
SET provider_id = (SELECT id FROM providers WHERE ruc = 'NIS-VARIABLE')
WHERE t.provider_id IS NULL
  AND (
    t.provider ILIKE '%ANDE%' OR
    t.provider ILIKE '%electricidad%' OR
    t.provider ILIKE '%energía%' OR
    t.concept ILIKE '%electricidad%' OR
    t.concept ILIKE '%energía%' OR
    t.concept ILIKE '%ANDE%'
  );

UPDATE expense_records e
SET provider_id = (SELECT id FROM providers WHERE ruc = 'NIS-VARIABLE')
WHERE e.provider_id IS NULL
  AND (
    e.proveedor ILIKE '%ANDE%' OR
    e.proveedor ILIKE '%electricidad%' OR
    e.proveedor ILIKE '%energía%' OR
    e.concepto ILIKE '%electricidad%' OR
    e.concepto ILIKE '%energía%' OR
    e.concepto ILIKE '%ANDE%'
  );

UPDATE church_transactions ct
SET provider_id = (SELECT id FROM providers WHERE ruc = 'NIS-VARIABLE')
WHERE ct.provider_id IS NULL
  AND (
    ct.vendor_customer ILIKE '%ANDE%' OR
    ct.vendor_customer ILIKE '%electricidad%' OR
    ct.vendor_customer ILIKE '%energía%' OR
    ct.description ILIKE '%electricidad%' OR
    ct.description ILIKE '%energía%' OR
    ct.description ILIKE '%ANDE%'
  );

-- Map ESSAP transactions (look for water-related entries)
UPDATE transactions t
SET provider_id = (SELECT id FROM providers WHERE ruc = 'ISSAN-VARIABLE')
WHERE t.provider_id IS NULL
  AND (
    t.provider ILIKE '%ESSAP%' OR
    t.provider ILIKE '%agua%' OR
    t.concept ILIKE '%agua%' OR
    t.concept ILIKE '%ESSAP%'
  );

UPDATE expense_records e
SET provider_id = (SELECT id FROM providers WHERE ruc = 'ISSAN-VARIABLE')
WHERE e.provider_id IS NULL
  AND (
    e.proveedor ILIKE '%ESSAP%' OR
    e.proveedor ILIKE '%agua%' OR
    e.concepto ILIKE '%agua%' OR
    e.concepto ILIKE '%ESSAP%'
  );

UPDATE church_transactions ct
SET provider_id = (SELECT id FROM providers WHERE ruc = 'ISSAN-VARIABLE')
WHERE ct.provider_id IS NULL
  AND (
    ct.vendor_customer ILIKE '%ESSAP%' OR
    ct.vendor_customer ILIKE '%agua%' OR
    ct.description ILIKE '%agua%' OR
    ct.description ILIKE '%ESSAP%'
  );

-- ============================================================================
-- PHASE 4: VERIFICATION AND REPORTING
-- ============================================================================

DO $$
DECLARE
  total_providers INTEGER;
  total_transactions INTEGER;
  linked_transactions INTEGER;
  total_expenses INTEGER;
  linked_expenses INTEGER;
  total_church_txns INTEGER;
  linked_church_txns INTEGER;
BEGIN
  -- Count providers
  SELECT COUNT(*) INTO total_providers FROM providers;

  -- Count transactions
  SELECT COUNT(*) INTO total_transactions FROM transactions WHERE provider IS NOT NULL;
  SELECT COUNT(*) INTO linked_transactions FROM transactions WHERE provider_id IS NOT NULL;

  -- Count expense records
  SELECT COUNT(*) INTO total_expenses FROM expense_records WHERE proveedor IS NOT NULL;
  SELECT COUNT(*) INTO linked_expenses FROM expense_records WHERE provider_id IS NOT NULL;

  -- Count church transactions
  SELECT COUNT(*) INTO total_church_txns FROM church_transactions WHERE vendor_customer IS NOT NULL;
  SELECT COUNT(*) INTO linked_church_txns FROM church_transactions WHERE provider_id IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '=== Migration 028: Provider ID Backfill ===';
  RAISE NOTICE 'Total providers in registry: %', total_providers;
  RAISE NOTICE '';
  RAISE NOTICE 'Transactions with provider text: %', total_transactions;
  RAISE NOTICE 'Transactions linked to provider_id: % (%.1f%%)',
    linked_transactions,
    CASE WHEN total_transactions > 0 THEN (linked_transactions::NUMERIC / total_transactions * 100) ELSE 0 END;
  RAISE NOTICE '';
  RAISE NOTICE 'Expense records with provider text: %', total_expenses;
  RAISE NOTICE 'Expense records linked to provider_id: % (%.1f%%)',
    linked_expenses,
    CASE WHEN total_expenses > 0 THEN (linked_expenses::NUMERIC / total_expenses * 100) ELSE 0 END;
  RAISE NOTICE '';
  RAISE NOTICE 'Church transactions with vendor text: %', total_church_txns;
  RAISE NOTICE 'Church transactions linked to provider_id: % (%.1f%%)',
    linked_church_txns,
    CASE WHEN total_church_txns > 0 THEN (linked_church_txns::NUMERIC / total_church_txns * 100) ELSE 0 END;
  RAISE NOTICE '';

  IF (linked_transactions > 0 OR linked_expenses > 0 OR linked_church_txns > 0) THEN
    RAISE NOTICE '✅ Migration completed successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: Unlinked records either:';
    RAISE NOTICE '  - Have no provider text (system-generated)';
    RAISE NOTICE '  - Could not be automatically matched';
    RAISE NOTICE '  - Will use legacy text fields as fallback';
  ELSE
    RAISE WARNING '⚠️  No records were linked - verify provider matching logic';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Save as 028_backfill_provider_ids_rollback.sql)
-- ============================================================================
/*
BEGIN;

-- Remove backfilled provider_id values
UPDATE transactions SET provider_id = NULL WHERE provider_id IS NOT NULL;
UPDATE expense_records SET provider_id = NULL WHERE provider_id IS NOT NULL;
UPDATE church_transactions SET provider_id = NULL WHERE provider_id IS NOT NULL;

-- Remove migrated legacy providers (keep special providers)
DELETE FROM providers
WHERE notas LIKE '%Migrado automáticamente%'
  AND es_especial = FALSE;

COMMIT;
*/