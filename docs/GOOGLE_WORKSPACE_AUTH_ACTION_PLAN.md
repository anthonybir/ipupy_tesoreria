# Google Workspace Authentication - Action Plan

**Date**: 2025-10-05
**Status**: Ready for Implementation
**Priority**: Medium (Security Hardening)

---

## 📋 Quick Summary

The Google Workspace OAuth implementation is **functional and secure**, but has **2 medium-priority issues** that should be addressed:

1. **Obsolete role reference** in auth trigger ('member' role removed in migration 037)
2. **Overly permissive default role** (all @ipupy.org.py users get 'admin')

**Estimated Time**: 30 minutes total
**Risk Level**: Low (changes are backward-compatible)

---

## 🎯 Action Items

### ✅ Immediate Actions (Required)

#### 1. Apply Migration 041 - Fix Auth Trigger Role Assignment

**File**: `migrations/041_fix_auth_trigger_role_assignment.sql`

**Changes**:
- Replace obsolete 'member' role with 'secretary'
- Change default organizational role from 'admin' to 'secretary'
- Update function comment with migration history

**Steps**:
```bash
# 1. Review the migration
cat migrations/041_fix_auth_trigger_role_assignment.sql

# 2. Apply via Supabase dashboard
# - Go to SQL Editor
# - Paste migration content
# - Execute

# OR apply via migration script (if configured)
node scripts/migrate.js
```

**Verification**:
```sql
-- Check function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Should show 'secretary' instead of 'member' and 'admin'
```

**Impact**: 
- ✅ New users default to 'secretary' (lowest privilege)
- ✅ Admins can upgrade roles via user management
- ✅ No impact on existing users
- ✅ Fixes security best practice violation

**Time**: 5 minutes

---

#### 2. Update Documentation

**Files to Update**:
- `docs/SECURITY.md` - Add migration 041 to history
- `docs/MIGRATION_HISTORY.md` - Document migration 041
- `docs/USER_MANAGEMENT_GUIDE.md` - Update default role info

**Changes**:
```markdown
## Migration 041 (2025-10-05)
- Fixed obsolete 'member' role reference in auth trigger
- Changed default organizational role from 'admin' to 'secretary'
- Implements principle of least privilege
```

**Time**: 10 minutes

---

### 🔧 Recommended Improvements (Optional)

#### 3. Enable Supabase Domain Restriction

**Location**: Supabase Dashboard → Authentication → Providers → Google

**Steps**:
1. Go to Supabase Dashboard
2. Navigate to Authentication → Providers
3. Click on Google provider
4. Enable "Restrict to specific domain"
5. Enter domain: `ipupy.org.py`
6. Save changes

**Benefits**:
- Prevents non-organizational accounts from initiating OAuth
- Cleaner error handling (fails at Google, not in app)
- Defense in depth

**Time**: 5 minutes

---

#### 4. Add User Deactivation Feature

**Files to Create/Modify**:
- `src/app/api/admin/users/[id]/deactivate/route.ts` (new)
- `src/components/Admin/UserManagement.tsx` (modify)
- `src/middleware.ts` (add is_active check)

**Implementation**:
```typescript
// Middleware check
if (user && profile && !profile.is_active) {
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login?error=account_deactivated', request.url));
}
```

**Benefits**:
- Immediate access revocation
- No need to wait for session expiry
- Audit trail of deactivations

**Time**: 2 hours

---

#### 5. Enhance Error Handling

**Files to Modify**:
- `src/components/Auth/SupabaseAuth.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/auth-supabase.ts`

**Improvements**:
- User-friendly error messages
- Specific error codes for different failures
- Logging for security events

**Example**:
```typescript
// Better error messages
const ERROR_MESSAGES = {
  'invalid_domain': 'Solo usuarios con correo @ipupy.org.py pueden acceder',
  'account_deactivated': 'Tu cuenta ha sido desactivada. Contacta al administrador',
  'rate_limit': 'Demasiados intentos. Intenta nuevamente en 15 minutos',
};
```

**Time**: 1 hour

---

## 🧪 Testing Checklist

### Pre-Migration Testing

- [ ] Verify current auth flow works
- [ ] Test with admin account (administracion@ipupy.org.py)
- [ ] Test with regular organizational account
- [ ] Verify existing sessions remain valid

### Post-Migration Testing

#### Test 1: New User Registration (Secretary Role)
```
1. Create test user: test-user@ipupy.org.py
2. Sign in with Google
3. Verify profile created with role = 'secretary'
4. Verify can access dashboard
5. Verify cannot access admin features
```

**Expected**: ✅ User created with 'secretary' role

---

#### Test 2: Admin Account (Unchanged)
```
1. Sign in as administracion@ipupy.org.py
2. Verify role = 'admin'
3. Verify can access all features
```

**Expected**: ✅ Admin role unchanged

---

#### Test 3: Existing Users (Unchanged)
```
1. Sign in with existing user account
2. Verify role unchanged
3. Verify permissions unchanged
```

**Expected**: ✅ No impact on existing users

---

#### Test 4: Role Upgrade Flow
```
1. Admin signs in
2. Navigate to User Management
3. Find test-user@ipupy.org.py
4. Upgrade role to 'treasurer'
5. Test user signs out and back in
6. Verify new role applied
```

**Expected**: ✅ Role upgrade works correctly

---

#### Test 5: Domain Restriction (Unchanged)
```
1. Attempt sign in with personal Gmail
2. Verify rejected at runtime
3. Verify session invalidated
```

**Expected**: ✅ Domain restriction still enforced

---

## 📊 Rollback Plan

If migration 041 causes issues:

### Rollback Steps

```sql
-- Rollback to migration 035 version
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    existing_profile_id UUID;
    user_full_name TEXT;
    user_avatar TEXT;
BEGIN
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  user_avatar := NEW.raw_user_meta_data->>'avatar_url';

  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
    AND (is_authenticated = false OR is_authenticated IS NULL)
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      id = NEW.id,
      full_name = COALESCE(full_name, user_full_name),
      avatar_url = COALESCE(avatar_url, user_avatar),
      is_authenticated = true,
      last_seen_at = now(),
      updated_at = now()
    WHERE id = existing_profile_id;
  ELSE
    INSERT INTO public.profiles (
      id, email, full_name, avatar_url, role,
      is_authenticated, last_seen_at, onboarding_step
    )
    VALUES (
      NEW.id,
      NEW.email,
      user_full_name,
      user_avatar,
      CASE
        WHEN NEW.email IN ('administracion@ipupy.org.py', 'tesoreria@ipupy.org.py') THEN 'admin'
        WHEN NEW.email LIKE '%@ipupy.org.py' THEN 'admin'  -- Reverted
        ELSE 'member'  -- Reverted (still obsolete, but matches migration 035)
      END,
      true,
      now(),
      0
    );
  END IF;

  RETURN NEW;
END;
$$;
```

**Note**: Rollback is unlikely to be needed as changes are backward-compatible.

---

## 📈 Success Metrics

### Immediate (Post-Migration)

- [ ] Migration 041 applied successfully
- [ ] No errors in Supabase logs
- [ ] Existing users can still log in
- [ ] New users get 'secretary' role by default

### Short-Term (1 week)

- [ ] No authentication-related issues reported
- [ ] Admin successfully upgrades user roles
- [ ] All edge cases handled correctly

### Long-Term (1 month)

- [ ] User deactivation feature implemented (optional)
- [ ] Enhanced error handling deployed (optional)
- [ ] Supabase domain restriction enabled (optional)

---

## 🔍 Monitoring

### What to Monitor

1. **Supabase Auth Logs**
   - Failed login attempts
   - Domain restriction violations
   - Rate limit hits

2. **Application Logs**
   - Auth context creation failures
   - Profile sync errors
   - Session validation issues

3. **User Reports**
   - Login difficulties
   - Permission issues
   - Unexpected role assignments

### Alert Thresholds

- **Critical**: >5 auth failures per minute
- **Warning**: >10 domain restriction violations per hour
- **Info**: New user registrations

---

## 📞 Support

### If Issues Arise

1. **Check Supabase Logs**
   - Dashboard → Logs → Auth
   - Look for errors in handle_new_user function

2. **Verify Migration Applied**
   ```sql
   SELECT pg_get_functiondef(oid)
   FROM pg_proc
   WHERE proname = 'handle_new_user';
   ```

3. **Test with Known Good Account**
   - Use administracion@ipupy.org.py
   - Verify admin access works

4. **Rollback if Necessary**
   - Use rollback SQL above
   - Document issue for investigation

### Contact

- **Technical Lead**: administracion@ipupy.org.py
- **Supabase Support**: https://supabase.com/support
- **Documentation**: `docs/GOOGLE_WORKSPACE_AUTH_REVIEW.md`

---

## ✅ Completion Checklist

### Pre-Implementation
- [ ] Review migration 041 SQL
- [ ] Review action plan
- [ ] Backup current database (Supabase auto-backups)
- [ ] Notify team of planned changes

### Implementation
- [ ] Apply migration 041
- [ ] Verify function updated
- [ ] Update documentation
- [ ] Test new user registration
- [ ] Test existing user login
- [ ] Test admin functionality

### Post-Implementation
- [ ] Monitor logs for 24 hours
- [ ] Verify no user complaints
- [ ] Update MIGRATION_HISTORY.md
- [ ] Mark action plan as complete

---

## 📚 Related Documentation

- **Review Report**: `docs/GOOGLE_WORKSPACE_AUTH_REVIEW.md`
- **Migration File**: `migrations/041_fix_auth_trigger_role_assignment.sql`
- **Security Guide**: `docs/SECURITY.md`
- **User Management**: `docs/USER_MANAGEMENT_GUIDE.md`
- **Migration History**: `docs/MIGRATION_HISTORY.md`

---

**Status**: Ready for implementation
**Next Action**: Apply migration 041
**Estimated Completion**: 30 minutes

