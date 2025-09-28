# Security Documentation

## Overview

The IPU PY Treasury system implements a comprehensive security model featuring Row Level Security (RLS), simplified role-based access control, secure authentication, and robust data protection mechanisms.

## Security Architecture

### Core Security Layers

1. **Authentication Layer** - Supabase Auth with multiple providers
2. **Authorization Layer** - Role-based access control (RBAC)
3. **Data Layer** - Row Level Security (RLS) policies
4. **Transport Layer** - HTTPS and secure headers
5. **Application Layer** - Input validation and sanitization

## Role-Based Access Control (RBAC)

### Role Simplification (Migration 023)

The system was simplified from 8 roles to 6 hierarchical roles for better clarity:

#### Previous Roles (Deprecated)
- `super_admin` → **Consolidated into `admin`**
- `admin` → **Remains `admin`**
- `church_admin` → **Renamed to `pastor`**
- `viewer` → **Converted to `member`**

#### Current Role System (6 Roles)

```sql
-- Role hierarchy (highest to lowest permissions)
1. admin              -- Full system administration
2. district_supervisor -- Multi-church oversight
3. pastor             -- Church management (renamed from church_admin)
4. treasurer          -- Financial management
5. secretary          -- Administrative support
6. member             -- Basic read-only access (converted from viewer)
```

### Role Permissions Matrix

#### 1. Admin Role (`admin`)

**Scope**: System-wide access
**Permissions**:
```sql
-- Full system administration
'system.manage' -> 'all'
'churches.manage' -> 'all'
'reports.approve' -> 'all'
'funds.manage' -> 'all'
'users.manage' -> 'all'
'configuration.manage' -> 'all'
```

**Database Functions**:
```sql
CREATE OR REPLACE FUNCTION app_user_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() = 'admin';
$$;
```

#### 2. District Supervisor Role (`district_supervisor`)

**Scope**: Multi-church district oversight
**Permissions**:
```sql
'churches.view' -> 'district'
'reports.approve' -> 'district'
'reports.view' -> 'district'
'members.view' -> 'district'
```

**Database Functions**:
```sql
CREATE OR REPLACE FUNCTION app_user_is_district_supervisor()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() = 'district_supervisor';
$$;
```

#### 3. Pastor Role (`pastor`) - Renamed from church_admin

**Scope**: Single church management
**Permissions**:
```sql
'church.manage' -> 'own'
'reports.create' -> 'own'
'reports.edit' -> 'own'
'members.manage' -> 'own'
'funds.view' -> 'own'
```

#### 4. Treasurer Role (`treasurer`)

**Scope**: Financial management for assigned church
**Permissions**:
```sql
'reports.create' -> 'own'
'reports.edit' -> 'own'
'funds.view' -> 'own'
'transactions.view' -> 'own'
'financial.manage' -> 'own'
```

#### 5. Secretary Role (`secretary`)

**Scope**: Administrative support for assigned church
**Permissions**:
```sql
'members.manage' -> 'own'
'reports.view' -> 'own'
'events.manage' -> 'own'
'documents.manage' -> 'own'
```

#### 6. Member Role (`member`) - Converted from viewer

**Scope**: Basic read-only access to own data
**Permissions**:
```sql
'profile.edit' -> 'own'
'contributions.view' -> 'own'
'events.view' -> 'own'
```

### Fund Director Role (Migration 025)

The fund_director role was added to enable designated users to plan and manage events for specific funds.

**Scope**: Assigned fund(s) only
**Permissions**:
```sql
'events.create' -> 'assigned'       -- Create events for assigned funds
'events.edit' -> 'own_draft'        -- Edit own draft/pending_revision events
'events.view' -> 'assigned'         -- View events in assigned funds
'funds.view' -> 'assigned'          -- View assigned fund details
'churches.view' -> 'assigned'       -- View churches in assigned funds
```

**Database Functions**:
```sql
CREATE OR REPLACE FUNCTION app_user_is_fund_director()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() = 'fund_director';
$$;

CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    app_current_user_role() = 'admin' OR
    (app_current_user_role() = 'fund_director' AND p_fund_id = ANY(app_user_assigned_funds()));
$$;

CREATE OR REPLACE FUNCTION app_user_assigned_funds()
RETURNS INTEGER[]
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (SELECT assigned_fund_ids
     FROM profiles
     WHERE id = app_current_user_id()),
    ARRAY[]::INTEGER[]
  );
$$;
```

### Role Management Functions

```sql
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

-- Church management role check
CREATE OR REPLACE FUNCTION app_user_is_church_manager()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() IN ('pastor', 'treasurer', 'secretary');
$$;
```

## Row Level Security (RLS)

### RLS Context Management

The system sets PostgreSQL configuration variables to provide user context to RLS policies:

```typescript
// Setting RLS context before queries
await client.query("SELECT set_config('app.current_user_id', $1, true)",
  [authContext.userId || '00000000-0000-0000-0000-000000000000']);
await client.query("SELECT set_config('app.current_user_role', $1, true)",
  [authContext.role || '']);  // SECURITY FIX: Empty string for unauthenticated
await client.query("SELECT set_config('app.current_user_church_id', $1, true)",
  [String(authContext.churchId || 0)]);
```

### Critical Security Fix: RLS Fallback

**Previous Issue**: Used `'member'` as fallback role for unauthenticated users
**Security Risk**: Unauthenticated users could access member-level data

```typescript
// ❌ VULNERABLE: Previous implementation
[authContext.role || 'member']  // Gave member access to unauthenticated users

// ✅ SECURE: Current implementation
[authContext.role || '']  // Empty string = no access for unauthenticated users
```

### RLS Helper Functions

```sql
-- Get current user ID from context
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), ''),
    '00000000-0000-0000-0000-000000000000'
  )::UUID;
$$;

-- Get current user role from context (SECURITY CRITICAL)
CREATE OR REPLACE FUNCTION app_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(current_setting('app.current_user_role', true), '');
$$;

-- Get current user church ID from context
CREATE OR REPLACE FUNCTION app_current_user_church_id()
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_church_id', true), ''),
    '0'
  )::BIGINT;
$$;
```

### RLS Policy Examples

#### Church Data Access Policy

```sql
-- Churches table RLS policy
CREATE POLICY "churches_access" ON churches
  FOR ALL TO authenticated
  USING (
    app_user_is_admin() OR  -- Admins see all churches
    (app_user_is_district_supervisor() AND district_id = app_current_user_district_id()) OR  -- District supervisors see their district
    id = app_current_user_church_id()  -- Church users see only their church
  );
```

#### Monthly Reports Access Policy

```sql
-- Monthly reports RLS policy
CREATE POLICY "monthly_reports_access" ON monthly_reports
  FOR ALL TO authenticated
  USING (
    app_user_is_admin() OR  -- Admins see all reports
    (app_user_is_district_supervisor() AND church_id IN (
      SELECT id FROM churches WHERE district_id = app_current_user_district_id()
    )) OR
    church_id = app_current_user_church_id()  -- Church users see only their reports
  );
```

#### User Profiles Access Policy

```sql
-- Profiles table RLS policy
CREATE POLICY "profiles_access" ON profiles
  FOR ALL TO authenticated
  USING (
    app_user_is_admin() OR  -- Admins manage all profiles
    id = app_current_user_id() OR  -- Users manage their own profile
    (app_user_is_church_manager() AND church_id = app_current_user_church_id())  -- Church managers manage their church users
  );
```

### Fund Events RLS Policies (Migration 026)

The fund events system implements comprehensive RLS policies to ensure proper access control throughout the event lifecycle.

#### Fund Events Table RLS

```sql
-- Policy: Fund directors can manage their draft/pending events
CREATE POLICY "Fund directors manage draft events"
ON fund_events FOR ALL TO authenticated
USING (
  (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND status IN ('draft', 'pending_revision'))
  OR app_current_user_role() IN ('admin', 'treasurer')
);

-- Policy: View access for all authenticated users (filtered by fund access)
CREATE POLICY "Fund events read access"
ON fund_events FOR SELECT TO authenticated
USING (
  app_current_user_role() = 'admin'
  OR (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
  OR app_current_user_role() = 'treasurer'
);
```

#### Fund Event Budget Items RLS

```sql
-- Budget items inherit access from parent event
CREATE POLICY "Budget items follow event access"
ON fund_event_budget_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
      AND (
        (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND status IN ('draft', 'pending_revision'))
        OR app_current_user_role() IN ('admin', 'treasurer')
      )
  )
);

CREATE POLICY "Budget items read access"
ON fund_event_budget_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
      AND (
        app_current_user_role() = 'admin'
        OR (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
        OR app_current_user_role() = 'treasurer'
      )
  )
);
```

#### Fund Event Actuals RLS

```sql
-- Actuals can be added by event creator or treasurer/admin
CREATE POLICY "Event actuals management"
ON fund_event_actuals FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
      AND (
        created_by = app_current_user_id()
        OR app_current_user_role() IN ('admin', 'treasurer')
      )
  )
);

CREATE POLICY "Event actuals read access"
ON fund_event_actuals FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
      AND (
        app_current_user_role() = 'admin'
        OR (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
        OR app_current_user_role() = 'treasurer'
      )
  )
);
```

#### Fund Event Audit Trail RLS

```sql
-- Audit trail is read-only for authorized users
CREATE POLICY "Event audit read access"
ON fund_event_audit FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
      AND (
        app_current_user_role() = 'admin'
        OR (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
        OR app_current_user_role() = 'treasurer'
      )
  )
);
```

### Fund Events Workflow Functions

#### Event Approval Process

```sql
-- Function to process event approval and create transactions
CREATE OR REPLACE FUNCTION process_fund_event_approval(
  p_event_id UUID,
  p_approved_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_total_income NUMERIC;
  v_total_expense NUMERIC;
  v_income_transaction_id BIGINT;
  v_expense_transaction_id BIGINT;
BEGIN
  -- Get event details
  SELECT * INTO v_event FROM fund_events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.status != 'submitted' THEN
    RAISE EXCEPTION 'Event must be in submitted status';
  END IF;

  -- Calculate totals from actuals
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE line_type = 'income'), 0),
    COALESCE(SUM(amount) FILTER (WHERE line_type = 'expense'), 0)
  INTO v_total_income, v_total_expense
  FROM fund_event_actuals
  WHERE event_id = p_event_id;

  -- Create income transaction if there's income
  IF v_total_income > 0 THEN
    INSERT INTO transactions (fund_id, church_id, concept, amount_in, amount_out, date, created_by, created_at)
    VALUES (
      v_event.fund_id,
      v_event.church_id,
      format('Evento: %s - Ingresos', v_event.name),
      v_total_income,
      0,
      v_event.event_date,
      'system',
      now()
    )
    RETURNING id INTO v_income_transaction_id;
  END IF;

  -- Create expense transaction if there's expense
  IF v_total_expense > 0 THEN
    INSERT INTO transactions (fund_id, church_id, concept, amount_in, amount_out, date, created_by, created_at)
    VALUES (
      v_event.fund_id,
      v_event.church_id,
      format('Evento: %s - Gastos', v_event.name),
      0,
      v_total_expense,
      v_event.event_date,
      'system',
      now()
    )
    RETURNING id INTO v_expense_transaction_id;
  END IF;

  -- Update event status
  UPDATE fund_events
  SET
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now()
  WHERE id = p_event_id;

  -- Log audit trail
  INSERT INTO fund_event_audit (event_id, action, performed_by, notes)
  VALUES (
    p_event_id,
    'approved',
    p_approved_by,
    format('Event approved. Income TX: %s, Expense TX: %s', v_income_transaction_id, v_expense_transaction_id)
  );

  -- Return result
  RETURN json_build_object(
    'success', true,
    'income_transaction_id', v_income_transaction_id,
    'expense_transaction_id', v_expense_transaction_id,
    'total_income', v_total_income,
    'total_expense', v_total_expense,
    'net_amount', v_total_income - v_total_expense
  );
END;
$$;
```

#### Event Summary Function

```sql
-- Function to get event summary with aggregated data
CREATE OR REPLACE FUNCTION get_fund_event_summary(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'event', row_to_json(e.*),
    'budget_total', (
      SELECT COALESCE(SUM(projected_amount), 0)
      FROM fund_event_budget_items
      WHERE event_id = p_event_id
    ),
    'actuals', json_build_object(
      'total_income', (
        SELECT COALESCE(SUM(amount), 0)
        FROM fund_event_actuals
        WHERE event_id = p_event_id AND line_type = 'income'
      ),
      'total_expense', (
        SELECT COALESCE(SUM(amount), 0)
        FROM fund_event_actuals
        WHERE event_id = p_event_id AND line_type = 'expense'
      )
    )
  )
  INTO v_result
  FROM fund_events e
  WHERE e.id = p_event_id;

  RETURN v_result;
END;
$$;
```

## Authentication

### Supabase Authentication

The system uses Supabase Auth with multiple providers:

```typescript
// Authentication configuration
{
  enforce2FA: false,           // Configurable 2FA requirement
  allowGoogleAuth: true,       // Google OAuth enabled
  allowMagicLink: true,        // Magic link authentication enabled
  sessionTimeout: 60,          // Session timeout in minutes
  maxLoginAttempts: 5,         // Maximum failed login attempts
  passwordMinLength: 8         // Minimum password length
}
```

### User Registration and Profile Creation

```sql
-- New user trigger with simplified roles
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
        -- System administrators
        WHEN NEW.email IN ('administracion@ipupy.org.py', 'tesoreria@ipupy.org.py') THEN 'admin'
        -- Organizational emails get admin role
        WHEN NEW.email LIKE '%@ipupy.org%' THEN 'admin'
        -- Default role for new users
        ELSE 'member'
      END,
      true,
      now(),
      0
    );
  END IF;

  RETURN NEW;
END;
$$;
```

### Role Assignment Logic

```sql
-- Automatic role assignment based on email domain
CASE
  -- System administrators (hardcoded)
  WHEN NEW.email IN ('administracion@ipupy.org.py', 'tesoreria@ipupy.org.py') THEN 'admin'
  -- Organizational domain users
  WHEN NEW.email LIKE '%@ipupy.org%' THEN 'admin'
  -- Default for external users
  ELSE 'member'
END
```

## API Security

### Authentication Context

All API routes use consistent authentication checking:

```typescript
import { getAuthContext } from '@/lib/auth-context';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Check authentication
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role-based permissions
    if (auth.role !== 'admin' && sensitiveOperation) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Use executeWithContext for RLS enforcement
    const result = await executeWithContext(auth, query, params);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### CORS Security

Enhanced CORS configuration prevents unauthorized cross-origin access:

```typescript
// CORS security improvements
const buildCorsHeaders = (origin?: string | null): HeadersInit => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };

  const allowedOrigins = getAllowedOrigins();

  // SECURITY FIX: Never use wildcard (*) with credentials
  // Only set CORS header if origin is explicitly allowed
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin && allowedOrigins.length > 0) {
    headers['Access-Control-Allow-Origin'] = allowedOrigins[0];
  }
  // REMOVED: Wildcard fallback that allowed all origins

  return headers;
};
```

**Allowed Origins**:
```typescript
const defaultOrigins = [
  'http://localhost:3000',      // Development
  'http://localhost:8000',      // Local server
  'https://ipupytesoreria.vercel.app'  // Production
];
```

### Input Validation and Sanitization

```typescript
// Example: Configuration API input validation
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Authentication check
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { section, data } = body;

    // Input validation
    if (!section || !data) {
      return NextResponse.json(
        { error: 'Section and data are required' },
        { status: 400 }
      );
    }

    // Validate section name
    const validSections = ['general', 'financial', 'security', 'notifications', 'funds', 'roles', 'integration'];
    if (!validSections.includes(section)) {
      return NextResponse.json(
        { error: 'Invalid configuration section' },
        { status: 400 }
      );
    }

    // Use transaction for atomic updates
    await executeTransaction(auth, async (client) => {
      // Sanitize and store configuration
      for (const [key, value] of Object.entries(data)) {
        await client.query(`
          INSERT INTO system_configuration (section, key, value, updated_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (section, key)
          DO UPDATE SET
            value = $3,
            updated_by = $4,
            updated_at = NOW()
        `, [section, key, JSON.stringify(value), auth.userId]);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Configuration update error:', error);
    return NextResponse.json(
      { error: 'Configuration update failed' },
      { status: 500 }
    );
  }
}
```

## Data Protection

### Sensitive Data Handling

#### Configuration Data

```typescript
// Configuration values stored as JSONB with audit trail
CREATE TABLE system_configuration (
  id SERIAL PRIMARY KEY,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section, key)
);

-- Audit trail for configuration changes
CREATE TABLE user_activity (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Financial Data Encryption

```sql
-- Sensitive financial data protection
CREATE POLICY "financial_data_encryption" ON monthly_reports
  FOR ALL TO authenticated
  USING (
    -- Only authorized roles can access financial details
    app_user_is_admin() OR
    (app_user_is_church_manager() AND church_id = app_current_user_church_id()) OR
    (app_user_is_district_supervisor() AND church_id IN (
      SELECT id FROM churches WHERE district_id = app_current_user_district_id()
    ))
  );
```

### Audit Trail

All sensitive operations are logged:

```typescript
// Log configuration changes
await client.query(`
  INSERT INTO user_activity (user_id, action, details, created_at)
  VALUES ($1, $2, $3, NOW())
`, [
  auth.userId,
  'configuration.update',
  JSON.stringify({ section, keys: Object.keys(data) })
]);

// Log report approvals
await client.query(`
  INSERT INTO user_activity (user_id, action, details, created_at)
  VALUES ($1, $2, $3, NOW())
`, [
  auth.userId,
  'report.approve',
  JSON.stringify({ reportId, churchId, month, year })
]);
```

## Permission Checking Functions

### Report Management Permissions

```sql
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
```

### Financial Permissions

```sql
-- Function to check financial access permissions
CREATE OR REPLACE FUNCTION can_access_financial_data(user_role TEXT, church_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  CASE user_role
    WHEN 'admin' THEN
      RETURN true;
    WHEN 'district_supervisor' THEN
      -- District supervisors can view financial data in their district
      RETURN EXISTS (
        SELECT 1 FROM churches
        WHERE id = church_id AND district_id = app_current_user_district_id()
      );
    WHEN 'pastor', 'treasurer' THEN
      -- Church financial staff can access own church data
      RETURN church_id = app_current_user_church_id();
    WHEN 'secretary' THEN
      -- Secretaries have limited financial access
      RETURN church_id = app_current_user_church_id();
    ELSE
      RETURN false;
  END CASE;
END;
$$;
```

## Security Configuration

### System Security Settings

The configuration system allows administrators to control security parameters:

```typescript
type SecurityConfig = {
  sessionTimeout: number;        // Session timeout in minutes (default: 60)
  maxLoginAttempts: number;      // Maximum failed login attempts (default: 5)
  passwordMinLength: number;     // Minimum password length (default: 8)
  enforce2FA: boolean;           // Require two-factor authentication (default: false)
  allowGoogleAuth: boolean;      // Allow Google OAuth (default: true)
  allowMagicLink: boolean;       // Allow magic link authentication (default: true)
};
```

### Environment Security

```typescript
// Environment validation for security-critical settings
const validateSecurityEnvironment = (): void => {
  // Ensure required security environment variables
  if (!process.env.SUPABASE_JWT_SECRET) {
    throw new Error('SUPABASE_JWT_SECRET is required for JWT validation');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }

  // Validate database connection security
  if (process.env.SUPABASE_SSL_DISABLED === 'true' && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: SSL disabled in production environment');
  }
};
```

## Security Monitoring

### Failed Authentication Tracking

```sql
-- Track failed authentication attempts
CREATE TABLE auth_failures (
  id SERIAL PRIMARY KEY,
  email TEXT,
  ip_address INET,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  failure_reason TEXT
);

-- Create index for efficient monitoring
CREATE INDEX idx_auth_failures_email_time ON auth_failures (email, attempted_at);
CREATE INDEX idx_auth_failures_ip_time ON auth_failures (ip_address, attempted_at);
```

### Suspicious Activity Detection

```sql
-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  recent_failures INTEGER;
  recent_ips INTEGER;
BEGIN
  -- Check for multiple failed attempts from same email
  SELECT COUNT(*) INTO recent_failures
  FROM auth_failures
  WHERE email = NEW.email
    AND attempted_at > NOW() - INTERVAL '1 hour';

  -- Check for attempts from multiple IPs
  SELECT COUNT(DISTINCT ip_address) INTO recent_ips
  FROM auth_failures
  WHERE email = NEW.email
    AND attempted_at > NOW() - INTERVAL '24 hours';

  -- Alert on suspicious patterns
  IF recent_failures > 10 OR recent_ips > 5 THEN
    INSERT INTO security_alerts (alert_type, details, created_at)
    VALUES (
      'suspicious_auth_activity',
      json_build_object(
        'email', NEW.email,
        'recent_failures', recent_failures,
        'recent_ips', recent_ips
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for suspicious activity detection
CREATE TRIGGER auth_failures_suspicious_activity
  AFTER INSERT ON auth_failures
  FOR EACH ROW
  EXECUTE FUNCTION detect_suspicious_activity();
```

## Security Best Practices

### 1. Database Security

```sql
-- Enable RLS on all user-accessible tables
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_balances ENABLE ROW LEVEL SECURITY;

-- Revoke default permissions and grant specific access
REVOKE ALL ON monthly_reports FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON monthly_reports TO authenticated;

-- Use security definer functions for privileged operations
CREATE OR REPLACE FUNCTION admin_create_church(...)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT app_user_is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Perform privileged operation
  INSERT INTO churches (...) VALUES (...);
  RETURN church_id;
END;
$$;
```

### 2. Application Security

```typescript
// Always validate authentication context
const validateAuthContext = (auth: AuthContext | null, requiredRole?: string): AuthContext => {
  if (!auth || !auth.userId) {
    throw new AuthenticationError('Authentication required');
  }

  if (requiredRole && auth.role !== requiredRole) {
    throw new AuthorizationError(`Role '${requiredRole}' required`);
  }

  return auth;
};

// Use type-safe role checking
const checkPermission = (userRole: string, permission: string, scope: string): boolean => {
  const rolePermissions = getRolePermissions(userRole);
  return rolePermissions.some(p =>
    p.permission === permission && (p.scope === 'all' || p.scope === scope)
  );
};
```

### 3. API Security

```typescript
// Rate limiting middleware
const rateLimiter = new Map<string, { count: number; lastReset: number }>();

const checkRateLimit = (identifier: string, maxRequests: number, windowMs: number): boolean => {
  const now = Date.now();
  const userLimit = rateLimiter.get(identifier);

  if (!userLimit || now - userLimit.lastReset > windowMs) {
    rateLimiter.set(identifier, { count: 1, lastReset: now });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
};

// Request logging for security monitoring
const logSecurityEvent = async (event: SecurityEvent): Promise<void> => {
  await executeWithContext(null, `
    INSERT INTO security_log (event_type, user_id, ip_address, details, created_at)
    VALUES ($1, $2, $3, $4, NOW())
  `, [event.type, event.userId, event.ipAddress, JSON.stringify(event.details)]);
};
```

## Incident Response

### Security Incident Categories

1. **Authentication Bypass** - Unauthorized access to protected resources
2. **Privilege Escalation** - Users gaining higher permissions
3. **Data Breach** - Unauthorized access to sensitive data
4. **SQL Injection** - Malicious database queries
5. **Cross-Site Scripting (XSS)** - Client-side script injection

### Response Procedures

#### 1. Immediate Response

```typescript
// Disable compromised user account
const disableUser = async (userId: string, reason: string): Promise<void> => {
  await executeWithContext(
    { userId: 'system', role: 'admin' },
    'UPDATE profiles SET is_active = false, disabled_reason = $2 WHERE id = $1',
    [userId, reason]
  );

  // Log security action
  await logSecurityEvent({
    type: 'user_disabled',
    userId,
    details: { reason, timestamp: new Date().toISOString() }
  });
};

// Invalidate all sessions for user
const invalidateUserSessions = async (userId: string): Promise<void> => {
  // Supabase handles session invalidation
  await supabase.auth.admin.deleteUser(userId);
};
```

#### 2. Investigation

```sql
-- Investigate suspicious activity
SELECT
  u.user_id,
  u.action,
  u.details,
  u.created_at,
  p.email,
  p.role
FROM user_activity u
JOIN profiles p ON u.user_id = p.id
WHERE u.created_at > NOW() - INTERVAL '24 hours'
  AND u.action LIKE '%suspicious%'
ORDER BY u.created_at DESC;

-- Check for unauthorized data access
SELECT
  u.user_id,
  p.email,
  p.role,
  COUNT(*) as access_count
FROM user_activity u
JOIN profiles p ON u.user_id = p.id
WHERE u.action = 'data.access'
  AND u.created_at > NOW() - INTERVAL '1 hour'
GROUP BY u.user_id, p.email, p.role
HAVING COUNT(*) > 100  -- Unusual access pattern
ORDER BY access_count DESC;
```

#### 3. Recovery

```typescript
// Reset compromised configuration
const resetSecurityConfiguration = async (): Promise<void> => {
  const adminAuth = { userId: 'system', role: 'admin' };

  await executeTransaction(adminAuth, async (client) => {
    // Reset to secure defaults
    await client.query(`
      UPDATE system_configuration
      SET value = $2
      WHERE section = 'security' AND key = $1
    `, ['enforce2FA', 'true']);

    await client.query(`
      UPDATE system_configuration
      SET value = $2
      WHERE section = 'security' AND key = $1
    `, ['sessionTimeout', '30']);  // Reduce session timeout

    // Log recovery action
    await client.query(`
      INSERT INTO security_log (event_type, details, created_at)
      VALUES ('security_reset', $1, NOW())
    `, [JSON.stringify({ action: 'security_configuration_reset' })]);
  });
};
```

## Compliance and Auditing

### Data Protection Compliance

The system implements data protection measures for compliance with privacy regulations:

```sql
-- Data retention policies
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Keep activity logs for 2 years
  DELETE FROM user_activity
  WHERE created_at < NOW() - INTERVAL '2 years';

  -- Keep security logs for 5 years
  DELETE FROM security_log
  WHERE created_at < NOW() - INTERVAL '5 years';

  -- Archive old reports (keep metadata, remove sensitive details)
  UPDATE monthly_reports
  SET
    detailed_data = NULL,
    notes = '[ARCHIVED]'
  WHERE created_at < NOW() - INTERVAL '7 years';
END;
$$;

-- Schedule cleanup job
SELECT cron.schedule(
  'cleanup_old_logs',
  '0 2 * * 0',  -- Weekly on Sunday at 2 AM
  'SELECT cleanup_old_activity_logs();'
);
```

### Audit Requirements

```typescript
// Comprehensive audit trail for financial operations
const logFinancialOperation = async (
  userId: string,
  operation: string,
  details: any
): Promise<void> => {
  await executeWithContext(
    { userId, role: 'system' },
    `INSERT INTO audit_trail (
      user_id, operation_type, table_name, record_id,
      old_values, new_values, ip_address, user_agent, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      userId,
      operation,
      details.tableName,
      details.recordId,
      JSON.stringify(details.oldValues),
      JSON.stringify(details.newValues),
      details.ipAddress,
      details.userAgent
    ]
  );
};
```

This comprehensive security documentation provides a robust foundation for the IPU PY Treasury system, ensuring data protection, proper access control, and compliance with security best practices.