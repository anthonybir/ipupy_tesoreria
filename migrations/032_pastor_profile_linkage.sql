-- Migration: Link pastors to user profiles for platform access
-- Purpose: Enable admin to assign system roles to pastors while maintaining pastoral identity
-- Author: AI Assistant
-- Date: 2025-10-01

BEGIN;

-- ============================================================================
-- PHASE 1: ADD PROFILE LINKAGE TO PASTORS TABLE
-- ============================================================================

-- Add profile_id foreign key to link pastors with user accounts
ALTER TABLE pastors
  ADD COLUMN IF NOT EXISTS profile_id UUID;

-- Add foreign key constraint with SET NULL on delete (preserve pastor record if user deleted)
ALTER TABLE pastors
  ADD CONSTRAINT pastors_profile_id_fk
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pastors_profile_id ON pastors(profile_id);

-- Prevent duplicate profile linkages (one profile can only be linked to one pastor)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pastors_profile_unique
  ON pastors(profile_id)
  WHERE profile_id IS NOT NULL;

COMMENT ON COLUMN pastors.profile_id IS 'Link to profiles table enabling platform access and role assignment for this pastor';

-- ============================================================================
-- PHASE 2: CREATE CONVENIENCE VIEW FOR PASTOR-USER ACCESS
-- ============================================================================

CREATE OR REPLACE VIEW pastor_user_access AS
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
  p.ordination_level,
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
-- PHASE 3: ADD AUDIT TRAIL FOR LINKAGE CHANGES
-- ============================================================================

-- Function to log pastor-profile linkage changes
CREATE OR REPLACE FUNCTION log_pastor_profile_link_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when profile_id is added (granted access)
  IF OLD.profile_id IS NULL AND NEW.profile_id IS NOT NULL THEN
    INSERT INTO user_activity (user_id, action, details, created_at)
    VALUES (
      COALESCE(current_setting('app.current_user_id', true)::UUID, NEW.profile_id),
      'pastor.access_granted',
      jsonb_build_object(
        'pastor_id', NEW.id,
        'pastor_name', NEW.full_name,
        'profile_id', NEW.profile_id,
        'church_id', NEW.church_id
      ),
      NOW()
    );
  END IF;

  -- Log when profile_id is removed (revoked access)
  IF OLD.profile_id IS NOT NULL AND NEW.profile_id IS NULL THEN
    INSERT INTO user_activity (user_id, action, details, created_at)
    VALUES (
      COALESCE(current_setting('app.current_user_id', true)::UUID, OLD.profile_id),
      'pastor.access_revoked',
      jsonb_build_object(
        'pastor_id', OLD.id,
        'pastor_name', OLD.full_name,
        'previous_profile_id', OLD.profile_id,
        'church_id', OLD.church_id
      ),
      NOW()
    );
  END IF;

  -- Log when profile_id is changed (re-linked)
  IF OLD.profile_id IS NOT NULL AND NEW.profile_id IS NOT NULL AND OLD.profile_id != NEW.profile_id THEN
    INSERT INTO user_activity (user_id, action, details, created_at)
    VALUES (
      COALESCE(current_setting('app.current_user_id', true)::UUID, NEW.profile_id),
      'pastor.access_changed',
      jsonb_build_object(
        'pastor_id', NEW.id,
        'pastor_name', NEW.full_name,
        'old_profile_id', OLD.profile_id,
        'new_profile_id', NEW.profile_id,
        'church_id', NEW.church_id
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS pastor_profile_link_audit ON pastors;
CREATE TRIGGER pastor_profile_link_audit
  AFTER UPDATE OF profile_id ON pastors
  FOR EACH ROW
  WHEN (OLD.profile_id IS DISTINCT FROM NEW.profile_id)
  EXECUTE FUNCTION log_pastor_profile_link_change();

-- ============================================================================
-- PHASE 4: VERIFICATION BLOCK
-- ============================================================================

DO $$
DECLARE
  linked_count INTEGER;
  active_pastors INTEGER;
BEGIN
  SELECT COUNT(*) INTO linked_count FROM pastors WHERE profile_id IS NOT NULL;
  SELECT COUNT(*) INTO active_pastors FROM pastors WHERE is_primary = TRUE AND status = 'active';

  RAISE NOTICE '====================================';
  RAISE NOTICE 'Pastor-Profile Linkage Migration';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Active primary pastors: %', active_pastors;
  RAISE NOTICE 'Pastors with platform access: %', linked_count;
  RAISE NOTICE 'Pastors without access: %', active_pastors - linked_count;
  RAISE NOTICE '====================================';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK GUIDANCE
-- ============================================================================
-- To revert:
--   1. DROP TRIGGER pastor_profile_link_audit ON pastors;
--   2. DROP FUNCTION log_pastor_profile_link_change();
--   3. DROP VIEW pastor_user_access;
--   4. DROP INDEX idx_pastors_profile_unique;
--   5. DROP INDEX idx_pastors_profile_id;
--   6. ALTER TABLE pastors DROP CONSTRAINT pastors_profile_id_fk;
--   7. ALTER TABLE pastors DROP COLUMN profile_id;
