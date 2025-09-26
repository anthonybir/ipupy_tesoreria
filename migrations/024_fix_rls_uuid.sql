-- Migration 024: Fix RLS UUID/BIGINT mismatch
-- This migration updates RLS functions to properly handle UUID user IDs from Supabase Auth

-- Drop existing functions that expect BIGINT (CASCADE to drop dependent policies)
DROP FUNCTION IF EXISTS app_current_user_id() CASCADE;
DROP FUNCTION IF EXISTS app_current_user_role() CASCADE;
DROP FUNCTION IF EXISTS app_current_user_church_id() CASCADE;

-- Create new functions that handle UUID properly
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_id', true)::UUID,
    '00000000-0000-0000-0000-000000000000'::UUID
  );
$$;

CREATE OR REPLACE FUNCTION app_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_role', true),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION app_current_user_church_id()
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_church_id', true)::INTEGER,
    0
  );
$$;

-- Update RLS policies that reference user_id to use UUID comparison
-- Note: Most policies use the functions above, so they should work automatically
-- But we need to ensure any direct user_id comparisons use UUID type

-- Create system_configuration table with proper structure
CREATE TABLE IF NOT EXISTS system_configuration (
  id SERIAL PRIMARY KEY,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section, key)
);

-- Enable RLS on system_configuration
ALTER TABLE system_configuration ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for system_configuration
CREATE POLICY "Admin users can manage configuration"
  ON system_configuration
  FOR ALL
  TO authenticated
  USING (app_current_user_role() = 'admin')
  WITH CHECK (app_current_user_role() = 'admin');

CREATE POLICY "All authenticated users can view configuration"
  ON system_configuration
  FOR SELECT
  TO authenticated
  USING (true);

-- Create user_activity table for audit logging if it doesn't exist
CREATE TABLE IF NOT EXISTS user_activity (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_activity
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_activity
CREATE POLICY "Admin users can view all activity"
  ON user_activity
  FOR SELECT
  TO authenticated
  USING (app_current_user_role() = 'admin');

CREATE POLICY "Users can view their own activity"
  ON user_activity
  FOR SELECT
  TO authenticated
  USING (user_id = app_current_user_id());

CREATE POLICY "System can insert activity"
  ON user_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Recreate policies that were dropped by CASCADE
-- The users_self_access policy needs to be recreated
DROP POLICY IF EXISTS users_self_access ON users;
CREATE POLICY users_self_access ON users
  FOR ALL
  TO authenticated
  USING (app_user_is_admin());

-- Insert default configuration values
INSERT INTO system_configuration (section, key, value, description)
VALUES
  ('general', 'systemName', '"IPU PY Tesorería"'::jsonb, 'System name'),
  ('general', 'organizationName', '"Iglesia Pentecostal Unida del Paraguay"'::jsonb, 'Organization name'),
  ('general', 'systemLanguage', '"es"'::jsonb, 'System language'),
  ('general', 'timezone', '"America/Asuncion"'::jsonb, 'System timezone'),
  ('general', 'currency', '"PYG"'::jsonb, 'Currency code'),
  ('general', 'currencySymbol', '"₲"'::jsonb, 'Currency symbol'),
  ('general', 'fiscalYearStart', '1'::jsonb, 'Fiscal year start month'),
  ('general', 'dateFormat', '"DD/MM/YYYY"'::jsonb, 'Date format'),
  ('general', 'numberFormat', '"es-PY"'::jsonb, 'Number format locale'),
  ('financial', 'fondoNacionalPercentage', '10'::jsonb, 'National fund percentage'),
  ('financial', 'reportDeadlineDay', '5'::jsonb, 'Monthly report deadline day'),
  ('financial', 'requireReceipts', 'true'::jsonb, 'Require receipts for transactions'),
  ('financial', 'receiptMinAmount', '100000'::jsonb, 'Minimum amount requiring receipt'),
  ('financial', 'autoCalculateTotals', 'true'::jsonb, 'Auto-calculate totals'),
  ('security', 'sessionTimeout', '60'::jsonb, 'Session timeout in minutes'),
  ('security', 'maxLoginAttempts', '5'::jsonb, 'Maximum login attempts'),
  ('security', 'passwordMinLength', '8'::jsonb, 'Minimum password length'),
  ('security', 'enforce2FA', 'false'::jsonb, 'Enforce two-factor authentication'),
  ('security', 'allowGoogleAuth', 'true'::jsonb, 'Allow Google authentication'),
  ('security', 'allowMagicLink', 'true'::jsonb, 'Allow magic link login'),
  ('notifications', 'emailEnabled', 'true'::jsonb, 'Enable email notifications'),
  ('notifications', 'reportSubmissionNotify', 'true'::jsonb, 'Notify on report submission'),
  ('notifications', 'reportApprovalNotify', 'true'::jsonb, 'Notify on report approval'),
  ('notifications', 'monthlyReminderEnabled', 'true'::jsonb, 'Enable monthly reminders')
ON CONFLICT (section, key) DO NOTHING;