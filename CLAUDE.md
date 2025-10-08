# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IPU PY Tesorería** is a modern treasury management system for the Iglesia Pentecostal Unida del Paraguay (United Pentecostal Church of Paraguay). Built with Next.js 15, TypeScript, Convex, and NextAuth to manage financial operations for 22 local churches with centralized reporting.

**Stack**: Next.js 15 (App Router) + React 19 + TypeScript + Convex (Document Database + Real-time) + NextAuth v5 + Tailwind CSS 4 + shadcn/ui

**Production**: https://ipupytesoreria.vercel.app

## Development Commands

```bash
# Development (requires both servers running)
npx convex dev           # Convex backend server (run in separate terminal)
npm run dev              # Next.js dev server (port 3000)
npm run dev:turbo        # Dev with Turbopack (faster)

# Production
npm run build            # Build for production (includes TypeScript check)
npm start                # Start production server
npx convex deploy        # Deploy Convex backend to production

# Quality & Type Safety
npm run typecheck        # TypeScript compilation check (tsc --noEmit)
npm run typecheck:watch  # Watch mode for development
npm run lint             # ESLint check
npm run lint:strict      # ESLint with zero warnings allowed
npm run validate         # Run typecheck + lint:strict

# Data Migration (Supabase → Convex)
npm run export-supabase  # Export data from Supabase
npm run transform-data   # Transform to Convex format
npm run migrate-data     # Full migration pipeline
```

**IMPORTANT**: Development requires both `npx convex dev` AND `npm run dev` running simultaneously in separate terminals.

## Architecture

### Directory Structure

```
src/
├── app/                      # Next.js 15 App Router
│   ├── api/                  # API routes (serverless)
│   │   ├── admin/            # Admin-only endpoints (users, reports, config)
│   │   ├── auth/             # Auth callback
│   │   ├── churches/         # Church management
│   │   ├── reports/          # Monthly reports
│   │   └── dashboard/        # Dashboard data
│   ├── (routes)/             # Application pages
│   │   ├── churches/         # Church management UI
│   │   ├── reports/          # Monthly reports UI
│   │   ├── funds/            # Fund management
│   │   ├── transactions/     # Transaction ledger
│   │   ├── export/           # Excel export
│   │   └── login/            # Login page
│   ├── layout.tsx            # Root layout with providers
│   └── providers.tsx         # Client-side providers (Auth, Query)
├── components/               # React components
│   ├── ui/                   # shadcn/ui components (button, dialog, etc.)
│   ├── Auth/                 # Authentication components
│   ├── Churches/             # Church management
│   ├── Reports/              # Report forms and views
│   ├── Shared/               # Reusable UI components
│   └── Layout/               # Layout components
├── lib/                      # Core utilities
│   ├── auth.ts               # NextAuth configuration
│   ├── convex-server.ts      # Server-side Convex client
│   ├── convex-id-mapping.ts  # Legacy ID compatibility layer
│   ├── auth-context.ts       # Auth context type definitions
│   ├── cors.ts               # CORS configuration
│   └── rate-limit.ts         # API rate limiting
├── hooks/                    # React hooks (TanStack Query)
│   ├── useChurches.ts        # Church data queries
│   ├── useReports.ts         # Report data queries
│   └── useAdminData.ts       # Admin data queries
├── types/                    # TypeScript type definitions
└── styles/                   # Global styles & CSS tokens

convex/                      # Convex backend functions
├── schema.ts                # Database schema definition
├── churches.ts              # Church queries and mutations
├── reports.ts               # Report operations
├── fundEvents.ts            # Fund events with approval workflow
├── auth.config.ts           # OIDC bridge configuration
└── _generated/             # Auto-generated API files

scripts/                     # Utility scripts
```

## Database Architecture

### Convex Document Database

The system uses **Convex** as its primary backend, providing:
- TypeScript-first schema definition (`convex/schema.ts`)
- Real-time reactive queries with automatic updates
- Serverless functions (queries, mutations, actions)
- Built-in authorization with `ctx.auth()`

### Legacy ID Compatibility

To maintain backward compatibility with existing REST APIs, Convex documents include a `supabase_id` field:
- All documents store their original PostgreSQL numeric ID
- API responses map Convex `_id` to `id` for client compatibility
- See `src/lib/convex-id-mapping.ts` for mapping utilities

### Core Collections

- **churches** - 22 IPU Paraguay churches with pastor information (includes `supabase_id`)
- **monthlyReports** - Financial reports with church references
- **profiles** - User profiles with 6-role system
- **systemConfiguration** - Admin-configurable settings
- **fundBalances** - Fund balances by church
- **fundTransactions** - Financial transaction ledger
- **fundEvents** - Event budgeting with approval workflow
- **donors** - Donor registry
- **userActivity** - Complete audit trail
- **providers** - Centralized provider registry

### Authorization Pattern

**CRITICAL**: All Convex functions MUST verify authentication and authorization.

```typescript
// Example authorization pattern
export const approve = mutation({
  handler: async (ctx, { id }) => {
    // 1. Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // 2. Load user profile with role
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .unique();

    // 3. Check role permissions
    if (!["admin", "treasurer"].includes(user.role)) {
      throw new Error("Unauthorized");
    }

    // 4. Perform authorized operation
    // ...
  },
});
```

See `convex/` directory for authorization patterns in each function.

### Schema Evolution

The Convex schema is defined in `convex/schema.ts` and automatically deployed. Changes to the schema are version-controlled in git and deployed via `npx convex deploy`.

**Migration from Supabase**: The original PostgreSQL migrations (000-037) are preserved in the `migrations/` directory for historical reference but are no longer actively used. Data was migrated to Convex with ID preservation.

## Authentication & Authorization

### Auth Provider

**NextAuth v5** with Google OAuth + Convex OIDC Bridge
- **Frontend**: NextAuth handles Google OAuth flow
- **Backend**: Convex OIDC bridge validates JWT tokens
- Domain restriction: `@ipupy.org.py` only
- Admin: `administracion@ipupy.org.py`

#### Auth Flow

1. User initiates Google OAuth via NextAuth (`/api/auth/signin`)
2. Google returns JWT token with email/profile
3. NextAuth creates session with user info
4. Convex receives JWT via OIDC bridge
5. Convex validates token and loads user profile from `profiles` collection
6. Backend functions access user via `ctx.auth.getUserIdentity()`

### Role System

The system uses a 6-role hierarchical model defined in the `profiles` collection:

1. **admin** - Platform administrators (highest level)
2. **fund_director** - Fund-specific management
3. **pastor** - Church leaders
4. **treasurer** - Church financial operations
5. **church_manager** - Church administration (view-only)
6. **secretary** - Church administrative support (lowest level)

**Authorization Pattern in Convex**:
```typescript
// Always verify role in Convex functions
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

const user = await ctx.db
  .query("profiles")
  .withIndex("by_email", (q) => q.eq("email", identity.email))
  .unique();

if (!["admin", "treasurer"].includes(user.role)) {
  throw new Error("Unauthorized");
}
```

## Key System Features

### Treasury Management
- Monthly financial reports with automatic calculations
- 10% national fund (`fondo_nacional`) auto-calculated
- Bank deposit tracking with receipt uploads
- Multi-fund accounting system
- Excel import/export (XLSX)

### Fund Events System
- Event budget planning with line items
- Actual income/expense tracking post-event
- Treasurer approval workflow (draft → submitted → approved)
- Automatic ledger transaction creation on approval
- Variance analysis (budget vs actuals)
- Fund director role with restricted fund access

### Provider Registry (Migration 027)
- Centralized provider database with RUC validation
- Automatic RUC deduplication across churches
- Backfill script migrated existing providers (migration 028)

### Admin Features
- User management with role assignment
- System configuration panel (by sections)
- Report approval workflow
- Audit trail monitoring
- Excel export for accounting

## TypeScript Configuration

**Maximum strict mode enabled** - Pre-commit hooks enforce type safety:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noPropertyAccessFromIndexSignature": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

### Type Safety Enforcement

**Pre-commit Hooks** (`.husky/pre-commit`):
- Runs `lint-staged` which checks TypeScript + ESLint on staged files
- **IMPORTANT**: Pre-commit hooks currently check for legacy Supabase RLS bypass patterns (`pool.query()`)
- These checks will be removed/updated as Convex migration completes

**Type Safety Commands:**
- `npm run typecheck` - Check TypeScript compilation without building
- `npm run typecheck:watch` - Watch mode for continuous checking
- `npm run lint:strict` - ESLint with zero warnings allowed
- `npm run validate` - Run typecheck + lint:strict together

**Best Practices:**
- ❌ Never use `any` without explicit justification comment
- ❌ Never call `useState()` without explicit generic type
- ✅ Always add return types to exported functions
- ✅ Use optional chaining (`?.`) for nullable data
- ✅ Define proper interfaces in `src/types/`

**NEVER disable strict checks in tsconfig.json**. Fix types instead of loosening compiler.

See [TYPE_SAFETY_GUIDE.md](./docs/TYPE_SAFETY_GUIDE.md) for detailed patterns and fixes.

## Component Patterns

### UI Components (shadcn/ui)

Located in `src/components/ui/` - Radix UI primitives styled with Tailwind:
- `button.tsx`, `dialog.tsx`, `select.tsx`, `input.tsx`, etc.
- Use `cn()` utility from `src/lib/utils/cn.ts` for class merging

### Data Fetching

**Current State (Hybrid - Phase 5 in progress)**:
- TanStack Query v5 hooks in `src/hooks/` (being migrated)
- Convex React hooks being rolled out incrementally

```typescript
// Current pattern (TanStack Query - being phased out)
const { data: churches } = useChurches();

// New pattern (Convex React - Phase 5)
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const churches = useQuery(api.churches.list);
```

**Migration Status**: See [CONVEX_MIGRATION_PLAN.md](./docs/CONVEX_MIGRATION_PLAN.md) Phase 5 for details.

### API Routes Pattern

REST API routes now call Convex functions as a compatibility layer:

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

export async function GET(req: NextRequest) {
  // 1. Verify NextAuth session
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  // 2. Initialize Convex HTTP client
  const client = new ConvexHttpClient(process.env['CONVEX_URL']!);

  // 3. Call Convex function (auth handled by OIDC bridge)
  const data = await client.query(api.example.list);

  return NextResponse.json(data);
}
```

## Environment Variables

Required variables (see `.env.example`):

```bash
# Convex (Required)
CONVEX_DEPLOYMENT=prod:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# NextAuth (Required)
NEXTAUTH_URL=https://ipupytesoreria.vercel.app
NEXTAUTH_SECRET=<generate-with-openssl-rand>

# Google OAuth (Required)
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# Organization
SYSTEM_OWNER_EMAIL=administracion@ipupy.org.py
ORGANIZATION_NAME=IPU PY

# Environment
NODE_ENV=production
```

**Vercel auto-sets**: `NEXT_PUBLIC_SITE_URL` and `VERCEL_URL`

## Language & Localization

- **Primary Language**: Spanish (Paraguay)
- All UI text, database fields, and comments in Spanish
- Currency: Paraguayan Guaraní (₲)
- Use `formatCurrency()` from `src/lib/utils/currency.ts`

## Security Best Practices

1. **Always verify auth in Convex functions**: Use `ctx.auth.getUserIdentity()` at start of every function
2. **Check role permissions**: Load user profile and verify role before operations
3. **Validate auth on API routes**: Use `getServerSession()` from NextAuth
4. **CORS restrictions**: Only allow approved origins (see `src/lib/cors.ts`)
5. **Rate limiting**: Applied on sensitive API routes
6. **Audit logging**: User actions logged in `userActivity` collection

## Development Best Practices

### Critical Development Workflow ⚠️

**ALWAYS run both development servers:**
```bash
# Terminal 1 - Convex backend
npx convex dev

# Terminal 2 - Next.js frontend
npm run dev
```

If you only run `npm run dev`, Convex queries will fail with connection errors.

### Manual and Systematic Approach ⚠️

**CRITICAL**: When fixing issues, especially production bugs, always take a manual and systematic approach:

1. **Avoid Bulk Automation Scripts** ❌
   - Scripts that modify multiple files or environment variables at once can mask issues
   - Automated fixes often miss edge cases or create new problems
   - Example: Bulk scripts that "fix" env vars without checking what actually exists

2. **Manual Investigation First** ✅
   - Read error messages carefully and trace the root cause
   - Check actual state:
     - Vercel: `vercel env ls` to see deployed variables
     - TypeScript: `npm run typecheck` to see compilation errors
     - Build: `npm run build` to catch production issues
   - Verify assumptions before applying fixes
   - Use Convex dashboard to inspect database state

3. **Fix One Thing at a Time** ✅
   - Make single, focused changes
   - Test each change before moving to the next
   - Commit each fix separately with clear messages
   - Example: Fix type error → commit → fix ESLint warning → commit

4. **Verify at Each Step** ✅
   - TypeScript: `npm run typecheck` (or `npm run typecheck:watch` during dev)
   - Linting: `npm run lint:strict`
   - Build: `npm run build`
   - Test in browser with Convex dev server running
   - Check Convex dashboard for data/function logs

### Environment Variables - Critical Patterns

**NEXT_PUBLIC_* Variables** (Client-Side):
- Required for any env var accessed in browser/client components
- Must use **inline** access for Next.js static replacement:
  ```typescript
  // ✅ Correct - inline access in object literal
  const config = {
    url: process.env['NEXT_PUBLIC_CONVEX_URL'] ?? ''
  };

  // ❌ Wrong - intermediate variable breaks replacement
  const url = process.env['NEXT_PUBLIC_CONVEX_URL'];
  const config = { url };
  ```

**Server-Only Variables**:
- No prefix needed
- Access via `getEnv()` or direct `process.env`
- Never expose secrets to client bundle

**Vercel-Specific**:
- Always verify variable names match between code and Vercel dashboard
- Use `vercel env ls` to inspect actual variable names
- Remember: `CONVEX_URL` (server) ≠ `NEXT_PUBLIC_CONVEX_URL` (client)

### Client/Server Code Separation

**Server-Only Code Patterns**:
```typescript
// ✅ Proper server-only check
if (typeof window === 'undefined' && process.stdout) {
  process.stdout.write('...');
}

// ❌ Insufficient check
if (typeof process !== 'undefined') {
  process.stdout.write('...'); // process exists in browser, but stdout doesn't!
}
```

**Client-Safe Utilities**:
- Always provide browser fallbacks
- Check for Node.js APIs before using them
- Example: Logger uses `console` in browser, `process.stdout` in Node.js

### Debugging Production Issues

1. **Check Browser Console** (Client errors)
   - Environment variable errors
   - Runtime exceptions
   - Network request failures

2. **Check Vercel Logs** (Server errors)
   - Build errors
   - API route failures
   - Environment variable issues

3. **Verify Environment Variables**
   ```bash
   vercel env ls                    # List all variables
   vercel env pull .env.local       # Pull to check values locally
   ```

4. **Test Specific Deployments**
   - Use deployment URL to test specific builds
   - Compare working vs failing deployments
   - Check what changed between versions

## Common Development Tasks

### Adding a New API Route

1. Create route file in `src/app/api/[name]/route.ts`
2. Import `getServerSession` from NextAuth
3. Validate authentication with NextAuth session
4. Initialize `ConvexHttpClient` to call Convex functions
5. Add CORS headers if needed (see `src/lib/cors.ts`)

### Adding a New Convex Function

1. Create or update file in `convex/[feature].ts`
2. Define schema in `convex/schema.ts` if adding new table
3. Implement query, mutation, or action with proper auth checks
4. Use `ctx.auth.getUserIdentity()` to verify authentication
5. Load user profile and verify role permissions
6. Add type definitions in `src/types/` if needed

### Adding a New UI Component

1. Check if shadcn/ui component exists (`src/components/ui/`)
2. Create feature component in appropriate directory
3. Use Tailwind classes with `cn()` utility
4. Import from `@/components/ui` for base components
5. Follow existing component patterns (props, state, queries)

## Convex Migration Status

**IMPORTANT**: The system is mid-migration from Supabase to Convex.

**Current State:**
- ✅ **Schema**: Fully migrated to Convex (`convex/schema.ts`)
- ✅ **Backend Functions**: Core queries/mutations implemented in `convex/*.ts`
- ✅ **Auth**: NextAuth v5 with Convex OIDC bridge active
- ⚠️ **API Routes**: REST endpoints (`src/app/api/`) still call Convex via HTTP client
- ⚠️ **Frontend**: Mix of TanStack Query hooks and Convex React hooks
- ⚠️ **Data**: Legacy `supabase_id` fields preserved for compatibility

**Known Migration Artifacts:**
- Pre-commit hooks check for Supabase `pool.query()` patterns (will be removed)
- Some API routes exist as compatibility wrappers over Convex functions
- Migration scripts in `scripts/` for data export/transform

**Next Steps:**
- Phase 5: Replace TanStack Query hooks with Convex React hooks
- Remove REST API compatibility layer where possible
- Clean up Supabase references in comments/docs

See migration scripts: `npm run export-supabase`, `npm run transform-data`

## Testing Strategy

**No formal test suite currently**. Manual testing approach:

1. Test in development with `npm run dev` + `npx convex dev`
2. Verify TypeScript with `npm run typecheck` or `npm run build`
3. Check ESLint with `npm run lint` or `npm run lint:strict`
4. Manual testing of features in browser
5. Database queries tested via Convex dashboard (https://dashboard.convex.dev)

**Pre-deployment validation:**
```bash
npm run validate  # Run typecheck + lint:strict together
npm run build     # Full production build
```

## Deployment

### Convex Backend

```bash
npx convex deploy
```

Monitors schema changes and deploys functions automatically.

### Vercel Frontend

1. Push to `main` branch
2. Vercel auto-builds and deploys Next.js app
3. Environment variables managed in Vercel dashboard
4. Monitor logs in Vercel dashboard

**Pre-deployment checklist**:
- ✅ `npm run lint` passes
- ✅ `npm run build` succeeds
- ✅ Environment variables configured in Vercel
- ✅ `npx convex deploy` completed successfully
- ✅ Convex OIDC bridge configured for Google OAuth

## Common Pitfalls & Quick Fixes

### Convex Connection Errors
**Symptom**: "Failed to fetch" or connection errors in browser console

**Fix**:
```bash
# Make sure Convex dev server is running
npx convex dev
```
You need BOTH `npx convex dev` AND `npm run dev` running simultaneously.

### Environment Variable Not Found (Client Side)
**Symptom**: `undefined` when accessing `process.env.NEXT_PUBLIC_*` in components

**Fix**: Use inline access in object literals for Next.js static replacement:
```typescript
// ✅ Correct
const config = {
  url: process.env['NEXT_PUBLIC_CONVEX_URL'] ?? ''
};

// ❌ Wrong - breaks static replacement
const url = process.env['NEXT_PUBLIC_CONVEX_URL'];
const config = { url };
```

### TypeScript Errors After Pull
**Symptom**: New type errors after pulling changes

**Fix**:
```bash
npm install           # Update dependencies
npm run typecheck     # See all errors
npm run typecheck:watch  # Fix in watch mode
```

### Build Fails in Production but Works Locally
**Symptom**: `npm run dev` works but `npm run build` fails

**Common causes**:
1. Missing environment variables (check Vercel dashboard)
2. TypeScript errors in production-only code paths
3. Client/server code separation issues

**Fix**:
```bash
npm run build  # Reproduce locally first
npm run validate  # Check types + lint
```

## Troubleshooting

### Convex Auth Errors

**Symptom**: "Not authenticated" or "Unauthorized" errors

**Fix**:
1. Verify NextAuth session is active (check `/api/auth/session`)
2. Ensure `NEXTAUTH_SECRET` is set correctly
3. Check Convex OIDC bridge configuration in dashboard
4. Verify Google OAuth credentials and redirect URLs

### TypeScript Errors

**Never disable `strict` mode**. Fix type errors properly:
- Add explicit type annotations
- Use optional chaining (`?.`) for nullable data
- Define proper interfaces in `src/types/`

### Real-time Subscription Issues

**Symptom**: UI not updating when data changes

**Check**:
1. Convex React provider is wrapping app (`ConvexProvider` in `providers.tsx`)
2. Using `useQuery` from `convex/react` not TanStack Query
3. Component subscribed to correct Convex function
4. Convex dev server running (`npx convex dev`)

### Auth Issues

Check:
1. NextAuth configured correctly in `src/lib/auth.ts`
2. Google OAuth credentials valid
3. Redirect URLs match production domain
4. Cookies enabled in browser
5. OIDC bridge active in Convex dashboard

## Documentation References

**Getting Started:**
- [README.md](./README.md) - Project overview and features
- [QUICK_START.md](./docs/QUICK_START.md) - Quick start guide
- [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md) - Development workflow

**Architecture & Database:**
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture
- [CONVEX_SCHEMA.md](./docs/CONVEX_SCHEMA.md) - Database schema reference
- [MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md) - Migration guides

**Operational:**
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Deployment procedures
- [ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) - Environment configuration
- [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- [MONITORING.md](./docs/MONITORING.md) - Monitoring and observability

**Development:**
- [TYPE_SAFETY_GUIDE.md](./docs/TYPE_SAFETY_GUIDE.md) - TypeScript patterns
- [COMMON_TASKS.md](./docs/COMMON_TASKS.md) - Common development tasks
- [TESTING.md](./docs/TESTING.md) - Testing strategy
- [COMPONENTS.md](./docs/COMPONENTS.md) - Component architecture

**Security & Compliance:**
- [SECURITY.md](./docs/SECURITY.md) - Security best practices
- [API_REFERENCE.md](./docs/API_REFERENCE.md) - API documentation

**Full Index:**
- [00-INDEX.md](./docs/00-INDEX.md) - Complete documentation index

## Support

Technical support: `administracion@ipupy.org.py`