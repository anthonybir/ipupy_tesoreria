# Deployment Guide - IPU PY Treasury System

**Last Updated**: 2025-01-08  
**Architecture**: Next.js 15 + Convex + NextAuth v5  
**Status**: ✅ Current (Post-Convex Migration)

---

## Overview

The IPU PY Treasury System uses a two-part deployment architecture:

1. **Frontend**: Next.js application deployed on Vercel
2. **Backend**: Convex functions deployed on Convex Cloud

This guide covers deployment to both platforms.

---

## Prerequisites

### Required Accounts
- ✅ Vercel account (https://vercel.com)
- ✅ Convex account (https://convex.dev)
- ✅ Google Cloud Console (for OAuth)
- ✅ GitHub account (for source control)

### Required Tools
```bash
# Install Vercel CLI
npm install -g vercel

# Install Convex CLI
npm install -g convex

# Verify installations
vercel --version
convex --version
```

---

## Part 1: Convex Backend Deployment

### Step 1: Create Convex Production Deployment

```bash
# Initialize Convex (if not already done)
npx convex dev

# Create production deployment
npx convex deploy --prod

# Output shows:
# ✓ Deployed functions to prod:your-project
# Deployment URL: https://quick-mouse-456.convex.cloud
```

### Step 2: Configure Convex Environment

The Convex backend requires OIDC configuration for NextAuth:

```typescript
// convex/auth.config.ts (already in repo)
export default {
  providers: [
    {
      domain: process.env.NEXTAUTH_URL, // Production URL
      applicationID: "convex",
    },
  ],
};
```

**No environment variables needed in Convex** - configuration is code-based.

### Step 3: Verify Convex Deployment

```bash
# Check deployment status
npx convex deploy --prod --dry-run

# View production logs
npx convex logs --prod

# Test with Convex Dashboard
# https://dashboard.convex.dev → Your project → Production
```

---

## Part 2: Vercel Frontend Deployment

### Step 1: Connect Repository to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### Step 2: Configure Environment Variables

**Required Variables** (add in Vercel Dashboard):

```bash
# Convex Backend (Required)
CONVEX_DEPLOYMENT=prod:your-project-name
NEXT_PUBLIC_CONVEX_URL=https://quick-mouse-456.convex.cloud

# NextAuth v5 (Required)
NEXTAUTH_SECRET=<generate-with-openssl>
NEXTAUTH_URL=https://yourdomain.vercel.app

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-prod-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-prod-client-secret

# Optional Configuration
SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME="Iglesia Pentecostal Unida del Paraguay"
```

**Generate NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
# Copy output to NEXTAUTH_SECRET
```

### Step 3: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to: **APIs & Services → Credentials**
4. Select your OAuth 2.0 Client ID
5. Add **Authorized redirect URIs**:
   ```
   https://yourdomain.vercel.app/api/auth/callback/google
   ```
6. Save changes

### Step 4: Deploy to Vercel

```bash
# Option 1: Deploy via Git push
git push origin main
# Vercel auto-deploys on push to main

# Option 2: Deploy via CLI
vercel --prod

# Output shows:
# ✓ Production: https://ipupytesoreria.vercel.app
```

### Step 5: Verify Deployment

```bash
# Check deployment status
vercel ls

# View deployment logs
vercel logs https://ipupytesoreria.vercel.app

# Test in browser
open https://ipupytesoreria.vercel.app
```

---

## Environment Variable Reference

### Production Environment Variables

| Variable | Value | Where to Set |
|----------|-------|--------------|
| `CONVEX_DEPLOYMENT` | `prod:project-name` | Vercel |
| `NEXT_PUBLIC_CONVEX_URL` | `https://xxx.convex.cloud` | Vercel |
| `NEXTAUTH_SECRET` | Random 32+ char string | Vercel |
| `NEXTAUTH_URL` | `https://yourdomain.vercel.app` | Vercel (or auto-set) |
| `GOOGLE_CLIENT_ID` | From Google Console | Vercel |
| `GOOGLE_CLIENT_SECRET` | From Google Console | Vercel |

**Setting in Vercel**:
1. Dashboard → Project → Settings → Environment Variables
2. Add each variable for **Production** environment
3. Click "Save"
4. Redeploy: `vercel --prod --force`

---

## Testing Deployment

### Frontend Tests

```bash
# Test homepage
curl https://ipupytesoreria.vercel.app

# Test authentication redirect
curl -I https://ipupytesoreria.vercel.app/churches
# Should redirect to login (302)

# Check build info
curl https://ipupytesoreria.vercel.app/api/health
```

### Backend Tests

```bash
# Test Convex connection from browser console
# Open https://ipupytesoreria.vercel.app
# DevTools → Console:

// Should see Convex client connected
console.log(window.__CONVEX_CLIENT_STATUS);
```

### Authentication Tests

1. **Login Test**:
   - Navigate to https://ipupytesoreria.vercel.app
   - Click "Iniciar Sesión"
   - Sign in with @ipupy.org.py Google account
   - Should redirect to dashboard

2. **Session Test**:
   - After login, check DevTools → Application → Cookies
   - Should see: `next-auth.session-token`

3. **API Test**:
   - Navigate to /churches (requires auth)
   - Should load church list, not error

---

## Deployment Checklist

### Pre-Deployment
- [ ] All TypeScript errors fixed (`npm run typecheck`)
- [ ] All ESLint warnings fixed (`npm run lint`)
- [ ] Local build succeeds (`npm run build`)
- [ ] Convex schema pushed (`npx convex deploy --prod`)
- [ ] Environment variables documented

### Convex Deployment
- [ ] Production deployment created
- [ ] OIDC configuration verified (`convex/auth.config.ts`)
- [ ] Functions deployed successfully
- [ ] Dashboard accessible (https://dashboard.convex.dev)

### Vercel Deployment
- [ ] Repository connected to Vercel
- [ ] All environment variables set
- [ ] Google OAuth redirect URIs configured
- [ ] Build succeeds
- [ ] Deployment URL accessible

### Post-Deployment
- [ ] Homepage loads
- [ ] Login flow works
- [ ] Dashboard displays data
- [ ] API routes respond correctly
- [ ] No console errors in browser
- [ ] Monitor logs for errors

---

## Deployment Workflows

### Continuous Deployment (Main Branch)

```bash
# 1. Make changes locally
git checkout -b feature/new-feature
# ... make changes ...

# 2. Test locally
npm run typecheck
npm run lint
npm run build
npx convex dev  # Test backend changes

# 3. Create pull request
git push origin feature/new-feature
# Create PR on GitHub

# 4. After approval, merge to main
git checkout main
git merge feature/new-feature
git push origin main

# 5. Vercel auto-deploys to production
# Convex needs manual deploy if schema changed:
npx convex deploy --prod
```

### Hotfix Deployment

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-fix

# 2. Fix issue
# ... make changes ...

# 3. Test and deploy quickly
npm run validate
git commit -m "hotfix: critical issue"
git push origin hotfix/critical-fix

# 4. Merge to main immediately
gh pr create --title "Hotfix: Critical Issue" --body "..."
gh pr merge --squash

# 5. Verify deployment
vercel --prod --force  # Force redeploy if needed
```

### Rolling Back

```bash
# Option 1: Revert via Vercel Dashboard
# Deployments → Previous deployment → "Promote to Production"

# Option 2: Redeploy previous commit
git checkout <previous-commit-sha>
vercel --prod --force

# Option 3: Revert commit
git revert <bad-commit-sha>
git push origin main
```

---

## Monitoring & Maintenance

### Vercel Monitoring

**Access Logs**:
```bash
# Real-time logs
vercel logs --follow

# Last 100 logs
vercel logs --since=1h

# Filter by status code
vercel logs | grep "500"
```

**Metrics Dashboard**:
- Vercel Dashboard → Project → Analytics
- Monitor: Requests, Bandwidth, Build time, Errors

### Convex Monitoring

**Access Dashboard**:
1. Go to https://dashboard.convex.dev
2. Select your project
3. View:
   - **Logs**: Real-time function execution
   - **Data**: Browse collections
   - **Functions**: View deployed functions
   - **Metrics**: Usage and performance

**Key Metrics**:
- Function call count
- Average execution time
- Error rate
- Database query performance

### Health Checks

Create a monitoring service to check:

```bash
# Check frontend up
curl -f https://ipupytesoreria.vercel.app || alert

# Check Convex backend
# (Test via authenticated API call)
curl -f https://ipupytesoreria.vercel.app/api/health || alert
```

---

## Troubleshooting Deployment

### Issue: Build Fails on Vercel

**Symptom**: Build error in Vercel logs

**Diagnosis**:
```bash
# Test build locally
npm run build

# Check for type errors
npm run typecheck

# Check for lint errors
npm run lint
```

**Fix**:
- Fix all TypeScript/ESLint errors locally
- Commit and push fixes
- Vercel will auto-retry build

### Issue: Environment Variables Not Working

**Symptom**: "NEXT_PUBLIC_CONVEX_URL is undefined"

**Diagnosis**:
```bash
# Check variables in Vercel
vercel env ls

# Verify variable names match code
grep -r "NEXT_PUBLIC_CONVEX_URL" src/
```

**Fix**:
1. Verify variable names exactly match
2. Ensure `NEXT_PUBLIC_` prefix for client vars
3. Redeploy: `vercel --prod --force`

### Issue: Authentication Not Working

**Symptom**: Login redirects fail or infinite loop

**Diagnosis**:
- Check Google OAuth redirect URIs include production URL
- Verify `NEXTAUTH_URL` matches actual deployment URL
- Check `NEXTAUTH_SECRET` is set

**Fix**:
1. Update Google OAuth redirect URIs
2. Verify `NEXTAUTH_URL` in Vercel env vars
3. Regenerate `NEXTAUTH_SECRET` if needed
4. Redeploy

### Issue: Convex Functions Not Working

**Symptom**: "Function not found" or auth errors

**Diagnosis**:
```bash
# Check deployment status
npx convex deploy --prod --dry-run

# View logs for errors
npx convex logs --prod
```

**Fix**:
```bash
# Redeploy Convex backend
npx convex deploy --prod

# Verify OIDC configuration
# Check convex/auth.config.ts has correct domain
```

---

## Production Data

### Data Loaded

The production deployment includes:
- **22 Churches**: All IPU Paraguay churches
- **Historical Reports**: Migrated from Supabase
- **Fund Transactions**: Complete ledger history
- **User Profiles**: Admin and church users

### Data Import (if needed)

```bash
# Export from backup
npx convex export --prod

# Import to new deployment
npx convex import --table churches backup/churches.jsonl
npx convex import --table profiles backup/profiles.jsonl
# ... repeat for each collection
```

---

## Security Checklist

### Production Security

- [ ] `NEXTAUTH_SECRET` is cryptographically secure
- [ ] `GOOGLE_CLIENT_SECRET` never exposed
- [ ] All secrets in Vercel environment variables (not .env files)
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] OAuth domain restriction enforced (@ipupy.org.py)
- [ ] CORS configured correctly
- [ ] Rate limiting enabled on sensitive endpoints

### Access Control

- [ ] Vercel project has correct team permissions
- [ ] Convex dashboard access limited to admins
- [ ] Google OAuth restricted to organization domain
- [ ] Service account keys rotated regularly

---

## Support & Maintenance

### Regular Maintenance

**Weekly**:
- Check Vercel analytics for errors
- Review Convex logs for issues
- Monitor resource usage

**Monthly**:
- Review and rotate secrets
- Update dependencies (`npm update`)
- Review security logs

**Quarterly**:
- Audit user access
- Review OAuth configuration
- Update documentation

### Getting Help

**Vercel Issues**:
- Vercel Support: https://vercel.com/support
- Docs: https://vercel.com/docs

**Convex Issues**:
- Convex Discord: https://convex.dev/community
- Docs: https://docs.convex.dev

**Application Issues**:
- Technical Support: administracion@ipupy.org.py
- GitHub Issues: Repository issues page

---

## Related Documentation

- [ENVIRONMENT_VARIABLES.md](../ENVIRONMENT_VARIABLES.md) - Complete variable reference
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) - Development workflows
- [TROUBLESHOOTING.md](../development/TROUBLESHOOTING.md) - Debug guide

---

## Legacy Deployment (Archived)

For historical reference, the previous PostgreSQL/Supabase deployment is documented in:
- [DEPLOYMENT_SUMMARY_OLD.md](./DEPLOYMENT_SUMMARY_OLD.md)
- [migrations/README.md](../../migrations/README.md)

---

**Status**: ✅ Production Deployed  
**Frontend**: https://ipupytesoreria.vercel.app  
**Backend**: Convex Cloud  
**Last Deploy**: Check Vercel dashboard for latest deployment
