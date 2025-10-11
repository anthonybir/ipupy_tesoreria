# Convex Auth Migration Rollback Procedure

**Date**: 2025-10-09
**Migration**: Convex Auth (`@convex-dev/auth`) replacing NextAuth v5 with OIDC Bridge
**Task Reference**: WS-4 Phase 6 (T-461 through T-464)

---

## ⚠️ When to Use This Document

Use this rollback procedure if:
- Convex Auth integration has critical production issues
- Google OAuth flow is failing consistently
- Profile auto-provisioning is creating incorrect data
- Domain restriction is not working
- Admin cannot authenticate

**DO NOT rollback** for minor issues that can be fixed forward.

---

## Pre-Rollback Checklist

Before initiating rollback:

1. **Document the Issue**
   - Capture error messages from browser console
   - Export logs from Convex dashboard
   - Note affected users and their emails
   - Record any data corruption

2. **Verify Issue is Critical**
   - Can the issue be fixed with configuration changes?
   - Is this affecting all users or just a subset?
   - Can we temporarily disable the feature?

3. **Backup Current State**
   ```bash
   # Export current Convex data
   npx convex export --path backup-$(date +%Y%m%d).zip

   # Document current commit
   git log -1 --oneline > rollback-from.txt
   ```

---

## Rollback Steps

### Step 1: Revert Code to Pre-Migration State

**Target Commit**: `e4310a4` - "feat(auth): WS-2 Phase 2 - Auto-provision user profiles on sign-in"

This commit contains the working NextAuth v5 + Convex OIDC bridge setup.

```bash
# Create rollback branch
git checkout -b rollback-convex-auth-$(date +%Y%m%d)

# Revert to pre-Convex Auth state
git revert --no-commit HEAD~5..HEAD  # Adjust count as needed

# Or hard reset (destroys uncommitted work!)
git reset --hard e4310a4

# Review changes
git status
git diff main
```

### Step 2: Restore Environment Variables

**Vercel Production**:
```bash
# Add back NextAuth variables
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production

# Remove if they were removed during migration
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
```

**Local Development**:
```bash
# Restore .env.local with NextAuth config
cat > .env.local <<EOF
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

NEXTAUTH_SECRET=<your-secret>
NEXTAUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME=IPU PY
EOF
```

### Step 3: Restore Convex Configuration

**In Convex Dashboard** (https://dashboard.convex.dev):

1. Go to **Settings** > **Environment Variables**
2. Remove Convex Auth variables (if any were added)
3. Go to **Auth** > **Providers**
4. Disable Google OAuth provider (if Convex Auth was fully configured)
5. Ensure OIDC bridge is enabled:
   - Auth > OIDC
   - Issuer URL: Your NextAuth deployment URL
   - Audience: Your application

### Step 4: Restore Dependencies

```bash
# Restore NextAuth v5 (if removed)
npm install next-auth@5

# Remove Convex Auth (if added)
npm uninstall @convex-dev/auth

# Reinstall dependencies
npm install
```

### Step 5: Database State

**⚠️ IMPORTANT**: The Convex Auth migration does NOT modify the database schema. All profile data remains intact.

**Check for data issues**:
```bash
# Start Convex dev
npx convex dev

# In Convex dashboard, query profiles table
# Verify no profiles were created with incorrect data
```

**If data corruption occurred**:
```javascript
// In Convex dashboard functions console
// Reset affected profiles (admin only!)
import { mutation } from "./_generated/server";

export default mutation(async ({ db }) => {
  // Find profiles created during migration window
  const profiles = await db.query("profiles")
    .filter(q => q.gte(q.field("created_at"), <migration-start-timestamp>))
    .collect();

  console.log(`Found ${profiles.length} profiles created during migration`);

  // Manual review required - DO NOT auto-delete
  return profiles.map(p => ({ email: p.email, created_at: p.created_at }));
});
```

### Step 6: Restore Source Files

**Key files to restore from commit `e4310a4`**:

```bash
# Auth configuration
git checkout e4310a4 -- src/lib/auth.ts

# Auth provider component
git checkout e4310a4 -- src/components/Auth/

# Login page
git checkout e4310a4 -- src/app/login/page.tsx

# Providers
git checkout e4310a4 -- src/app/providers.tsx

# API routes
git checkout e4310a4 -- src/app/api/auth/

# Middleware
git checkout e4310a4 -- src/middleware.ts

# Convex auth config
git checkout e4310a4 -- convex/auth.config.ts
git checkout e4310a4 -- convex/auth.ts  # If it existed

# Package dependencies
git checkout e4310a4 -- package.json package-lock.json
npm install
```

### Step 7: Test Rollback Locally

```bash
# Terminal 1: Start Convex
npx convex dev

# Terminal 2: Start Next.js
npm run dev

# Open browser to http://localhost:3000
# Test sign-in with @ipupy.org.py account
# Verify UserMenu shows user info
# Test sign-out
# Verify protected routes redirect to login
```

### Step 8: Deploy Rollback

```bash
# Deploy Convex backend
npx convex deploy

# Verify TypeScript
npm run typecheck

# Build Next.js
npm run build

# Push to main (trigger Vercel deployment)
git add -A
git commit -m "rollback(auth): revert to NextAuth v5 due to [issue]"
git push origin rollback-convex-auth-$(date +%Y%m%d)

# Create PR to main
gh pr create --title "ROLLBACK: Convex Auth Migration" --body "Critical issue: [describe issue]"
```

### Step 9: Monitor Rollback

After deployment:

1. **Verify auth works**:
   - Test sign-in with admin account
   - Test sign-in with regular user
   - Verify role permissions work
   - Check UserMenu displays correctly

2. **Check for errors**:
   - Browser console (client errors)
   - Vercel logs (server errors)
   - Convex dashboard logs

3. **Verify data integrity**:
   - No duplicate profiles
   - User roles preserved
   - Church associations intact

---

## Post-Rollback Tasks

After successful rollback:

1. **Document Root Cause**
   - What went wrong?
   - Why did we miss it in testing?
   - Update `docs/WS4_PHASE6_POST_MORTEM.md`

2. **Update Documentation**
   - Mark Convex Auth migration as "attempted and rolled back" in TASK_TRACKER.md
   - Update CLAUDE.md to reflect current auth system (NextAuth v5)
   - Add lessons learned to docs

3. **Plan Forward Fix**
   - Can the issue be fixed?
   - Do we need to redesign the approach?
   - When can we retry?

---

## Prevention for Next Attempt

Before retrying Convex Auth migration:

1. **Staging Environment**
   - Test in separate Convex deployment
   - Use Vercel preview deployment
   - Test with multiple @ipupy.org.py accounts

2. **Phased Rollout**
   - Enable for admin only first
   - Monitor for 24 hours
   - Gradually enable for all users

3. **Feature Flag**
   - Use environment variable to toggle between NextAuth and Convex Auth
   - Allow quick rollback without code changes

4. **Extended Testing**
   - Browser testing with real Google OAuth
   - Test all 8 smoke test scenarios
   - Load testing with multiple concurrent sign-ins

---

## Reference Commits

| Commit | Description | Use Case |
|--------|-------------|----------|
| `e4310a4` | **Rollback target**: NextAuth v5 + Convex OIDC working | Stable fallback state |
| `221fa08` | Latest commit before rollback | Migration attempt |
| `af6f5ca` | Supabase to Convex migration complete | Historical reference |

---

## Support Contacts

- **Technical Lead**: Check TASK_TRACKER.md ownership
- **Convex Support**: https://convex.dev/community
- **Production Admin**: administracion@ipupy.org.py

---

## Rollback Time Estimate

- **Code Revert**: 15 minutes
- **Environment Variables**: 10 minutes
- **Testing**: 30 minutes
- **Deployment**: 15 minutes
- **Verification**: 30 minutes

**Total**: ~1.5 hours for full rollback and verification
