# Role System Reference - IPU PY Tesorería

**Status:** ✅ Authoritative (Current as of January 2025)
**Last Updated:** October 8, 2025
**Migrations:** 051-054 (Treasurer consolidation completed)

---

## Executive Summary

IPU PY Tesorería uses a **6-role hierarchical permission system** with two organizational scopes:

- **NATIONAL scope**: System-wide operations (admin, treasurer, fund_director)
- **CHURCH scope**: Church-specific operations (pastor, church_manager, secretary)

### Critical Facts

✅ **6 roles total** (NOT 7 - see Historical Context below)
✅ **treasurer role is NATIONAL scope** (approves reports, manages all funds)
✅ **pastor role handles LOCAL finances** (creates reports, cannot approve)
✅ **Roles defined in** [`convex/schema.ts:282`](../convex/schema.ts)
✅ **Hierarchy defined in** [`convex/lib/auth.ts`](../convex/lib/auth.ts)

---

## Role Hierarchy

| Level | Role | Scope | Primary Responsibilities |
|-------|------|-------|-------------------------|
| **6** | admin | NATIONAL | Platform administration, user management, system configuration |
| **5** | fund_director | ASSIGNED FUNDS | Fund-specific management and event approval |
| **4** | pastor | CHURCH | Church leadership, local financial oversight, report creation |
| **3** | treasurer | NATIONAL | **Report approval**, fund management, national finance oversight |
| **2** | church_manager | CHURCH | View-only access to church data |
| **1** | secretary | CHURCH | Administrative support, data entry |

---

## Role Definitions

### 1. admin (Level 6 - NATIONAL)

**Scope:** System-wide access

**Permissions:**
- ✅ All CRUD operations on all resources
- ✅ User management (create, update, delete, role assignment)
- ✅ System configuration (all settings)
- ✅ Report approval/rejection
- ✅ Fund management (all funds)
- ✅ Church management (create, update, deactivate)
- ✅ Provider registry management
- ✅ Financial reconciliation
- ✅ Audit trail access

**Code Reference:**
```typescript
// convex/lib/permissions.ts
export async function requireAdmin(ctx: AuthContext) {
  if (ctx.role !== "admin") {
    throw new Error("Requiere rol de administrador");
  }
}
```

**Typical User:** `administracion@ipupy.org.py`

---

### 2. fund_director (Level 5 - ASSIGNED FUNDS)

**Scope:** Specific fund(s) assigned via `fund_id` field

**Permissions:**
- ✅ View assigned fund details
- ✅ Approve fund event budgets
- ✅ View fund transactions
- ✅ Manage event budgets within assigned funds
- ❌ Cross-fund operations
- ❌ Report approval (national treasurer only)
- ❌ User management

**Code Reference:**
```typescript
// convex/lib/permissions.ts
export async function requireFundDirector(ctx: AuthContext, fundId: Id<"funds">) {
  if (ctx.role === "admin") return; // Admin bypass
  if (ctx.role !== "fund_director") {
    throw new Error("Requiere rol de director de fondo");
  }
  if (ctx.fundId !== fundId) {
    throw new Error("No tiene acceso a este fondo");
  }
}
```

**Assignment:** Set via `profiles.fund_id` field

---

### 3. pastor (Level 4 - CHURCH)

**Scope:** Assigned church via `church_id` field

**Permissions:**
- ✅ View church details
- ✅ **Create monthly reports** (diezmos, ofrendas, gastos)
- ✅ Update church information (within limits)
- ✅ View church financial history
- ✅ Manage church providers
- ✅ View church fund balances
- ❌ **Approve reports** (national treasurer only)
- ❌ Cross-church operations
- ❌ User management

**Code Reference:**
```typescript
// convex/lib/permissions.ts
export async function requireChurchModify(ctx: AuthContext, churchId: Id<"churches">) {
  if (ctx.role === "admin") return; // Admin bypass
  if (!["pastor", "treasurer"].includes(ctx.role)) {
    throw new Error("No tiene permisos para modificar iglesias");
  }
  if (ctx.role === "pastor" && ctx.churchId !== churchId) {
    throw new Error("No tiene acceso a esta iglesia");
  }
}
```

**Assignment:** Set via `profiles.church_id` field

**Critical Note:** Pastor creates reports but **CANNOT** approve them. Approval is a **NATIONAL** operation requiring treasurer or admin role.

---

### 4. treasurer (Level 3 - NATIONAL)

**Scope:** System-wide financial operations

**Permissions:**
- ✅ **Approve/reject monthly reports** (all churches)
- ✅ View all church financial data
- ✅ Manage all funds
- ✅ Financial reconciliation across all churches
- ✅ Transaction ledger access (all churches)
- ✅ Export financial data
- ❌ User management
- ❌ System configuration

**Code Reference:**
```typescript
// convex/lib/permissions.ts
export async function requireReportApproval(ctx: AuthContext) {
  if (!["admin", "treasurer"].includes(ctx.role)) {
    throw new Error("Requiere rol de tesorero o administrador");
  }
}
```

**Historical Context:**
The `treasurer` role was consolidated from `national_treasurer` in migrations 051-054 (October 2025). It is **NOT** a church-level role. Local church finances are managed by the `pastor` role.

**Assignment:** No `church_id` required (national scope)

---

### 5. church_manager (Level 2 - CHURCH)

**Scope:** Assigned church via `church_id` field

**Permissions:**
- ✅ View church details (read-only)
- ✅ View church reports (read-only)
- ✅ View church financial data (read-only)
- ❌ Create/modify reports
- ❌ Financial operations

**Code Reference:**
```typescript
// Permission checks allow church_manager view access but block mutations
if (ctx.role === "church_manager") {
  throw new Error("church_manager es solo lectura");
}
```

**Assignment:** Set via `profiles.church_id` field

---

### 6. secretary (Level 1 - CHURCH)

**Scope:** Assigned church via `church_id` field

**Permissions:**
- ✅ View church contact information
- ✅ Administrative data entry support
- ✅ View church calendar/events
- ❌ Financial data access
- ❌ Report creation/modification

**Code Reference:**
```typescript
// Lowest permission level - minimal access
export const ROLE_LEVELS = {
  secretary: 1,
  // ...
} as const;
```

**Assignment:** Set via `profiles.church_id` field

---

## Permission Enforcement

### Convex Function Pattern

All Convex mutations/queries **MUST** verify authentication and authorization:

```typescript
// convex/reports.ts example
export const approve = mutation({
  handler: async (ctx, { id }) => {
    // 1. Get authenticated context
    const authCtx = await getAuthContext(ctx);

    // 2. Verify permission
    requireReportApproval(authCtx);

    // 3. Perform operation
    await ctx.db.patch(id, { estado: "aprobado" });
  },
});
```

### API Route Pattern

REST API routes delegate authorization to Convex functions via authenticated client:

```typescript
// src/app/api/reports/route.ts example
export async function PUT(request: NextRequest) {
  try {
    // NextAuth verifies session
    const client = await getAuthenticatedConvexClient();

    // Convex function handles authorization
    const report = await client.mutation(api.reports.approve, { id });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    // Error includes authorization failures
    return handleApiError(error, request.headers.get('origin'));
  }
}
```

---

## Organizational Scope Model

### NATIONAL Scope Roles

Roles that operate across **all churches** and **all funds**:

| Role | Operations |
|------|-----------|
| admin | All system operations |
| treasurer | Report approval, fund management, reconciliation |
| fund_director | Event approval within assigned fund(s) |

**Key Characteristic:** No `church_id` required (except fund_director with `fund_id`)

### CHURCH Scope Roles

Roles that operate within a **single church**:

| Role | Operations |
|------|-----------|
| pastor | Report creation, local finance management |
| church_manager | Read-only church data |
| secretary | Administrative support |

**Key Characteristic:** Requires `church_id` assignment in profile

---

## Permission Matrix

| Operation | admin | fund_director | pastor | treasurer | church_manager | secretary |
|-----------|-------|---------------|--------|-----------|---------------|-----------|
| Create church | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Update church | ✅ | ❌ | ✅* | ✅ | ❌ | ❌ |
| View church | ✅ | ❌ | ✅* | ✅ | ✅* | ❌ |
| Create report | ✅ | ❌ | ✅* | ✅ | ❌ | ❌ |
| Approve report | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Reject report | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| View all reports | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| View church reports | ✅ | ❌ | ✅* | ✅ | ✅* | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve fund event | ✅ | ✅** | ❌ | ✅ | ❌ | ❌ |
| View fund transactions | ✅ | ✅** | ❌ | ✅ | ❌ | ❌ |
| Financial reconciliation | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| System configuration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

\* **Church-scoped:** Only for assigned church
\*\* **Fund-scoped:** Only for assigned fund(s)

---

## Historical Context

### Migration 051-054: Treasurer Consolidation

**Date:** October 2025
**Impact:** Consolidated `national_treasurer` role into `treasurer` with NATIONAL scope

**Before (7 roles):**
- `national_treasurer` (national scope)
- `treasurer` (church scope)
- Others...

**After (6 roles):**
- `treasurer` (NATIONAL scope - approves reports, manages all funds)
- `pastor` (church scope - creates reports, manages local finances)
- Others...

**Key Changes:**
1. **`national_treasurer` eliminated** - operations moved to `treasurer`
2. **`treasurer` is now NATIONAL** - no longer church-scoped
3. **`pastor` handles local finances** - report creation, church operations

**Migration Files:**
- [051_consolidate_roles.sql](../migrations/051_consolidate_roles.sql)
- [052_update_permissions.sql](../migrations/052_update_permissions.sql)
- [053_treasurer_final.sql](../migrations/053_treasurer_final.sql)
- [054_verify_consolidation.sql](../migrations/054_verify_consolidation.sql)

**Documentation Updated:**
- ⚠️ **Outdated:** [USER_MANAGEMENT_GUIDE.md](./archive/misc/USER_MANAGEMENT_GUIDE.md) still references 7 roles
- ✅ **Current:** [ROLES_AND_PERMISSIONS.md](./archive/misc/ROLES_AND_PERMISSIONS.md) reflects 6-role model

---

## Code References

### Schema Definition

[`convex/schema.ts:282-310`](../convex/schema.ts)

```typescript
profiles: defineTable({
  user_id: v.string(),
  email: v.string(),
  role: v.union(
    v.literal("admin"),
    v.literal("treasurer"),
    v.literal("fund_director"),
    v.literal("pastor"),
    v.literal("church_manager"),
    v.literal("secretary")
  ),
  church_id: v.optional(v.id("churches")),
  fund_id: v.optional(v.id("funds")),
  full_name: v.optional(v.string()),
  active: v.boolean(),
  created_at: v.number(),
  updated_at: v.number(),
})
.index("by_email", ["email"])
.index("by_church", ["church_id"])
.index("by_fund", ["fund_id"]),
```

### Role Hierarchy

[`convex/lib/auth.ts`](../convex/lib/auth.ts)

```typescript
export const ROLE_LEVELS = {
  secretary: 1,
  church_manager: 2,
  treasurer: 3,
  pastor: 4,
  fund_director: 5,
  admin: 6,
} as const;

export type UserRole = keyof typeof ROLE_LEVELS;
```

### Permission Helpers

[`convex/lib/permissions.ts`](../convex/lib/permissions.ts)

```typescript
export async function requireAdmin(ctx: AuthContext);
export async function requireChurchModify(ctx: AuthContext, churchId: Id<"churches">);
export async function requireReportApproval(ctx: AuthContext);
export async function requireFundDirector(ctx: AuthContext, fundId: Id<"funds">);
```

---

## Related Documentation

### Current (Authoritative)
- ✅ [CONVEX_SCHEMA.md](./CONVEX_SCHEMA.md) - Database schema with role fields
- ✅ [SECURITY.md](./SECURITY.md) - Security best practices
- ✅ [CLAUDE.md](../CLAUDE.md) - Developer guide with auth patterns

### Historical (Reference Only)
- 📚 [ROLES_AND_PERMISSIONS.md](./archive/misc/ROLES_AND_PERMISSIONS.md) - Post-migration 053 notes
- 📚 [ROLE_SYSTEM_EVOLUTION.md](./archive/misc/ROLE_SYSTEM_EVOLUTION.md) - Migration history
- ⚠️ [USER_MANAGEMENT_GUIDE.md](./archive/misc/USER_MANAGEMENT_GUIDE.md) - **OUTDATED** (references 7 roles)

---

## Verification Checklist

Use this checklist to verify role system integrity:

### Schema Verification
- [ ] 6 roles defined in `convex/schema.ts` profiles table
- [ ] `ROLE_LEVELS` constant matches 6 roles in `convex/lib/auth.ts`
- [ ] No references to `national_treasurer` in active code

### Permission Enforcement
- [ ] All Convex mutations call `getAuthContext()` first
- [ ] Report approval restricted to `admin` and `treasurer` only
- [ ] Pastor can create but NOT approve reports
- [ ] Fund director limited to assigned fund(s)
- [ ] Church-scoped roles respect `church_id` boundaries

### Data Integrity
- [ ] All profiles have valid role from 6-role enum
- [ ] NATIONAL roles (`admin`, `treasurer`) have no `church_id`
- [ ] CHURCH roles (`pastor`, `church_manager`, `secretary`) have `church_id`
- [ ] Fund directors have `fund_id` assigned

### UI/UX Consistency
- [ ] Role selectors show exactly 6 options
- [ ] Permission-based UI hiding works correctly
- [ ] Error messages reference correct role names

---

## Support

For questions about roles and permissions:
- **Technical:** Review code in `convex/lib/auth.ts` and `convex/lib/permissions.ts`
- **Business Logic:** Contact `administracion@ipupy.org.py`
- **Migration History:** See `migrations/051-054` and archived docs

---

**Document Status:** ✅ Authoritative
**Supersedes:** All previous role documentation with conflicting information
**Next Review:** When role system changes are proposed
