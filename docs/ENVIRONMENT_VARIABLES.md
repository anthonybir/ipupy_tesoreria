# Environment Variables Reference

**Last Updated**: 2025-01-08  
**Architecture**: Next.js 15 + Convex + NextAuth v5

---

## Overview

This document provides a complete reference for all environment variables used in the IPU PY Tesorería system. The system uses:

- **Convex** for backend and database
- **NextAuth v5** for authentication with Google OAuth
- **Next.js 15** for frontend
- **Vercel** for hosting (frontend)
- **Convex Cloud** for hosting (backend)

---

## Quick Start

### Development Setup

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
nano .env.local

# Required for development
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXTAUTH_SECRET=your-secret-key-minimum-32-characters
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Production Setup (Vercel)

```bash
# Add via Vercel CLI
vercel env add CONVEX_DEPLOYMENT
vercel env add NEXT_PUBLIC_CONVEX_URL
vercel env add NEXTAUTH_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET

# Or add via Vercel Dashboard:
# https://vercel.com/[team]/[project]/settings/environment-variables
```

---

## Required Variables

### Convex Backend

#### `CONVEX_DEPLOYMENT` (Required)
- **Type**: Server-side only
- **Format**: `dev:deployment-name` or `prod:deployment-name`
- **Used by**: Convex CLI, deployment scripts
- **Example**: `dev:happy-animal-123`
- **How to get**:
  ```bash
  npx convex dev
  # Deployment name shown in output
  ```

#### `NEXT_PUBLIC_CONVEX_URL` (Required)
- **Type**: Client-side (public)
- **Format**: `https://[deployment-name].convex.cloud`
- **Used by**: Frontend React components, Convex client
- **Example**: `https://happy-animal-123.convex.cloud`
- **How to get**:
  ```bash
  npx convex dev
  # URL shown in output and added to .env.local automatically
  ```
- **Important**: Must have `NEXT_PUBLIC_` prefix for client-side access

---

### NextAuth v5 Authentication

#### `NEXTAUTH_SECRET` (Required)
- **Type**: Server-side only
- **Format**: Random string (minimum 32 characters)
- **Used by**: NextAuth session encryption
- **Security**: Keep secret, rotate periodically
- **How to generate**:
  ```bash
  openssl rand -base64 32
  ```
- **Development**: Use any 32+ character string
- **Production**: Generate cryptographically secure random string

#### `NEXTAUTH_URL` (Required)
- **Type**: Server-side only
- **Format**: Full URL including protocol
- **Used by**: NextAuth OAuth callbacks
- **Development**: `http://localhost:3000`
- **Production**: `https://yourdomain.com`
- **Vercel**: Auto-set by Vercel to deployment URL

---

### Google OAuth

#### `GOOGLE_CLIENT_ID` (Required)
- **Type**: Server-side only (used in auth flow)
- **Format**: `[id].apps.googleusercontent.com`
- **Used by**: NextAuth Google provider
- **How to get**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create project → APIs & Services → Credentials
  3. Create OAuth 2.0 Client ID
  4. Application type: Web application
  5. Authorized redirect URIs:
     - Development: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://yourdomain.com/api/auth/callback/google`

#### `GOOGLE_CLIENT_SECRET` (Required)
- **Type**: Server-side only
- **Format**: Alphanumeric string from Google Console
- **Used by**: NextAuth Google provider
- **Security**: Keep secret, never commit to git
- **How to get**: Same location as `GOOGLE_CLIENT_ID` in Google Console

---

### Optional Configuration

#### `SYSTEM_OWNER_EMAIL` (Optional)
- **Type**: Server-side only
- **Format**: Email address
- **Used by**: Admin user identification, system notifications
- **Default**: `administracion@ipupy.org.py`
- **Example**: `admin@example.com`

#### `ORGANIZATION_NAME` (Optional)
- **Type**: Server-side only
- **Format**: String
- **Used by**: Email templates, system branding
- **Default**: `Iglesia Pentecostal Unida del Paraguay`
- **Example**: `My Organization`

#### `NODE_ENV` (Auto-set)
- **Type**: Server-side and build-time
- **Format**: `development` | `production` | `test`
- **Used by**: Next.js, feature flags, logging
- **Default**: Set automatically by platform
- **Vercel**: Auto-set to `production` in production

---

## Variable Scopes

### Server-Side Only Variables
Variables without `NEXT_PUBLIC_` prefix are only available in:
- API routes (`/app/api/**`)
- Server components
- Server actions
- Middleware

**Examples**:
- `CONVEX_DEPLOYMENT`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Client-Side Variables
Variables with `NEXT_PUBLIC_` prefix are available in:
- Client components
- Browser JavaScript
- **Important**: Exposed in browser bundle (don't use for secrets!)

**Examples**:
- `NEXT_PUBLIC_CONVEX_URL`

**Access Pattern**:
```typescript
// ✅ Correct - inline access for static replacement
const config = {
  url: process.env['NEXT_PUBLIC_CONVEX_URL'] ?? '',
};

// ❌ Wrong - intermediate variable breaks Next.js replacement
const url = process.env['NEXT_PUBLIC_CONVEX_URL'];
const config = { url };
```

---

## Environment Files

### `.env.local` (Development - Gitignored)
```bash
# Local development only
# Never commit this file
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXTAUTH_SECRET=development-secret-at-least-32-characters
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=dev-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=dev-secret
SYSTEM_OWNER_EMAIL=dev@ipupy.org.py
ORGANIZATION_NAME="IPU Paraguay - Dev"
NODE_ENV=development
```

### `.env.example` (Template - Committed to Git)
```bash
# Copy this file to .env.local and fill in values

# Convex Backend (Required)
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# NextAuth v5 (Required)
NEXTAUTH_SECRET=your-secret-key-minimum-32-characters
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional Configuration
SYSTEM_OWNER_EMAIL=admin@example.com
ORGANIZATION_NAME="Your Organization"
```

### Vercel Production Variables
Set via Vercel Dashboard or CLI:

```bash
# Production values
CONVEX_DEPLOYMENT=prod:ipupy-tesoreria
NEXT_PUBLIC_CONVEX_URL=https://quick-mouse-456.convex.cloud
NEXTAUTH_SECRET=<production-secret-from-vault>
NEXTAUTH_URL=https://ipupytesoreria.vercel.app
GOOGLE_CLIENT_ID=prod-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<production-secret-from-vault>
SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME="Iglesia Pentecostal Unida del Paraguay"
```

---

## Security Best Practices

### 1. Never Commit Secrets
```bash
# ✅ Good - in .gitignore
.env.local
.env.production
.env*.local

# ❌ Bad - committed to git
.env
.env.development
```

### 2. Rotate Secrets Regularly
- `NEXTAUTH_SECRET`: Every 90 days
- `GOOGLE_CLIENT_SECRET`: When team members leave
- `CONVEX_DEPLOYMENT`: Only on major migrations

### 3. Use Different Secrets Per Environment
```bash
# ❌ Bad - same secret everywhere
NEXTAUTH_SECRET=my-secret-123

# ✅ Good - unique per environment
# Development: dev-secret-abc123...
# Production: prod-secret-xyz789...
```

### 4. Validate Required Variables at Startup
```typescript
// src/lib/env-validation.ts
const requiredEnvVars = [
  'NEXT_PUBLIC_CONVEX_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}
```

### 5. Use Vercel Environment Groups
- **Development**: Branch deployments
- **Preview**: Pull request previews
- **Production**: Main branch deployment

---

## Troubleshooting

### Issue: "NEXT_PUBLIC_CONVEX_URL is undefined in browser"

**Cause**: Variable not set or missing `NEXT_PUBLIC_` prefix

**Fix**:
```bash
# Check .env.local has correct name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Restart dev server
npm run dev
```

### Issue: "NextAuth callback URL mismatch"

**Cause**: `NEXTAUTH_URL` doesn't match Google OAuth redirect URI

**Fix**:
```bash
# Development
NEXTAUTH_URL=http://localhost:3000

# Google Console → Authorized redirect URIs:
http://localhost:3000/api/auth/callback/google
```

### Issue: "Convex authentication failed"

**Cause**: NextAuth not providing ID token or OIDC not configured

**Fix**:
1. Verify `convex/auth.config.ts` exists:
   ```typescript
   export default {
     providers: [
       {
         domain: process.env.NEXTAUTH_URL,
         applicationID: "convex",
       },
     ],
   };
   ```

2. Verify NextAuth returns `idToken`:
   ```typescript
   // src/lib/auth.ts
   callbacks: {
     async jwt({ token, account }) {
       if (account?.id_token) {
         token.idToken = account.id_token;
       }
       return token;
     },
   }
   ```

### Issue: "Build fails with undefined env var"

**Cause**: Client-side code accessing server-only variable

**Fix**:
```typescript
// ❌ Wrong - client component accessing server var
'use client';
const secret = process.env.NEXTAUTH_SECRET; // undefined in browser

// ✅ Correct - server component or API route
// app/api/example/route.ts
const secret = process.env['NEXTAUTH_SECRET']; // available
```

---

## Migration Notes

### From Supabase to Convex

**Removed Variables** (No longer needed):
```bash
# ❌ Old Supabase variables (deprecated)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
DATABASE_URL
```

**Added Variables** (Convex):
```bash
# ✅ New Convex variables
CONVEX_DEPLOYMENT
NEXT_PUBLIC_CONVEX_URL
```

**Migrated Variables** (Now use NextAuth):
```bash
# Authentication moved from Supabase Auth to NextAuth
NEXTAUTH_SECRET        # Replaces JWT_SECRET
NEXTAUTH_URL           # New requirement
GOOGLE_CLIENT_ID       # Still needed
GOOGLE_CLIENT_SECRET   # Still needed
```

---

## Testing

### Local Development
```bash
# 1. Set environment variables
cp .env.example .env.local
nano .env.local

# 2. Verify Convex connection
npx convex dev

# 3. Start Next.js
npm run dev

# 4. Test in browser
open http://localhost:3000
```

### Production Verification
```bash
# Check Vercel environment variables
vercel env ls

# Test production build locally
npm run build
npm start

# Verify environment in production
curl https://your-app.vercel.app/api/health
```

---

## Reference

### All Variables Summary

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `CONVEX_DEPLOYMENT` | Server | ✅ Yes | - | Convex deployment identifier |
| `NEXT_PUBLIC_CONVEX_URL` | Client | ✅ Yes | - | Convex backend URL |
| `NEXTAUTH_SECRET` | Server | ✅ Yes | - | Session encryption key |
| `NEXTAUTH_URL` | Server | ✅ Yes | - | Application base URL |
| `GOOGLE_CLIENT_ID` | Server | ✅ Yes | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Server | ✅ Yes | - | Google OAuth secret |
| `SYSTEM_OWNER_EMAIL` | Server | ⚠️ Optional | `administracion@ipupy.org.py` | Admin email |
| `ORGANIZATION_NAME` | Server | ⚠️ Optional | `Iglesia Pentecostal Unida del Paraguay` | Organization name |
| `NODE_ENV` | Both | Auto-set | `development` | Environment mode |

---

## External Resources

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Convex Environment Variables](https://docs.convex.dev/production/hosting/environment-variables)
- [NextAuth Configuration](https://authjs.dev/getting-started/deployment)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 4.0.0 | 2025-01-08 | Complete rewrite for Convex + NextAuth architecture |

---

**Maintained By**: Technical Documentation Team  
**Last Review**: 2025-01-08  
**Next Review**: 2025-02-08  
**Status**: ✅ Current (Post-Convex Migration)
