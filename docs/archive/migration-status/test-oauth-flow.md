# Testing OAuth User Creation Flow

## Test Checklist

### 1. Test New User Registration
- [ ] Navigate to http://localhost:3000/login
- [ ] Click "Sign in with Google"
- [ ] Complete Google OAuth flow
- [ ] Verify redirect to dashboard

### 2. Verify Database Records
Run these queries in Supabase SQL Editor:

```sql
-- Check if user was created in auth.users
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Check if profile was created
SELECT id, email, role, is_authenticated, migration_notes
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- Verify the trigger worked
SELECT
    au.email as auth_email,
    p.email as profile_email,
    p.role,
    p.is_authenticated,
    p.church_id
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
ORDER BY au.created_at DESC
LIMIT 5;
```

### 3. Test Admin Email Detection
- [ ] Sign in with an email ending in @ipupy.org
- [ ] Verify the profile gets 'admin' role

### 4. Test Regular User
- [ ] Sign in with any other Google account
- [ ] Verify the profile gets 'viewer' role

### 5. Test Returning User
- [ ] Sign out
- [ ] Sign in again with same account
- [ ] Verify no duplicate profiles are created

### 6. Test Legacy User Activation
For existing users in the system:
- [ ] Have them sign in with Google using their registered email
- [ ] Verify their existing profile is linked to auth.users
- [ ] Check that is_authenticated becomes true

## Current Status

### ✅ Completed
1. Created `public.profiles` table
2. Created trigger `on_auth_user_created` to sync users
3. Migrated 2 legacy users to profiles table
4. Updated application code to use profiles instead of users
5. Fixed trigger to handle both new and legacy users

### How It Works

When a user signs in with Google OAuth:

1. **New User Flow**:
   - Supabase creates entry in `auth.users`
   - Trigger fires and creates profile with default role
   - Admin emails (@ipupy.org) get 'admin' role
   - Others get 'viewer' role

2. **Legacy User Flow**:
   - User signs in with email matching existing profile
   - Trigger updates existing profile to link with auth.users
   - Sets is_authenticated = true
   - Preserves existing role and church_id

3. **Returning User Flow**:
   - User already in auth.users
   - Profile already exists and linked
   - No changes needed

## Notes
- Legacy users (2 existing) need to sign in with Google to activate
- Profile data (role, church_id) is preserved during activation
- New users get automatic role assignment based on email domain