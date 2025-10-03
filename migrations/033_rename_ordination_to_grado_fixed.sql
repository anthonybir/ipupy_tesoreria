-- Migration 033: Rename ordination_level to grado with proper constraints (FIXED)
-- Purpose: Align column name with IPU Paraguay terminology and enforce valid grades
-- Date: 2025-10-03

BEGIN;

-- ============================================================================
-- STEP 1: NORMALIZE EXISTING DATA BEFORE RENAME
-- ============================================================================

UPDATE pastors
SET ordination_level = LOWER(ordination_level)
WHERE ordination_level IS NOT NULL;

-- Map ADMIN to general (ADMIN is not a ministerial grade)
UPDATE pastors
SET ordination_level = 'general'
WHERE ordination_level = 'admin';

-- Map ORDENADO to ordenación
UPDATE pastors
SET ordination_level = 'ordenación'
WHERE ordination_level = 'ordenado';

-- ============================================================================
-- STEP 2: RENAME COLUMN
-- ============================================================================

ALTER TABLE pastors
  RENAME COLUMN ordination_level TO grado;

COMMENT ON COLUMN pastors.grado IS 'Grado ministerial del pastor: ordenación (más alto), general, o local (más bajo)';

-- ============================================================================
-- STEP 3: ADD CHECK CONSTRAINT FOR VALID GRADES
-- ============================================================================

ALTER TABLE pastors
  ADD CONSTRAINT pastors_grado_check
  CHECK (grado IS NULL OR grado IN ('ordenación', 'general', 'local'));

-- ============================================================================
-- STEP 4: UPDATE CHURCH_PRIMARY_PASTORS VIEW
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
-- STEP 5: UPDATE PASTOR_USER_ACCESS VIEW
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

COMMIT;
