# Google OAuth Configuration Fix

## Problem
Authentication works on localhost but loops back to login page on production (https://ipupytesoreria.vercel.app/).

## Root Cause
Google OAuth Console likely missing production redirect URI.

## Solution Steps

### 1. Open Google Cloud Console
Go to: https://console.cloud.google.com/apis/credentials

### 2. Find OAuth 2.0 Client ID
Look for Client ID: `44786170581-apr8ukthgnp6dku7rkjh90kfruc2sf8t.apps.googleusercontent.com`

### 3. Verify Authorized Redirect URIs
The OAuth client MUST have BOTH redirect URIs configured:

**Required URIs:**
```
http://localhost:3000/api/auth/callback/google
https://ipupytesoreria.vercel.app/api/auth/callback/google
```

**If missing the production URI**, add it:
1. Click on the OAuth client
2. Scroll to "Authorized redirect URIs"
3. Click "+ ADD URI"
4. Enter: `https://ipupytesoreria.vercel.app/api/auth/callback/google`
5. Click "SAVE"

### 4. Verify Authorized JavaScript Origins
Should include:
```
http://localhost:3000
https://ipupytesoreria.vercel.app
```

### 5. Test After Changes
1. Wait 2-3 minutes for Google to propagate changes
2. Visit https://ipupytesoreria.vercel.app/
3. Click "Iniciar sesión con Google"
4. Should redirect to Google consent screen
5. After approving, should redirect back to dashboard

## Current Configuration

### Environment Variables (Verified)
- ✅ `GOOGLE_CLIENT_ID` set in Vercel
- ✅ `GOOGLE_CLIENT_SECRET` set in Vercel
- ✅ `NEXTAUTH_URL` = https://ipupytesoreria.vercel.app
- ✅ `NEXTAUTH_SECRET` rotated and set
- ✅ `NEXT_PUBLIC_CONVEX_URL` set

### Code Configuration (Verified)
- ✅ NextAuth v5 configured in src/lib/auth.ts
- ✅ Middleware allows /api/auth/* routes
- ✅ Login page at /login works
- ✅ Callback route at /api/auth/[...nextauth]/route.ts exists

### Known Working
- ✅ Development (localhost:3000) authentication works
- ✅ Google OAuth flow completes on localhost
- ✅ Session persists on localhost
- ✅ Convex integration works on localhost

### Issue
- ❌ Production redirects back to /login after Google auth
- ❌ No session created in production
- ❌ Infinite loop: /login → Google → /login

## Diagnosis

Since localhost works, the issue is **NOT**:
- NextAuth configuration ❌
- Environment variables ❌
- Code implementation ❌
- NEXTAUTH_SECRET ❌

The issue **IS**:
- ✅ Missing production redirect URI in Google OAuth Console

## After Fixing

Once the redirect URI is added, the flow should work:
1. User clicks "Iniciar sesión con Google" on https://ipupytesoreria.vercel.app/login
2. NextAuth redirects to Google OAuth: `https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=https://ipupytesoreria.vercel.app/api/auth/callback/google`
3. User approves access
4. Google redirects to: `https://ipupytesoreria.vercel.app/api/auth/callback/google?code=...`
5. NextAuth validates code and creates session
6. User is redirected to dashboard

## Verification Commands

After fixing, verify the auth flow:

```bash
# Check session endpoint
curl https://ipupytesoreria.vercel.app/api/auth/session

# Should return session object (after logging in), not null
```
