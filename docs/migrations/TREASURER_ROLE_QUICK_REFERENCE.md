# Treasurer Role - Quick Reference Card

**Version**: 1.0 (Post-Migration 054)
**Last Updated**: 2025-10-06

---

## Role Overview

**Spanish Label**: Tesorero Nacional
**Role ID**: `treasurer`
**Level**: 6 (national scope)
**Type**: NATIONAL (not church-scoped)

**Position Description**: Nationally elected treasurer managing all fund operations across the organization.

---

## Quick Facts

| Property | Value |
|----------|-------|
| Total Permissions | 11 |
| Permission Scope | `all` (national) |
| Church ID Required | No (national role) |
| Fund Access | All funds |
| Report Access | All churches |
| Approval Rights | Yes (fund events) |

---

## Permission Matrix

| Category | Permissions | Scope |
|----------|-------------|-------|
| **Events** | approve, view, edit, create | all |
| **Funds** | view, manage | all |
| **Transactions** | view, create | all |
| **Dashboard** | view | all |
| **Churches** | view | all |
| **Reports** | view | all |

**Total**: 11 permissions

---

## Code Reference

### Type Definition

```typescript
// src/lib/authz.ts
type ProfileRole =
  | 'admin'
  | 'treasurer'           // National treasurer (merged from national_treasurer)
  | 'fund_director'
  | 'pastor'
  | 'church_manager'
  | 'secretary';
```

---

### Authorization Checks

```typescript
// Check if user is treasurer
if (auth.role === 'treasurer') {
  // User is national treasurer
}

// Check if user can approve events
import { canApproveFundEvent } from '@/lib/fund-event-authz';

if (canApproveFundEvent(auth)) {
  // Only admin and treasurer can approve
}

// Check fund access
import { hasFundAccess } from '@/lib/auth-supabase';

if (hasFundAccess(auth, fundId)) {
  // Treasurer has access to ALL funds
}
```

---

### Database Queries

```sql
-- Get all treasurer users
SELECT id, email, full_name
FROM profiles
WHERE role = 'treasurer';

-- Check treasurer permissions
SELECT permission, scope
FROM role_permissions
WHERE role = 'treasurer'
ORDER BY permission;

-- Verify role level
SELECT get_role_level('treasurer');
-- Expected: 6
```

---

## Common Tasks

### Assign Treasurer Role to User

**Via Admin UI**:
1. Navigate to Admin > Users
2. Find user by email
3. Click Edit
4. Select "Tesorero Nacional" from dropdown
5. Church ID: Leave blank (national role)
6. Save

**Via SQL** (emergency only):
```sql
UPDATE profiles
SET role = 'treasurer',
    church_id = NULL  -- National role has no church
WHERE email = 'user@ipupy.org.py';
```

---

### Verify Treasurer Access

**Fund Events**:
```sql
-- Set context
SET app.current_user_role = 'treasurer';
SET app.current_user_id = '<uuid>';

-- Test access
SELECT COUNT(*) FROM fund_events;
-- Expected: Returns all events (not filtered)
```

**Providers**:
```sql
SELECT COUNT(*) FROM providers;
-- Expected: Returns all providers (not filtered)
```

**Reports**:
```sql
SELECT COUNT(*) FROM monthly_reports;
-- Expected: Returns all reports from all churches
```

---

### Troubleshooting

#### Issue: Treasurer Cannot Access Fund Events

**Symptom**: 403 Forbidden or empty data

**Check 1: Verify Role**:
```sql
SELECT role FROM profiles WHERE email = '<treasurer-email>';
-- Expected: 'treasurer'
```

**Check 2: Verify RLS Context**:
```sql
-- In API logs, check for:
SET app.current_user_role = 'treasurer';
-- If missing, RLS context not set correctly
```

**Check 3: Verify RLS Policy**:
```sql
SELECT policyname, tablename
FROM pg_policies
WHERE tablename = 'fund_events'
  AND definition LIKE '%treasurer%';
-- Expected: Policy includes 'treasurer' role
```

**Fix**: If role is correct but access denied, check RLS policies in migration 053.

---

#### Issue: Treasurer Assigned to Specific Church

**Symptom**: Treasurer only sees data from one church

**Check**:
```sql
SELECT church_id FROM profiles WHERE email = '<treasurer-email>';
-- Expected: NULL (national role has no church)
```

**Fix**:
```sql
UPDATE profiles
SET church_id = NULL
WHERE email = '<treasurer-email>';
```

**Explanation**: National roles should NOT have church_id set. Only church-scoped roles (pastor, church_manager, secretary) need church_id.

---

#### Issue: "Role Not Found" Error

**Symptom**: Application rejects login with "invalid role"

**Check**:
```sql
SELECT get_role_level(role) as level, role
FROM profiles
WHERE email = '<treasurer-email>';
-- Expected: level=6, role='treasurer'
```

**Common Mistake**: Role still set to `national_treasurer` (obsolete)

**Fix**:
```sql
UPDATE profiles
SET role = 'treasurer'
WHERE role = 'national_treasurer';
```

---

## API Usage Examples

### Get Treasurer Profile

```typescript
// GET /api/profile
const response = await fetch('/api/profile');
const profile = await response.json();

if (profile.role === 'treasurer') {
  console.log('User is national treasurer');
  console.log('Permissions:', profile.permissions);
}
```

---

### Create Fund Event (Treasurer Only)

```typescript
// POST /api/fund-events
const event = {
  fund_id: 1,
  title: 'Convención Nacional 2025',
  budget_items: [...],
  // ...
};

const response = await fetch('/api/fund-events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(event)
});

// Treasurer has permission to create for all funds
```

---

### Approve Fund Event (Treasurer + Admin Only)

```typescript
// PATCH /api/fund-events/:id
const response = await fetch(`/api/fund-events/${eventId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'approved' })
});

// Only treasurer and admin can approve
// Fund directors can only submit (not approve)
```

---

## Migration History

### Pre-Migration (Before 051)

**Problem**: Two treasurer roles with unclear scopes
- `treasurer` - Church-scoped (INCORRECT)
- `national_treasurer` - National-scoped (CORRECT)

**Issue**: Confusion about which role to assign

---

### Post-Migration (After 054)

**Solution**: Single treasurer role with national scope
- `treasurer` - National-scoped (MERGED)
- Pastors handle church finances

**Benefit**: Clear organizational alignment

---

### Timeline

| Migration | Date | Purpose |
|-----------|------|---------|
| 051 | 2025-10-06 | Restore treasurer national access |
| 052 | 2025-10-06 | Fix array syntax error |
| 053 | 2025-10-06 | Merge national_treasurer → treasurer |
| 054 | 2025-10-06 | Migrate existing data |

---

## Related Roles

### Admin (Level 7)

**Relationship**: Admin > Treasurer
- Admin can assign treasurer role
- Admin has all treasurer permissions + more

---

### Fund Director (Level 5)

**Relationship**: Treasurer > Fund Director
- Fund director manages specific funds (assigned)
- Treasurer manages ALL funds (unrestricted)
- Fund director CANNOT approve (only submit)
- Treasurer CAN approve

---

### Pastor (Level 4)

**Relationship**: Treasurer (national) ≠ Pastor (church)
- Treasurer handles NATIONAL funds
- Pastor handles LOCAL church finances
- No overlap in responsibilities

---

## Database Schema

### Profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  church_id INTEGER REFERENCES churches,
  -- ...
  CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'treasurer', 'fund_director', 'pastor', 'church_manager', 'secretary'))
);
```

**Note**: `national_treasurer` is NOT in constraint (obsolete role)

---

### Role Permissions Table

```sql
CREATE TABLE role_permissions (
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  scope TEXT NOT NULL,  -- 'all' for treasurer
  description TEXT,
  PRIMARY KEY (role, permission)
);
```

**Treasurer Permissions**:
```sql
SELECT * FROM role_permissions WHERE role = 'treasurer';
```

| role | permission | scope | description |
|------|------------|-------|-------------|
| treasurer | events.approve | all | Aprobar eventos de fondos |
| treasurer | events.view | all | Ver todos los eventos |
| ... | ... | ... | ... |

---

## RLS Policies

### Fund Events Table

```sql
-- Policy: "Fund events: national roles full access"
CREATE POLICY "Fund events: national roles full access"
  ON fund_events FOR ALL
  USING (app_current_user_role() IN ('admin', 'treasurer'));
```

**Impact**: Treasurer sees ALL fund events (no filtering)

---

### Monthly Reports Table

```sql
-- Policy: "National roles view all monthly reports"
CREATE POLICY "National roles view all monthly reports"
  ON monthly_reports FOR SELECT
  USING (app_current_user_role() IN ('admin', 'treasurer'));
```

**Impact**: Treasurer sees ALL reports from ALL churches

---

### Providers Table

```sql
-- Policy: "Providers: national roles full access"
CREATE POLICY "Providers: national roles full access"
  ON providers FOR ALL
  USING (app_current_user_role() IN ('admin', 'treasurer'));
```

**Impact**: Treasurer can manage ALL providers across ALL funds

---

## Security Notes

### What Treasurer CAN Do

✅ View all fund events (all funds)
✅ Create fund events
✅ Approve fund events (workflow: fund_director submits → treasurer approves)
✅ View all providers
✅ Create/edit providers
✅ View all monthly reports (all churches)
✅ View all transactions
✅ Create transactions
✅ Access national dashboard
✅ View all church data

---

### What Treasurer CANNOT Do

❌ Create new churches (admin only)
❌ Assign roles (admin only)
❌ Delete other users (admin only)
❌ Modify system configuration (admin only)
❌ Access admin panel (admin only)

---

### RLS Enforcement

**Critical**: All treasurer operations MUST go through RLS policies.

**Safe Pattern**:
```typescript
// src/lib/db-admin.ts
import { executeWithContext } from '@/lib/db-admin';

await executeWithContext(auth, async (client) => {
  // All queries here enforce RLS
  const result = await client.query('SELECT * FROM fund_events');
  return result.rows;
});
```

**Unsafe Pattern** (NEVER USE):
```typescript
// ❌ BYPASSES RLS - SECURITY VIOLATION
import { pool } from '@/lib/db';

const result = await pool.query('SELECT * FROM fund_events');
// Returns ALL data regardless of role
```

---

## Testing

### Unit Test Example

```typescript
import { canApproveFundEvent } from '@/lib/fund-event-authz';

describe('Treasurer Authorization', () => {
  it('should allow treasurer to approve fund events', () => {
    const auth = {
      userId: 'test-uuid',
      email: 'treasurer@ipupy.org.py',
      role: 'treasurer' as const
    };

    expect(canApproveFundEvent(auth)).toBe(true);
  });

  it('should deny fund director from approving', () => {
    const auth = {
      userId: 'test-uuid',
      email: 'director@ipupy.org.py',
      role: 'fund_director' as const
    };

    expect(canApproveFundEvent(auth)).toBe(false);
  });
});
```

---

### Integration Test Example

```typescript
describe('Treasurer Fund Access', () => {
  it('should grant treasurer access to all funds', async () => {
    const auth = {
      userId: 'treasurer-uuid',
      role: 'treasurer',
      email: 'treasurer@ipupy.org.py'
    };

    const funds = await executeWithContext(auth, async (client) => {
      const result = await client.query('SELECT * FROM funds');
      return result.rows;
    });

    expect(funds.length).toBeGreaterThan(0);
    // Treasurer sees ALL funds (no filtering)
  });
});
```

---

## Glossary

| Term | Spanish | Definition |
|------|---------|------------|
| Treasurer | Tesorero Nacional | Nationally elected position managing all fund operations |
| Fund Director | Director de Fondos | Manages specific assigned funds (not national) |
| Pastor | Pastor | Local church leader handling church finances |
| Fund Event | Evento de Fondo | Budgeted event with line items (e.g., national convention) |
| RLS | RLS | Row-Level Security (database access control) |
| Scope | Alcance | Access level (all=national, own=church-only) |

---

## Support

**Technical Issues**: `administracion@ipupy.org.py`

**Role Assignment**: National Administrator (via admin panel)

**Documentation**:
- `/docs/migrations/TREASURER_ROLE_CONSOLIDATION.md` - Full technical guide
- `/docs/ROLES_AND_PERMISSIONS.md` - Complete role reference
- `/docs/USER_MANAGEMENT_GUIDE.md` - Admin procedures

---

**Quick Reference Version**: 1.0
**Compatible With**: Migrations 051-054+
**Last Reviewed**: 2025-10-06
