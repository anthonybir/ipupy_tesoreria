-- Ensure admin helper considers both admin and super_admin roles
CREATE OR REPLACE FUNCTION app_user_is_admin()
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT app_current_user_role() IN ('admin', 'super_admin');
$$;
