# Google Workspace Authentication - Complete File Inventory

**Date**: 2025-10-05
**Purpose**: Comprehensive list of all files involved in Google Workspace OAuth authentication

---

## 🎯 Core Authentication Files

### Frontend Components

| File | Purpose | Lines | Critical? |
|------|---------|-------|-----------|
| `src/components/Auth/SupabaseAuth.tsx` | Login UI with Google OAuth button | 128 | ✅ Yes |
| `src/app/login/page.tsx` | Login page wrapper | ~50 | ✅ Yes |

**Key Functions**:
- `handleGoogleLogin()` - Initiates OAuth flow
- `signInWithOAuth()` - Supabase client method

---

### API Routes

| File | Purpose | Lines | Critical? |
|------|---------|-------|-----------|
| `src/app/auth/callback/route.ts` | OAuth callback handler | 23 | ✅ Yes |
| `src/app/api/admin/users/route.ts` | User management API | 776 | ⚠️ Related |

**Key Functions**:
- `GET()` - Handles OAuth callback
- `exchangeCodeForSession()` - Converts code to session
- Rate limiting via `withRateLimit()`

---

### Supabase Client Libraries

| File | Purpose | Lines | Critical? |
|------|---------|-------|-----------|
| `src/lib/supabase/client.ts` | Browser Supabase client | 8 | ✅ Yes |
| `src/lib/supabase/server.ts` | Server Supabase client | 61 | ✅ Yes |
| `src/lib/supabase/middleware.ts` | Session update middleware | 61 | ✅ Yes |

**Key Functions**:
- `createClient()` - Creates Supabase client instance
- `updateSession()` - Refreshes user session
- `getUser()` - Retrieves authenticated user

---

### Authentication Context

| File | Purpose | Lines | Critical? |
|------|---------|-------|-----------|
| `src/lib/auth-supabase.ts` | Auth context provider | 174 | ✅ Yes |
| `src/lib/auth-context.ts` | Auth context types | ~50 | ✅ Yes |

**Key Functions**:
- `getAuthContext()` - Gets auth from Supabase session
- `getAuthFromCookies()` - Server-side auth retrieval
- Domain validation (`@ipupy.org.py`)
- `isSystemOwner()` - Admin check
- `canAccessChurch()` - Permission check

---

### Middleware & Route Protection

| File | Purpose | Lines | Critical? |
|------|---------|-------|-----------|
| `src/middleware.ts` | Global route protection | 65 | ✅ Yes |

**Key Functions**:
- `middleware()` - Runs on every request
- Session validation
- Public route bypass
- Redirect to login if unauthenticated

**Protected Routes**: All except:
- `/login`
- `/auth/callback`
- `/api/auth/callback`

---

## 🗄️ Database Layer

### Migrations

| File | Purpose | Status | Critical? |
|------|---------|--------|-----------|
| `migrations/016_create_profiles_and_auth_sync.sql` | Initial profile sync trigger | ✅ Applied | ✅ Yes |
| `migrations/017_enhance_profiles.sql` | Enhanced profile fields | ✅ Applied | ✅ Yes |
| `migrations/023_simplify_roles.sql` | Role simplification | ✅ Applied | ✅ Yes |
| `migrations/035_fix_domain_validation.sql` | Domain validation fix | ✅ Applied | ✅ Yes |
| `migrations/041_fix_auth_trigger_role_assignment.sql` | **NEW** - Fix obsolete roles | ⏳ Pending | ✅ Yes |

---

### Database Functions

| Function | Purpose | Trigger | Critical? |
|----------|---------|---------|-----------|
| `handle_new_user()` | Profile creation/sync | `on_auth_user_created` | ✅ Yes |

**Trigger Details**:
- **Event**: AFTER INSERT on `auth.users`
- **Timing**: For each row
- **Security**: SECURITY DEFINER (elevated privileges)

**Function Logic**:
1. Extract metadata from `raw_user_meta_data`
2. Check for existing profile (legacy user)
3. Update existing or create new profile
4. Assign role based on email domain
5. Set `is_authenticated = true`

---

### Database Tables

| Table | Purpose | Critical? |
|-------|---------|-----------|
| `auth.users` | Supabase managed auth | ✅ Yes |
| `public.profiles` | Application user data | ✅ Yes |

**Profiles Table Schema**:
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,                    -- Links to auth.users.id
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL,                     -- ProfileRole type
  church_id INTEGER REFERENCES churches,
  phone TEXT,
  permissions JSONB DEFAULT '{}',
  preferred_language TEXT DEFAULT 'es',
  is_authenticated BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  profile_completed_at TIMESTAMPTZ,
  onboarding_step INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## ⚙️ Configuration Files

### Environment Variables

| File | Purpose | Critical? |
|------|---------|-----------|
| `.env.example` | Environment template | ✅ Yes |
| `src/lib/env-validation.ts` | Environment validation | ✅ Yes |

**Required Variables**:
```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Database (Required for Vercel)
DATABASE_URL=postgresql://xxx

# Google OAuth (Optional but recommended)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Site URL (Auto-set on Vercel)
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

---

### Utility Files

| File | Purpose | Critical? |
|------|---------|-----------|
| `src/lib/utils/site-url.ts` | Site URL detection | ⚠️ Related |
| `src/lib/rate-limit.ts` | Rate limiting | ✅ Yes |
| `src/lib/logger.ts` | Logging utility | ⚠️ Related |

---

## 📚 Documentation Files

### Primary Documentation

| File | Purpose | Status |
|------|---------|--------|
| `docs/GOOGLE_WORKSPACE_AUTH_REVIEW.md` | **NEW** - Comprehensive review | ✅ Complete |
| `docs/GOOGLE_WORKSPACE_AUTH_ACTION_PLAN.md` | **NEW** - Implementation plan | ✅ Complete |
| `docs/GOOGLE_WORKSPACE_AUTH_FILE_INVENTORY.md` | **NEW** - This file | ✅ Complete |

---

### Related Documentation

| File | Purpose | Relevance |
|------|---------|-----------|
| `docs/SECURITY.md` | Security documentation | High |
| `docs/USER_MANAGEMENT_GUIDE.md` | User management | High |
| `docs/QUICK_START.md` | Setup guide | Medium |
| `docs/MIGRATION_HISTORY.md` | Migration tracking | High |
| `docs/archive/migration-status/SUPABASE_AUTH_COMPLETE.md` | Auth migration | Medium |
| `docs/archive/migration-status/SUPABASE_AUTH_MIGRATION_PLAN.md` | Migration plan | Low |

---

## 🧪 Testing Files

| File | Purpose | Status |
|------|---------|--------|
| `test-auth.js` | Auth connection test | ✅ Working |
| `docs/SECURITY_TESTING.md` | Security test guide | ✅ Complete |
| `docs/TESTING.md` | General testing guide | ✅ Complete |

---

## 🔍 Code Search Patterns

### Find All Auth-Related Code

```bash
# Find OAuth references
grep -r "signInWithOAuth" src/ --include="*.ts" --include="*.tsx"

# Find domain validation
grep -r "@ipupy.org.py" src/ --include="*.ts" --include="*.tsx"

# Find auth context usage
grep -r "getAuthContext\|getAuthFromCookies" src/ --include="*.ts"

# Find Supabase client usage
grep -r "createClient()" src/ --include="*.ts" --include="*.tsx"

# Find session management
grep -r "updateSession\|getUser\|getSession" src/ --include="*.ts"
```

---

## 📊 File Statistics

### By Category

| Category | Files | Total Lines | Critical Files |
|----------|-------|-------------|----------------|
| Frontend Components | 2 | ~178 | 2 |
| API Routes | 2 | ~799 | 1 |
| Supabase Clients | 3 | ~130 | 3 |
| Auth Context | 2 | ~224 | 2 |
| Middleware | 1 | 65 | 1 |
| Migrations | 5 | ~400 | 5 |
| Configuration | 2 | ~300 | 2 |
| Documentation | 9 | ~2000 | 3 |
| **TOTAL** | **26** | **~4096** | **19** |

---

## 🔗 Dependency Graph

```
User Login Flow:
  SupabaseAuth.tsx
    ↓ uses
  supabase/client.ts
    ↓ calls
  Supabase Auth API
    ↓ redirects to
  Google OAuth
    ↓ returns to
  auth/callback/route.ts
    ↓ uses
  supabase/server.ts
    ↓ creates
  auth.users (Supabase)
    ↓ triggers
  handle_new_user() (Database)
    ↓ creates/updates
  profiles (Database)
    ↓ read by
  middleware.ts
    ↓ uses
  supabase/middleware.ts
    ↓ validates
  auth-supabase.ts
    ↓ creates
  AuthContext
    ↓ used by
  All Protected Routes
```

---

## 🎯 Critical Path Files

**If these files fail, authentication breaks**:

1. `src/lib/supabase/client.ts` - Browser auth
2. `src/lib/supabase/server.ts` - Server auth
3. `src/app/auth/callback/route.ts` - OAuth callback
4. `src/middleware.ts` - Route protection
5. `migrations/035_fix_domain_validation.sql` - Profile sync
6. `src/lib/auth-supabase.ts` - Auth context

---

## 📝 Maintenance Checklist

### When Adding New Auth Features

- [ ] Update `src/lib/auth-supabase.ts` if changing auth context
- [ ] Update `src/middleware.ts` if changing route protection
- [ ] Update `handle_new_user()` if changing profile creation
- [ ] Update documentation in `docs/SECURITY.md`
- [ ] Add tests in `docs/SECURITY_TESTING.md`

### When Changing Role System

- [ ] Update `handle_new_user()` role assignment logic
- [ ] Update `src/lib/authz.ts` role definitions
- [ ] Create migration to update existing profiles
- [ ] Update `docs/ROLES_AND_PERMISSIONS.md`
- [ ] Test with all role types

### When Updating Supabase

- [ ] Test auth flow after Supabase updates
- [ ] Verify session management still works
- [ ] Check for breaking changes in Supabase SDK
- [ ] Update `package.json` dependencies
- [ ] Run full test suite

---

## 🔐 Security-Critical Files

**These files enforce security policies**:

1. `src/lib/auth-supabase.ts:36-50` - Domain validation
2. `migrations/035_fix_domain_validation.sql:59-66` - Role assignment
3. `src/middleware.ts:41-55` - Route protection
4. `src/app/auth/callback/route.ts:10-11` - Rate limiting
5. `src/lib/supabase/middleware.ts:36-37` - Session validation

**Review these files carefully before making changes!**

---

## 📞 Support

For questions about specific files:
- **Auth Flow**: See `docs/GOOGLE_WORKSPACE_AUTH_REVIEW.md`
- **Implementation**: See `docs/GOOGLE_WORKSPACE_AUTH_ACTION_PLAN.md`
- **Security**: See `docs/SECURITY.md`
- **Troubleshooting**: See `docs/QUICK_START.md`

---

**Last Updated**: 2025-10-05
**Maintained By**: Technical Team
**Review Frequency**: After each auth-related change

