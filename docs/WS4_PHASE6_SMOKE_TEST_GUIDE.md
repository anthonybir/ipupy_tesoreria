# WS-4 Phase 6 Smoke Test Guide (T-461)
**Test Suite:** Convex Auth Production Validation
**Task:** T-461 - Comprehensive Auth Flow Validation
**Date:** October 10, 2025
**Tester:** _[Your name]_

---

## Overview

This smoke test suite validates the **complete Convex Auth migration** before marking WS-4 complete. Unlike T-446 (automated Jest tests), this suite verifies the auth flow in a **live development environment** with real browser interactions.

**Key Differences from T-446:**
- T-446: Unit tests for `ensureProfile` mutation logic (Jest mocks)
- T-461: End-to-end browser testing with actual Google OAuth flow

---

## Prerequisites

### 1. Environment Setup

```bash
# Terminal 1: Start Convex dev server
npx convex dev

# Terminal 2: Start Next.js dev server
npm run dev
```

**Verify both servers are running:**
- Convex dashboard: https://dashboard.convex.dev
- Next.js app: http://localhost:3000
- No connection errors in browser console

### 2. Convex Environment Variables

Verify in Convex dashboard → Settings → Environment Variables:

```bash
AUTH_GOOGLE_ID=<set>
AUTH_GOOGLE_SECRET=<set>
SITE_URL=http://localhost:3000
```

**Important:** `SITE_URL` must match your development environment URL exactly.

### 3. Test Accounts Required

- ✅ **Admin account**: `administracion@ipupy.org.py` (already migrated)
- ✅ **New user account**: Fresh `@ipupy.org.py` Google account (for new user test)
- ✅ **Inactive profile**: Use admin account, manually deactivate in Convex dashboard
- ✅ **Invalid domain**: Any `@gmail.com` or `@outlook.com` account

### 4. Browser Setup

- Use **Incognito/Private window** for each test scenario
- Open **Developer Console** (F12) to monitor logs
- Clear cookies/storage between tests
- Recommended browsers: Chrome, Firefox, Safari

---

## Test Scenarios

### Scenario 1: New User Sign-In ✅

**Objective:** Verify new `@ipupy.org.py` user gets auto-provisioned with secretary role

**Test Steps:**
1. Open incognito window → http://localhost:3000
2. App should redirect to `/login` (not authenticated)
3. Click "Sign in with Google" button
4. Complete Google OAuth with **new** `@ipupy.org.py` account
5. Should redirect back to app after successful sign-in
6. Check UserMenu in top-right shows user email

**Expected Results:**
- ✅ Redirected to dashboard (`/`) after sign-in
- ✅ UserMenu displays user email and name
- ✅ No errors in browser console
- ✅ Profile created in Convex with:
  - `role: "secretary"` (default for non-admin)
  - `active: true`
  - `user_id: <Convex ID>` (starts with `j9...`)
  - `email: <lowercase normalized>`

**Verification in Convex Dashboard:**
```
1. Go to https://dashboard.convex.dev
2. Select your deployment (dashing-clownfish-472)
3. Navigate to Tables → profiles
4. Find latest profile entry (sort by _creationTime desc)
5. Verify fields:
   - role = "secretary"
   - active = true
   - user_id = <Convex ID> (not email string)
   - email = <test email, lowercase>

6. Navigate to Tables → users
7. Find corresponding user record
8. Verify:
   - email matches profile email
   - name matches Google account name
```

**Browser Console Checks:**
```javascript
// Should see (in development mode):
[Dev] ensureProfile: created test.user@ipupy.org.py (role=secretary)

// Should NOT see:
❌ Error: Not authenticated
❌ Error: Email domain not allowed
❌ Failed to fetch
```

**Screenshots to Capture:**
1. Login page before sign-in
2. Google OAuth consent screen
3. Dashboard after successful sign-in (UserMenu visible)
4. Convex dashboard showing profile entry
5. Browser console logs

---

### Scenario 2: Admin Email Auto-Role Assignment ✅

**Objective:** Verify `administracion@ipupy.org.py` gets admin role (not secretary)

**Test Steps:**
1. Sign out from previous test (UserMenu → Sign Out)
2. Verify redirected to `/login`
3. Open new incognito window
4. Sign in with `administracion@ipupy.org.py`
5. Complete OAuth flow

**Expected Results:**
- ✅ Profile has `role: "admin"` (special case in `ensureProfile`)
- ✅ Admin UI accessible at `/admin/users`
- ✅ User ID is Convex ID (not email)

**Verification:**
```
Convex dashboard → profiles table:
- email = "administracion@ipupy.org.py"
- role = "admin"
- active = true

Browser navigation:
1. Navigate to http://localhost:3000/admin/users
2. ✅ Page loads without 403 error
3. ✅ User management UI visible
4. ✅ Can see list of profiles
5. ✅ RoleSelect dropdown available
```

**Console Check:**
```javascript
[Dev] ensureProfile: updated administracion@ipupy.org.py (role=admin, ...)
```

---

### Scenario 3: Sign-Out Flow ✅

**Objective:** Verify sign-out properly clears session and redirects

**Test Steps:**
1. While signed in (any account)
2. Click UserMenu in top-right
3. Click "Sign Out" or "Cerrar Sesión"
4. Observe redirect behavior

**Expected Results:**
- ✅ Immediately redirected to `/login`
- ✅ UserMenu no longer visible
- ✅ Cannot access protected routes (e.g., `/admin/users` → redirects to `/login`)
- ✅ No session cookie remains (check DevTools → Application → Cookies)

**Verification:**
```
1. After sign-out, try navigating to:
   - http://localhost:3000/admin/users
   - http://localhost:3000/

2. Both should redirect to /login

3. Check cookies in DevTools:
   - No `__session` or `__clerk_*` cookies
   - Convex auth tokens cleared
```

---

### Scenario 4: Domain Restriction Enforcement ✅

**Objective:** Verify non-`@ipupy.org.py` emails are rejected

**Test Steps:**
1. Open incognito window → http://localhost:3000/login
2. Click "Sign in with Google"
3. Use **invalid** account (`@gmail.com`, `@outlook.com`, etc.)
4. Complete OAuth flow
5. Observe error handling

**Expected Results:**
- ❌ Sign-in **fails** with error message
- ✅ Error: "Email domain not allowed" or "Solo @ipupy.org.py permitido"
- ✅ User NOT created in `users` table
- ✅ Profile NOT created in `profiles` table
- ✅ Redirected back to `/login` (not dashboard)

**Verification:**
```
Browser console:
❌ Error: Email domain not allowed

Convex dashboard → users table:
✅ No user record for invalid email

Convex dashboard → profiles table:
✅ No profile record for invalid email
```

**Edge Cases to Test:**
- `test@gmail.com` → ❌ Rejected
- `test@ipupy.org` → ❌ Rejected (missing `.py`)
- `test@ipupy.org.py.fake.com` → ❌ Rejected (domain suffix attack)
- `test@IPUPY.ORG.PY` → ✅ Accepted (case-insensitive, normalized to lowercase)

---

### Scenario 5: Profile Reactivation on Sign-In ✅

**Objective:** Verify inactive profiles are automatically reactivated

**Pre-Test Setup:**
```bash
# Manual setup via Convex dashboard:
1. Sign in with test account first
2. Go to Convex dashboard → profiles table
3. Find test user's profile
4. Click to edit
5. Set active = false
6. Save
7. Sign out from app
```

**Test Steps:**
1. User signs out (profile now inactive)
2. User signs back in with same account
3. Complete OAuth flow

**Expected Results:**
- ✅ Profile `active` changes from `false` → `true`
- ✅ `updated_at` timestamp updates
- ✅ No new duplicate profile created
- ✅ Browser console shows: `ensureProfile: updated <email> (reactivated=true, ...)`
- ✅ Role preserved (not reset to secretary)

**Verification:**
```
Convex dashboard → profiles table:
- Profile count for test email = 1 (not 2)
- active = true (changed from false)
- updated_at = <recent timestamp>
- role = <original role> (preserved)
```

---

### Scenario 6: Concurrent Sign-In (Race Condition Test) ✅

**Objective:** Verify no duplicate profiles created with simultaneous sign-ins

**Test Steps:**
1. Open 2 browser tabs side-by-side in **same incognito window**
2. Both tabs should show `/login` page
3. **Tab 1**: Click "Sign in with Google"
4. **Tab 2**: Click "Sign in with Google" (within 2 seconds)
5. Complete OAuth in **Tab 1** first
6. Complete OAuth in **Tab 2** second
7. Check both tabs show dashboard

**Expected Results:**
- ✅ Only **1** profile created (check Convex profiles table)
- ✅ Both tabs show same user data
- ✅ No "Profile not found" errors
- ✅ Both tabs functional (can navigate, use features)

**Verification:**
```
Convex dashboard → profiles table:
- Filter by test email
- Count = 1 (not 2)
- _creationTime shows single creation timestamp

Both browser tabs:
- Tab 1: UserMenu shows email
- Tab 2: UserMenu shows same email
- No console errors in either tab
```

**Implementation Detail:**
The `ensureProfile` mutation uses Convex's transactional guarantees:
- First call creates profile
- Second call finds existing profile (no duplicate)

---

### Scenario 7: Name/Email Sync from Google ✅

**Objective:** Verify user profile updates when Google account changes

**Pre-Test Setup:**
```bash
# Option A: Change name in Google account settings
1. Go to https://myaccount.google.com
2. Update display name to "Test Name Updated"
3. Save

# Option B: Manually edit in Convex dashboard
1. Go to users table
2. Find test user
3. Set name = "Old Name"
4. Save
```

**Test Steps:**
1. Change display name in Google account to "New Test Name"
2. Sign out from app
3. Sign in again
4. Check if name updated in Convex

**Expected Results:**
- ✅ `users` table `name` field updates to "New Test Name"
- ✅ Console shows: `ensureProfile: updated <email> (..., userNameUpdated=true)`
- ✅ UserMenu reflects new name

**Verification:**
```
Convex dashboard → users table:
- name = "New Test Name" (updated)
- email = <unchanged>

Browser UI:
- UserMenu displays new name
```

---

### Scenario 8: Protected Route Access Control ✅

**Objective:** Verify unauthenticated users cannot access protected routes

**Test Steps:**
1. **Start signed out** (clear all cookies)
2. Try to navigate directly to protected routes:
   - http://localhost:3000/admin/users
   - http://localhost:3000/
   - http://localhost:3000/churches
   - http://localhost:3000/reports

**Expected Results:**
- ✅ All routes redirect to `/login`
- ✅ No content flash before redirect
- ✅ After sign-in, redirect back to original requested URL (if applicable)

**Verification:**
```
Browser behavior:
1. Request /admin/users → Redirect to /login
2. Sign in → Redirect to /admin/users (original destination)

Console:
No API errors or 403 responses
```

---

## Performance Checks

### Auth Flow Performance

**Measure:**
- OAuth redirect time (click button → redirect to Google)
- OAuth callback time (Google redirect → app dashboard)
- `ensureProfile` mutation execution time
- Overall sign-in experience

**Expected Benchmarks:**
- OAuth redirect: < 500ms
- OAuth callback + profile creation: < 2s total
- Subsequent sign-ins (existing profile): < 1s

**How to Measure:**
```javascript
// In browser console, check Network tab:
1. Filter by "convex.cloud"
2. Look for mutation requests
3. Check timing (should be < 500ms per mutation)
```

---

## Data Integrity Checks

### Profile Data Validation

After all tests, verify in Convex dashboard:

```
profiles table:
✅ All profiles have Convex user IDs (no email strings in user_id field)
✅ All emails lowercase normalized
✅ No duplicate profiles (unique by email)
✅ Active flags correctly set
✅ Roles correctly assigned (admin vs secretary)

users table:
✅ One user per profile
✅ Email matches profile email
✅ Names populated (not null)
```

---

## Test Results Template

### Summary

- **Date:** _______________
- **Tester:** _______________
- **Environment:** Development (localhost:3000)
- **Convex Deployment:** dashing-clownfish-472
- **Overall Status:** ⏳ IN PROGRESS / ✅ PASSED / ❌ FAILED

### Scenario Results

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. New User Sign-In | [ ] PASS / [ ] FAIL | |
| 2. Admin Role Assignment | [ ] PASS / [ ] FAIL | |
| 3. Sign-Out Flow | [ ] PASS / [ ] FAIL | |
| 4. Domain Restriction | [ ] PASS / [ ] FAIL | |
| 5. Profile Reactivation | [ ] PASS / [ ] FAIL | |
| 6. Concurrent Sign-In | [ ] PASS / [ ] FAIL | |
| 7. Name/Email Sync | [ ] PASS / [ ] FAIL | |
| 8. Protected Routes | [ ] PASS / [ ] FAIL | |

### Performance Results

- OAuth redirect time: ___ ms
- OAuth callback time: ___ ms
- ensureProfile mutation time: ___ ms
- Overall sign-in experience: [ ] Fast / [ ] Acceptable / [ ] Slow

### Data Integrity

- [ ] All user IDs are Convex IDs (not emails)
- [ ] No duplicate profiles
- [ ] All emails normalized to lowercase
- [ ] Roles correctly assigned

---

## Success Criteria

**ALL scenarios must PASS before marking T-461 complete:**

- ✅ 8/8 scenarios pass
- ✅ No authentication errors
- ✅ Domain restriction enforced 100%
- ✅ Sign-out properly clears session
- ✅ No duplicate profiles created
- ✅ Performance acceptable (< 2s sign-in)
- ✅ All data integrity checks pass

---

## Troubleshooting

### Issue: "No autenticado" error on sign-in

**Possible Causes:**
1. Convex environment variables not set
2. Google OAuth client ID/secret mismatch
3. SITE_URL doesn't match development URL

**Fix:**
```bash
# Check Convex dashboard → Settings → Environment Variables
AUTH_GOOGLE_ID=<set>
AUTH_GOOGLE_SECRET=<set>
SITE_URL=http://localhost:3000  # Must match exactly

# Restart Convex dev server after changes
npx convex dev
```

### Issue: Profile not created after sign-in

**Check:**
1. Browser console for errors
2. Convex dashboard → Logs → Filter by "ensureProfile"
3. Verify mutation is being called
4. Check `AuthProvider` guards (might be blocking mutation)

**Debug:**
```bash
# In Convex dashboard → Logs, search for:
ensureProfile

# Look for error messages or stack traces
```

### Issue: Domain restriction not working

**Verify:**
```typescript
// In convex/auth.ts, check:
const ALLOWED_DOMAIN = "@ipupy.org.py";

if (!email.endsWith(ALLOWED_DOMAIN)) {
  throw new Error("Email domain not allowed");
}
```

### Issue: Duplicate profiles created

**Possible Causes:**
1. Race condition in `ensureProfile` (query not indexed)
2. Multiple `AuthProvider` instances
3. Concurrent mutations bypassing database checks

**Check:**
```
Convex dashboard → Tables → profiles
- Index on user_id: ✅ Should exist
- Index on email: ✅ Should exist

convex/schema.ts:
.index("by_user_id", ["user_id"])
.index("by_email", ["email"])
```

---

## Next Steps After Testing

1. **If ALL PASS**:
   - Document results in `WS4_PHASE6_SMOKE_TEST_RESULTS.md`
   - Mark T-461 complete in TASK_TRACKER.md
   - Proceed to T-462 (verify role assignments)

2. **If ANY FAIL**:
   - Document failure in results file
   - Create GitHub issue for bug
   - Fix code and re-test
   - Do NOT proceed to T-462 until all pass

3. **Update Documentation**:
   - Add session log entry to TASK_TRACKER.md
   - Update CHANGELOG.md with test outcomes
   - Capture screenshots for documentation

---

## Production Deployment Checklist

**Before deploying to production, verify:**

- [ ] All 8 smoke test scenarios pass in development
- [ ] Jest unit tests pass (20/20 tests)
- [ ] TypeScript build succeeds (`npm run build`)
- [ ] ESLint passes (`npm run lint`)
- [ ] No console errors in browser
- [ ] Convex functions deployed (`npx convex deploy`)
- [ ] Convex environment variables set in **production** deployment
- [ ] Google OAuth redirect URIs updated for production domain
- [ ] Rollback procedure documented (T-464)
- [ ] Team trained on new auth flow

---

## Reference Files

- **Jest Tests**: `tests/unit/auth.test.ts` (automated unit tests)
- **Migration Script**: `scripts/migrate-profiles-to-convex.ts`
- **Auth Mutation**: `convex/auth.ts` (`ensureProfile`)
- **Auth Provider**: `src/components/Auth/AuthProvider.tsx`
- **Login Component**: `src/components/Auth/ConvexAuthLogin.tsx`
- **Schema**: `convex/schema.ts` (authTables merged)
