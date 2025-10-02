-- Migration 033: Rename ordination_level to grado with proper constraints
-- Purpose: Align column name with IPU Paraguay terminology and enforce valid grades
-- Date: 2025-10-01

BEGIN;

-- ============================================================================
-- STEP 1: RENAME COLUMN
-- ============================================================================

ALTER TABLE pastors
  RENAME COLUMN ordination_level TO grado;

COMMENT ON COLUMN pastors.grado IS 'Grado ministerial del pastor: ordenación (más alto), general, o local (más bajo)';

-- ============================================================================
-- STEP 2: ADD CHECK CONSTRAINT FOR VALID GRADES
-- ============================================================================

ALTER TABLE pastors
  ADD CONSTRAINT pastors_grado_check
  CHECK (grado IS NULL OR grado IN ('ordenación', 'general', 'local'));

-- ============================================================================
-- STEP 3: UPDATE CHURCH_PRIMARY_PASTORS VIEW
-- ============================================================================

DROP VIEW IF EXISTS church_primary_pastors;

CREATE VIEW church_primary_pastors AS
SELECT
  c.id,
  c.name,
  p.id as pastor_id,
  p.full_name,
  p.preferred_name,
  p.email,
  p.phone,
  p.whatsapp,
  p.grado,
  p.role_title,
  p.status,
  p.start_date,
  p.end_date
FROM churches c
LEFT JOIN LATERAL (
  SELECT * FROM pastors
  WHERE church_id = c.id
    AND status = 'active'
  ORDER BY
    is_primary DESC,
    start_date DESC NULLS LAST
  LIMIT 1
) p ON TRUE;

COMMENT ON VIEW church_primary_pastors IS 'Display current primary pastor for each church with all contact and credential details.';

-- ============================================================================
-- STEP 4: UPDATE PASTOR_USER_ACCESS VIEW
-- ============================================================================

DROP VIEW IF EXISTS pastor_user_access;

CREATE VIEW pastor_user_access AS
SELECT
  p.id AS pastor_id,
  p.church_id,
  p.full_name AS pastor_name,
  p.role_title AS pastoral_role,
  p.grado,
  c.name AS church_name,
  p.profile_id,
  prof.role AS platform_role,
  prof.is_active AS platform_active,
  CASE
    WHEN prof.id IS NULL THEN 'no_access'
    WHEN prof.is_active = FALSE THEN 'revoked'
    ELSE 'active'
  END AS access_status,
  p.created_at,
  p.updated_at
FROM pastors p
LEFT JOIN churches c ON c.id = p.church_id
LEFT JOIN profiles prof ON prof.id = p.profile_id
WHERE p.status = 'active';

COMMENT ON VIEW pastor_user_access IS 'Consolidated view of pastor directory records with their platform access status and roles.';

-- ============================================================================
-- STEP 5: UPDATE EXISTING DATA (IF NEEDED)
-- ============================================================================

-- Map any existing ordination levels to new terminology
-- This is a no-op if data already matches, but ensures consistency

UPDATE pastors
SET grado = CASE
  WHEN grado ILIKE '%ordenación%' OR grado ILIKE '%ordenacion%' THEN 'ordenación'
  WHEN grado ILIKE '%general%' THEN 'general'
  WHEN grado ILIKE '%local%' THEN 'local'
  ELSE grado -- Keep NULL or other values as-is (will be validated by CHECK)
END
WHERE grado IS NOT NULL;

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

INSERT INTO user_activity (
  user_id,
  action,
  table_name,
  details,
  created_at
) VALUES (
  NULL,
  'schema_migration',
  'pastors',
  jsonb_build_object(
    'migration', '033',
    'description', 'Renamed ordination_level to grado with valid grade constraints',
    'valid_grades', ARRAY['ordenación', 'general', 'local']
  ),
  now()
);

COMMIT;
