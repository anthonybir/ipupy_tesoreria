# WS-2 Phase 6 – Smoke Test Results

**Test Date:** October 10, 2025  
**Tester:** Anthony Bir  
**Environment:** Local Development  
**Convex Deployment:** Dev  

## Summary

| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| Priority 1 (Permissions) | 3 | 0 | 0 | 0 |
| Priority 2 (Admin UI) | 2 | 0 | 0 | 0 |
| Priority 3 (Auto-Provision) | 1 | 0 | 0 | 0 |
| **TOTAL** | **6** | **0** | **0** | **0** |

**Overall Status:** 🟡 IN PROGRESS

---

## Test Results

### T6-004: Treasurer Approves Report

**Date:** _Not yet tested_  
**Result:** ⏳ PENDING

**Steps Executed:**
- [ ] Created test report as pastor
- [ ] Signed in as treasurer
- [ ] Attempted approval

**Expected:** Approval succeeds with success toast  
**Actual:** _TBD_

**Issues:** None yet

**Screenshots:** _TBD_

---

### T6-005: Pastor CANNOT Approve Report

**Date:** _Not yet tested_  
**Result:** ⏳ PENDING

**Steps Executed:**
- [ ] Signed in as pastor
- [ ] Attempted to approve report
- [ ] Verified error message

**Expected:** Permission denied error  
**Actual:** _TBD_

**Issues:** None yet

**Screenshots:** _TBD_

---

### T6-006: Pastor Creates Report

**Date:** _Not yet tested_  
**Result:** ⏳ PENDING

**Steps Executed:**
- [ ] Signed in as pastor
- [ ] Created new report
- [ ] Verified submission

**Expected:** Report created with "Enviado" status  
**Actual:** _TBD_

**Issues:** None yet

**Screenshots:** _TBD_

---

### T6-002: Admin Assigns Role

**Date:** _Not yet tested_  
**Result:** ⏳ PENDING

**Steps Executed:**
- [ ] Signed in as admin
- [ ] Navigated to /admin/users
- [ ] Changed user role
- [ ] Verified in Convex dashboard

**Expected:** Role changes immediately with success toast  
**Actual:** _TBD_

**Issues:** None yet

**Screenshots:** _TBD_

---

### T6-003: Admin Deactivates/Reactivates User

**Date:** _Not yet tested_  
**Result:** ⏳ PENDING

**Steps Executed:**
- [ ] Deactivated user
- [ ] Verified status change
- [ ] Reactivated user
- [ ] Verified role preserved

**Expected:** Status toggles, role preserved  
**Actual:** _TBD_

**Issues:** None yet

**Screenshots:** _TBD_

---

### T6-011: New User Auto-Provisioning

**Date:** _Not yet tested_  
**Result:** ⏳ PENDING

**Steps Executed:**
- [ ] Created new test account
- [ ] Signed in for first time
- [ ] Verified profile creation
- [ ] Checked default role

**Expected:** Profile created with secretary role  
**Actual:** _TBD_

**Issues:** None yet

**Screenshots:** _TBD_

---

## Issues Found

### Blocker Issues
_None yet_

### High Priority Issues
_None yet_

### Medium Priority Issues
_None yet_

### Low Priority Issues
_None yet_

---

## Environment Details

**System:**
- macOS Darwin 25.0.0
- Node.js: _[version]_
- Next.js: 15.x
- Convex: _[version]_

**Configuration:**
- Convex URL: `[dev deployment URL]`
- Auth Provider: NextAuth + Google OAuth
- Domain: @ipupy.org.py

**Pre-Test Validation:**
```bash
$ npm run typecheck
# Result: TBD

$ npm run lint  
# Result: TBD
```

---

## Notes

### Test Setup Issues
_Document any issues encountered during setup_

### Observations
_Any unexpected behavior or notes during testing_

### Recommendations
_Suggestions for improvement based on testing_

---

## Sign-Off

**Tested By:** ________________  
**Date:** ________________

**Approved By:** ________________  
**Date:** ________________

**Ready for WS-4:** ☐ YES  ☐ NO  

**Reason if NO:** ________________
