# Quick Start Guide - IPU PY Tesorería

Get up and running with IPU PY Tesorería in 10 minutes.

## Prerequisites

- Node.js 20+ installed
- Git installed
- Convex account ([convex.dev](https://convex.dev) - free tier works)
- Google Cloud account (for OAuth)

## 1. Clone and Install (1 minute)

```bash
# Clone repository
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Install dependencies
npm install
```

## 2. Convex Setup (4 minutes)

### Create Convex Project

1. Go to [convex.dev](https://convex.dev)
2. Sign in with GitHub
3. Click "Create a project"
4. Note your deployment URL (will be something like `https://happy-animal-123.convex.cloud`)

### Initialize Convex

```bash
# Initialize Convex in your project
npx convex dev
```

This will:
- Link your local project to Convex
- Deploy the schema and functions
- Start watching for changes
- Generate `convex/_generated/` files

### Configure Google OAuth in Convex

1. Go to your Convex dashboard
2. Navigate to Settings → Authentication
3. Enable "OpenID Connect (OIDC)"
4. Note the issuer URL (will be used in NextAuth config)

## 3. Google OAuth Setup (2 minutes)

### Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to APIs & Services → Credentials
4. Click "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: Web application
6. Add authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-domain.vercel.app/api/auth/callback/google
   ```
7. Copy Client ID and Client Secret

## 4. Environment Setup (2 minutes)

```bash
# Copy environment template
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Convex
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-command-below>

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Organization
SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME=IPU PY
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

## 5. Import Initial Data (Optional)

If you have legacy Supabase data to import:

```bash
# Export from Supabase (if applicable)
npm run export:supabase

# Transform for Convex
npm run transform-data

# Import to Convex
npm run convex:import
```

Otherwise, the system will start with empty collections.

## 6. Start Development Servers

You need TWO terminal windows:

**Terminal 1 - Convex Backend:**
```bash
npx convex dev
```

**Terminal 2 - Next.js Frontend:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 7. First Login

1. Click "Sign in with Google"
2. Use email ending in `@ipupy.org.py`
3. First user becomes admin automatically
4. Subsequent users need role assignment by admin

## Common Commands

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npx convex dev           # Start Convex backend with live reload

# Production
npm run build            # Build Next.js for production
npx convex deploy        # Deploy Convex functions to cloud

# Quality
npm run lint             # Run ESLint
npx tsc --noEmit         # Check TypeScript
```

## Project Structure

```
ipupy-tesoreria/
├── src/
│   ├── app/            # Next.js pages and API routes
│   ├── components/     # React components
│   ├── lib/            # Utilities and configs
│   │   ├── auth.ts     # NextAuth configuration
│   │   └── convex-*.ts # Convex client utilities
│   └── types/          # TypeScript types
├── convex/             # Convex backend
│   ├── schema.ts       # Database schema
│   ├── *.ts            # Queries, mutations, actions
│   └── _generated/     # Auto-generated (git-ignored)
└── docs/               # Documentation
```

## Quick Tips

### Check Convex Dashboard

Visit your Convex dashboard to:
- View all collections and documents
- Monitor function logs in real-time
- Test queries and mutations
- Check auth status

### View Logs

```bash
# Convex backend logs
# Watch Terminal 1 (npx convex dev)

# Next.js logs
# Watch Terminal 2 (npm run dev)

# Check browser console for client errors
```

### Reset Convex Data

```bash
# Clear all data in Convex (CAUTION!)
npx convex data clear --all

# Re-import initial data if needed
npm run convex:import
```

## Troubleshooting

### "Not authenticated" errors

**Cause**: OIDC bridge not configured properly

**Fix**:
1. Check Convex dashboard → Settings → Authentication
2. Verify OIDC is enabled
3. Ensure `NEXTAUTH_SECRET` is set
4. Check `NEXTAUTH_URL` matches your domain

### "Google OAuth error"

**Fix**:
1. Verify redirect URI in Google Console: `http://localhost:3000/api/auth/callback/google`
2. Ensure domain restriction allows `@ipupy.org.py`
3. Check Client ID and Secret in `.env.local`

### "Convex function not found"

**Fix**:
```bash
# Regenerate Convex types
npx convex dev --once

# Or restart convex dev
# Ctrl+C then run: npx convex dev
```

### Build errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules convex/_generated
npm install
npx convex dev --once
npm run build
```

### TypeScript errors in `convex/_generated`

**Fix**: This directory is auto-generated. Don't edit it manually.
```bash
# Regenerate
npx convex dev --once
```

## Verification Checklist

Before proceeding, verify:

- ✅ Convex dev server running (`npx convex dev`)
- ✅ Next.js dev server running (`npm run dev`)
- ✅ Can access http://localhost:3000
- ✅ Google OAuth working (can sign in)
- ✅ Convex dashboard shows your collections
- ✅ No TypeScript errors (`npx tsc --noEmit`)

## Next Steps

- Read [Convex Migration Plan](./CONVEX_MIGRATION_PLAN.md) to understand the architecture
- Check [Architecture Proposal](./Arquitectura%20propuesta%20(Next.js%2015%20+%20Vercel%20+%20Convex).md) for design decisions
- See [API Reference](./API_REFERENCE.md) for endpoint documentation
- Review [Security](./SECURITY.md) for authorization patterns
- Deploy with [Deployment Guide](./DEPLOYMENT.md)

## Support

- Email: administracion@ipupy.org.py
- GitHub Issues: [Report bugs](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)
- Convex Docs: [docs.convex.dev](https://docs.convex.dev)

---

**Ready to go!** 🚀 You should now have a working local instance of IPU PY Tesorería running on Convex.
