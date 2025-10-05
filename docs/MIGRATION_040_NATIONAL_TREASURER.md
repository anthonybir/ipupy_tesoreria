# Migration 040: National Treasurer Role Implementation

**Date**: 2025-10-05
**Status**: ✅ COMPLETE
**Migration File**: `migrations/040_add_national_treasurer_role.sql`

---

## 📋 Overview

Added **national_treasurer** role - an elected position that supervises ALL national funds and fund directors. This role sits between admin (level 7) and fund_director (level 5) in the hierarchy.

---

## 🎯 Business Requirements

### Problem
- Fund directors operate independently without centralized oversight
- No role exists to approve fund events (currently only admin/treasurer can)
- Need elected position to supervise all 9 national funds

### Solution
**National Treasurer** role with:
- Access to ALL 9 national funds (vs. fund_director who gets 1 fund)
- Power to approve/reject fund events from ANY fund_director
- Complete oversight of fund transactions and balances
- NO system/user/church management (admin retains that)

---

## 🔧 Technical Implementation

### Database Changes

#### 1. Updated `profiles_role_check` Constraint
```sql
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN (
  'admin',
  'national_treasurer',  -- NEW
  'fund_director',
  'pastor',
  'treasurer',
  'church_manager',
  'secretary'
));
```

#### 2. Updated `get_role_level()` Function
```sql
CREATE OR REPLACE FUNCTION get_role_level(user_role TEXT)
RETURNS INTEGER AS $$
  SELECT CASE user_role
    WHEN 'admin' THEN 7                    -- Was 6
    WHEN 'national_treasurer' THEN 6       -- NEW
    WHEN 'fund_director' THEN 5
    WHEN 'pastor' THEN 4
    WHEN 'treasurer' THEN 3
    WHEN 'church_manager' THEN 2
    WHEN 'secretary' THEN 1
    ELSE 0
  END;
$$ LANGUAGE SQL IMMUTABLE;
```

#### 3. Added 11 Permissions
```sql
INSERT INTO role_permissions (role, permission, scope, description) VALUES
  -- Event management
  ('national_treasurer', 'events.approve', 'all', '...'),
  ('national_treasurer', 'events.view', 'all', '...'),
  ('national_treasurer', 'events.edit', 'all', '...'),
  ('national_treasurer', 'events.create', 'all', '...'),

  -- Fund management
  ('national_treasurer', 'funds.view', 'all', '...'),
  ('national_treasurer', 'funds.manage', 'all', '...'),

  -- Transaction oversight
  ('national_treasurer', 'transactions.view', 'all', '...'),
  ('national_treasurer', 'transactions.create', 'all', '...'),

  -- Context
  ('national_treasurer', 'dashboard.view', 'all', '...'),
  ('national_treasurer', 'churches.view', 'all', '...'),
  ('national_treasurer', 'reports.view', 'all', '...');
```

#### 4. Updated `system_configuration`
- Added national_treasurer role definition to JSONB
- Updated fund_director description: "Gestiona eventos de fondos asignados (reporta a Tesorero Nacional)"

### Backend Changes

#### 1. Authorization ([authz.ts](../src/lib/authz.ts))
```typescript
const PROFILE_ROLE_ORDER = [
  'admin',
  'national_treasurer',  // NEW
  'fund_director',
  'pastor',
  'treasurer',
  'church_manager',
  'secretary'
] as const;

const ROLE_LABELS: Record<ProfileRole, string> = {
  admin: 'Administrador',
  national_treasurer: 'Tesorero Nacional',  // NEW
  fund_director: 'Director de Fondos',
  // ...
};
```

#### 2. Validation Schemas ([api-schemas.ts](../src/lib/validations/api-schemas.ts))
```typescript
export const updateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum([
    'admin',
    'national_treasurer',  // NEW
    'fund_director',
    'pastor',
    'treasurer',
    'church_manager',
    'secretary'
  ]),
  // ...
});
```

#### 3. API Route Guards
**[fund-events/[id]/route.ts](../src/app/api/fund-events/[id]/route.ts)**:
```typescript
// Approve action
if (!['admin', 'national_treasurer', 'treasurer'].includes(auth.role)) {
  return NextResponse.json(
    { error: 'Insufficient permissions to approve events' },
    { status: 403 }
  );
}

// Reject action
if (!['admin', 'national_treasurer', 'treasurer'].includes(auth.role)) {
  return NextResponse.json(
    { error: 'Insufficient permissions to reject events' },
    { status: 403 }
  );
}
```

**[admin/pastors/link-profile/route.ts](../src/app/api/admin/pastors/link-profile/route.ts)**:
```typescript
const validRoles = [
  'admin',
  'national_treasurer',  // NEW
  'fund_director',
  'pastor',
  'treasurer',
  'church_manager',
  'secretary'
];
```

### Frontend Changes

#### Admin Configuration ([admin/configuration/page.tsx](../src/app/admin/configuration/page.tsx))
```typescript
const defaultRolesConfig: RolesConfig = {
  roles: [
    {
      id: 'admin',
      name: 'Administrador',
      description: 'Acceso completo al sistema',
      permissions: ['all'],
      editable: false,
    },
    {
      id: 'national_treasurer',  // NEW
      name: 'Tesorero Nacional',
      description: 'Supervisa todos los fondos nacionales y aprueba eventos (posición electa)',
      permissions: [
        'events.approve', 'events.view', 'events.edit', 'events.create',
        'funds.view', 'funds.manage',
        'transactions.view', 'transactions.create',
        'dashboard.view', 'churches.view', 'reports.view'
      ],
      editable: false,
    },
    // ... other roles
  ]
};
```

---

## 📊 Verification Results

### ✅ Migration Execution Checks
```
✓ Constraint verification: national_treasurer present
✓ Hierarchy verification: national_treasurer = level 6
✓ Permissions verification: 11 permissions added
✓ Configuration verification: national_treasurer in system_configuration
```

### ✅ TypeScript Compilation
```bash
npx tsc --noEmit
# Exit code: 0 (no errors)
```

### ✅ ESLint
```bash
npm run lint
# ✔ No ESLint warnings or errors
```

---

## 📚 Documentation Updates

- ✅ [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) - Added comprehensive section for national_treasurer
- ✅ [USER_MANAGEMENT_GUIDE.md](USER_MANAGEMENT_GUIDE.md) - Added role description and example case
- ✅ [MIGRATION_040_NATIONAL_TREASURER.md](MIGRATION_040_NATIONAL_TREASURER.md) - This document

---

## 📈 Impact Summary

### Before Migration 040
- **Roles**: 6 (admin, fund_director, pastor, treasurer, church_manager, secretary)
- **Hierarchy**: admin(6), fund_director(5), pastor(4), treasurer(3), church_manager(2), secretary(1)
- **Event Approval**: Only admin and treasurer (church-level) could approve
- **Fund Oversight**: No centralized supervision of fund directors

### After Migration 040
- **Roles**: 7 (added national_treasurer)
- **Hierarchy**: admin(7), national_treasurer(6), fund_director(5), pastor(4), treasurer(3), church_manager(2), secretary(1)
- **Event Approval**: admin, national_treasurer, and treasurer can approve
- **Fund Oversight**: National treasurer supervises ALL fund directors and 9 national funds

---

## 🔄 Rollback Plan

If rollback is needed:

```sql
BEGIN;

-- Remove permissions
DELETE FROM role_permissions WHERE role = 'national_treasurer';

-- Remove from system_configuration
UPDATE system_configuration
SET value = jsonb_set(
  value,
  '{roles}',
  (SELECT jsonb_agg(elem)
   FROM jsonb_array_elements(value->'roles') elem
   WHERE elem->>'id' != 'national_treasurer')
)
WHERE section = 'roles';

-- Restore get_role_level() (admin back to 6)
CREATE OR REPLACE FUNCTION get_role_level(user_role TEXT)
RETURNS INTEGER AS $$
  SELECT CASE user_role
    WHEN 'admin' THEN 6
    WHEN 'fund_director' THEN 5
    WHEN 'pastor' THEN 4
    WHEN 'treasurer' THEN 3
    WHEN 'church_manager' THEN 2
    WHEN 'secretary' THEN 1
    ELSE 0
  END;
$$ LANGUAGE SQL IMMUTABLE;

-- Restore constraint
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'fund_director', 'pastor', 'treasurer', 'church_manager', 'secretary'));

COMMIT;
```

---

## ✅ Acceptance Criteria

All criteria met:

- [x] Database constraint updated to include national_treasurer
- [x] Hierarchy function updated (admin: 6→7, national_treasurer: 6)
- [x] 11 permissions added for national_treasurer
- [x] system_configuration updated with role definition
- [x] TypeScript types updated (authz.ts, api-schemas.ts)
- [x] API routes updated to allow national_treasurer approval
- [x] Frontend configuration includes national_treasurer
- [x] Documentation complete and accurate
- [x] Zero TypeScript errors
- [x] Zero ESLint warnings

---

**Migration Author**: Claude Code
**Reviewed By**: System Verification
**Production Status**: Ready for deployment
