# WS-2 Phase 6 – Manual Test Execution Checklist

**Created:** October 10, 2025  
**Status:** Ready for Execution  
**Estimated Time:** 45-60 minutes

## Pre-Test Setup ✅

### 1. Environment Ready
- ✅ Convex dev server running (`npx convex dev`)
- ✅ Next.js dev server running (`npm run dev`)  
- ✅ Validation passed (`npm run typecheck` + `npm run lint`)

### 2. Test Data Available
- ✅ Active churches in database (22 churches found)
- ✅ Admin account exists: `administracion@ipupy.org.py`
- ✅ Test account exists: `test.smoketest@ipupy.org.py`

### 3. Test Accounts Needed
Create these Google Workspace accounts if they don't exist:
- [ ] `test.treasurer@ipupy.org.py` (for treasurer role testing)
- [ ] `test.pastor@ipupy.org.py` (for pastor role testing)
- [ ] `test.new@ipupy.org.py` (for auto-provisioning test)

---

## Test Execution Sequence

### ⏱️ Test T6-011: New User Auto-Provisioning (5 min)
**Priority:** HIGH | **Complexity:** LOW

**Objective:** Verify new users get profiles automatically with default secretary role

**Steps:**
1. [ ] Open http://localhost:3000/login in **incognito window**
2. [ ] Sign in with BRAND NEW account: `test.new@ipupy.org.py`
3. [ ] Complete Google OAuth flow
4. [ ] Note redirect to dashboard

**Expected Result:**
- [ ] ✅ Sign-in succeeds without errors
- [ ] ✅ Dashboard loads (even if empty)
- [ ] ✅ No "Usuario no encontrado" error

**Verification:**
1. [ ] Check Convex terminal for log: `"Profile created for test.new@ipupy.org.py"`
2. [ ] OR query in Convex dashboard:
   ```
   profiles table → filter by email = "test.new@ipupy.org.py"
   Expected: role = "secretary", active = true
   ```

**Result:** ⏳ PENDING
**Notes:** _____________________
**Screenshot:** _____________________

---

### ⏱️ Test T6-002: Admin Assigns Role (10 min)
**Priority:** HIGH | **Complexity:** MEDIUM

**Objective:** Verify admin can change user roles via UI

**Steps:**
1. [ ] Sign out, sign in as: `administracion@ipupy.org.py`
2. [ ] Navigate to: http://localhost:3000/admin/users
3. [ ] Find user: `test.new@ipupy.org.py` (created in T6-011)
4. [ ] Click role dropdown for this user
5. [ ] Change role from `secretary` → `treasurer`
6. [ ] Note toast notification

**Expected Result:**
- [ ] ✅ Role dropdown shows all 6 roles with Spanish labels
- [ ] ✅ Selection updates immediately (optimistic UI)
- [ ] ✅ Success toast appears: "Rol actualizado correctamente"
- [ ] ✅ UI shows new role badge/label

**Verification:**
1. [ ] Refresh page - role still shows `treasurer`
2. [ ] Check Convex dashboard:
   ```
   profiles → email = "test.new@ipupy.org.py"
   Expected: role = "treasurer"
   ```

**Result:** ⏳ PENDING
**Notes:** _____________________
**Screenshot:** _____________________

---

### ⏱️ Test T6-003: Admin Deactivates User (5 min)
**Priority:** MEDIUM | **Complexity:** LOW

**Objective:** Verify status toggle preserves role assignment

**Steps:**
1. [ ] Still signed in as admin at `/admin/users`
2. [ ] Find user: `test.new@ipupy.org.py`
3. [ ] Click "Desactivar" button
4. [ ] Note UI changes
5. [ ] Click "Reactivar" button

**Expected Result:**
- [ ] ✅ After deactivate: Badge shows "Inactivo" or similar
- [ ] ✅ After reactivate: Badge shows "Activo"
- [ ] ✅ Role remains `treasurer` (not reset to secretary)
- [ ] ✅ Success toasts on both actions

**Verification:**
Check Convex dashboard:
```
profiles → email = "test.new@ipupy.org.py"
Expected: active = true, role = "treasurer"
```

**Result:** ⏳ PENDING
**Notes:** _____________________

---

### ⏱️ Test T6-006: Pastor Creates Report (10 min)
**Priority:** HIGH | **Complexity:** MEDIUM

**Objective:** Verify pastor can create monthly reports

**Setup:**
1. [ ] First assign church to test account:
   - Sign in as admin → `/admin/users`
   - Edit `test.new@ipupy.org.py`
   - Change role to `pastor`
   - Assign church: `IPU J. AUGUSTO SALDÍVAR` (or any active church)
   - Save changes

**Steps:**
1. [ ] Sign out, sign in as: `test.new@ipupy.org.py`
2. [ ] Navigate to: http://localhost:3000/reports/new
3. [ ] Fill form:
   ```
   Church: [Auto-selected from profile]
   Period: October 2025
   Total Income: 2,000,000 ₲
   Other Income: 0 ₲
   Bank Deposit: 200,000 ₲
   Deposit Photo: [Upload any image]
   Notes: "Test report for smoke testing"
   ```
4. [ ] Click "Enviar Reporte"

**Expected Result:**
- [ ] ✅ Form submits without errors
- [ ] ✅ Redirect to reports list
- [ ] ✅ Success toast: "Reporte enviado correctamente"
- [ ] ✅ Report appears in list with status: "Enviado"
- [ ] ✅ Auto-calculated 10% fund: 200,000 ₲

**Verification:**
Check Convex dashboard:
```
monthlyReports → filter latest
Expected: status = "enviado", tithe_amount = 200000
```

**Note the Report ID for next tests:** _____________________

**Result:** ⏳ PENDING
**Notes:** _____________________
**Screenshot:** _____________________

---

### ⏱️ Test T6-004: Treasurer Approves Report (10 min) 🚨 CRITICAL
**Priority:** CRITICAL | **Complexity:** MEDIUM

**Objective:** Verify treasurer can approve reports (permission system working)

**Setup:**
1. [ ] Update test account role:
   - Sign in as admin → `/admin/users`  
   - Edit `test.new@ipupy.org.py`
   - Change role from `pastor` → `treasurer`
   - Remove church assignment (treasurer is NATIONAL scope)
   - Save

**Steps:**
1. [ ] Sign out, sign in as: `test.new@ipupy.org.py`
2. [ ] Navigate to pending reports (admin view or reports list)
3. [ ] Find the report created in T6-006
4. [ ] Click "Aprobar" button
5. [ ] Confirm approval in dialog (if any)

**Expected Result:**
- [ ] ✅ "Aprobar" button is visible and enabled
- [ ] ✅ Approval succeeds without errors
- [ ] ✅ Success toast: "Reporte aprobado correctamente"
- [ ] ✅ Report status changes to "Aprobado"
- [ ] ✅ Audit fields populated:
  ```
  approved_by: test.new@ipupy.org.py
  approved_at: [timestamp]
  ```

**Verification:**
Check Convex dashboard:
```
monthlyReports → find report from T6-006
Expected: status = "aprobado", approved_by = [email]
```

**Result:** ⏳ PENDING
**Notes:** _____________________
**Screenshot:** _____________________

---

### ⏱️ Test T6-005: Pastor CANNOT Approve (10 min) 🚨 BLOCKER TEST
**Priority:** CRITICAL | **Complexity:** MEDIUM

**Objective:** Verify pastor is blocked from approving reports (security test)

**Setup:**
1. [ ] Create ANOTHER test report:
   - Repeat T6-006 steps OR use existing pending report
   - Note the report ID: _____________________

2. [ ] Update test account role BACK to pastor:
   - Sign in as admin → `/admin/users`
   - Edit `test.new@ipupy.org.py`
   - Change role from `treasurer` → `pastor`
   - Assign church: `IPU J. AUGUSTO SALDÍVAR`
   - Save

**Steps:**
1. [ ] Sign out, sign in as: `test.new@ipupy.org.py`
2. [ ] Navigate to the pending report
3. [ ] Attempt to approve:
   - **Option A:** Check if "Aprobar" button is hidden/disabled
   - **Option B:** If button visible, click and observe error

**Expected Result:**
- [ ] ✅ "Aprobar" button is HIDDEN or DISABLED
- [ ] ✅ OR clicking shows error toast
- [ ] ✅ Error message: "se requiere rol de tesorero nacional o administrador"
- [ ] ✅ Report status UNCHANGED (still "Enviado")

**Verification:**
Check Convex dashboard:
```
monthlyReports → check report status
Expected: status = "enviado" (NOT "aprobado")
```

**⚠️ BLOCKER CONDITION:**
If pastor CAN approve → STOP TESTING → File critical bug → Do NOT proceed to WS-4

**Result:** ⏳ PENDING
**Notes:** _____________________
**Screenshot:** _____________________

---

## Post-Test Validation

### Run Automated Checks
```bash
# TypeScript validation
npm run typecheck

# Lint validation  
npm run lint

# Check no regression errors in console
```

### Summary Checklist
- [ ] All 6 tests executed
- [ ] T6-005 (pastor block) PASSED (critical security test)
- [ ] No blocker issues found
- [ ] Results documented in `WS2_PHASE6_TEST_RESULTS.md`
- [ ] Screenshots captured for approval flows

---

## Test Results Summary

| Test ID | Test Name | Status | Duration | Issues Found |
|---------|-----------|--------|----------|--------------|
| T6-011 | Auto-Provisioning | ⏳ | ___ min | ___ |
| T6-002 | Admin Role Assignment | ⏳ | ___ min | ___ |
| T6-003 | User Deactivation | ⏳ | ___ min | ___ |
| T6-006 | Pastor Create Report | ⏳ | ___ min | ___ |
| T6-004 | Treasurer Approve | ⏳ | ___ min | ___ |
| T6-005 | Pastor Block (CRITICAL) | ⏳ | ___ min | ___ |

**Total Time:** _____ minutes  
**Pass Rate:** ____ / 6 (___%)

---

## Exit Criteria

**Ready for WS-4 (Convex Auth Migration)?**

- [ ] ALL tests passed (6/6)
- [ ] Zero blocker issues
- [ ] T6-005 security test confirmed working
- [ ] Results documented
- [ ] `npm run validate` passes

**If all boxes checked:** ✅ Proceed to WS-4 Phase 1 (T-411)  
**If any unchecked:** 🔄 Fix issues before starting auth migration

---

## Quick Reference

**Dev Servers:**
```bash
# Terminal 1
npx convex dev

# Terminal 2  
npm run dev
```

**App URLs:**
- Login: http://localhost:3000/login
- Dashboard: http://localhost:3000/dashboard
- Admin Users: http://localhost:3000/admin/users
- New Report: http://localhost:3000/reports/new

**Convex Dashboard:**
https://dashboard.convex.dev

**Test Helper:**
```bash
./scripts/test-helper.sh all
```
