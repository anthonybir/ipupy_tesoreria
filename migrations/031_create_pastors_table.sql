-- Migration: Create pastors table and link to churches
-- Purpose: Normalize pastoral leadership data and enable multi-pastor history
-- Author: Codex Automation
-- Date: 2025-10-01

BEGIN;

-- ============================================================================
-- PHASE 1: CREATE PASTORS TABLE (NORMALIZED LEADERSHIP DIRECTORY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pastors (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  preferred_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  national_id TEXT,
  tax_id TEXT,
  ordination_level TEXT,
  role_title TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transition', 'emeritus', 'retired')),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT pastors_tenure_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

COMMENT ON TABLE pastors IS 'Normalized registry of pastoral leaders linked to congregations with historical tracking.';
COMMENT ON COLUMN pastors.church_id IS 'Foreign key to churches table; cascades on delete to remove associated pastor history.';
COMMENT ON COLUMN pastors.full_name IS 'Legal or full display name for the pastor.';
COMMENT ON COLUMN pastors.preferred_name IS 'Preferred short name used in UI or communications.';
COMMENT ON COLUMN pastors.whatsapp IS 'WhatsApp contact number (optional) for direct messaging.';
COMMENT ON COLUMN pastors.national_id IS 'Cédula or national identification number for compliance reports.';
COMMENT ON COLUMN pastors.tax_id IS 'RUC linked to fiscal reporting of honorarios pastorales.';
COMMENT ON COLUMN pastors.ordination_level IS 'Degree or level of ministerial ordination (Diácono, Ministro, Presbítero, etc.).';
COMMENT ON COLUMN pastors.role_title IS 'Ministerial role inside the congregation (Pastor Principal, Asistente, Supervisor regional, etc.).';
COMMENT ON COLUMN pastors.status IS 'Lifecycle state for the record: active, inactive, transition, emeritus, retired.';
COMMENT ON COLUMN pastors.is_primary IS 'Flag marking the current lead pastor for the congregation.';
COMMENT ON COLUMN pastors.start_date IS 'Date the pastor assumed the current assignment.';
COMMENT ON COLUMN pastors.end_date IS 'Date the pastor concluded the assignment (NULL if ongoing).';
COMMENT ON COLUMN pastors.photo_url IS 'Optional storage reference for profile photo or credential.';
COMMENT ON COLUMN pastors.notes IS 'Free-form administrative notes (handoff details, coverage plans, etc.).';

-- ============================================================================
-- PHASE 2: INDEXES AND UNIQUENESS CONSTRAINTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pastors_church_id ON pastors(church_id);
CREATE INDEX IF NOT EXISTS idx_pastors_status ON pastors(status);
CREATE INDEX IF NOT EXISTS idx_pastors_role_title ON pastors(role_title) WHERE role_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pastors_start_date ON pastors(start_date) WHERE start_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pastors_name_search ON pastors USING GIN (to_tsvector('spanish', full_name));

-- Ensure only one active primary pastor per church at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pastors_primary_active
  ON pastors(church_id)
  WHERE is_primary = TRUE AND status = 'active' AND end_date IS NULL;

-- ============================================================================
-- PHASE 3: LINK CHURCHES TO PRIMARY PASTOR RECORDS
-- ============================================================================

ALTER TABLE churches
  ADD COLUMN IF NOT EXISTS primary_pastor_id BIGINT;

ALTER TABLE churches
  ADD CONSTRAINT churches_primary_pastor_fk
  FOREIGN KEY (primary_pastor_id) REFERENCES pastors(id) ON DELETE SET NULL;

COMMENT ON COLUMN churches.primary_pastor_id IS 'Reference to pastors.id representing the lead pastor currently assigned to the congregation.';

-- ============================================================================
-- PHASE 4: BACKFILL EXISTING PASTOR DATA INTO THE NEW TABLE
-- ============================================================================

WITH seeded AS (
  INSERT INTO pastors (
    church_id,
    full_name,
    preferred_name,
    email,
    phone,
    whatsapp,
    national_id,
    tax_id,
    ordination_level,
    role_title,
    start_date,
    status,
    is_primary,
    notes,
    created_at,
    updated_at
  )
  SELECT
    c.id,
    c.pastor,
    NULL,
    NULL,
    NULLIF(c.phone, ''),
    NULL,
    NULLIF(c.pastor_cedula, ''),
    NULLIF(c.pastor_ruc, ''),
    NULLIF(c.pastor_grado, ''),
    NULLIF(c.pastor_posicion, ''),
    c.created_at::date,
    CASE WHEN c.active THEN 'active' ELSE 'inactive' END,
    TRUE,
    NULL,
    COALESCE(c.created_at, now()),
    now()
  FROM churches c
  WHERE NOT EXISTS (
    SELECT 1 FROM pastors p WHERE p.church_id = c.id AND p.is_primary = TRUE
  )
  RETURNING id, church_id
)
UPDATE churches c
SET primary_pastor_id = seeded.id
FROM seeded
WHERE c.id = seeded.church_id;

-- ============================================================================
-- PHASE 5: ENABLE RLS AND DEFINE ACCESS POLICIES
-- ============================================================================

ALTER TABLE pastors ENABLE ROW LEVEL SECURITY;

-- Full administrative control
CREATE POLICY pastors_admin_full_access ON pastors
  FOR ALL
  USING (
    COALESCE(current_setting('app.current_user_role', true), '') = 'admin'
  )
  WITH CHECK (
    COALESCE(current_setting('app.current_user_role', true), '') = 'admin'
  );

-- Church-scoped management (leadership can manage their own roster)
CREATE POLICY pastors_church_scope ON pastors
  FOR ALL
  USING (
    COALESCE(current_setting('app.current_user_role', true), '') = 'admin'
    OR COALESCE(current_setting('app.current_user_church_id', true), '')::BIGINT = church_id
  )
  WITH CHECK (
    COALESCE(current_setting('app.current_user_role', true), '') = 'admin'
    OR COALESCE(current_setting('app.current_user_church_id', true), '')::BIGINT = church_id
  );

-- Public directory access for active lead pastors
CREATE POLICY pastors_public_directory ON pastors
  FOR SELECT
  USING (status = 'active');

-- ============================================================================
-- PHASE 6: CREATE DIRECTORY VIEW FOR QUICK LOOKUPS
-- ============================================================================

CREATE OR REPLACE VIEW church_primary_pastors AS
SELECT
  c.id AS church_id,
  c.name AS church_name,
  c.city,
  c.active,
  c.phone AS church_phone,
  NULL::TEXT AS church_email,
  p.id AS pastor_id,
  p.full_name,
  p.preferred_name,
  p.email AS pastor_email,
  p.phone AS pastor_phone,
  p.whatsapp AS pastor_whatsapp,
  p.role_title,
  p.ordination_level,
  p.national_id AS pastor_national_id,
  p.tax_id AS pastor_tax_id,
  p.photo_url AS pastor_photo_url,
  p.notes AS pastor_notes,
  p.status,
  p.start_date,
  p.end_date,
  p.is_primary
FROM churches c
LEFT JOIN LATERAL (
  SELECT *
  FROM pastors p
  WHERE p.church_id = c.id
  ORDER BY p.is_primary DESC, p.status = 'active' DESC, p.start_date DESC NULLS LAST, p.created_at DESC
  LIMIT 1
) p ON TRUE;

COMMENT ON VIEW church_primary_pastors IS 'Convenience view exposing each church with its most recent primary pastor (active-first ordering).';

-- ============================================================================
-- PHASE 7: VERIFICATION BLOCK (OPTIONAL WARNINGS ONLY)
-- ============================================================================

DO $$
DECLARE
  orphan_count INTEGER;
  duplicate_primary INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM churches c
  WHERE c.primary_pastor_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'There are % churches without a linked primary pastor.', orphan_count;
  END IF;

  SELECT COUNT(*) INTO duplicate_primary
  FROM (
    SELECT church_id
    FROM pastors
    WHERE is_primary = TRUE AND status = 'active'
    GROUP BY church_id
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_primary > 0 THEN
    RAISE WARNING 'Detected % churches with more than one active primary pastor.', duplicate_primary;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK GUIDANCE
-- ============================================================================
-- To revert, create a new migration that:
--   1. Drops the view church_primary_pastors.
--   2. Deletes rows from pastors where seeded from churches (or truncates table).
--   3. Removes the foreign key and column churches.primary_pastor_id.
--   4. Drops the pastors table and associated policies/indexes.
-- Note: Ensure you preserve any newly captured history before deletion.
