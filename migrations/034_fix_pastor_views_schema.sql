-- Migration 034: Fix pastor views to match API route expectations
-- Purpose: Restore missing columns in church_primary_pastors and pastor_user_access views
-- Date: 2025-10-03

BEGIN;

-- ============================================================================
-- FIX 1: RESTORE FULL CHURCH_PRIMARY_PASTORS VIEW
-- ============================================================================

DROP VIEW IF EXISTS church_primary_pastors;

CREATE VIEW church_primary_pastors AS
SELECT
  c.id AS church_id,
  c.name AS church_name,
  c.city,
  c.active,
  c.phone AS church_phone,
  c.email AS church_email,
  p.id AS pastor_id,
  p.full_name,
  p.preferred_name,
  p.email AS pastor_email,
  p.phone AS pastor_phone,
  p.whatsapp AS pastor_whatsapp,
  p.role_title,
  p.grado,
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
-- FIX 2: RESTORE FULL PASTOR_USER_ACCESS VIEW
-- ============================================================================

DROP VIEW IF EXISTS pastor_user_access;

CREATE VIEW pastor_user_access AS
SELECT
  p.id AS pastor_id,
  p.church_id,
  c.name AS church_name,
  c.city,
  p.full_name AS pastor_name,
  p.preferred_name,
  p.email AS pastor_email,
  p.phone AS pastor_phone,
  p.whatsapp AS pastor_whatsapp,
  p.role_title AS pastoral_role,
  p.grado AS ordination_level,
  p.status AS pastor_status,
  p.profile_id,
  prof.email AS platform_email,
  prof.role AS platform_role,
  prof.is_active AS platform_active,
  prof.last_seen_at,
  prof.role_assigned_by,
  prof.role_assigned_at,
  CASE
    WHEN prof.id IS NULL THEN 'no_access'
    WHEN prof.is_active = FALSE THEN 'revoked'
    ELSE 'active'
  END AS access_status
FROM pastors p
LEFT JOIN churches c ON c.id = p.church_id
LEFT JOIN profiles prof ON prof.id = p.profile_id
WHERE p.is_primary = TRUE AND p.status = 'active';

COMMENT ON VIEW pastor_user_access IS 'Shows active primary pastors with their platform access status and role assignments';

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
  'views',
  jsonb_build_object(
    'migration', '034',
    'description', 'Fixed church_primary_pastors and pastor_user_access views to match API expectations',
    'views_updated', ARRAY['church_primary_pastors', 'pastor_user_access']
  ),
  now()
);

COMMIT;
