-- Migration 055: Tolerate Convex IDs in RLS helpers
-- Purpose: Prevent UUID cast failures when Convex-authenticated sessions
--          populate app.current_user_id with non-UUID identifiers.
-- Context: Postgres remains in read-only mode for historical exports, so we
--          only need the helpers to fail closed instead of raising errors.
-- Date: 2025-10-10

BEGIN;

-- ============================================================================
-- Utility: Safe UUID cast helper
-- ============================================================================

CREATE OR REPLACE FUNCTION app_try_cast_uuid(value TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed TEXT;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  trimmed := btrim(value);

  IF trimmed = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN trimmed::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
    WHEN data_exception THEN
      RETURN NULL;
  END;
END;
$$;

COMMENT ON FUNCTION app_try_cast_uuid(TEXT) IS
  'Attempts to cast the provided text to UUID, returning NULL if the value is blank or invalid.';

-- ============================================================================
-- Helper: app_current_user_id (safe for Convex document ids)
-- ============================================================================

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw_setting TEXT;
  resolved UUID;
BEGIN
  raw_setting := current_setting('app.current_user_id', true);
  resolved := app_try_cast_uuid(raw_setting);

  RETURN resolved;
END;
$$;

COMMENT ON FUNCTION app_current_user_id() IS
  'Returns the current application user UUID or NULL when no valid UUID is present.';

-- ============================================================================
-- Trigger helper: Log pastor/profile link changes without UUID casts
-- ============================================================================

CREATE OR REPLACE FUNCTION log_pastor_profile_link_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actor UUID;
BEGIN
  actor := app_current_user_id();

  -- Log when profile_id is added (granted access)
  IF OLD.profile_id IS NULL AND NEW.profile_id IS NOT NULL THEN
    INSERT INTO user_activity (user_id, action, details, created_at)
    VALUES (
      COALESCE(actor, NEW.profile_id),
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
      COALESCE(actor, OLD.profile_id),
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
      COALESCE(actor, NEW.profile_id),
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
$$;

COMMENT ON FUNCTION log_pastor_profile_link_change() IS
  'Audit trigger for pastor/profile linkage that tolerates non-UUID session identifiers.';

-- ============================================================================
-- Helper: app_user_has_fund_access (safe UUID resolution)
-- ============================================================================

CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := app_current_user_id();

  IF v_user_id IS NULL THEN
    BEGIN
      v_user_id := auth.uid();
    EXCEPTION
      WHEN others THEN
        v_user_id := NULL;
    END;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id;

  -- National-level roles with unrestricted access
  IF v_role IN ('admin', 'national_treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Fund directors: check assignments
  IF v_role = 'fund_director' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.fund_director_assignments
      WHERE profile_id = v_user_id
      AND (fund_id = p_fund_id OR fund_id IS NULL)
    );
  END IF;

  -- Church-scoped roles: blocked from national fund access
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION app_user_has_fund_access(BIGINT) IS
  'Legacy BIGINT overload hardened against non-UUID session identifiers.';

COMMIT;

-- ============================================================================
-- Verification Hints
-- ============================================================================
-- SELECT app_try_cast_uuid('not-a-uuid'); -- should return NULL
-- SELECT app_try_cast_uuid('00000000-0000-0000-0000-000000000000');
-- SELECT app_current_user_id(); -- returns NULL when set_config contains Convex id
