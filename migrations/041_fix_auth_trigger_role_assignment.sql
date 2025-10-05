-- Migration: Fix Auth Trigger Role Assignment
-- Purpose: Update handle_new_user() to use current role system and safer defaults
-- Author: Security Hardening
-- Date: 2025-10-05
-- Related: Migration 037 (removed 'member' role), Migration 040 (added 'national_treasurer')
-- =============================================================================

BEGIN;

-- Update the handle_new_user trigger with correct role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    existing_profile_id UUID;
    user_full_name TEXT;
    user_avatar TEXT;
BEGIN
  -- Extract user information from auth metadata
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  user_avatar := NEW.raw_user_meta_data->>'avatar_url';

  -- Check for existing legacy user
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
    AND (is_authenticated = false OR is_authenticated IS NULL)
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Update existing legacy user profile
    UPDATE public.profiles
    SET
      id = NEW.id,
      full_name = COALESCE(full_name, user_full_name),
      avatar_url = COALESCE(avatar_url, user_avatar),
      is_authenticated = true,
      last_seen_at = now(),
      updated_at = now()
    WHERE id = existing_profile_id;
  ELSE
    -- Create new user profile with role assignment
    INSERT INTO public.profiles (
      id, email, full_name, avatar_url, role,
      is_authenticated, last_seen_at, onboarding_step
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_full_name,
      user_avatar,
      CASE
        -- SECURITY: System administrators (exact match)
        WHEN NEW.email IN ('administracion@ipupy.org.py', 'tesoreria@ipupy.org.py') THEN 'admin'
        
        -- SECURITY FIX: Default organizational users to lowest privilege
        -- Admin can upgrade roles as needed via user management
        WHEN NEW.email LIKE '%@ipupy.org.py' THEN 'secretary'
        
        -- SECURITY: Fallback for any edge cases (should never happen with domain restriction)
        -- Using 'secretary' instead of obsolete 'member' role
        ELSE 'secretary'
      END,
      true,
      now(),
      0
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.handle_new_user() IS
  'Handles new user registration with @ipupy.org.py domain validation. ' ||
  'Security: System admins get admin role, organizational users default to secretary. ' ||
  'Migration 041: Fixed obsolete member role, implemented safer default role assignment.';

COMMIT;

