# Supabase Auth Migration Plan

## Current State Analysis ✅

### What We Found:
1. **No profiles table in codebase** - Only exists in Supabase console (manually created)
2. **Legacy JWT auth still active** - All API routes use `verifyBearerToken`
3. **Mixed auth systems** - Supabase for login, JWT for API calls
4. **No database sync** - `auth.users` not connected to `public.users`

## Migration Steps Required

### Phase 1: Database Migration ✅ DONE
- [x] Created migration file `016_create_profiles_and_auth_sync.sql`
- [x] Defines `profiles` table with proper structure
- [x] Creates trigger to sync `auth.users` → `profiles`
- [x] Migrates existing users from `public.users`
- [x] Sets up RLS policies

### Phase 2: Remove Legacy Auth Code 🔄 IN PROGRESS
- [x] Updated `auth-context.ts` to use Supabase only
- [x] Created new `auth-supabase.ts` with clean implementation
- [ ] Update all API routes:
  - [ ] `/api/dashboard` - Remove JWT, use Supabase
  - [ ] `/api/reports` - Remove JWT, use Supabase
  - [ ] `/api/churches` - Remove JWT, use Supabase
- [ ] Delete legacy files:
  - [ ] `src/lib/auth.ts` (JWT-based)
  - [ ] `src/lib/jwt.ts` (JWT utilities)

### Phase 3: Update API Routes
Each route needs these changes:
```typescript
// OLD (JWT-based)
const payload = verifyBearerToken(request.headers.get('authorization'));

// NEW (Supabase-based)
import { getAuthContext } from '@/lib/auth-context';
const authContext = await getAuthContext(request);
if (!authContext) {
  return jsonError(401, 'Autenticación requerida', origin);
}
```

### Phase 4: Run Database Migration
```bash
# Apply the migration to create profiles table and trigger
npx supabase db push migrations/016_create_profiles_and_auth_sync.sql
```

### Phase 5: Testing Checklist
- [ ] New user signs in → profile created automatically
- [ ] Admin email (@ipupy.org.py) → gets admin role
- [ ] Regular user → gets viewer role
- [ ] API calls work with Supabase session
- [ ] Legacy users can activate via Google sign-in

## Files to Update

### API Routes to Modify:
1. `/src/app/api/dashboard/route.ts`
2. `/src/app/api/reports/route.ts`
3. `/src/app/api/churches/route.ts`

### Files to Delete:
1. `/src/lib/auth.ts` (legacy JWT auth)
2. `/src/lib/jwt.ts` (JWT utilities)

### Files Already Updated:
1. ✅ `/src/lib/auth-context.ts` - Now uses Supabase only
2. ✅ `/src/lib/supabase/server.ts` - Has getUserProfile function
3. ✅ `/src/app/page.tsx` - Uses getUserProfile
4. ✅ `/src/middleware.ts` - Checks Supabase auth

## Migration Script

```sql
-- Run this in Supabase SQL Editor to apply migration
-- (or use the migration file with Supabase CLI)

-- The migration will:
-- 1. Create profiles table
-- 2. Set up auth trigger
-- 3. Migrate existing users
-- 4. Create RLS policies

-- Check current state:
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'legacy users', COUNT(*) FROM public.users;
```

## Critical Notes

### ⚠️ Breaking Changes:
1. **API Authentication** - All API calls must use Supabase session, not JWT
2. **User IDs** - Changed from integer to UUID
3. **Role System** - Now stored in profiles, not users table

### 🔒 Security:
- RLS enabled on profiles table
- Only admins can modify other profiles
- Users can only view their own profile
- Auth trigger runs with SECURITY DEFINER

### 📝 Legacy User Activation:
- 2 existing users need to sign in with Google
- Their profiles will be linked automatically
- Roles and church assignments preserved

## Next Immediate Actions

1. **Update API routes** - Remove JWT, use getAuthContext
2. **Run migration** - Apply 016_create_profiles_and_auth_sync.sql
3. **Test auth flow** - Sign in with administracion@ipupy.org.py
4. **Delete legacy code** - Remove JWT files once confirmed working