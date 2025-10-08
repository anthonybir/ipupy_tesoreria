# Authentication Error Handling Guide

## Phase 4.1b - NextAuth + Convex OIDC Bridge

**Date**: 2025-01-08  
**Status**: ✅ Implementation Complete - Testing Required

---

## Overview

This document summarizes the recent authentication migration and security fixes, and provides testing guidance for validating the complete NextAuth + Convex OIDC authentication flow.

## What Was Fixed

### P0 Critical Fixes

#### 1. Convex Auth Configuration (P0 Blocker)
**File**: `convex/auth.config.ts`  
**Issue**: Used client-side `NEXT_PUBLIC_GOOGLE_CLIENT_ID` instead of server-side `GOOGLE_CLIENT_ID`  
**Impact**: All authenticated requests would fail with 401 in production  
**Fix**: Changed to use `GOOGLE_CLIENT_ID` with fail-fast validation

```typescript
// BEFORE (BROKEN):
applicationID: process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'] ?? "missing-client-id",

// AFTER (FIXED):
applicationID: (() => {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return clientId;
})(),
```

#### 2. Environment Variable Configuration (P0)
**Issue**: Vercel production variable `NEXT_PUBLIC_CONVEX_URL` set to literal string  
**Impact**: App couldn't connect to Convex backend  
**Fix**: Corrected all Vercel environment variables, removed trailing newlines

#### 3. Report Status Workflow (P0)
**File**: `src/hooks/useReportMutations.ts`  
**Issue**: "Marcar procesado" button became no-op after estado forwarding fix  
**Fix**: Added `|| estado === "procesado"` to route to approve mutation

```typescript
// Route "aprobado" or "procesado" to approve mutation
if (estado.includes("aprob") || estado === "procesado") {
  const result = await approveMutation.mutateAsync({ id: convexId });
  return mapUpdateResult(result);
}
```

#### 4. Login Page Still Using Supabase (P0)
**Files**: `src/components/Auth/NextAuthLogin.tsx`, `src/app/login/page.tsx`  
**Issue**: Login page showed Supabase auth causing SSL errors  
**Fix**: Created new NextAuthLogin component, replaced SupabaseAuth

#### 5. Convex Client Initialization (P0)
**File**: `src/lib/convex-client.ts`  
**Issue**: `originalFactory.call` TypeError due to improper env var access  
**Fix**: Changed to inline access for Next.js static replacement

```typescript
// ✅ Correct - inline access
export const convexClient = new ConvexReactClient(
  process.env['NEXT_PUBLIC_CONVEX_URL'] ?? (() => {
    throw new Error('Missing NEXT_PUBLIC_CONVEX_URL');
  })()
);
```

### P1 Important Fixes

#### 6. NextAuth CallbackUrl (P1)
**File**: `src/components/Auth/NextAuthLogin.tsx`  
**Issue**: Login only respected custom `from` param, ignored NextAuth standard `callbackUrl`  
**Fix**: Priority order: `callbackUrl` > `from` > `/`

```typescript
const callbackUrl = searchParams?.get('callbackUrl') 
                 ?? searchParams?.get('from') 
                 ?? '/';
```

### Security Enhancements

#### 7. Sensitive Data Redaction
**File**: `src/lib/auth.ts`  
**Issue**: NextAuth debug mode exposed tokens and client secrets in console  
**Fix**: Implemented comprehensive sensitive data redaction

```typescript
const SENSITIVE_KEYS = new Set([
  "clientSecret", "client_secret", "secret",
  "accessToken", "access_token",
  "refreshToken", "refresh_token",
  "idToken", "id_token",
]);

// All sensitive fields now show "[REDACTED]" in logs
```

#### 8. Middleware Migration
**File**: `src/middleware.ts`  
**Issue**: Still used Supabase authentication  
**Fix**: Complete rewrite to use NextAuth JWT token validation

---

## Authentication Flow (Complete)

### 1. User Initiates Login
```
User clicks "Iniciar sesión con Google" → NextAuth /api/auth/signin
```

### 2. Google OAuth Flow
```
Google OAuth → User consent → Google returns:
- ID token (JWT with email, name, picture)
- Access token
- Refresh token
```

### 3. NextAuth Session Creation
```
NextAuth jwt() callback → Stores tokens in encrypted session JWT
NextAuth session() callback → Exposes tokens to client
```

### 4. Convex Authentication Bridge
```
useAuthFromNextAuth hook → Fetches ID token from /api/openid/token
ConvexProviderWithAuth → Calls fetchAccessToken()
Convex client → Sends ID token with every query/mutation
```

### 5. Convex Backend Validation
```
Convex receives ID token → Validates against convex/auth.config.ts
Checks iss claim: "https://accounts.google.com" ✓
Checks aud claim: matches GOOGLE_CLIENT_ID ✓
Fetches Google JWKS → Verifies signature ✓
ctx.auth.getUserIdentity() → Returns token payload
```

### 6. Backend Authorization
```
Convex function → ctx.auth.getUserIdentity()
Load user profile from "profiles" collection
Check role permissions (admin, treasurer, etc.)
Execute authorized operation
```

---

## Required Environment Variables

### Development (.env.local)
```bash
# Convex Backend
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-dev.convex.cloud

# NextAuth
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Organization
SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME=IPU PY

# Environment
NODE_ENV=development
```

### Production (Vercel Dashboard)
```bash
# ✅ Verified as of 2025-10-08
CONVEX_DEPLOYMENT=prod:different-schnauzer-772
NEXT_PUBLIC_CONVEX_URL=https://different-schnauzer-772.convex.cloud
NEXTAUTH_SECRET=<your-production-secret> # rotated to PZClyHfHiXS1FRGzdSlHgpNRaE7LtKb6SfNtxpXa0mQ=
NEXTAUTH_URL=https://ipupytesoreria.vercel.app
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME=IPU PY
NODE_ENV=production
```

**Note**: Vercel auto-sets `VERCEL_URL` and `NEXT_PUBLIC_SITE_URL`

---

## Testing Checklist

### Pre-Testing Setup

- [ ] **Restart dev server**: `npm run dev`
- [ ] **Clear browser cache**: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- [ ] **Delete .next cache**: `rm -rf .next` if issues persist
- [ ] **Verify Convex deployment**: `npx convex dev` running in separate terminal

### Development Testing (localhost:3000)

#### Basic Authentication Flow
- [ ] Navigate to `http://localhost:3000`
- [ ] Should redirect to `/login` if not authenticated
- [ ] Click "Iniciar sesión con Google"
- [ ] Google OAuth consent screen appears
- [ ] Select account with `@ipupy.org.py` domain
- [ ] Should redirect back to `/` after successful login
- [ ] User info displays correctly in UI

#### Debug Log Verification (Security)
- [ ] Open browser console (F12 → Console tab)
- [ ] Look for `[NextAuth][debug]` messages
- [ ] Verify sensitive fields show `[REDACTED]`:
  ```
  [NextAuth][debug][JWT_CALLBACK] {
    token: {
      id: "...",
      email: "...",
      idToken: "[REDACTED]",        ← Should be redacted
      accessToken: "[REDACTED]",     ← Should be redacted
      refreshToken: "[REDACTED]",    ← Should be redacted
    }
  }
  ```
- [ ] **CRITICAL**: If you see actual tokens/secrets in logs, something is wrong

#### Convex Connection Status
- [ ] Look for Convex websocket connection in Network tab (WS filter)
- [ ] Should see `wss://different-schnauzer-772.convex.cloud/_ws`
- [ ] No "Reconectando con el servidor de Convex…" banner should appear
- [ ] If banner appears, check console for auth errors

#### Protected Routes
- [ ] Navigate to `/churches` - should load church list
- [ ] Navigate to `/reports` - should load reports
- [ ] Navigate to `/funds` - should load funds
- [ ] Navigate to `/transactions` - should load ledger
- [ ] All pages should render without 401 errors

#### API Endpoints
- [ ] Open browser DevTools → Network tab
- [ ] Navigate to different pages
- [ ] Check XHR/Fetch requests to `/api/*` endpoints
- [ ] All API requests should return 200 or 404 (not 401)
- [ ] Look for Convex function calls in Network tab

#### Middleware Validation
- [ ] Try accessing protected route directly (e.g., `/churches`)
- [ ] Should redirect to `/login?from=/churches` if not logged in
- [ ] After login, should redirect back to `/churches`

#### Report Status Workflow (P0 Fix)
- [ ] Navigate to monthly reports page
- [ ] Find a report with "Pendiente" status
- [ ] Click "Marcar procesado" button
- [ ] Status should change to "Procesado" ✓
- [ ] No console errors should appear

#### Logout Flow
- [ ] Click logout button (if available in UI)
- [ ] Should redirect to `/login`
- [ ] Try accessing `/churches` - should redirect to login
- [ ] NextAuth session should be cleared

### Production Testing (ipupytesoreria.vercel.app)

**Wait for Vercel deployment to complete before testing production**

#### Deployment Verification
- [ ] Check Vercel dashboard for successful deployment
- [ ] Verify environment variables are set correctly
- [ ] Check deployment logs for any errors
- [ ] Verify Convex deployment is active (`npx convex deploy`)

#### Live Authentication
- [ ] Visit `https://ipupytesoreria.vercel.app`
- [ ] Complete full login flow
- [ ] Verify all protected pages load
- [ ] Test report workflow
- [ ] Check browser console for errors

#### Performance Check
- [ ] Initial page load < 3 seconds
- [ ] Navigation between pages is instant
- [ ] No excessive API calls in Network tab
- [ ] Convex websocket stays connected

---

## Common Issues & Solutions

### Issue 1: "Not authenticated" Errors in Convex Functions
**Symptoms**: 401 errors, `ctx.auth.getUserIdentity()` returns null

**Diagnosis**:
1. Check browser console for auth errors
2. Verify NextAuth session exists: visit `/api/auth/session`
3. Check Convex dashboard → Settings → Auth for OIDC bridge config
4. Verify `GOOGLE_CLIENT_ID` matches in:
   - `.env.local` or Vercel dashboard
   - `convex/auth.config.ts`
   - Google Cloud Console OAuth client

**Fix**:
- Ensure `GOOGLE_CLIENT_ID` (not `NEXT_PUBLIC_*`) is set in backend
- Restart Convex dev server: `npx convex dev`
- Clear browser cache and retry login

### Issue 2: "originalFactory.call" TypeError
**Symptoms**: App crashes with undefined error on load

**Diagnosis**:
- Check `src/lib/convex-client.ts`
- Verify `NEXT_PUBLIC_CONVEX_URL` is accessed inline

**Fix**:
```typescript
// ✅ Correct pattern
export const convexClient = new ConvexReactClient(
  process.env['NEXT_PUBLIC_CONVEX_URL'] ?? (() => {
    throw new Error('Missing NEXT_PUBLIC_CONVEX_URL');
  })()
);

// ❌ Wrong pattern (breaks Next.js static replacement)
const url = process.env['NEXT_PUBLIC_CONVEX_URL'];
export const convexClient = new ConvexReactClient(url);
```

### Issue 3: Tokens/Secrets Visible in Console
**Symptoms**: Debug logs show actual token values

**Diagnosis**:
- Check `src/lib/auth.ts` for `nextAuthLogger` configuration
- Verify `debug: true` only in development
- Check `sanitizeMetadata()` is called

**Fix**:
- Ensure `redactSensitive()` function is properly implemented
- Verify `SENSITIVE_KEYS` set includes all token fields
- If secrets were exposed, rotate them in Google Cloud Console

### Issue 4: Convex Websocket Disconnects
**Symptoms**: "Reconectando con el servidor…" banner appears

**Diagnosis**:
1. Check browser console for websocket errors
2. Verify Convex deployment is active
3. Check `NEXT_PUBLIC_CONVEX_URL` is correct
4. Look for network connectivity issues

**Fix**:
- Verify `NEXT_PUBLIC_CONVEX_URL` matches actual deployment
- Check Convex dashboard for deployment status
- Restart dev server and clear `.next` cache

### Issue 5: "Marcar procesado" Button Not Working
**Symptoms**: Button click has no effect, status doesn't change

**Diagnosis**:
- Check browser console for errors
- Verify `useReportMutations.ts` includes `estado === "procesado"` check
- Check Convex function logs in dashboard

**Fix**:
```typescript
// Ensure this line includes "procesado" check
if (estado.includes("aprob") || estado === "procesado") {
  const result = await approveMutation.mutateAsync({ id: convexId });
  return mapUpdateResult(result);
}
```

---

## Security Recommendations

### Immediate Actions
- [ ] **Test redaction**: Verify debug logs show `[REDACTED]` for sensitive fields
- [ ] **Rotate secrets**: If tokens were exposed in earlier logs, rotate in Google Cloud Console
- [ ] **Review logs**: Check Vercel logs for any exposed credentials
- [ ] **Enable HSTS**: Ensure HTTPS-only in production (already configured)

### Ongoing Monitoring
- [ ] Monitor Vercel logs for 401/403 errors
- [ ] Check Convex dashboard for failed auth attempts
- [ ] Review user activity logs in `userActivity` collection
- [ ] Set up alerts for auth failures (optional)

---

## Next Steps

### Immediate (Required)
1. ✅ Complete development testing checklist above
2. ⏳ If all tests pass, deploy to production
3. ⏳ Complete production testing checklist
4. ⏳ Monitor for 24 hours after deployment

### Future Improvements (Optional)
- [ ] Add error boundary for auth errors
- [ ] Implement refresh token rotation
- [ ] Add session activity tracking
- [ ] Set up monitoring/alerting (e.g., Sentry)
- [ ] Document common user auth issues

---

## Support

**Technical Issues**: administracion@ipupy.org.py  
**Documentation**: See [CLAUDE.md](../CLAUDE.md) for architecture overview  
**Migration Status**: See [CONVEX_MIGRATION_PLAN.md](./CONVEX_MIGRATION_PLAN.md)

---

## Version History

- **2025-01-08**: Created after Phase 4.1b completion (P0 fixes + security enhancements)
- **2025-01-07**: Phase 4.1b - NextAuth → Convex OIDC Bridge implementation
