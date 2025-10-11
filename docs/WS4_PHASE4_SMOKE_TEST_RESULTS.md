# WS-4 Phase 4 Smoke Test Results
**Test Suite:** Convex Auth Profile Auto-Provisioning (T-446)
**Date:** October 10, 2025
**Tester:** _[Fill in your name]_
**Environment:** Development (localhost:3000)
**Convex Deployment:** _[Fill in deployment name]_

---

## Executive Summary

**Overall Status**: ⏳ IN PROGRESS / ✅ PASSED / ❌ FAILED

**Tests Passed**: ___ / 6
**Tests Failed**: ___ / 6
**Critical Issues**: ___ (list any blockers)

**Proceed to T-451/T-452?**: ⏳ PENDING / ✅ YES / ❌ NO (needs fixes)

---

## Environment Verification

- [x] Convex dev server running: `npx convex dev`
- [x] Next.js dev server running: `npm run dev`
- [x] Convex dashboard accessible
- [x] Google OAuth configured in Convex
- [x] Test accounts prepared

---

## Test Results

### ✅ Scenario 1: New User First Sign-In
**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `_______________@ipupy.org.py`

**Results**:
- Profile created: [ ] YES / [ ] NO
- Profile ID: `_______________`
- Role assigned: `_______________` (expected: `secretary`)
- User ID format: [ ] Convex ID / [ ] Email string
- Active status: [ ] true / [ ] false
- Console errors: [ ] NONE / [ ] YES (describe below)

**Convex Dashboard Verification**:
```
profiles table:
- _id: _______________
- user_id: _______________
- email: _______________
- role: _______________
- active: _______________
- created_at: _______________

users table:
- _id: _______________
- email: _______________
- name: _______________
```

**Screenshots**: _[Link or filename]_

**Notes**:
```
[Add any observations, unexpected behavior, or additional context]
```

---

### ✅ Scenario 2: Admin Email Sign-In
**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `administracion@ipupy.org.py`

**Results**:
- Admin role assigned: [ ] YES / [ ] NO
- Admin UI accessible (`/admin/users`): [ ] YES / [ ] NO
- User ID is Convex ID: [ ] YES / [ ] NO
- Console errors: [ ] NONE / [ ] YES

**Convex Dashboard Verification**:
```
profiles table:
- role: _______________  (expected: "admin")
```

**Admin UI Verification**:
- Can access `/admin/users`: [ ] YES / [ ] NO
- User list loads: [ ] YES / [ ] NO
- Can create/edit users: [ ] YES / [ ] NO

**Screenshots**: _[Link or filename]_

**Notes**:
```
[Add any observations]
```

---

### ✅ Scenario 3: Profile Reactivation
**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Pre-Test State**: Set `active: false` in profiles table
**Test Account**: `_______________@ipupy.org.py`

**Results**:
- Profile reactivated: [ ] YES / [ ] NO
- Active status after sign-in: [ ] true / [ ] false
- Duplicate profile created: [ ] YES / [ ] NO
- Console log showed reactivation: [ ] YES / [ ] NO
- `reactivated` flag in mutation result: [ ] true / [ ] false

**Convex Dashboard Verification**:
```
Before test:
- active: false

After test:
- active: _______________
- updated_at: _______________ (should change)
- Profile count: ___ (should stay same)
```

**Console Output**:
```
Expected: [Auth] ensureProfile: updated <email> (reactivated=true, ...)
Actual: _______________
```

**Screenshots**: _[Link or filename]_

**Notes**:
```
[Add any observations]
```

---

### ✅ Scenario 4: Name/Email Sync from OAuth Provider
**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Pre-Test Setup**: Changed Google account name to "New Test Name"
**Test Account**: `_______________@ipupy.org.py`

**Results**:
- `users` table `name` updated: [ ] YES / [ ] NO
- Old name: `_______________`
- New name: `_______________`
- Console log showed update: [ ] YES / [ ] NO
- `userNameUpdated` flag: [ ] true / [ ] false

**Convex Dashboard Verification**:
```
users table before:
- name: _______________

users table after:
- name: _______________
```

**Console Output**:
```
Expected: [Auth] ensureProfile: updated <email> (..., userNameUpdated=true)
Actual: _______________
```

**Screenshots**: _[Link or filename]_

**Notes**:
```
[Add any observations]
```

---

### ✅ Scenario 5: Invalid Domain Rejection
**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `_______________@gmail.com` (or other non-ipupy.org.py)

**Results**:
- Sign-in blocked: [ ] YES / [ ] NO
- Error message shown: `_______________`
- Expected: "Email domain not allowed"
- Profile created in Convex: [ ] YES (FAIL) / [ ] NO (PASS)
- User created in Convex: [ ] YES (FAIL) / [ ] NO (PASS)

**Convex Dashboard Verification**:
```
profiles table:
- Count for invalid email: ___ (expected: 0)

users table:
- Count for invalid email: ___ (expected: 0)
```

**Console Output**:
```
Expected: Error: Email domain not allowed
Actual: _______________
```

**Screenshots**: _[Link or filename]_

**Notes**:
```
[Add any observations]
```

---

### ✅ Scenario 6: Race Condition Check (Concurrent Tabs)
**Status**: ⏳ NOT STARTED / ✅ PASS / ❌ FAIL

**Test Account**: `_______________@ipupy.org.py`

**Setup**:
- Tab 1: Sign-in initiated at `___:___:___ AM/PM`
- Tab 2: Sign-in initiated at `___:___:___ AM/PM`

**Results**:
- Profiles created: ___ (expected: 1)
- Both tabs work correctly: [ ] YES / [ ] NO
- Console errors: [ ] NONE / [ ] YES
- `hasTriggeredEnsure` flag worked: [ ] YES / [ ] NO

**Convex Dashboard Verification**:
```
profiles table:
- Count for test email: ___ (expected: 1)
- Profile _id: _______________
- _creationTime: _______________
```

**Tab 1 Console**:
```
[Paste relevant logs]
```

**Tab 2 Console**:
```
[Paste relevant logs]
```

**Screenshots**: _[Link or filename]_

**Notes**:
```
[Add any observations about timing, errors, or race conditions]
```

---

## Issues Discovered

### Critical Issues (Blockers)
1. _[None found / Describe issue]_

### Medium Issues (Non-Blockers)
1. _[None found / Describe issue]_

### Minor Issues (Cosmetic)
1. _[None found / Describe issue]_

---

## Performance Observations

**ensureProfile Mutation Time**:
- Average: ___ ms
- Min: ___ ms
- Max: ___ ms

**Profile Query Load Time**:
- Average: ___ ms

**Overall Sign-in Experience**:
- Fast (< 1s): [ ]
- Acceptable (1-3s): [ ]
- Slow (> 3s): [ ]

---

## Recommendations

### Code Changes Needed
1. _[None / List required fixes]_

### Documentation Updates
1. _[None / List docs to update]_

### Follow-up Tests
1. _[None / List additional tests needed]_

---

## Sign-Off

**Tester Approval**: ⏳ PENDING / ✅ APPROVED / ❌ REJECTED

**Ready for T-451/T-452**: ⏳ PENDING / ✅ YES / ❌ NO

**Tester Signature**: _______________
**Date**: _______________

**Notes**:
```
[Final comments or observations]
```
