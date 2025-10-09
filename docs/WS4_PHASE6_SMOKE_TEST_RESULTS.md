# WS-4 Phase 6 Smoke Test Results (T-461)
**Test Suite:** Convex Auth Production Validation
**Task:** T-461 - Comprehensive Auth Flow Validation
**Date:** _______________
**Tester:** _______________
**Environment:** Development (localhost:3000)
**Convex Deployment:** dashing-clownfish-472

---

## Executive Summary

**Overall Status**: ⏳ IN PROGRESS / ✅ PASSED / ❌ FAILED

**Tests Passed**: ___ / 8
**Tests Failed**: ___ / 8
**Critical Issues**: ___ (list any blockers)

**Proceed to T-462?**: ⏳ PENDING / ✅ YES / ❌ NO (needs fixes)

**Sign-Off**: _______________ (Tester Name)

---

## Environment Verification

- [ ] Convex dev server running (`npx convex dev`)
- [ ] Next.js dev server running (`npm run dev`)
- [ ] Convex dashboard accessible (https://dashboard.convex.dev)
- [ ] Convex environment variables set:
  - [ ] AUTH_GOOGLE_ID
  - [ ] AUTH_GOOGLE_SECRET
  - [ ] SITE_URL=http://localhost:3000
- [ ] Test accounts prepared (admin + new user + invalid domain)

---

## Test Execution Log

### Scenario 1: New User Sign-In

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `_______________@ipupy.org.py`
**Test Timestamp**: `___:___ AM/PM`

**Execution Steps:**
- [ ] Opened incognito window
- [ ] Navigated to http://localhost:3000
- [ ] Clicked "Sign in with Google"
- [ ] Completed OAuth with new @ipupy.org.py account
- [ ] Redirected to dashboard

**Results:**
- Profile created: [ ] YES / [ ] NO
- Profile ID: `_______________`
- User ID (Convex): `_______________`
- Role assigned: `_______________` (expected: `secretary`)
- Active status: [ ] true / [ ] false
- Email normalized: [ ] YES (lowercase) / [ ] NO
- Console errors: [ ] NONE / [ ] YES (describe below)

**Convex Dashboard Verification:**
```
profiles table:
- _id: _______________
- user_id: _______________ (Convex ID starts with 'j9'?)
- email: _______________ (lowercase?)
- role: _______________ (expected: "secretary")
- active: _______________ (expected: true)
- created_at: _______________
- updated_at: _______________

users table:
- _id: _______________ (matches profile user_id?)
- email: _______________ (matches profile email?)
- name: _______________ (from Google account?)
```

**Browser Console Output:**
```
[Paste relevant console logs here]
```

**Screenshots:**
- [ ] Login page
- [ ] Google OAuth screen
- [ ] Dashboard after sign-in
- [ ] Convex profiles table
- [ ] Convex users table

**Notes:**
```
[Any observations, unexpected behavior, or edge cases discovered]
```

---

### Scenario 2: Admin Email Auto-Role Assignment

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `administracion@ipupy.org.py`
**Test Timestamp**: `___:___ AM/PM`

**Execution Steps:**
- [ ] Signed out from previous test
- [ ] Opened new incognito window
- [ ] Signed in with admin email
- [ ] Verified admin role assigned
- [ ] Accessed /admin/users page

**Results:**
- Admin role assigned: [ ] YES / [ ] NO
- Role value: `_______________` (expected: `admin`)
- Admin UI accessible: [ ] YES / [ ] NO
- User ID is Convex ID: [ ] YES / [ ] NO
- Console errors: [ ] NONE / [ ] YES

**Convex Dashboard Verification:**
```
profiles table:
- email: administracion@ipupy.org.py
- role: _______________ (expected: "admin")
- active: _______________ (expected: true)
```

**Admin UI Check:**
- Can access `/admin/users`: [ ] YES / [ ] NO
- User list loads: [ ] YES / [ ] NO
- Can see all profiles: [ ] YES / [ ] NO
- RoleSelect dropdown works: [ ] YES / [ ] NO

**Screenshots:**
- [ ] Admin users page
- [ ] Convex dashboard showing admin role

**Notes:**
```
[Any observations]
```

---

### Scenario 3: Sign-Out Flow

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: _______________ (any authenticated user)
**Test Timestamp**: `___:___ AM/PM`

**Execution Steps:**
- [ ] Signed in successfully
- [ ] Clicked UserMenu
- [ ] Clicked "Sign Out" / "Cerrar Sesión"
- [ ] Observed redirect behavior
- [ ] Verified session cleared

**Results:**
- Redirected to /login: [ ] YES / [ ] NO
- UserMenu no longer visible: [ ] YES / [ ] NO
- Session cookie cleared: [ ] YES / [ ] NO
- Cannot access /admin/users: [ ] YES (blocked) / [ ] NO (still accessible)
- Cannot access /: [ ] YES (blocked) / [ ] NO (still accessible)

**Cookie Verification (DevTools → Application → Cookies):**
```
Before sign-out:
- Cookies present: _______________

After sign-out:
- Cookies remaining: _______________
- Expected: No Convex auth cookies
```

**Protected Route Test:**
- Navigate to `/admin/users` after sign-out: [ ] Redirects to /login / [ ] Accessible
- Navigate to `/` after sign-out: [ ] Redirects to /login / [ ] Accessible

**Screenshots:**
- [ ] Before sign-out (UserMenu visible)
- [ ] After sign-out (redirected to login)
- [ ] Cookie state in DevTools

**Notes:**
```
[Any observations about session management]
```

---

### Scenario 4: Domain Restriction Enforcement

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account (Invalid)**: `_______________@gmail.com`
**Test Timestamp**: `___:___ AM/PM`

**Execution Steps:**
- [ ] Opened incognito window
- [ ] Clicked "Sign in with Google"
- [ ] Used @gmail.com / @outlook.com account
- [ ] Completed OAuth flow
- [ ] Observed error handling

**Results:**
- Sign-in blocked: [ ] YES / [ ] NO
- Error message shown: `_______________`
- Expected message: "Email domain not allowed" or "Solo @ipupy.org.py permitido"
- User created in Convex: [ ] YES (FAIL) / [ ] NO (PASS)
- Profile created in Convex: [ ] YES (FAIL) / [ ] NO (PASS)
- Redirected to /login: [ ] YES / [ ] NO

**Convex Dashboard Verification:**
```
users table:
- Search for invalid email: _______________
- Count: ___ (expected: 0)

profiles table:
- Search for invalid email: _______________
- Count: ___ (expected: 0)
```

**Browser Console Output:**
```
Expected: Error: Email domain not allowed
Actual: _______________
```

**Edge Cases Tested:**
- [ ] `test@gmail.com` → ❌ Rejected
- [ ] `test@ipupy.org` → ❌ Rejected (missing .py)
- [ ] `test@IPUPY.ORG.PY` → ✅ Accepted (case-insensitive)

**Screenshots:**
- [ ] Error message shown to user
- [ ] Browser console with error
- [ ] Convex dashboard (no records created)

**Notes:**
```
[Any observations about error handling or UX]
```

---

### Scenario 5: Profile Reactivation on Sign-In

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `_______________@ipupy.org.py`
**Test Timestamp**: `___:___ AM/PM`

**Pre-Test Setup:**
- [ ] Signed in with test account first
- [ ] Went to Convex dashboard → profiles table
- [ ] Set `active = false` for test user's profile
- [ ] Signed out from app
- [ ] Profile confirmed inactive in dashboard

**Execution Steps:**
- [ ] User signed back in with same account
- [ ] Completed OAuth flow
- [ ] Checked profile status in dashboard

**Results:**
- Profile reactivated: [ ] YES / [ ] NO
- Active status after sign-in: [ ] true / [ ] false
- Duplicate profile created: [ ] YES (FAIL) / [ ] NO (PASS)
- Console log showed reactivation: [ ] YES / [ ] NO
- Role preserved: [ ] YES / [ ] NO (should not reset to secretary)

**Convex Dashboard Verification:**
```
Before reactivation:
- active: false
- role: _______________
- updated_at: _______________

After reactivation:
- active: _______________ (expected: true)
- role: _______________ (should be unchanged)
- updated_at: _______________ (should be updated)
- Profile count: ___ (expected: 1, not 2)
```

**Browser Console Output:**
```
Expected: [Dev] ensureProfile: updated <email> (reactivated=true, ...)
Actual: _______________
```

**Screenshots:**
- [ ] Profile before (active=false)
- [ ] Profile after (active=true)
- [ ] Console log showing reactivation

**Notes:**
```
[Any observations about reactivation logic]
```

---

### Scenario 6: Concurrent Sign-In (Race Condition)

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `_______________@ipupy.org.py`
**Test Timestamp**: `___:___ AM/PM`

**Setup:**
- [ ] Opened 2 tabs side-by-side in same incognito window
- [ ] Both tabs on /login page
- [ ] Tab 1 sign-in initiated at: `___:___:___`
- [ ] Tab 2 sign-in initiated at: `___:___:___` (within 2 seconds)

**Execution Steps:**
- [ ] Tab 1: Clicked "Sign in with Google"
- [ ] Tab 2: Clicked "Sign in with Google" (immediately after)
- [ ] Completed OAuth in Tab 1 first
- [ ] Completed OAuth in Tab 2 second
- [ ] Both tabs loaded dashboard

**Results:**
- Profiles created: ___ (expected: 1)
- Both tabs functional: [ ] YES / [ ] NO
- Tab 1 console errors: [ ] NONE / [ ] YES
- Tab 2 console errors: [ ] NONE / [ ] YES
- Both tabs show same user email: [ ] YES / [ ] NO

**Convex Dashboard Verification:**
```
profiles table:
- Filter by test email
- Count: ___ (expected: 1, not 2)
- Profile _id: _______________
- _creationTime: _______________ (single timestamp)

users table:
- Filter by test email
- Count: ___ (expected: 1, not 2)
```

**Tab 1 Console Output:**
```
[Paste Tab 1 console logs]
```

**Tab 2 Console Output:**
```
[Paste Tab 2 console logs]
```

**Screenshots:**
- [ ] Both tabs showing dashboard
- [ ] Convex dashboard (profile count = 1)
- [ ] Console logs from both tabs

**Notes:**
```
[Any observations about race condition handling, timing, or errors]
```

---

### Scenario 7: Name/Email Sync from Google

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `_______________@ipupy.org.py`
**Test Timestamp**: `___:___ AM/PM`

**Pre-Test Setup:**
- [ ] Changed Google account name to "Test Name Updated"
- [ ] OR manually edited `users` table in Convex dashboard (name = "Old Name")
- [ ] Signed out from app

**Execution Steps:**
- [ ] Signed back in
- [ ] Checked if name updated in Convex
- [ ] Verified UserMenu reflects new name

**Results:**
- Name updated in users table: [ ] YES / [ ] NO
- Old name: `_______________`
- New name: `_______________`
- Console log showed update: [ ] YES / [ ] NO
- UserMenu displays new name: [ ] YES / [ ] NO

**Convex Dashboard Verification:**
```
users table before sign-in:
- name: _______________

users table after sign-in:
- name: _______________ (should be "Test Name Updated")
- email: _______________ (unchanged)
```

**Browser Console Output:**
```
Expected: [Dev] ensureProfile: updated <email> (..., userNameUpdated=true)
Actual: _______________
```

**Screenshots:**
- [ ] Google account settings (name change)
- [ ] Convex users table before
- [ ] Convex users table after
- [ ] UserMenu showing new name

**Notes:**
```
[Any observations about sync behavior]
```

---

### Scenario 8: Protected Route Access Control

**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Timestamp**: `___:___ AM/PM`

**Execution Steps:**
- [ ] Cleared all cookies (started signed out)
- [ ] Tried to access /admin/users directly
- [ ] Tried to access / directly
- [ ] Tried to access /churches directly
- [ ] Tried to access /reports directly
- [ ] Observed redirect behavior
- [ ] Signed in, checked if redirected back to original URL

**Results:**

| Route | Redirects to /login? | Content Flash? | Notes |
|-------|---------------------|----------------|-------|
| `/admin/users` | [ ] YES / [ ] NO | [ ] YES / [ ] NO | |
| `/` | [ ] YES / [ ] NO | [ ] YES / [ ] NO | |
| `/churches` | [ ] YES / [ ] NO | [ ] YES / [ ] NO | |
| `/reports` | [ ] YES / [ ] NO | [ ] YES / [ ] NO | |

**Post-Sign-In Redirect:**
- Requested URL before sign-in: `_______________`
- Redirected to after sign-in: `_______________`
- Expected: Same as requested URL (or dashboard)

**Console Errors:**
- API 403 errors: [ ] NONE / [ ] YES
- Other errors: [ ] NONE / [ ] YES

**Screenshots:**
- [ ] Direct navigation to protected route (should redirect)
- [ ] After sign-in (should access route)

**Notes:**
```
[Any observations about redirect behavior or UX]
```

---

## Performance Measurements

### Auth Flow Performance

**Measured Timings:**
- OAuth redirect time (button click → Google): ___ ms
- OAuth callback time (Google → dashboard): ___ ms
- `ensureProfile` mutation time: ___ ms
- Overall sign-in experience: ___ s

**Performance Rating:**
- [ ] Fast (< 1s total)
- [ ] Acceptable (1-3s total)
- [ ] Slow (> 3s total)

**How Measured:**
```
Browser DevTools → Network tab
- Filter by "convex.cloud"
- Checked timing for mutation requests
```

**Benchmarks:**
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| OAuth redirect | < 500ms | ___ ms | [ ] ✅ / [ ] ❌ |
| OAuth callback + profile | < 2s | ___ ms | [ ] ✅ / [ ] ❌ |
| Subsequent sign-ins | < 1s | ___ ms | [ ] ✅ / [ ] ❌ |

---

## Data Integrity Validation

### Profile Table Checks

**Verification in Convex Dashboard → profiles table:**

- [ ] All profiles have Convex user IDs (format: `j9...`, not email strings)
- [ ] All emails normalized to lowercase
- [ ] No duplicate profiles (run query: `db.query("profiles").collect()` and check for duplicates)
- [ ] Active flags correctly set (new profiles = true, reactivated = true)
- [ ] Roles correctly assigned:
  - `administracion@ipupy.org.py` → `admin`
  - Other @ipupy.org.py → `secretary`

**Profile Count:**
- Total profiles after all tests: ___
- Expected profiles: ___ (1 admin + X test users)

### Users Table Checks

**Verification in Convex Dashboard → users table:**

- [ ] One user per profile (count matches profile count)
- [ ] All emails match corresponding profile emails
- [ ] Names populated (not null or empty)
- [ ] Email field is lowercase

**User Count:**
- Total users after all tests: ___
- Expected users: ___ (should match profile count)

### Index Verification

**Check in Convex Dashboard → Tables → profiles → Indexes:**
- [ ] `by_user_id` index exists
- [ ] `by_email` index exists
- [ ] Both indexes show as "Ready"

**Check in Convex Dashboard → Tables → users → Indexes:**
- [ ] Email index exists (from Convex Auth)
- [ ] Index shows as "Ready"

---

## Issues Discovered

### Critical Issues (Blockers)

**Issue 1:**
- **Title**: _______________
- **Scenario**: _______________
- **Description**: _______________
- **Impact**: [ ] Blocker / [ ] Major / [ ] Minor
- **Fix Required**: _______________

### Medium Issues (Non-Blockers)

**Issue 1:**
- **Title**: _______________
- **Scenario**: _______________
- **Description**: _______________
- **Impact**: [ ] Blocker / [ ] Major / [ ] Minor
- **Fix Required**: _______________

### Minor Issues (Cosmetic/UX)

**Issue 1:**
- **Title**: _______________
- **Scenario**: _______________
- **Description**: _______________
- **Impact**: [ ] Blocker / [ ] Major / [ ] Minor
- **Fix Required**: _______________

---

## Recommendations

### Code Changes Needed

1. _______________ (if any issues found)
2. _______________
3. _______________

### Documentation Updates

1. _______________ (e.g., update auth flow diagram)
2. _______________
3. _______________

### Follow-up Tests Required

1. _______________ (e.g., test with more concurrent users)
2. _______________
3. _______________

### Production Deployment Considerations

1. _______________ (e.g., update Google OAuth redirect URIs)
2. _______________
3. _______________

---

## Final Sign-Off

**Test Completion:**
- Tests completed: _____ / 8
- Tests passed: _____ / 8
- Tests failed: _____ / 8

**Critical Issues:**
- Count: _____
- All resolved: [ ] YES / [ ] NO

**Proceed to Next Task:**
- **T-462 (Verify role assignments)**: ⏳ PENDING / ✅ APPROVED / ❌ BLOCKED

**Tester Approval:**
- **Tester Name**: _______________
- **Date**: _______________
- **Signature**: _______________

**Notes:**
```
[Final comments, observations, or recommendations]
```

---

## Appendix: Test Environment Details

**System Information:**
- OS: _______________
- Browser: _______________
- Browser Version: _______________
- Node.js Version: _______________
- npm Version: _______________

**Convex Deployment:**
- Deployment Name: dashing-clownfish-472
- Deployment Type: Development
- Schema Version: _______________
- Last Deploy: _______________

**Next.js Application:**
- Version: 15.5.3
- Build: Development
- Port: 3000

**Test Accounts Used:**
- Admin: administracion@ipupy.org.py
- New User: _______________
- Invalid Domain: _______________

---

## Reference Documentation

- **Test Guide**: `docs/WS4_PHASE6_SMOKE_TEST_GUIDE.md`
- **Jest Tests**: `tests/unit/auth.test.ts`
- **Migration Guide**: `docs/WS4_MIGRATION_DRY_RUN_GUIDE.md`
- **Auth Mutation**: `convex/auth.ts`
- **Auth Provider**: `src/components/Auth/AuthProvider.tsx`
- **Schema**: `convex/schema.ts`
