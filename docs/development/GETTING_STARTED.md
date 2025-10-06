# Getting Started - IPU PY Tesorería

Complete setup guide for developers joining the IPUPY_Tesoreria project.

**Target Audience**: New developers setting up their development environment for the first time.

**Time to Complete**: 30-45 minutes

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Repository Setup](#repository-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [First Run](#first-run)
- [Verification Steps](#verification-steps)
- [IDE Setup](#ide-setup)
- [Common Setup Issues](#common-setup-issues)
- [Next Steps](#next-steps)

---

## Prerequisites

### Required Software

Install the following before beginning:

#### 1. Node.js 20+

```bash
# macOS (using Homebrew)
brew install node@20

# Verify installation
node --version  # Should be 20.x or higher
npm --version   # Should be 10.x or higher
```

#### 2. Git

```bash
# macOS
brew install git

# Verify installation
git --version  # Should be 2.x or higher
```

#### 3. VS Code (Recommended IDE)

Download from [code.visualstudio.com](https://code.visualstudio.com/)

#### 4. PostgreSQL Client (Optional but Useful)

```bash
# macOS - Install psql command-line tool
brew install postgresql@16

# Or use a GUI client like:
# - TablePlus: https://tableplus.com/
# - Postico: https://eggerapps.at/postico/
```

### Required Accounts

You'll need access to:

1. **GitHub Repository**
   - Request access from: administracion@ipupy.org.py
   - Repository: `anthonybirhouse/ipupy-tesoreria` (private)

2. **Supabase Project**
   - Request project invite from admin
   - Production project: `ipupytesoreria`
   - Development project: (optional, recommended)

3. **Google Cloud Console** (for OAuth testing)
   - Request access if testing authentication
   - OAuth credentials already configured for production

4. **Vercel** (optional, for deployment testing)
   - Request team invite from admin
   - Used for preview deployments

---

## Repository Setup

### 1. Clone the Repository

```bash
# Choose your workspace directory
cd ~/workspace  # or wherever you keep projects

# Clone the repository
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Verify you're on the main branch
git branch
# Output: * main
```

### 2. Install Dependencies

```bash
# Install all npm packages
npm install

# Expected output: ~400 packages installed in ~2 minutes
# Total install size: ~250MB
```

**Troubleshooting**:
- If `npm install` fails with permission errors, check your Node.js installation
- If you see peer dependency warnings, they're safe to ignore
- If install hangs, try clearing npm cache: `npm cache clean --force`

### 3. Verify Installation

```bash
# Check that build scripts are available
npm run --list

# You should see:
# - dev
# - dev:turbo
# - build
# - start
# - lint
# - lint:strict
# - typecheck
# - validate
```

---

## Environment Configuration

### Understanding Environment Files

The project uses different environment files for different purposes:

- `.env.local` - Your local development environment (gitignored)
- `.env.example` - Template showing required variables
- `.env.production` - Production settings (DO NOT commit sensitive values)

### 1. Copy Environment Template

```bash
# Create your local environment file
cp .env.example .env.local
```

### 2. Configure Supabase Connection

Open `.env.local` in your editor and add Supabase credentials:

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to Find These Values**:

1. Log into [supabase.com](https://supabase.com)
2. Open your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (secret!)

### 3. Configure Database Connection

```bash
# Database URL (Required for Vercel, optional for local)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Where to Find This**:

1. Supabase Dashboard → **Settings** → **Database**
2. Look for "Connection String"
3. Choose "Connection Pooler" tab
4. Copy the **Transaction** mode URL
5. Replace `[YOUR-PASSWORD]` with your database password

**Connection Modes**:
- **Transaction Mode** (port 6543): Use this for Vercel serverless
- **Session Mode** (port 5432): Use for local development with long connections

### 4. Configure Google OAuth (Optional)

For local authentication testing:

```bash
# Google OAuth (Optional - for local Google login)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Note**: For development, you can skip this and use the existing production OAuth. Authentication will redirect but still work.

### 5. Set Organization Details

```bash
# Organization Settings
SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME=Iglesia Pentecostal Unida del Paraguay

# Environment
NODE_ENV=development
```

### 6. Verify Environment Variables

```bash
# Run the environment checker
npm run dev

# If environment variables are missing/invalid, you'll see errors like:
# ❌ NEXT_PUBLIC_SUPABASE_URL is required
# ❌ SUPABASE_SERVICE_ROLE_KEY is required
```

**Important**: The app validates critical environment variables at startup and will fail fast if misconfigured.

---

## Database Setup

### Option A: Use Existing Supabase Database

**Recommended for most developers** - Connect to shared development database.

1. Database already has:
   - All tables and schemas (migrations 000-041 applied)
   - 22 pre-loaded churches
   - Sample users and data
   - RLS policies enabled

2. Your Supabase credentials in `.env.local` are sufficient

3. Test connection:

```bash
# Install Supabase CLI (optional)
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Verify connection
supabase db remote commit
# Output: Connected to [project-name]
```

### Option B: Set Up Local Database (Advanced)

**For developers needing isolated database** - Requires Docker.

<details>
<summary>Click to expand local database setup instructions</summary>

#### 1. Install Docker

```bash
# macOS
brew install --cask docker

# Start Docker Desktop
open /Applications/Docker.app
```

#### 2. Initialize Supabase Locally

```bash
# Initialize Supabase in project
supabase init

# Start local Supabase stack
supabase start

# Output will show:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# anon key: eyJhbGciOiJ...
# service_role key: eyJhbGciOiJ...
```

#### 3. Update .env.local for Local

```bash
# Local Supabase (when using Docker)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-from-supabase-start]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key-from-supabase-start]
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

#### 4. Apply Migrations

```bash
# Apply all migrations to local database
supabase db push

# Verify migrations
supabase db remote commit
# Should show 41 migrations applied
```

#### 5. Seed Local Database

```bash
# Load sample data
npm run db:seed  # (if seed script exists)

# Or manually via Studio
open http://localhost:54323
```

</details>

### Database Migrations Status

Current production database has 41 migrations applied:

- **000-010**: Initial schema, auth, RLS foundation
- **011-020**: Performance, indexes, donor registry
- **021-030**: Role system, configuration, fund events, providers
- **031-041**: Security hardening, national treasurer role

**View migration history**: [docs/MIGRATION_HISTORY.md](../migrations/MIGRATION_HISTORY.md)

---

## First Run

### 1. Start Development Server

```bash
# Standard Next.js dev server
npm run dev

# Or with Turbopack (faster)
npm run dev:turbo
```

**Expected Output**:

```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- info  Loaded env from .env.local
- event compiled client and server successfully in 3.2s
```

### 2. Open Application

Navigate to [http://localhost:3000](http://localhost:3000)

**What You Should See**:

1. **Login Page** - Google OAuth button and domain restriction notice
2. **Domain Restriction**: Only `@ipupy.org.py` emails allowed
3. **Clean layout** with IPU PY branding

### 3. Test Authentication (Optional)

**Note**: You need a test user account in the Supabase database.

1. Click "Iniciar sesión con Google"
2. Authenticate with your `@ipupy.org.py` account
3. You'll be redirected to `/dashboard` after successful login

**If you don't have test credentials**:
- Request test account from administracion@ipupy.org.py
- Or create user directly in Supabase Dashboard → Authentication

### 4. Test Basic Functionality

Once logged in, verify these pages load:

- [x] **Dashboard** (`/dashboard`) - Shows financial metrics
- [x] **Churches** (`/churches`) - Lists 22 churches
- [x] **Reports** (`/reports`) - Monthly report list
- [x] **Funds** (`/funds`) - Fund management (admin only)

---

## Verification Steps

### 1. TypeScript Compilation

```bash
# Run TypeScript type check
npm run typecheck

# Expected output:
# No errors found ✅

# If you see errors:
# - Check your Node.js version (must be 20+)
# - Ensure all dependencies installed: npm install
# - Review docs/development/TYPE_SAFETY_GUIDE.md for fixing patterns
```

### 2. Linting

```bash
# Run ESLint
npm run lint

# Expected output:
# ✔ No ESLint warnings or errors

# For zero-warning enforcement:
npm run lint:strict

# This is what pre-commit hooks use
```

### 3. Build Production Bundle

```bash
# Test production build
npm run build

# Expected output:
# Route (app)                              Size     First Load JS
# ┌ ○ /                                    5.2 kB         120 kB
# ├ ○ /churches                            8.4 kB         135 kB
# ├ ○ /dashboard                           12.1 kB        140 kB
# ...
# ○  (Static)  automatically rendered as static HTML
#
# Build completed in 45s ✅
```

### 4. Test API Routes

```bash
# Test health check endpoint
curl http://localhost:3000/api/churches

# Expected: JSON array of churches (requires auth header for most)
```

### 5. Database Connection Test

Check that database queries work:

```bash
# Open Supabase Studio
supabase studio

# Or visit your Supabase Dashboard
open https://app.supabase.com/project/your-project-ref/editor

# Run test query:
SELECT COUNT(*) FROM churches WHERE active = true;
# Expected: 22 active churches
```

---

## IDE Setup

### VS Code Extensions (Recommended)

Install these for optimal development experience:

#### Required Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",           // ESLint integration
    "esbenp.prettier-vscode",           // Code formatting
    "bradlc.vscode-tailwindcss",        // Tailwind CSS IntelliSense
    "ms-vscode.vscode-typescript-next", // Latest TypeScript features
  ]
}
```

Install via Command Palette (Cmd+Shift+P):
```
Extensions: Install Extensions
```

#### Optional but Useful

```json
{
  "recommendations": [
    "supabase.supabase-vscode",         // Supabase integration
    "prisma.prisma",                    // SQL syntax highlighting
    "github.copilot",                   // AI pair programming
    "usernamehw.errorlens",             // Inline error display
    "gruntfuggly.todo-tree"             // TODO comment tracking
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/.vercel": true
  }
}
```

### Keyboard Shortcuts

The app includes Vim-style keyboard shortcuts:

- `g h` - Go to home/dashboard
- `g i` - Go to churches (iglesias)
- `g r` - Go to reports
- `g f` - Go to funds
- `?` - Show help modal

**Enable in app**: Shortcuts work automatically, press `?` to see full list.

---

## Common Setup Issues

### Issue 1: `npm install` Fails

**Symptom**:
```
npm ERR! code EACCES
npm ERR! syscall access
npm ERR! path /usr/local/lib/node_modules
```

**Fix**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) /usr/local/lib/node_modules
npm install
```

### Issue 2: TypeScript Errors on First Run

**Symptom**:
```
Type error: Cannot find module '@/lib/supabase/server'
```

**Fix**:
```bash
# Clear Next.js cache
rm -rf .next
rm -rf node_modules/.cache

# Reinstall and rebuild
npm install
npm run dev
```

### Issue 3: Environment Variables Not Loading

**Symptom**:
```
Error: NEXT_PUBLIC_SUPABASE_URL is required
```

**Fix**:

1. Verify `.env.local` exists in project root (not in subdirectory)
2. Restart dev server after changing env vars
3. Check variable names match exactly (case-sensitive)
4. No spaces around `=` sign

```bash
# ❌ Wrong
NEXT_PUBLIC_SUPABASE_URL = https://...

# ✅ Correct
NEXT_PUBLIC_SUPABASE_URL=https://...
```

### Issue 4: Database Connection Timeout

**Symptom**:
```
Error: Connection terminated unexpectedly
```

**Fixes**:

1. **Use Connection Pooler**:
   ```bash
   # Change from port 5432 to 6543
   DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres
   ```

2. **Check Supabase Project Status**:
   - Project might be paused (free tier)
   - Visit Supabase dashboard to wake it up

3. **Verify Database Password**:
   ```bash
   # Test connection with psql
   psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
   ```

### Issue 5: Google OAuth Redirect Fails

**Symptom**:
```
redirect_uri_mismatch error
```

**Fix**:

Add `http://localhost:3000/auth/callback` to allowed redirect URIs:

1. Google Cloud Console → APIs & Services → Credentials
2. Select OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/api/auth/callback`

### Issue 6: Supabase RLS "Permission Denied"

**Symptom**:
```
Error: permission denied for table churches
```

**Cause**: Database queries not using RLS context.

**Fix**: All queries must use `executeWithContext()`:

```typescript
// ❌ Wrong
const result = await pool.query('SELECT * FROM churches');

// ✅ Correct
const result = await executeWithContext(auth, async (client) => {
  return await client.query('SELECT * FROM churches');
});
```

See [docs/database/RLS_POLICIES.md](../database/RLS_POLICIES.md) for details.

### Issue 7: Port 3000 Already in Use

**Symptom**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Fixes**:

```bash
# Option 1: Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use different port
PORT=3001 npm run dev

# Option 3: Find and kill Next.js process
ps aux | grep next
kill [PID]
```

---

## Next Steps

### 1. Read Core Documentation

Start with these essential docs:

- **[CLAUDE.md](../../CLAUDE.md)** - Project overview and architecture
- **[TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md)** - TypeScript patterns and enforcement
- **[COMMON_TASKS.md](../development/COMMON_TASKS.md)** - Recipe-style task guides
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - System design and patterns

### 2. Explore the Codebase

Recommended exploration order:

```bash
# 1. Understand project structure
ls -la src/

# 2. Review key libraries
cat src/lib/db-context.ts      # RLS context management
cat src/lib/auth-supabase.ts   # Authentication
cat src/lib/db-admin.ts        # Database operations

# 3. Study API route pattern
cat src/app/api/churches/route.ts

# 4. Examine component structure
ls src/components/
cat src/components/ui/button.tsx  # shadcn/ui component example
```

### 3. Pick Your First Task

Good starter tasks for new developers:

- [ ] Fix a TypeScript type error (check GitHub Issues labeled `good-first-issue`)
- [ ] Add a new shadcn/ui component
- [ ] Write documentation for an undocumented feature
- [ ] Add a new validation rule using Zod
- [ ] Create a new TanStack Query hook
- [ ] Fix an ESLint warning

### 4. Set Up Pre-Commit Hooks

Hooks are installed automatically on `npm install` via Husky:

```bash
# Verify hooks installed
ls -la .husky/
# You should see: pre-commit

# Test pre-commit validation
npm run validate
# Runs: typecheck && lint:strict
```

**What hooks do**:
- Run TypeScript compilation check
- Run ESLint with zero warnings enforcement
- Block commits with type errors or linting issues

### 5. Join the Team

- **Slack**: Request invite to `#dev-ipupy-tesoreria`
- **GitHub**: Watch repository for updates
- **Meetings**: Weekly standup (ask admin for calendar invite)
- **Contact**: administracion@ipupy.org.py for questions

### 6. Review Development Workflow

Standard workflow:

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes, commit often
3. Run validation: `npm run validate`
4. Push branch: `git push -u origin feature/my-feature`
5. Create PR on GitHub
6. Wait for CI checks ✅
7. Request review from team
8. Merge when approved

---

## Additional Resources

### Documentation
- [API Reference](../API_REFERENCE.md)
- [Database Schema](../database/SCHEMA_REFERENCE.md)
- [Security Guide](../SECURITY.md)
- [Migration History](../migrations/MIGRATION_HISTORY.md)

### External Links
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

### Community
- **Email**: administracion@ipupy.org.py
- **Repository**: github.com/anthonybirhouse/ipupy-tesoreria
- **Production**: ipupytesoreria.vercel.app

---

## Checklist: Setup Complete

Mark these off as you complete them:

- [ ] Node.js 20+ installed and verified
- [ ] Repository cloned successfully
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` configured with Supabase credentials
- [ ] Development server runs (`npm run dev`)
- [ ] Can access http://localhost:3000
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Production build succeeds (`npm run build`)
- [ ] VS Code extensions installed
- [ ] Pre-commit hooks verified
- [ ] Read CLAUDE.md and [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md)
- [ ] Can authenticate (optional)
- [ ] Joined team communication channels

---

**Congratulations!** 🎉 You're ready to start developing on IPU PY Tesorería.

If you encountered issues not covered here, please document them and submit a PR to improve this guide.

**Next**: Read [COMMON_TASKS.md](../development/COMMON_TASKS.md) for practical development recipes.
