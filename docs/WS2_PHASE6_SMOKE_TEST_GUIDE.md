# WS-2 Phase 6 – Smoke Test Execution Guide

**Last Updated:** October 10, 2025  
**Test Environment:** Local Development  
**Estimated Time:** 45-60 minutes

> **Update (Oct 9, 2025 – WS-4 Phase 4):** `ensureProfile` now requires an authenticated Convex session and no longer accepts the `email` parameter. When executing these tests, trigger profile provisioning by signing in through the app (or an authenticated client). The CLI examples that pass an email are preserved here for historical context only.

## Setup Instructions

### 1. Start Development Servers

```bash
# Terminal 1 - Convex backend
npx convex dev

# Terminal 2 - Next.js frontend
npm run dev
```

Verify both servers are running:
- Convex: Watch for "Convex functions ready" message
- Next.js: Visit http://localhost:3000

### 2. Prepare Test Accounts

You'll need Google Workspace accounts for testing:

| Role | Email | Purpose |
|------|-------|---------|
| Admin | `administracion@ipupy.org.py` | Full system access, role assignment |
| Treasurer | `tesorero@ipupy.org.py` | Report approval, national scope |
| Pastor | `pastor.iglesia1@ipupy.org.py` | Report creation, church scope |
| New User | `test.nuevo@ipupy.org.py` | Auto-provisioning test |

**Note:** Use actual @ipupy.org.py Google Workspace accounts or create test accounts in your workspace.

### 3. Verify Convex Deployment

```bash
# Check that auth.ts is deployed
npx convex function convex/auth:ensureProfile --help
```

## Test Execution Checklist

### Priority 1: Permission System (CRITICAL)

#### ✅ T6-004: Treasurer Approves Report

**Objective:** Verify treasurer can approve reports

**Steps:**
1. Sign in as **pastor** account
2. Create a test report:
   ```
   Church: Any church
   Period: October 2025
   Total Income: 1000000 ₲
   Bank Deposit: 100000 ₲ (10%)
   Status: Should be "Enviado" after creation
   ```
3. Sign out, sign in as **treasurer** account
4. Navigate to `/admin` or reports list
5. Find the pending report
6. Click "Aprobar" button

**Expected Result:**
- ✅ Approval succeeds
- ✅ Report status changes to "Aprobado"
- ✅ Success toast appears
- ✅ Audit metadata captured (approved_by, approved_at)

**Failure Scenarios:**
- ❌ "Acceso denegado" error → Check permission helper
- ❌ Button not visible → Check UI role gates

---

#### ✅ T6-005: Pastor CANNOT Approve Report

**Objective:** Verify pastor is blocked from approving

**Steps:**
1. Sign in as **pastor** account
2. Navigate to the same report from T6-004
3. Attempt to approve via:
   - UI button (if visible)
   - Direct API call (use browser DevTools)

**Expected Result:**
- ✅ UI button is hidden OR disabled
- ✅ API returns: `{ success: false, error: "se requiere rol de tesorero nacional o administrador" }`
- ✅ Report status unchanged
- ✅ Error toast appears

**Failure Scenarios:**
- ❌ Approval succeeds → BLOCKER - permission bypass!
- ❌ Wrong error message → Check `requireReportApproval` helper

---

#### ✅ T6-006: Pastor Creates Report

**Objective:** Verify pastor can create reports

**Steps:**
1. Sign in as **pastor** account
2. Navigate to `/reports/new`
3. Fill out report form:
   ```
   Church: Pastor's assigned church
   Period: October 2025
   Total Income: 2000000 ₲
   Bank Deposit: 200000 ₲
   Upload deposit photo: (any image)
   ```
4. Click "Enviar Reporte"

**Expected Result:**
- ✅ Report created successfully
- ✅ Status: "Enviado" (submitted)
- ✅ Auto-calculations correct (10% fund = 200000)
- ✅ Redirect to reports list
- ✅ Success toast appears

**Failure Scenarios:**
- ❌ Permission denied → Check church scope assignment
- ❌ Wrong calculations → Check report mutation logic

---

### Priority 2: Admin UI

#### ✅ T6-002: Admin Assigns Role

**Objective:** Verify admin can change user roles

**Steps:**
1. Sign in as **admin** account
2. Navigate to `/admin/users`
3. Find existing user or create new one:
   ```
   Email: test.nuevo@ipupy.org.py
   Name: Usuario Prueba
   Initial Role: secretary
   ```
4. Change role from `secretary` → `treasurer`
5. Assign national scope

**Expected Result:**
- ✅ Role dropdown shows all 6 roles
- ✅ Role updates immediately (optimistic UI)
- ✅ Success toast appears
- ✅ Convex profile updated
- ✅ User can now approve reports on next login

**Verification:**
```bash
# Check in Convex dashboard
# Query: profiles table where email = "test.nuevo@ipupy.org.py"
# Verify: role = "treasurer"
```

**Failure Scenarios:**
- ❌ Role doesn't save → Check mutation wiring
- ❌ Dropdown missing roles → Check RoleSelect component

---

#### ✅ T6-003: Admin Deactivates/Reactivates User

**Objective:** Verify status toggle works

**Steps:**
1. Sign in as **admin** account
2. Navigate to `/admin/users`
3. Find active user
4. Click "Desactivar" button
5. Verify user marked inactive
6. Click "Reactivar" button

**Expected Result:**
- ✅ Status toggles to "Inactivo" on deactivate
- ✅ Status toggles to "Activo" on reactivate
- ✅ Role/church assignment preserved
- ✅ Success toasts appear
- ✅ Inactive users shown with badge/indicator

**Failure Scenarios:**
- ❌ Reactivation loses role → Check mutation logic
- ❌ Inactive user can still sign in → Check auth guard

---

### Priority 3: Auto-Provisioning

#### ✅ T6-011: New User Auto-Provisioning

**Objective:** Verify new users get profiles automatically

**Steps:**
1. Use a **NEW** Google Workspace account that has never signed in
2. Navigate to `/login`
3. Click "Sign in with Google"
4. Complete Google OAuth flow
5. After redirect to dashboard, verify profile created

**Expected Result:**
- ✅ Sign-in succeeds
- ✅ Profile auto-created in Convex
- ✅ Default role: `secretary`
- ✅ Status: `active`
- ✅ Name from Google profile
- ✅ Email from Google profile
- ✅ User appears in `/admin/users` list

**Verification:**
```bash
# Check Convex logs in terminal running `npx convex dev`
# Look for: "Profile created for [email]"

# OR query Convex dashboard:
# profiles table where email = "[new-user-email]"
```

**Failure Scenarios:**
- ❌ "Usuario no encontrado" error → Check `ensureProfile` call
- ❌ Profile not created → Check JWT callback wiring
- ❌ Wrong default role → Check `ensureProfile` mutation

---

## Test Data Setup

### Creating Test Reports

Use the Convex dashboard to create test reports directly:

```typescript
// In Convex dashboard, run this mutation:
// convex/reports:create

{
  "church_id": "<church-id-from-churches-table>",
  "reporting_month": 10,
  "reporting_year": 2025,
  "total_income": 1000000,
  "tithe_amount": 100000,
  "bank_deposit_amount": 100000,
  "deposit_photo_url": "https://example.com/receipt.jpg",
  "other_income": 0,
  "notes": "Test report for smoke testing"
}
```

### Creating Test Churches

If you need test churches:

```typescript
// In Convex dashboard, run:
// convex/churches:create

{
  "name": "Iglesia Prueba 1",
  "city": "Asunción",
  "pastor_name": "Pastor Prueba",
  "status": "active"
}
```

## Results Documentation Template

After each test, document results:

```markdown
### Test: T6-XXX - [Test Name]

**Date:** YYYY-MM-DD HH:MM
**Tester:** [Your name]
**Environment:** Local Dev

**Result:** ✅ PASS / ❌ FAIL

**Details:**
- [What happened]
- [Screenshots if applicable]
- [Any unexpected behavior]

**Issues Found:**
- [Link to bug ticket if created]
```

## Quick Validation Commands

```bash
# Verify TypeScript
npm run typecheck

# Verify lint
npm run lint

# Check Convex function deployments
npx convex function list

# View Convex logs
# (automatic in terminal running `npx convex dev`)
```

## Troubleshooting

### Issue: "Not authenticated" errors

**Solution:**
1. Clear browser cookies
2. Sign out completely
3. Sign in again
4. Check Convex auth in DevTools → Application → Cookies

### Issue: Role changes not visible

**Solution:**
1. Check Convex dashboard for actual data
2. Sign out and sign in to refresh session
3. Verify mutation succeeded in Convex logs

### Issue: Permission errors on valid operations

**Solution:**
1. Check user's role in Convex dashboard
2. Verify church assignment matches
3. Check `convex/lib/permissions.ts` logic
4. Review Convex function logs for auth context

### Issue: Auto-provisioning not working

**Solution:**
1. Check `CONVEX_URL` env var is set
2. Verify `ensureProfile` mutation deployed
3. Check NextAuth JWT callback logs
4. Look for errors in both server terminals

## Exit Criteria

Before marking T-213 complete:

- ✅ All Priority 1 tests pass
- ✅ All Priority 2 tests pass  
- ✅ T6-011 (auto-provisioning) passes
- ✅ No blocker issues found
- ✅ Results documented in `WS2_PHASE6_TEST_RESULTS.md`
- ✅ `npm run typecheck` passes
- ✅ `npm run lint` passes

## Next Steps After Testing

1. Document all results in `docs/WS2_PHASE6_TEST_RESULTS.md`
2. Create bug tickets for any issues found
3. Update `docs/TASK_TRACKER.md` to mark T-213 complete
4. Begin WS-4 Phase 1 (Convex Auth migration)

---

## Quick Reference: Test Accounts

| Account Type | Email Pattern | Default Role | Scope |
|-------------|---------------|--------------|-------|
| Admin | `administracion@ipupy.org.py` | admin | NATIONAL |
| Treasurer | `tesorero@ipupy.org.py` | treasurer | NATIONAL |
| Fund Director | `director.fondo@ipupy.org.py` | fund_director | FUND |
| Pastor | `pastor.[church]@ipupy.org.py` | pastor | CHURCH |
| Church Manager | `manager.[church]@ipupy.org.py` | church_manager | CHURCH |
| Secretary | `secretario.[church]@ipupy.org.py` | secretary | CHURCH |
| New User | `test.[name]@ipupy.org.py` | secretary (auto) | CHURCH |
