# Role System Evolution - IPU PY Tesorería

**Last Updated**: 2025-10-05
**Current Version**: 4.0 (7 roles)

---

## 📋 Executive Summary

The IPU PY Tesorería role system has evolved through **4 major migrations** from an initial 8-role system to the current **7-role hierarchical system**. This document tracks the complete evolution and provides a reference for understanding the current state.

---

## 🎯 Current Role System (v4.0)

### Active Roles (7 Total)

| Role | Level | Scope | Added/Modified |
|------|-------|-------|----------------|
| `admin` | 7 | National - All system | Migration 023 (consolidated from super_admin) |
| `national_treasurer` | 6 | National - All funds | **Migration 040** (NEW) |
| `fund_director` | 5 | National - Assigned funds | **Migration 026** (NEW) |
| `pastor` | 4 | Church - Own church only | Migration 023 (renamed from church_admin) |
| `treasurer` | 3 | Church - Own church only | Original (unchanged) |
| `church_manager` | 2 | Church - Own church only | Original (unchanged) |
| `secretary` | 1 | Church - Own church only | Original (unchanged) |

### Source of Truth

**TypeScript**: `src/lib/authz.ts`
```typescript
const PROFILE_ROLE_ORDER = [
  'admin',
  'national_treasurer',
  'fund_director',
  'pastor',
  'treasurer',
  'church_manager',
  'secretary'
] as const;

export type ProfileRole = typeof PROFILE_ROLE_ORDER[number];
```

**Database**: `profiles_role_check` constraint
```sql
CHECK (role IN (
  'admin',
  'national_treasurer',
  'fund_director',
  'pastor',
  'treasurer',
  'church_manager',
  'secretary'
))
```

---

## 📜 Migration History

### Version 1.0 - Initial System (Pre-Migration 023)

**8 Roles** (Original implementation):

1. `super_admin` - System owner
2. `admin` - Platform administrators
3. `district_supervisor` - Regional oversight
4. `church_admin` - Church leadership
5. `treasurer` - Financial management
6. `secretary` - Administrative support
7. `member` - Church members
8. `viewer` - Read-only access

**Issues**:
- Too many roles with overlapping responsibilities
- Confusing hierarchy (super_admin vs admin)
- Unclear distinction between member and viewer
- district_supervisor role rarely used

---

### Version 2.0 - Migration 023 (Role Simplification)

**Date**: 2024-12-XX
**Migration**: `migrations/023_simplify_roles.sql`
**Result**: **6 Roles**

**Changes**:
- ✅ `super_admin` → **Consolidated into `admin`**
- ✅ `church_admin` → **Renamed to `pastor`**
- ❌ `viewer` → **Removed** (consolidated into member)
- ✅ Kept: `admin`, `district_supervisor`, `pastor`, `treasurer`, `secretary`, `member`

**Rationale**:
- Simplified admin hierarchy (one admin role instead of two)
- Clearer church leadership role name (pastor vs church_admin)
- Reduced redundancy (viewer merged into member)

**Database Changes**:
```sql
-- Updated constraint to 6 roles
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'district_supervisor', 'pastor', 'treasurer', 'secretary', 'member'));

-- Migrated existing users
UPDATE profiles SET role = 'admin' WHERE role = 'super_admin';
UPDATE profiles SET role = 'pastor' WHERE role = 'church_admin';
UPDATE profiles SET role = 'member' WHERE role = 'viewer';
```

---

### Version 3.0 - Migration 026 (Fund Director)

**Date**: 2024-09-27
**Migration**: `migrations/026_fund_director_events.sql`
**Result**: **7 Roles** (6 + fund_director)

**Changes**:
- ✅ **Added `fund_director` role** for fund-specific management
- ✅ Created `fund_director_assignments` table
- ✅ Added fund events system with approval workflow

**Rationale**:
- Need for specialized fund management role
- Separation of concerns (fund management vs church management)
- Support for national fund oversight

**Database Changes**:
```sql
-- Added fund_director to constraint (kept church_manager, removed member/district_supervisor later)
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'treasurer', 'pastor', 'church_manager', 'secretary', 'fund_director'));

-- Created fund director assignments
CREATE TABLE fund_director_assignments (
  id SERIAL PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  fund_id INTEGER REFERENCES funds(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id)
);
```

**Note**: This migration also removed `district_supervisor` and `member` from the constraint, though migration 037 formalized this cleanup.

---

### Version 3.5 - Migration 037 (Role Cleanup)

**Date**: 2024-10-XX
**Migration**: `migrations/037_fix_role_inconsistencies.sql`
**Result**: **6 Roles** (formalized)

**Changes**:
- ❌ **Removed `district_supervisor`** (obsolete, never used)
- ❌ **Removed `member`** (consolidated into secretary)
- ✅ Fixed `church_manager` permissions
- ✅ Added `get_role_level()` database function
- ✅ Cleaned up obsolete role references

**Rationale**:
- district_supervisor role was never actually used in production
- member role redundant with secretary
- Formalize the actual 6-role system in use

**Database Changes**:
```sql
-- Formalized 6-role constraint
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'fund_director', 'pastor', 'treasurer', 'church_manager', 'secretary'));

-- Added role level function
CREATE OR REPLACE FUNCTION get_role_level(role_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'admin' THEN 6
    WHEN 'fund_director' THEN 5
    WHEN 'pastor' THEN 4
    WHEN 'treasurer' THEN 3
    WHEN 'church_manager' THEN 2
    WHEN 'secretary' THEN 1
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

### Version 4.0 - Migration 040 (National Treasurer)

**Date**: 2024-10-05
**Migration**: `migrations/040_add_national_treasurer_role.sql`
**Result**: **7 Roles** (current)

**Changes**:
- ✅ **Added `national_treasurer` role** (level 6)
- ✅ Updated `get_role_level()` to include national_treasurer
- ✅ Added national_treasurer permissions (11 total)
- ✅ Updated role hierarchy (admin=7, national_treasurer=6)

**Rationale**:
- Need for elected national treasurer position
- Oversight of ALL national funds (vs fund_director who manages specific funds)
- Separation of financial oversight from system administration

**Database Changes**:
```sql
-- Added national_treasurer to constraint
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'national_treasurer', 'fund_director', 'pastor', 'treasurer', 'church_manager', 'secretary'));

-- Updated role level function
CREATE OR REPLACE FUNCTION get_role_level(role_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'admin' THEN 7
    WHEN 'national_treasurer' THEN 6
    WHEN 'fund_director' THEN 5
    WHEN 'pastor' THEN 4
    WHEN 'treasurer' THEN 3
    WHEN 'church_manager' THEN 2
    WHEN 'secretary' THEN 1
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 🗑️ Obsolete Roles Reference

### Removed Roles

| Role | Removed In | Reason | Migrated To |
|------|-----------|--------|-------------|
| `super_admin` | Migration 023 | Redundant with admin | `admin` |
| `church_admin` | Migration 023 | Unclear naming | `pastor` |
| `viewer` | Migration 023 | Redundant with member | `member` → `secretary` |
| `district_supervisor` | Migration 037 | Never used in production | N/A (removed) |
| `member` | Migration 037 | Redundant with secretary | `secretary` |

### Migration Path for Obsolete Roles

If you encounter references to obsolete roles in old code or documentation:

```typescript
// OLD (pre-migration 023)
if (role === 'super_admin') { ... }
if (role === 'church_admin') { ... }

// NEW (current)
if (role === 'admin') { ... }
if (role === 'pastor') { ... }

// REMOVED (migration 037)
if (role === 'district_supervisor') { ... }  // ❌ Remove this check
if (role === 'member') { ... }               // ❌ Remove this check
```

---

## 📊 Role Comparison Matrix

| Feature | v1.0 (8 roles) | v2.0 (Mig 023) | v3.0 (Mig 026) | v3.5 (Mig 037) | v4.0 (Mig 040) |
|---------|----------------|----------------|----------------|----------------|----------------|
| **Total Roles** | 8 | 6 | 7 | 6 | **7** |
| **Admin Roles** | 2 (super_admin, admin) | 1 (admin) | 1 (admin) | 1 (admin) | **2 (admin, national_treasurer)** |
| **Fund Roles** | 0 | 0 | 1 (fund_director) | 1 (fund_director) | **2 (national_treasurer, fund_director)** |
| **Church Roles** | 4 | 4 | 4 | 4 | **4** |
| **Read-Only Roles** | 2 (member, viewer) | 1 (member) | 1 (member) | 0 | **0** |
| **Hierarchy Levels** | No | No | No | Yes (1-6) | **Yes (1-7)** |

---

## 🔍 Verification Checklist

To verify the current role system is correctly implemented:

### Database
- [ ] Check `profiles_role_check` constraint has 7 roles
- [ ] Verify `get_role_level()` function returns levels 1-7
- [ ] Confirm `role_permissions` table has entries for all 7 roles
- [ ] Check no profiles have obsolete roles

### TypeScript
- [ ] Verify `src/lib/authz.ts` has `ProfileRole` type with 7 roles
- [ ] Check `PROFILE_ROLE_ORDER` array matches database constraint
- [ ] Confirm no code references obsolete roles

### Documentation
- [ ] `docs/ROLES_AND_PERMISSIONS.md` lists 7 roles
- [ ] `docs/API_REFERENCE.md` updated
- [ ] `docs/SECURITY.md` updated
- [ ] Archive docs have deprecation notices

---

## 📚 Related Documentation

- **Current Roles**: `docs/ROLES_AND_PERMISSIONS.md`
- **User Management**: `docs/USER_MANAGEMENT_GUIDE.md`
- **Security**: `docs/SECURITY.md`
- **API Reference**: `docs/API_REFERENCE.md`
- **Database Schema**: `docs/database/SCHEMA_REFERENCE.md`
- **Migration History**: `docs/MIGRATION_HISTORY.md`

---

## 🤝 Support

For questions about the role system:
- **Email**: administracion@ipupy.org.py
- **Documentation**: This file and related docs above
- **Code**: `src/lib/authz.ts` (source of truth)

