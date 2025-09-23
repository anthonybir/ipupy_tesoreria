-- Migration: Enhance profiles table with essential user information
-- Purpose: Add missing user fields and improve profile functionality
-- Author: System
-- Date: 2025-09-23

-- Phase 1: Add essential user information columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'es' CHECK (preferred_language IN ('es', 'gn', 'en'));

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language ON public.profiles(preferred_language);

-- Phase 2: Add permissions and enhanced role management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS role_assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS role_assigned_by UUID REFERENCES public.profiles(id);

-- Create more granular roles
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('super_admin', 'admin', 'district_supervisor', 'church_admin', 'treasurer', 'secretary', 'member', 'viewer'));

-- Update existing admin roles to super_admin for system administrators
UPDATE public.profiles
SET role = 'super_admin',
    role_assigned_at = now()
WHERE email = 'administracion@ipupy.org.py';

-- Keep other admins as regular admins
UPDATE public.profiles
SET role_assigned_at = now()
WHERE role = 'admin' AND email != 'administracion@ipupy.org.py';

-- Phase 3: Add profile completion tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Phase 4: Create user activity tracking table
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for activity tracking
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON public.user_activity(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON public.user_activity(created_at DESC);

-- Enable RLS on user_activity
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_activity
CREATE POLICY "Users can view own activity" ON public.user_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.user_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Phase 5: Update the auth trigger to capture more OAuth data
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
  -- Extract full name and avatar from metadata if available
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  user_avatar := NEW.raw_user_meta_data->>'avatar_url';

  -- Check if a profile already exists with this email (legacy user)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
    AND (is_authenticated = false OR is_authenticated IS NULL)
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Legacy user logging in for first time - update their profile
    UPDATE public.profiles
    SET
      id = NEW.id,  -- Link to auth user ID
      full_name = COALESCE(full_name, user_full_name),
      avatar_url = COALESCE(avatar_url, user_avatar),
      is_authenticated = true,
      last_seen_at = now(),
      updated_at = now()
    WHERE id = existing_profile_id;
  ELSE
    -- Check if profile already exists for this auth user ID
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE id = NEW.id;

    IF existing_profile_id IS NULL THEN
      -- New user - create profile with enhanced data
      INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        is_authenticated,
        last_seen_at,
        onboarding_step
      )
      VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        user_avatar,
        CASE
          WHEN NEW.email = 'administracion@ipupy.org.py' THEN 'super_admin'
          WHEN NEW.email LIKE '%@ipupy.org%' THEN 'admin'
          ELSE 'viewer'
        END,
        true,
        now(),
        0
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Phase 6: Create function to update last seen
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Phase 7: Create view for user profile with church details
CREATE OR REPLACE VIEW public.user_profiles_extended AS
SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.avatar_url,
    p.role,
    p.permissions,
    p.church_id,
    c.name as church_name,
    c.city as church_city,
    p.preferred_language,
    p.last_seen_at,
    p.profile_completed_at,
    p.onboarding_step,
    p.is_active,
    p.created_at,
    p.updated_at,
    CASE
        WHEN p.full_name IS NOT NULL
         AND p.phone IS NOT NULL
        THEN true
        ELSE false
    END as is_profile_complete
FROM public.profiles p
LEFT JOIN public.churches c ON p.church_id = c.id;

-- Grant permissions
GRANT SELECT ON public.user_profiles_extended TO authenticated;
GRANT ALL ON public.user_activity TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN public.profiles.full_name IS 'User''s full name from OAuth or manual entry';
COMMENT ON COLUMN public.profiles.phone IS 'Contact phone number (required for church admins)';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Profile picture URL from OAuth or upload';
COMMENT ON COLUMN public.profiles.permissions IS 'Granular permissions as JSON object';
COMMENT ON COLUMN public.profiles.preferred_language IS 'User interface language preference (es=Spanish, gn=Guaraní, en=English)';
COMMENT ON COLUMN public.profiles.last_seen_at IS 'Last activity timestamp';
COMMENT ON COLUMN public.profiles.onboarding_step IS 'Current step in onboarding process (0=not started)';
COMMENT ON TABLE public.user_activity IS 'Audit trail of user actions for security and analytics';