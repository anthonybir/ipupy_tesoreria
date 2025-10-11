# WS-4 Phase 4 Smoke Test Guide
**Test Suite:** Convex Auth Profile Auto-Provisioning
**Task:** T-446
**Date:** October 10, 2025
**Tester:** _[Your name]_

---

## Prerequisites

### 1. Environment Setup
```bash
# Terminal 1: Start Convex dev server
npx convex dev

# Terminal 2: Start Next.js dev server
npm run dev
```

### 2. Browser Setup
- Use **Incognito/Private window** for clean state
- Open **Developer Console** (F12)
- Clear all cookies/storage before each test
- Navigate to: http://localhost:3000

### 3. Test Accounts Required
- ✅ **New user**: Create fresh Google account with `@ipupy.org.py` email
- ✅ **Admin email**: `administracion@ipupy.org.py`
- ✅ **Invalid domain**: Any `@gmail.com` or other non-org account

---

## Test Scenarios

### Scenario 1: New User First Sign-In (Secretary Role)

**Objective**: Verify auto-provisioning creates profile with correct defaults

**Steps**:
1. Open incognito window → http://localhost:3000/login
2. Click "Sign in with Google"
3. Use **new** `@ipupy.org.py` account
4. Complete OAuth flow

**Expected Results**:
- ✅ Redirected to dashboard after sign-in
- ✅ No errors in browser console
- ✅ Profile created with:
  - `role: "secretary"`
  - `active: true`
  - `user_id: <Convex ID>` (not email string)
  - `email: <normalized lowercase>`

**Verification**:
```bash
# Open Convex dashboard: https://dashboard.convex.dev
# Go to Tables → profiles
# Find latest profile entry
# Check:
# - role field = "secretary"
# - user_id field = ID (e.g., "j97abc...")
# - active field = true
```

**Browser Console Checks**:
```
Expected logs:
✅ [Auth] ensureProfile: created <email> (role=secretary)
✅ No error messages

Capture screenshot of:
- Console logs
- Convex dashboard profiles table
- User visible in UI (UserMenu shows email)
```

---

### Scenario 2: Admin Email Sign-In (Admin Role)

**Objective**: Verify special admin email gets admin role

**Steps**:
1. Sign out from previous test
2. Open new incognito window
3. Sign in with `administracion@ipupy.org.py`

**Expected Results**:
- ✅ Profile created with `role: "admin"`
- ✅ User ID is Convex ID (not email)
- ✅ Admin UI visible at `/admin/users`

**Verification**:
```bash
# Convex dashboard → profiles table
# Check latest profile:
# - email = "administracion@ipupy.org.py"
# - role = "admin"
```

**Browser Navigation**:
```
1. After sign-in, navigate to http://localhost:3000/admin/users
2. ✅ Page loads without 403 error
3. ✅ User management UI visible
```

---

### Scenario 3: Profile Reactivation

**Objective**: Verify inactive profiles are reactivated on sign-in

**Pre-Test Setup**:
```bash
# Manual setup via Convex dashboard:
1. Go to profiles table
2. Find test user profile
3. Edit → Set active = false
4. Save
```

**Steps**:
1. User signs out
2. User signs back in with same account

**Expected Results**:
- ✅ Profile `active` changes from `false` → `true`
- ✅ Browser console shows: `ensureProfile: updated <email> (reactivated=true, ...)`
- ✅ No new duplicate profile created

**Verification**:
```bash
# Convex dashboard → profiles table
# Check profile count (should NOT increase)
# Check updated_at timestamp (should change)
# Check active field = true
```

---

### Scenario 4: Name/Email Sync from OAuth Provider

**Objective**: Verify `users` table stays in sync with Google profile

**Pre-Test Setup**:
```bash
# Option A: Change name in Google account settings
# Option B: Manually edit users table in Convex dashboard
1. Go to users table
2. Find test user
3. Edit → Set name = "Old Name"
4. Save
```

**Steps**:
1. Change display name in Google account to "New Name"
2. Sign out from app
3. Sign in again

**Expected Results**:
- ✅ `users` table `name` field updates to "New Name"
- ✅ Browser console shows: `ensureProfile: updated <email> (..., userNameUpdated=true)`
- ✅ Profile `full_name` may also update

**Verification**:
```bash
# Convex dashboard → users table
# Find user record
# Check name = "New Name"
```

---

### Scenario 5: Invalid Domain Rejection

**Objective**: Verify domain restriction enforcement

**Steps**:
1. Try to sign in with `@gmail.com` or `@outlook.com` account
2. Complete OAuth flow

**Expected Results**:
- ❌ Sign-in fails with error
- ✅ Error message: "Email domain not allowed"
- ✅ User NOT created in `users` table
- ✅ Profile NOT created in `profiles` table

**Verification**:
```bash
# Browser console should show:
❌ Error: Email domain not allowed

# Convex dashboard → profiles table
# ✅ No profile created for invalid email
```

---

### Scenario 6: Race Condition Check (Concurrent Tabs)

**Objective**: Verify no duplicate profiles on simultaneous sign-ins

**Steps**:
1. Open 2 browser tabs side-by-side
2. Sign out from both
3. In **Tab 1**: Click "Sign in with Google"
4. In **Tab 2**: Click "Sign in with Google" (immediately after)
5. Complete OAuth in one tab
6. Switch to other tab, complete OAuth

**Expected Results**:
- ✅ Only **1** profile created (check `profiles` table)
- ✅ Both tabs end up with same profile data
- ✅ No error messages in either tab
- ✅ `hasTriggeredEnsure` flag prevents duplicate mutations

**Verification**:
```bash
# Convex dashboard → profiles table
# Filter by email = test user
# ✅ Count = 1 (not 2)

# Check _creationTime of profile
# ✅ Only one creation timestamp
```

---

## Test Results Template

### Scenario 1: New User Sign-In
- [ ] PASS / [ ] FAIL
- Profile ID: `_______________`
- Role assigned: `_______________`
- User ID format: [ ] Convex ID / [ ] Email string
- Screenshots: `_______________`
- Notes: `_______________`

### Scenario 2: Admin Sign-In
- [ ] PASS / [ ] FAIL
- Admin role assigned: [ ] YES / [ ] NO
- Admin UI accessible: [ ] YES / [ ] NO
- Notes: `_______________`

### Scenario 3: Reactivation
- [ ] PASS / [ ] FAIL
- Active flag updated: [ ] YES / [ ] NO
- Duplicate created: [ ] YES / [ ] NO
- Notes: `_______________`

### Scenario 4: Name Sync
- [ ] PASS / [ ] FAIL
- Name updated in users table: [ ] YES / [ ] NO
- Console log showed update: [ ] YES / [ ] NO
- Notes: `_______________`

### Scenario 5: Invalid Domain
- [ ] PASS / [ ] FAIL
- Error shown to user: [ ] YES / [ ] NO
- Profile created: [ ] YES / [ ] NO
- Notes: `_______________`

### Scenario 6: Race Condition
- [ ] PASS / [ ] FAIL
- Profile count: `_______________`
- Both tabs work: [ ] YES / [ ] NO
- Notes: `_______________`

---

## Success Criteria

All scenarios must **PASS** before proceeding to T-451/T-452:

- ✅ 6/6 scenarios pass
- ✅ No console errors (except expected domain rejection)
- ✅ No duplicate profiles created
- ✅ All profiles have Convex IDs (not email strings)
- ✅ Role assignment works correctly
- ✅ Reactivation works correctly

---

## Troubleshooting

### Issue: "No autenticado" error on sign-in
**Fix**: Check Convex environment variables:
```bash
# Verify in Convex dashboard → Settings → Environment Variables
AUTH_GOOGLE_ID=<set>
AUTH_GOOGLE_SECRET=<set>
SITE_URL=http://localhost:3000
```

### Issue: Profile not created after sign-in
**Check**:
1. Browser console for errors
2. Convex dashboard → Logs → Filter by "ensureProfile"
3. AuthProvider guards (might be blocking mutation)

### Issue: Duplicate profiles created
**Check**:
1. `hasTriggeredEnsure` flag logic in AuthProvider
2. Profile query timing (might be too slow)

---

## Next Steps After Testing

1. Document results in `WS4_PHASE4_SMOKE_TEST_RESULTS.md`
2. If **ALL PASS**: Mark T-446 complete, proceed to T-451
3. If **ANY FAIL**: Debug issue, fix code, re-test
4. Update TASK_TRACKER.md with test outcomes
