# CORRECT PERMISSIONS MODEL - IPU PY Tesorería

**Date**: 2025-10-05
**Status**: ⚠️ PROPOSED - Requires migration 038

---

## Business Model Summary

IPU PY Tesorería is a **DUAL-SCOPE** system:

1. **NATIONAL LEVEL**: Centralized fund management for 9 national funds
2. **CHURCH LEVEL**: Local church financial reporting for 22 churches (38 total with historical records)

### Key Facts

- **38 churches exist**, but **ZERO have users** (except admin)
- **9 national funds**: Fondo Nacional, Misiones, Lazos de Amor, Misión Posible, Caballeros, APY, Instituto Bíblico, Damas, Niños
- **Events are NATIONAL**: Created by fund directors using national funds, approved by admin
- **Reports are CHURCH-LEVEL**: Monthly financial reports submitted by churches (or admin if no users)

---

## Role Hierarchy & Scope

| Role | Level | Scope | Primary Function |
|------|-------|-------|------------------|
| **admin** | NATIONAL | ALL | System administration, approves reports & events, fills forms for offline churches |
| **fund_director** | NATIONAL | Assigned funds | Creates/manages events for national funds |
| **pastor** | CHURCH | Own church | Church leadership, submits monthly reports |
| **treasurer** | CHURCH | Own church | Church financial management |
| **church_manager** | CHURCH | Own church | Church operations (view-only) |
| **secretary** | CHURCH | Own church | Administrative support |

---

## Correct Permissions by Role

### 1. ADMIN (National Administration)

**Scope**: ALL
**Hierarchy Level**: 6

**Functions**:
- Full system access (god mode)
- Approves monthly reports from all churches
- Approves fund events
- Manages users and roles
- Can fill forms FOR any church (critical for 38 churches with no users)
- Manages national funds
- System configuration

**Permissions**:
```
ALL PERMISSIONS (no restrictions)
```

**Database**: No RLS restrictions for admin

---

### 2. FUND_DIRECTOR (National Fund Manager)

**Scope**: Assigned funds (via `fund_director_assignments`)
**Hierarchy Level**: 5

**Functions**:
- Creates budgeted events for assigned national funds (e.g., Misiones, APY)
- Tracks fund balances for assigned funds
- Views transactions for assigned funds
- Submits events to admin for approval

**Permissions**:
| Permission | Scope | Description |
|------------|-------|-------------|
| `events.create` | assigned funds | Create event budgets |
| `events.edit` | assigned funds | Edit draft/pending events |
| `events.view` | assigned funds | View all events for assigned funds |
| `events.submit` | assigned funds | Submit events for approval |
| `funds.view` | assigned funds | View fund balances |
| `transactions.view` | assigned funds | View fund transactions |
| `dashboard.view` | assigned funds | View fund-specific dashboard |

**REMOVED** (from current incorrect model):
- ❌ `churches.view` - Fund directors manage funds, NOT churches
- ❌ `reports.view` - Don't need church reports
- ❌ `dashboard.view` (church) - Only fund dashboard

**RLS**: Can only see events/transactions for `fund_id IN (SELECT fund_id FROM fund_director_assignments WHERE profile_id = current_user_id())`

---

### 3. PASTOR (Church Leadership)

**Scope**: Own church ONLY
**Hierarchy Level**: 4

**Functions**:
- Manages church operations
- Creates monthly financial reports
- Manages church members
- Views church dashboard

**Permissions**:
| Permission | Scope | Description |
|------------|-------|-------------|
| `church.manage` | own | Manage church information |
| `reports.create` | own | Create monthly reports |
| `reports.edit` | own | Edit draft/submitted reports (before approval) |
| `reports.view` | own | View church reports |
| `members.manage` | own | Manage church members |
| `dashboard.view` | own | View church dashboard |

**CURRENT**: ✅ Correct!

**RLS**: Can only see data where `church_id = app.current_user_church_id`

---

### 4. TREASURER (Church Financial Officer)

**Scope**: Own church ONLY
**Hierarchy Level**: 3

**Functions**:
- Manages church finances
- Creates/edits monthly reports
- Views church fund balances
- Records church transactions

**Permissions**:
| Permission | Scope | Description |
|------------|-------|-------------|
| `reports.create` | own | Create monthly reports |
| `reports.edit` | own | Edit draft reports |
| `reports.view` | own | View church reports |
| `funds.view` | own | View church fund balances |
| `transactions.view` | own | View church transactions |
| `transactions.create` | own | Record church transactions |
| `dashboard.view` | own | View church dashboard |

**REMOVED** (from current incorrect model):
- ❌ `events.approve` - Events approved by ADMIN, not church treasurer!
- ❌ `events.create` - Events created by FUND_DIRECTOR, not church treasurer!
- ❌ `events.manage` - Events are NATIONAL-level

**RLS**: Can only see data where `church_id = app.current_user_church_id`

---

### 5. SECRETARY (Church Administrative Support)

**Scope**: Own church ONLY
**Hierarchy Level**: 1

**Functions**:
- Supports church administrative tasks
- Views reports (read-only)
- Manages members
- Views dashboard

**Permissions**:
| Permission | Scope | Description |
|------------|-------|-------------|
| `reports.view` | own | View church reports |
| `members.manage` | own | Manage church members |
| `dashboard.view` | own | View church dashboard |

**REMOVED** (from current incorrect model):
- ❌ `events.manage` - Secretaries are church-level, events are national!

**RLS**: Can only see data where `church_id = app.current_user_church_id`

---

### 6. CHURCH_MANAGER (Church Operations Manager)

**Scope**: Own church ONLY
**Hierarchy Level**: 2

**Functions**:
- View-only access to church data
- Can view reports, members, events (church-specific), dashboard

**Permissions**:
| Permission | Scope | Description |
|------------|-------|-------------|
| `church.view` | own | View church information |
| `reports.view` | own | View church reports |
| `members.view` | own | View church members |
| `events.view` | own | View church-specific events (if any) |
| `dashboard.view` | own | View church dashboard |

**CURRENT**: ✅ Correct!

**RLS**: Can only see data where `church_id = app.current_user_church_id`

---

## Permission Matrix (Complete)

| Permission | admin | fund_director | pastor | treasurer | church_manager | secretary |
|------------|-------|---------------|--------|-----------|----------------|-----------|
| **SYSTEM** |
| `system.manage` | ✅ ALL | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.manage` | ✅ ALL | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CHURCHES** |
| `churches.manage` | ✅ ALL | ❌ | ✅ own | ❌ | ❌ | ❌ |
| `churches.view` | ✅ ALL | ❌ | ✅ own | ❌ | ✅ own | ❌ |
| **REPORTS** |
| `reports.approve` | ✅ ALL | ❌ | ❌ | ❌ | ❌ | ❌ |
| `reports.create` | ✅ ALL | ❌ | ✅ own | ✅ own | ❌ | ❌ |
| `reports.edit` | ✅ ALL | ❌ | ✅ own | ✅ own | ❌ | ❌ |
| `reports.view` | ✅ ALL | ❌ | ✅ own | ✅ own | ✅ own | ✅ own |
| **EVENTS** (NATIONAL) |
| `events.approve` | ✅ ALL | ❌ | ❌ | ❌ | ❌ | ❌ |
| `events.create` | ✅ ALL | ✅ funds | ❌ | ❌ | ❌ | ❌ |
| `events.edit` | ✅ ALL | ✅ funds | ❌ | ❌ | ❌ | ❌ |
| `events.view` | ✅ ALL | ✅ funds | ❌ | ❌ | ✅ own | ❌ |
| `events.submit` | ✅ ALL | ✅ funds | ❌ | ❌ | ❌ | ❌ |
| **FUNDS** |
| `funds.manage` | ✅ ALL | ❌ | ❌ | ❌ | ❌ | ❌ |
| `funds.view` | ✅ ALL | ✅ funds | ❌ | ✅ own | ❌ | ❌ |
| **TRANSACTIONS** |
| `transactions.create` | ✅ ALL | ❌ | ❌ | ✅ own | ❌ | ❌ |
| `transactions.view` | ✅ ALL | ✅ funds | ❌ | ✅ own | ❌ | ❌ |
| **MEMBERS** |
| `members.manage` | ✅ ALL | ❌ | ✅ own | ❌ | ❌ | ✅ own |
| `members.view` | ✅ ALL | ❌ | ✅ own | ❌ | ✅ own | ✅ own |
| **DASHBOARD** |
| `dashboard.view` | ✅ ALL | ✅ funds | ✅ own | ✅ own | ✅ own | ✅ own |

**Legend**:
- ✅ ALL = Full access to all records
- ✅ funds = Access to assigned funds only
- ✅ own = Access to own church records only
- ❌ = No access

---

## Migration Requirements (038)

### Changes Needed:

1. **REMOVE from role_permissions**:
   - `treasurer` → `events.approve`, `events.create`, `events.manage`
   - `fund_director` → `churches.view`
   - `secretary` → `events.manage`

2. **ADD to role_permissions**:
   - `fund_director` → `events.submit` (can submit for approval)
   - `treasurer` → `transactions.create` (church-level)
   - `events.approve` → admin ONLY (already has via full access)

3. **UPDATE system_configuration**:
   - Update role descriptions to reflect national vs church scope

4. **VERIFY RLS policies**:
   - fund_director can only access assigned funds
   - Church roles can only access own church data

---

## Critical Business Rules

1. **Admin can fill forms for ANY church** - Essential since 38 churches have no users
2. **Events are NATIONAL** - Created by fund_director, approved by admin, use national funds
3. **Reports are CHURCH-LEVEL** - Submitted by pastor/treasurer, approved by admin
4. **Fund directors manage FUNDS, not churches** - They don't need church access
5. **Church treasurers are NOT national treasurers** - They can't approve national events

---

## References

- [BUSINESS_LOGIC.md](./database/BUSINESS_LOGIC.md) - Complete business logic documentation
- [Current (incorrect) ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md)
- Migration 037 - Fixed role inconsistencies (incomplete - didn't fix permissions)
- Migration 038 (pending) - Fix all permissions based on this model
