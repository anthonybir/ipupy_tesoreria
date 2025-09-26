-- Migration: Extend configuration coverage and align seed data
-- Date: 2025-09-26

BEGIN;

-- Align fund names with UI/domain expectations
UPDATE funds SET name = 'Fondo Nacional'
WHERE name IN ('General', 'Fondo General');

UPDATE funds SET name = 'Instituto Bíblico'
WHERE name IN ('IBA', 'Instituto Biblico');

UPDATE funds SET name = 'Misión Posible'
WHERE name = 'Mision Posible';

-- Ensure core national funds exist (no balance override on conflict)
INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
VALUES
  ('Fondo Nacional', 'nacional', 'Fondo nacional IPU (10% automático)', 0, TRUE, 'system'),
  ('Misiones', 'misionero', 'Fondo de Misiones nacional', 0, TRUE, 'system'),
  ('Instituto Bíblico', 'educativo', 'Fondo Instituto Bíblico (IBA)', 0, TRUE, 'system'),
  ('Caballeros', 'especial', 'Fondo ministerio de caballeros', 0, TRUE, 'system'),
  ('Damas', 'especial', 'Fondo ministerio de damas', 0, TRUE, 'system'),
  ('Niños', 'especial', 'Fondo ministerio de niños', 0, TRUE, 'system'),
  ('APY', 'especial', 'Fondo Asociación Pentecostal de Jóvenes', 0, TRUE, 'system'),
  ('Lazos de Amor', 'obras_beneficas', 'Fondo benéfico Lazos de Amor', 0, TRUE, 'system'),
  ('Misión Posible', 'misionero', 'Fondo de proyectos misioneros especiales', 0, TRUE, 'system')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- General configuration extensions
INSERT INTO system_configuration (section, key, value, description)
VALUES
  ('general', 'maintenanceMode', 'false'::jsonb, 'Enable system maintenance banner'),
  ('general', 'allowRegistrations', 'false'::jsonb, 'Allow self-service church registrations'),
  ('general', 'requireEmailVerification', 'true'::jsonb, 'Require email verification for new accounts')
ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Financial configuration extensions
INSERT INTO system_configuration (section, key, value, description)
VALUES
  ('financial', 'honorariosPastoralesDefault', '0'::jsonb, 'Default pastor honorarium amount (Gs.)'),
  ('financial', 'requiredApprovals', '2'::jsonb, 'Number of approvals required for reports'),
  ('financial', 'autoGenerateReports', 'true'::jsonb, 'Automatically generate monthly reports'),
  ('financial', 'reminderDaysBefore', '3'::jsonb, 'Reminder days before report deadline'),
  ('financial', 'allowNegativeBalances', 'false'::jsonb, 'Allow funds to go negative'),
  ('financial', 'roundingMethod', '"nearest"'::jsonb, 'Rounding method for auto calculations'),
  ('financial', 'enableBudgets', 'true'::jsonb, 'Enable budget planning features'),
  ('financial', 'budgetWarningThreshold', '80'::jsonb, 'Budget usage warning threshold (percent)'),
  ('financial', 'allowManualEntries', 'true'::jsonb, 'Allow manual ledger entries'),
  ('financial', 'requireDoubleEntry', 'true'::jsonb, 'Enforce double-entry bookkeeping')
ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Notification configuration extensions
INSERT INTO system_configuration (section, key, value, description)
VALUES
  ('notifications', 'smsEnabled', 'false'::jsonb, 'Enable SMS notifications'),
  ('notifications', 'whatsappEnabled', 'false'::jsonb, 'Enable WhatsApp notifications'),
  ('notifications', 'lowBalanceNotify', 'true'::jsonb, 'Notify on low fund balance'),
  ('notifications', 'lowBalanceThreshold', '500000'::jsonb, 'Low balance threshold (Gs.)'),
  ('notifications', 'weeklyDigestEnabled', 'false'::jsonb, 'Enable weekly email digest'),
  ('notifications', 'notifyAdminsOnErrors', 'true'::jsonb, 'Notify admins when errors occur'),
  ('notifications', 'notifyOnNewRegistration', 'true'::jsonb, 'Notify on new user registrations'),
  ('notifications', 'notifyOnLargeTransaction', 'true'::jsonb, 'Notify on large transactions'),
  ('notifications', 'largeTransactionThreshold', '10000000'::jsonb, 'Large transaction threshold (Gs.)')
ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Funds configuration defaults (metadata only; live list comes from funds table)
INSERT INTO system_configuration (section, key, value, description)
VALUES
  (
    'funds',
    'defaultFunds',
    '[{"name":"Fondo Nacional","percentage":10,"required":true,"autoCalculate":true},{"name":"Misiones","percentage":0,"required":false,"autoCalculate":false},{"name":"Instituto Bíblico","percentage":0,"required":false,"autoCalculate":false},{"name":"Caballeros","percentage":0,"required":false,"autoCalculate":false},{"name":"Damas","percentage":0,"required":false,"autoCalculate":false},{"name":"Niños","percentage":0,"required":false,"autoCalculate":false},{"name":"APY","percentage":0,"required":false,"autoCalculate":false},{"name":"Lazos de Amor","percentage":0,"required":false,"autoCalculate":false},{"name":"Misión Posible","percentage":0,"required":false,"autoCalculate":false}]'::jsonb,
    'Default national fund metadata'
  ),
  ('funds', 'allowCustomFunds', 'true'::jsonb, 'Allow churches to register custom funds'),
  ('funds', 'maxCustomFunds', '10'::jsonb, 'Maximum custom funds per church'),
  ('funds', 'trackFundHistory', 'true'::jsonb, 'Track historical balances for funds'),
  ('funds', 'allowInterFundTransfers', 'true'::jsonb, 'Allow transfers between funds'),
  ('funds', 'requireTransferApproval', 'true'::jsonb, 'Require approval for fund transfers')
ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Integration configuration defaults
INSERT INTO system_configuration (section, key, value, description)
VALUES
  ('integration', 'apiEnabled', 'true'::jsonb, 'Expose REST API endpoints'),
  ('integration', 'apiRateLimit', '1000'::jsonb, 'API rate limit per window'),
  ('integration', 'apiRateLimitWindow', '3600'::jsonb, 'API rate limit window in seconds'),
  ('integration', 'webhooksEnabled', 'false'::jsonb, 'Enable outbound webhooks'),
  ('integration', 'webhookUrl', '""'::jsonb, 'Webhook endpoint URL'),
  ('integration', 'exportEnabled', 'true'::jsonb, 'Enable data exports'),
  ('integration', 'exportFormats', '["excel","pdf","csv"]'::jsonb, 'Supported export formats'),
  ('integration', 'backupEnabled', 'true'::jsonb, 'Enable automated backups'),
  ('integration', 'backupFrequency', '"daily"'::jsonb, 'Backup frequency'),
  ('integration', 'backupRetention', '30'::jsonb, 'Backup retention in days'),
  ('integration', 'googleSheetsIntegration', 'false'::jsonb, 'Enable Google Sheets sync'),
  ('integration', 'googleSheetsId', '""'::jsonb, 'Google Sheets document ID'),
  ('integration', 'supabaseProjectUrl', '""'::jsonb, 'Cached Supabase project URL'),
  ('integration', 'supabaseAnonKey', '""'::jsonb, 'Cached Supabase anon key')
ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Role configuration defaults (metadata lives here; permissions table below)
INSERT INTO system_configuration (section, key, value, description)
VALUES
  (
    'roles',
    'definitions',
    '[{"id":"admin","name":"Administrador","description":"Acceso completo al sistema","editable":false},{"id":"district_supervisor","name":"Supervisor de Distrito","description":"Supervisa iglesias de su distrito","editable":true},{"id":"pastor","name":"Pastor","description":"Gestiona su iglesia local","editable":true},{"id":"treasurer","name":"Tesorero","description":"Gestiona finanzas de la iglesia","editable":true},{"id":"secretary","name":"Secretario","description":"Apoya tareas administrativas","editable":true},{"id":"member","name":"Miembro","description":"Acceso básico de lectura","editable":true}]'::jsonb,
    'Role catalog definitions'
  )
ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Ensure role permissions matrix exists
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  scope TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission)
);

INSERT INTO role_permissions (role, permission, scope, description)
VALUES
  ('admin', 'system.manage', 'all', 'Full system administration'),
  ('admin', 'churches.manage', 'all', 'Manage all churches'),
  ('admin', 'reports.approve', 'all', 'Approve all reports'),
  ('admin', 'funds.manage', 'all', 'Manage all funds'),
  ('admin', 'users.manage', 'all', 'Manage all users'),
  ('district_supervisor', 'churches.view', 'district', 'View churches in assigned district'),
  ('district_supervisor', 'reports.approve', 'district', 'Approve district reports'),
  ('district_supervisor', 'reports.view', 'district', 'View district reports'),
  ('district_supervisor', 'members.view', 'district', 'View district members'),
  ('pastor', 'church.manage', 'own', 'Manage own church configuration'),
  ('pastor', 'reports.create', 'own', 'Create reports for own church'),
  ('pastor', 'reports.edit', 'own', 'Edit reports for own church'),
  ('pastor', 'members.manage', 'own', 'Manage members in own church'),
  ('pastor', 'funds.view', 'own', 'View own church funds'),
  ('treasurer', 'reports.create', 'own', 'Create financial reports'),
  ('treasurer', 'reports.edit', 'own', 'Edit financial reports'),
  ('treasurer', 'funds.view', 'own', 'View church funds'),
  ('treasurer', 'transactions.view', 'own', 'View church transactions'),
  ('secretary', 'members.manage', 'own', 'Manage member records'),
  ('secretary', 'reports.view', 'own', 'View church reports'),
  ('secretary', 'events.manage', 'own', 'Manage church events'),
  ('member', 'profile.edit', 'own', 'Edit own profile'),
  ('member', 'contributions.view', 'own', 'View own contributions'),
  ('member', 'events.view', 'own', 'View church events')
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;
