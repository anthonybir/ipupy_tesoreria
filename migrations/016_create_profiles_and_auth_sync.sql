-- Migration: Create profiles table and auth.users sync trigger
-- Purpose: Properly integrate Supabase Auth with application data
-- Author: System
-- Date: 2025-09-23

-- Drop the profiles table if it exists (in case we ran this in Supabase console)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table to sync with auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'church', 'viewer')),
  church_id INTEGER REFERENCES public.churches(id),
  is_authenticated BOOLEAN DEFAULT false,
  migration_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_church_id ON public.profiles(church_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_is_authenticated ON public.profiles(is_authenticated);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- RLS policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS policy: Admins can insert profiles
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to handle new user creation (idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    existing_profile_id UUID;
    user_full_name TEXT;
BEGIN
  -- Extract full name from metadata if available
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Check if a profile already exists with this email (legacy user)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
    AND is_authenticated = false
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Legacy user logging in for first time - update their profile
    UPDATE public.profiles
    SET
      id = NEW.id,  -- Link to auth user ID
      full_name = COALESCE(full_name, user_full_name),
      is_authenticated = true,
      migration_notes = COALESCE(migration_notes || ' | ', '') || 'Linked to auth.users on ' || now()::text,
      updated_at = now()
    WHERE id = existing_profile_id;
  ELSE
    -- Check if profile already exists for this auth user ID
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE id = NEW.id;

    IF existing_profile_id IS NULL THEN
      -- New user - create profile
      INSERT INTO public.profiles (id, email, full_name, role, is_authenticated)
      VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        CASE
          WHEN NEW.email = 'administracion@ipupy.org.py' THEN 'admin'
          WHEN NEW.email LIKE '%@ipupy.org%' THEN 'admin'
          ELSE 'viewer'
        END,
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to sync auth.users with profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Migrate existing users from public.users to profiles
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    church_id,
    is_authenticated,
    migration_notes,
    created_at
)
SELECT
    gen_random_uuid() as id,
    u.email,
    CASE
        WHEN u.email = 'administracion@ipupy.org.py' THEN 'Administrador IPUPY'
        ELSE split_part(u.email, '@', 1)
    END as full_name,
    COALESCE(u.role, 'viewer') as role,
    u.church_id,
    false as is_authenticated,  -- They need to sign in with Google to activate
    'Migrated from public.users - pending auth activation' as migration_notes,
    COALESCE(u.created_at, now()) as created_at
FROM public.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Create view to see authentication status
CREATE OR REPLACE VIEW public.user_authentication_status AS
SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.church_id,
    c.name as church_name,
    p.is_authenticated,
    CASE
        WHEN au.id IS NOT NULL THEN 'Authenticated'
        WHEN p.is_authenticated = false THEN 'Legacy - Needs Activation'
        ELSE 'Unknown'
    END as status,
    p.created_at,
    au.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN public.churches c ON p.church_id = c.id
ORDER BY p.created_at DESC;

-- Grant necessary permissions
GRANT SELECT ON public.user_authentication_status TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users for application-specific data';
COMMENT ON COLUMN public.profiles.is_authenticated IS 'Whether this profile has been linked to an auth.users entry';
COMMENT ON COLUMN public.profiles.migration_notes IS 'Notes about profile migration and authentication status';