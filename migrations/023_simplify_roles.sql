-- Migration: Simplify Role System
-- Purpose: Consolidate from 8 roles to 6 clearer, hierarchical roles
-- Author: System Architecture Review
-- Date: 2025-09-25
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: BACKUP CURRENT ROLE DATA
-- ============================================================================

-- Create backup table for role history
CREATE TABLE IF NOT EXISTS role_migration_backup (
  id SERIAL PRIMARY KEY,
  profile_id UUID,
  old_role TEXT,
  new_role TEXT,
  migration_date TIMESTAMPTZ DEFAULT now()
);

-- Backup current roles
INSERT INTO role_migration_backup (profile_id, old_role, new_role)
SELECT
  id,
  role,
  CASE
    WHEN role = 'super_admin' THEN 'admin'
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'church_admin' THEN 'pastor'
    WHEN role = 'viewer' THEN 'member'
    ELSE role  -- Keep district_supervisor, treasurer, secretary, member as-is
  END
FROM profiles;

-- ============================================================================
-- PHASE 2: UPDATE ROLE DATA
-- ============================================================================

-- Consolidate super_admin into admin
UPDATE profiles
SET
  role = 'admin',
  updated_at = now()
WHERE role = 'super_admin';

-- Rename church_admin to pastor (more domain-appropriate)
UPDATE profiles
SET
  role = 'pastor',
  updated_at = now()
WHERE role = 'church_admin';

-- Convert viewers to members
UPDATE profiles
SET
  role = 'member',
  updated_at = now()
WHERE role = 'viewer';

-- Log the changes
DO $$
DECLARE
  admin_count INTEGER;
  pastor_count INTEGER;
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'admin';
  SELECT COUNT(*) INTO pastor_count FROM profiles WHERE role = 'pastor';
  SELECT COUNT(*) INTO member_count FROM profiles WHERE role = 'member';

  RAISE NOTICE 'Role migration completed:';
  RAISE NOTICE '  - Admins (consolidated): %', admin_count;
  RAISE NOTICE '  - Pastors (renamed from church_admin): %', pastor_count;
  RAISE NOTICE '  - Members (converted from viewer): %', member_count;
END $$;

-- ============================================================================
-- PHASE 3: UPDATE ROLE CONSTRAINT
-- ============================================================================

-- Drop old constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with simplified roles
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'district_supervisor', 'pastor', 'treasurer', 'secretary', 'member'));

-- ============================================================================
-- PHASE 4: UPDATE RLS POLICIES FOR NEW ROLES
-- ============================================================================

-- Drop and recreate the app_user_is_admin function to handle simplified roles
CREATE OR REPLACE FUNCTION app_user_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  -- Now only 'admin' role, no more 'super_admin'
  SELECT app_current_user_role() = 'admin';
$$;

-- Create function to check if user has church management role
CREATE OR REPLACE FUNCTION app_user_is_church_manager()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() IN ('pastor', 'treasurer', 'secretary');
$$;

-- Create function to check if user is district supervisor
CREATE OR REPLACE FUNCTION app_user_is_district_supervisor()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() = 'district_supervisor';
$$;

-- ============================================================================
-- PHASE 5: UPDATE AUTH TRIGGER FOR NEW ROLES
-- ============================================================================

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
      -- New user - create profile with simplified roles
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
          -- System administrators (simplified check)
          WHEN NEW.email IN ('administracion@ipupy.org.py', 'tesoreria@ipupy.org.py') THEN 'admin'
          -- Other organizational emails get admin role
          WHEN NEW.email LIKE '%@ipupy.org%' THEN 'admin'
          -- Default role for new users
          ELSE 'member'
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

-- ============================================================================
-- PHASE 6: CREATE ROLE PERMISSION MATRIX
-- ============================================================================

-- Create a table to document role permissions (for reference)
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  scope TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, permission)
);

-- Insert permission matrix
INSERT INTO role_permissions (role, permission, scope, description)
VALUES
  -- Admin permissions (full system access)
  ('admin', 'system.manage', 'all', 'Full system administration'),
  ('admin', 'churches.manage', 'all', 'Manage all churches'),
  ('admin', 'reports.approve', 'all', 'Approve all reports'),
  ('admin', 'funds.manage', 'all', 'Manage all funds'),
  ('admin', 'users.manage', 'all', 'Manage all users'),

  -- District Supervisor permissions
  ('district_supervisor', 'churches.view', 'district', 'View churches in district'),
  ('district_supervisor', 'reports.approve', 'district', 'Approve district reports'),
  ('district_supervisor', 'reports.view', 'district', 'View district reports'),
  ('district_supervisor', 'members.view', 'district', 'View district members'),

  -- Pastor permissions
  ('pastor', 'church.manage', 'own', 'Manage own church'),
  ('pastor', 'reports.create', 'own', 'Create reports for own church'),
  ('pastor', 'reports.edit', 'own', 'Edit own church reports'),
  ('pastor', 'members.manage', 'own', 'Manage church members'),
  ('pastor', 'funds.view', 'own', 'View church funds'),

  -- Treasurer permissions
  ('treasurer', 'reports.create', 'own', 'Create financial reports'),
  ('treasurer', 'reports.edit', 'own', 'Edit financial reports'),
  ('treasurer', 'funds.view', 'own', 'View church funds'),
  ('treasurer', 'transactions.view', 'own', 'View church transactions'),

  -- Secretary permissions
  ('secretary', 'members.manage', 'own', 'Manage member records'),
  ('secretary', 'reports.view', 'own', 'View reports'),
  ('secretary', 'events.manage', 'own', 'Manage church events'),

  -- Member permissions
  ('member', 'profile.edit', 'own', 'Edit own profile'),
  ('member', 'contributions.view', 'own', 'View own contributions'),
  ('member', 'events.view', 'own', 'View church events')
ON CONFLICT (role, permission) DO NOTHING;

-- ============================================================================
-- PHASE 7: CREATE HELPER FUNCTIONS FOR ROLE CHECKING
-- ============================================================================

-- Function to check if user can manage reports
CREATE OR REPLACE FUNCTION can_manage_reports(user_role TEXT, church_id BIGINT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  CASE user_role
    WHEN 'admin' THEN
      RETURN true;  -- Admin can manage all reports
    WHEN 'district_supervisor' THEN
      -- TODO: Check if church is in user's district
      RETURN church_id IS NOT NULL;
    WHEN 'pastor', 'treasurer' THEN
      -- Can only manage own church reports
      RETURN church_id = app_current_user_church_id();
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Function to get role hierarchy level
CREATE OR REPLACE FUNCTION get_role_level(user_role TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE user_role
    WHEN 'admin' THEN 6
    WHEN 'district_supervisor' THEN 5
    WHEN 'pastor' THEN 4
    WHEN 'treasurer' THEN 3
    WHEN 'secretary' THEN 2
    WHEN 'member' THEN 1
    ELSE 0
  END;
$$;

-- Function to check if role A can manage role B
CREATE OR REPLACE FUNCTION can_manage_role(manager_role TEXT, target_role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT get_role_level(manager_role) > get_role_level(target_role);
$$;

-- ============================================================================
-- PHASE 8: DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE role_permissions IS 'Permission matrix for simplified role system';
COMMENT ON FUNCTION app_user_is_church_manager() IS 'Check if user has church management permissions (pastor, treasurer, secretary)';
COMMENT ON FUNCTION can_manage_reports(TEXT, BIGINT) IS 'Check if user with given role can manage reports for specified church';
COMMENT ON FUNCTION get_role_level(TEXT) IS 'Get hierarchical level of role (higher = more permissions)';
COMMENT ON FUNCTION can_manage_role(TEXT, TEXT) IS 'Check if one role can manage users with another role';

-- ============================================================================
-- PHASE 9: VERIFICATION
-- ============================================================================

-- Verify role distribution after migration
DO $$
DECLARE
  role_record RECORD;
  total_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM profiles;

  RAISE NOTICE '=== Role Distribution After Migration ===';
  RAISE NOTICE 'Total users: %', total_users;
  RAISE NOTICE '';

  FOR role_record IN
    SELECT role, COUNT(*) as count
    FROM profiles
    GROUP BY role
    ORDER BY
      CASE role
        WHEN 'admin' THEN 1
        WHEN 'district_supervisor' THEN 2
        WHEN 'pastor' THEN 3
        WHEN 'treasurer' THEN 4
        WHEN 'secretary' THEN 5
        WHEN 'member' THEN 6
        ELSE 7
      END
  LOOP
    RAISE NOTICE '%: % users (%.1f%%)',
      RPAD(role_record.role, 20),
      role_record.count,
      (role_record.count::NUMERIC / NULLIF(total_users, 0) * 100);
  END LOOP;

  -- Check for any invalid roles
  PERFORM 1 FROM profiles
  WHERE role NOT IN ('admin', 'district_supervisor', 'pastor', 'treasurer', 'secretary', 'member');

  IF FOUND THEN
    RAISE WARNING 'Found users with invalid roles after migration!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✅ All users have valid roles in the simplified system';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Save as 023_simplify_roles_rollback.sql)
-- ============================================================================
/*
BEGIN;

-- Restore original roles from backup
UPDATE profiles p
SET
  role = b.old_role,
  updated_at = now()
FROM role_migration_backup b
WHERE p.id = b.profile_id
  AND b.migration_date = (
    SELECT MAX(migration_date)
    FROM role_migration_backup
    WHERE profile_id = p.id
  );

-- Restore original constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('super_admin', 'admin', 'district_supervisor', 'church_admin',
                'treasurer', 'secretary', 'member', 'viewer'));

-- Restore original functions
-- (Would need to restore from migration 017)

-- Drop new helper functions
DROP FUNCTION IF EXISTS app_user_is_church_manager();
DROP FUNCTION IF EXISTS app_user_is_district_supervisor();
DROP FUNCTION IF EXISTS can_manage_reports(TEXT, BIGINT);
DROP FUNCTION IF EXISTS get_role_level(TEXT);
DROP FUNCTION IF EXISTS can_manage_role(TEXT, TEXT);

-- Drop permission matrix table
DROP TABLE IF EXISTS role_permissions;

-- Note: Keep the backup table for audit purposes
-- DROP TABLE IF EXISTS role_migration_backup;

COMMIT;
*/