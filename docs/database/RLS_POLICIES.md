# Row Level Security (RLS) Policies - IPU PY Tesorería

## Overview

**Row Level Security (RLS)** is PostgreSQL's built-in data isolation mechanism that enforces access control at the database level. IPU PY Tesorería uses RLS to ensure:

1. **Church Data Isolation**: Users can only access data from their assigned church
2. **Role-Based Access**: Different roles have different permissions
3. **Defense in Depth**: Security enforced at database level, not just application level
4. **Audit Trail**: All access is logged through session context

**⚠️ CRITICAL**: All database queries **MUST** set session context before execution via `executeWithContext()` wrapper.

---

## Session Context System

### Context Variables (PostgreSQL Session)

All RLS policies rely on three session variables set before each query:

```sql
-- Set by executeWithContext() in src/lib/db-admin.ts
SET LOCAL app.current_user_id = '[user_uuid]';
SET LOCAL app.current_user_role = '[user_role]';
SET LOCAL app.current_user_church_id = '[church_id]';
```

### Context Accessor Functions

**Migration**: 010_implement_rls.sql

```sql
-- Get current user ID
CREATE FUNCTION app_current_user_id() RETURNS UUID;
-- Returns: User UUID or NULL if not set

-- Get current user role
CREATE FUNCTION app_current_user_role() RETURNS TEXT;
-- Returns: Role name or empty string if not set (fixed in security patch)

-- Get current user church ID
CREATE FUNCTION app_current_user_church_id() RETURNS INTEGER;
-- Returns: Church ID or NULL if not set
```

**⚠️ SECURITY FIX** (Oct 2025):
- Changed `app_current_user_role()` default from `'viewer'` to `''`
- Prevents unauthenticated users from getting viewer-level access
- File: `src/lib/db-context.ts` line 43

---

## Helper Functions

### Admin Check

```sql
CREATE FUNCTION app_user_is_admin() RETURNS BOOLEAN;
```

Returns `TRUE` if current user has `admin` role.

### Church Ownership

```sql
CREATE FUNCTION app_user_owns_church(church_id INTEGER) RETURNS BOOLEAN;
```

Returns `TRUE` if:
- User is admin (full access), OR
- User's church_id matches provided church_id

### Fund Director Functions (Migration 026)

```sql
-- Check if user is fund director
CREATE FUNCTION app_user_is_fund_director() RETURNS BOOLEAN;

-- Get assigned fund IDs
CREATE FUNCTION app_user_assigned_funds() RETURNS INTEGER[];

-- Check fund access
CREATE FUNCTION app_user_has_fund_access(p_fund_id INTEGER) RETURNS BOOLEAN;
```

**CRITICAL**: These functions short-circuit for non-fund-directors to avoid RLS violations.

---

## Core RLS Policies

### 1. Profiles Table

**Table**: `profiles`
**Migration**: 016, 017

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (id = app_current_user_id());

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT
USING (app_current_user_role() = 'admin');

-- Only admins can create/update/delete profiles
CREATE POLICY "Only admins can manage profiles"
ON profiles FOR ALL
USING (app_current_user_role() = 'admin')
WITH CHECK (app_current_user_role() = 'admin');
```

**Access Matrix**:
| Role | Own Profile | Other Profiles | Create | Update | Delete |
|------|-------------|----------------|--------|--------|--------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| All others | ✅ | ❌ | ❌ | ❌ | ❌ |

---

### 2. Churches Table

**Table**: `churches`
**Migration**: 010

```sql
-- All authenticated users can view all churches
CREATE POLICY "All users can view churches"
ON churches FOR SELECT
USING (true);

-- Only admin can modify churches
CREATE POLICY "Only admin can modify churches"
ON churches FOR INSERT, UPDATE, DELETE
USING (app_current_user_role() = 'admin')
WITH CHECK (app_current_user_role() = 'admin');
```

**Rationale**: Church list is public within organization (needed for dropdowns, reports), but only admin can modify.

---

### 3. Monthly Reports Table

**Table**: `monthly_reports`
**Migration**: 010, 022

```sql
-- Church isolation for reports
CREATE POLICY "Church isolation on reports"
ON monthly_reports FOR SELECT
USING (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id)
);

-- Treasurers/pastors can create reports for their church
CREATE POLICY "Treasurers can create reports"
ON monthly_reports FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor') AND
  (app_current_user_role() = 'admin' OR app_user_owns_church(church_id))
);

-- Only admin can approve reports
CREATE POLICY "Only admin can approve reports"
ON monthly_reports FOR UPDATE
USING (
  app_current_user_role() = 'admin' OR
  (app_current_user_role() IN ('treasurer', 'pastor') AND app_user_owns_church(church_id))
)
WITH CHECK (
  app_current_user_role() = 'admin' OR
  (app_current_user_role() IN ('treasurer', 'pastor') AND app_user_owns_church(church_id))
);
```

**Access Matrix**:
| Role | Own Church | Other Churches | Create | Approve |
|------|------------|----------------|--------|---------|
| admin | ✅ | ✅ | ✅ | ✅ |
| treasurer | ✅ | ❌ | ✅ | ❌ |
| pastor | ✅ | ❌ | ✅ | ❌ |
| secretary | ✅ | ❌ | ❌ | ❌ |
| member | ✅ | ❌ | ❌ | ❌ |

---

### 4. Fund Tables

#### Funds (Fund Categories)

**Table**: `funds`
**Migration**: 022

```sql
-- All users can view funds
CREATE POLICY "All users can view funds"
ON funds FOR SELECT
USING (true);

-- Only admin can manage funds
CREATE POLICY "Only admin can manage funds"
ON funds FOR INSERT, UPDATE, DELETE
USING (app_current_user_role() = 'admin')
WITH CHECK (app_current_user_role() = 'admin');
```

#### Fund Balances

**Table**: `fund_balances`
**Migration**: 022

```sql
-- Users can view balances for their church
CREATE POLICY "Church isolation on fund balances"
ON fund_balances FOR SELECT
USING (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id)
);

-- Only admin and treasurer can modify balances
CREATE POLICY "Only admin/treasurer can modify balances"
ON fund_balances FOR INSERT, UPDATE, DELETE
USING (app_current_user_role() IN ('admin', 'treasurer'))
WITH CHECK (app_current_user_role() IN ('admin', 'treasurer'));
```

#### Fund Transactions

**Table**: `fund_transactions`
**Migration**: 022, 026

```sql
-- Church isolation for transactions
CREATE POLICY "Church isolation on transactions"
ON fund_transactions FOR SELECT
USING (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id) OR
  (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
);

-- Transaction creators
CREATE POLICY "Transaction creators can insert"
ON fund_transactions FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director') AND
  (app_current_user_role() = 'admin' OR app_user_owns_church(church_id))
);
```

**Fund Director Access**:
- Fund directors can ONLY see transactions for their assigned funds
- Access controlled via `fund_director_assignments` table
- Short-circuit logic prevents RLS violations for other roles

---

### 5. Fund Events System

#### Fund Events

**Table**: `fund_events`
**Migration**: 026

```sql
-- View events for assigned funds
CREATE POLICY "View events for accessible funds"
ON fund_events FOR SELECT
USING (
  app_current_user_role() IN ('admin', 'treasurer') OR
  (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
);

-- Fund directors can create events for their funds
CREATE POLICY "Fund directors can create events"
ON fund_events FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'fund_director') AND
  (
    app_current_user_role() IN ('admin', 'treasurer') OR
    (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
  )
);

-- Only treasurer can approve events
CREATE POLICY "Only treasurer can approve events"
ON fund_events FOR UPDATE
USING (
  app_current_user_role() IN ('admin', 'treasurer') OR
  (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND status = 'draft')
)
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer') OR
  (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
);
```

**Event Workflow Security**:
1. Fund director creates event (status: `draft`)
2. Fund director can edit while `draft`
3. Fund director submits (status: `submitted`)
4. **ONLY treasurer** can approve (status: `approved`)
5. On approval: Transactions created automatically

#### Fund Event Line Items

**Table**: `fund_event_line_items`
**Migration**: 026

```sql
-- Line items follow parent event access
CREATE POLICY "Line items follow event access"
ON fund_event_line_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE fund_events.id = fund_event_line_items.event_id
    AND (
      app_current_user_role() IN ('admin', 'treasurer') OR
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_events.fund_id))
    )
  )
);
```

#### Fund Director Assignments

**Table**: `fund_director_assignments`
**Migration**: 026

```sql
-- Admins/treasurers can view all assignments
CREATE POLICY "Admins/treasurers view all assignments"
ON fund_director_assignments FOR SELECT
USING (app_current_user_role() IN ('admin', 'treasurer'));

-- Fund directors can view their own assignments
CREATE POLICY "Fund directors view own assignments"
ON fund_director_assignments FOR SELECT
USING (
  app_user_is_fund_director() AND
  profile_id = app_current_user_id()
);

-- Only admin can manage assignments
CREATE POLICY "Only admin can manage assignments"
ON fund_director_assignments FOR ALL
USING (app_current_user_role() = 'admin')
WITH CHECK (app_current_user_role() = 'admin');
```

---

### 6. Provider Registry

**Table**: `providers`
**Migration**: 027

```sql
-- Transaction creators can view providers
CREATE POLICY "Transaction creators can view providers"
ON providers FOR SELECT
USING (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Transaction creators can create providers
CREATE POLICY "Transaction creators can create providers"
ON providers FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Only admin/treasurer can update providers
CREATE POLICY "Only admin/treasurer can update providers"
ON providers FOR UPDATE
USING (app_current_user_role() IN ('admin', 'treasurer'))
WITH CHECK (app_current_user_role() IN ('admin', 'treasurer'));

-- Only admin/treasurer can delete providers
CREATE POLICY "Only admin/treasurer can delete providers"
ON providers FOR DELETE
USING (app_current_user_role() IN ('admin', 'treasurer'));
```

**Rationale**:
- All transaction creators need to view/create providers (autocomplete)
- RUC UNIQUE constraint prevents duplicates (database-level)
- Only admin/treasurer can modify to prevent accidental changes

---

## Audit & Configuration Tables

### User Activity

**Table**: `user_activity`
**Migration**: 009

```sql
-- Users can view their own activity
CREATE POLICY "Users can view own activity"
ON user_activity FOR SELECT
USING (user_id = app_current_user_id());

-- Admins can view all activity
CREATE POLICY "Admins can view all activity"
ON user_activity FOR SELECT
USING (app_current_user_role() = 'admin');

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON user_activity FOR INSERT
WITH CHECK (true);  -- Audit logging always allowed
```

### System Configuration

**Table**: `system_configuration`
**Migration**: 025

```sql
-- All users can read public configuration
CREATE POLICY "Users can read public config"
ON system_configuration FOR SELECT
USING (is_public = true);

-- Admins can read all configuration
CREATE POLICY "Admins can read all config"
ON system_configuration FOR SELECT
USING (app_current_user_role() = 'admin');

-- Only admin can modify configuration
CREATE POLICY "Only admin can modify config"
ON system_configuration FOR INSERT, UPDATE, DELETE
USING (app_current_user_role() = 'admin')
WITH CHECK (app_current_user_role() = 'admin');
```

---

## Role Permission Matrix

### Complete Access Control

| Table | admin | treasurer | pastor | fund_director | secretary | member |
|-------|-------|-----------|--------|---------------|-----------|--------|
| **profiles** | CRUD | R (own) | R (own) | R (own) | R (own) | R (own) |
| **churches** | CRUD | R (all) | R (all) | R (all) | R (all) | R (all) |
| **monthly_reports** | CRUD (all) | CRUD (own church) | CRU (own church) | R (own church) | R (own church) | R (own church) |
| **funds** | CRUD | R (all) | R (all) | R (assigned) | R (all) | R (all) |
| **fund_balances** | CRUD (all) | RU (own church) | R (own church) | R (assigned) | R (own church) | R (own church) |
| **fund_transactions** | CRUD (all) | CRUD (own church) | CRU (own church) | CR (assigned) | R (own church) | R (own church) |
| **fund_events** | CRUD (all) | CRUD (all) | R (own church) | CRUD (assigned) | R (own church) | R (own church) |
| **providers** | CRUD | RUD | RC | RC | RC | - |
| **user_activity** | R (all) | R (own) | R (own) | R (own) | R (own) | R (own) |
| **system_configuration** | CRUD | R (public) | R (public) | R (public) | R (public) | R (public) |

**Legend**:
- **C**: Create
- **R**: Read
- **U**: Update
- **D**: Delete
- **(own)**: Own church data only
- **(all)**: All churches
- **(assigned)**: Assigned funds only
- **(public)**: Public configuration only

---

## Security Best Practices

### 1. Always Use Context Wrapper

**✅ CORRECT**:
```typescript
import { executeWithContext } from '@/lib/db-admin';

const result = await executeWithContext(auth, async (client) => {
  return await client.query('SELECT * FROM monthly_reports WHERE church_id = $1', [churchId]);
});
```

**❌ WRONG**:
```typescript
import pool from '@/lib/pool';

// NO CONTEXT SET - RLS will deny access!
const result = await pool.query('SELECT * FROM monthly_reports');
```

### 2. Validate Context Before Queries

```typescript
// src/lib/db-admin.ts
export async function executeWithContext<T>(
  auth: AuthContext,
  queryFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    // Set session context
    await setDatabaseContext(client, auth);

    // Verify context was set
    const contextCheck = await getDatabaseContext(client);
    if (!contextCheck.user_id) {
      throw new Error('Failed to set database context');
    }

    // Execute query with RLS context
    return await queryFn(client);
  } finally {
    client.release();
  }
}
```

### 3. Test RLS Policies

```sql
-- Test as treasurer (church_id = 1)
SET LOCAL app.current_user_id = 'user-uuid';
SET LOCAL app.current_user_role = 'treasurer';
SET LOCAL app.current_user_church_id = 1;

-- Should return only church 1 reports
SELECT * FROM monthly_reports;

-- Should fail (trying to access church 2)
INSERT INTO monthly_reports (church_id, month, year) VALUES (2, 1, 2025);
```

### 4. Monitor RLS Violations

```sql
-- Check for queries without context
SELECT
  user_id,
  action,
  resource_type,
  details
FROM user_activity
WHERE details->>'rls_context_set' = 'false'
ORDER BY created_at DESC;
```

---

## Common RLS Patterns

### Pattern 1: Church Isolation

```sql
-- Standard church isolation policy
CREATE POLICY "church_isolation"
ON table_name FOR SELECT
USING (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id)
);
```

### Pattern 2: Role-Based Full Access

```sql
-- Admin gets full access, others restricted
CREATE POLICY "admin_full_others_restricted"
ON table_name FOR ALL
USING (
  app_current_user_role() = 'admin' OR
  [additional_conditions]
)
WITH CHECK (
  app_current_user_role() = 'admin' OR
  [additional_conditions]
);
```

### Pattern 3: Joined Table Access

```sql
-- Access based on related table
CREATE POLICY "related_table_access"
ON child_table FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM parent_table
    WHERE parent_table.id = child_table.parent_id
    AND app_user_owns_church(parent_table.church_id)
  )
);
```

### Pattern 4: Status-Based Access

```sql
-- Different access based on record status
CREATE POLICY "status_based_access"
ON table_name FOR UPDATE
USING (
  app_current_user_role() = 'admin' OR
  (app_current_user_role() = 'treasurer' AND status IN ('draft', 'submitted'))
)
WITH CHECK (
  app_current_user_role() = 'admin' OR
  app_current_user_role() = 'treasurer'
);
```

---

## Troubleshooting RLS Issues

### Issue 1: "Permission Denied" Error

**Symptom**: Query fails with "permission denied for table X"

**Cause**: RLS context not set before query

**Fix**:
```typescript
// Ensure executeWithContext() is used
const result = await executeWithContext(auth, async (client) => {
  return await client.query(...);
});
```

### Issue 2: Empty Result Set

**Symptom**: Query returns no rows when data exists

**Cause**: RLS policy blocking access

**Debug**:
```sql
-- Check current context
SELECT
  app_current_user_id() as user_id,
  app_current_user_role() as role,
  app_current_user_church_id() as church_id;

-- Check policy conditions
-- Review policy USING clause for the table
```

### Issue 3: Fund Director Access Denied

**Symptom**: Fund director cannot access assigned funds

**Cause**: Assignment not created or RLS short-circuit failing

**Fix**:
```sql
-- Verify assignment exists
SELECT * FROM fund_director_assignments
WHERE profile_id = '[user_uuid]';

-- Check fund access
SELECT app_user_has_fund_access([fund_id]);
```

---

## Migration History

| Migration | RLS Changes |
|-----------|-------------|
| 010 | Initial RLS: users, churches, reports, transactions |
| 022 | Comprehensive RLS: funds, members, donors |
| 023 | Role simplification: 8→6 roles, policy updates |
| 024 | UUID fixes: Consistent type usage |
| 026 | Fund director: Events, assignments, fund access |
| 027 | Providers: Transaction creator access |

---

## Resources

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Context Implementation](../../src/lib/db-context.ts)
- [SECURITY_AUDIT_2025-09-28.md](../SECURITY_AUDIT_2025-09-28.md)

---

**Last Updated**: October 2025
**Security Patch**: RLS fallback role fix (Oct 2025)
