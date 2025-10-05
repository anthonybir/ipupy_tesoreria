# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IPU PY Tesorería** is a modern treasury management system for the Iglesia Pentecostal Unida del Paraguay (United Pentecostal Church of Paraguay). Built with Next.js 15, TypeScript, and Supabase to manage financial operations for 22 local churches with centralized reporting.

**Stack**: Next.js 15 (App Router) + React 19 + TypeScript + Supabase (PostgreSQL + Auth) + Tailwind CSS 4 + shadcn/ui

**Production**: https://ipupytesoreria.vercel.app

## Development Commands

```bash
# Development
npm run dev              # Next.js dev server (port 3000)
npm run dev:turbo        # Dev with Turbopack

# Production
npm run build            # Build for production
npm start                # Start production server

# Quality
npm run lint             # ESLint check
```

**No separate typecheck script** - TypeScript checking happens during `npm run build`

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
│   ├── supabase/             # Supabase client & middleware
│   ├── db-context.ts         # RLS context management
│   ├── db-admin.ts           # Admin database operations
│   ├── auth-context.ts       # Auth context type definitions
│   ├── cors.ts               # CORS configuration
│   └── rate-limit.ts         # API rate limiting
├── hooks/                    # React hooks (TanStack Query)
│   ├── useChurches.ts        # Church data queries
│   ├── useReports.ts         # Report data queries
│   └── useAdminData.ts       # Admin data queries
├── types/                    # TypeScript type definitions
└── styles/                   # Global styles & CSS tokens

migrations/                   # SQL migrations (28 total)
scripts/                      # Utility scripts
```

## Database Architecture

### ⚠️ Known Technical Debt

**Database Access Pattern** (2025-10-05):
- Currently uses **hybrid approach**: Supabase Auth + Direct PostgreSQL (`pg` library)
- **Issue**: Connection timeouts on Vercel serverless (15s limit)
- **Current workaround**: Using pgBouncer connection pooler (port 6543)
- **Recommended migration**: Switch to Supabase JavaScript client exclusively
- **Documentation**: See [docs/future-improvements/MIGRATE_TO_SUPABASE_CLIENT.md](docs/future-improvements/MIGRATE_TO_SUPABASE_CLIENT.md)

This hybrid approach works but is not optimal for serverless environments. Future migration to Supabase client will eliminate connection timeouts and simplify the codebase.

### Core Tables

- **churches** - 22 pre-loaded IPU Paraguay churches with pastor information
- **monthly_reports** - Financial reports (diezmos, ofrendas, fondo_nacional)
- **profiles** - User profiles with simplified 6-role system (migration 023)
- **system_configuration** - Admin-configurable settings
- **fund_balances** - Fund balances by church
- **fund_transactions** - Financial transaction ledger
- **fund_events** - Event budgeting with approval workflow
- **donors** - Donor registry
- **user_activity** - Complete audit trail
- **providers** - Centralized provider registry (migration 027)

### Row Level Security (RLS)

**CRITICAL**: All database operations MUST set session context before queries.

The system uses PostgreSQL session variables for RLS enforcement:
- `app.current_user_id`
- `app.current_user_role`
- `app.current_user_church_id`

See `src/lib/db-context.ts` for context management utilities.

### Migration System

Migrations are numbered sequentially (000-037) and applied via Supabase. Key migrations:

- **010** - RLS implementation
- **023** - Role simplification (8→6 roles)
- **024** - RLS UUID fixes
- **026** - Fund director events system
- **027** - Provider registry with RUC deduplication
- **037** - Role system fixes (church_manager permissions, get_role_level(), obsolete role cleanup)

To run migrations: Use Supabase dashboard or `scripts/migrate.js`

## Authentication & Authorization

### Auth Provider

**Supabase Auth** with Google OAuth
- Domain restriction: `@ipupy.org.py` only
- Admin: `administracion@ipupy.org.py`
- Magic link fallback available

### Role System (Simplified v2.2)

6 hierarchical roles (migrations 023, 026, 037):

1. **admin** - Platform administrators (level 6)
2. **fund_director** - Fund-specific management (level 5) *added in migration 026*
3. **pastor** - Church leaders (level 4)
4. **treasurer** - Church financial operations (level 3)
5. **church_manager** - Church administration view-only (level 2)
6. **secretary** - Church administrative support (level 1)

**Migration History**:
- **023**: Initial simplification (`super_admin` → `admin`, `church_admin` → `pastor`)
- **026**: Added `fund_director` role and events system
- **037**: Fixed permissions & hierarchy (church_manager perms, removed obsolete roles)

**Obsolete roles removed in 037**: `district_supervisor`, `member`

### Auth Flow

1. User authenticates via Supabase Auth (Google OAuth)
2. `auth.callback` route handles OAuth response
3. Middleware validates session on protected routes
4. API routes use `getAuthFromCookies()` for user context
5. Database queries use `setDatabaseContext()` for RLS

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

### Type Safety Enforcement (Pre-Commit Hooks)

**CRITICAL:** All commits are blocked by pre-commit hooks if:
- ❌ TypeScript compilation errors exist (`tsc --noEmit`)
- ❌ ESLint warnings exist (`eslint --max-warnings 0`)
- ❌ `any` type is used without justification
- ❌ Missing return types on exported functions
- ❌ `useState()` called without explicit generic

**Scripts:**
- `npm run typecheck` - Check TypeScript compilation
- `npm run typecheck:watch` - Watch mode for development
- `npm run lint:strict` - ESLint with zero warnings
- `npm run validate` - Run both typecheck and lint

**NEVER disable strict checks**. Fix types instead of loosening compiler.

See [TYPE_SAFETY_GUIDE.md](./docs/TYPE_SAFETY_GUIDE.md) for detailed patterns and fixes.

## Component Patterns

### UI Components (shadcn/ui)

Located in `src/components/ui/` - Radix UI primitives styled with Tailwind:
- `button.tsx`, `dialog.tsx`, `select.tsx`, `input.tsx`, etc.
- Use `cn()` utility from `src/lib/utils/cn.ts` for class merging

### Data Fetching (TanStack Query v5)

Use custom hooks in `src/hooks/`:

```typescript
// Church data
const { data: churches } = useChurches();

// Reports with filters
const { data: reports } = useReports({
  churchId,
  year,
  month
});

// Mutations
const { mutate: updateChurch } = useChurchMutations();
```

### API Routes Pattern

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromCookies } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db-admin';

export async function GET(req: NextRequest) {
  const auth = await getAuthFromCookies();

  if (!auth) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  const result = await executeWithContext(auth, async (client) => {
    // Database operations here with RLS context set
    return await client.query('SELECT ...');
  });

  return NextResponse.json(result.rows);
}
```

## Environment Variables

Required variables (see `.env.example`):

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Database (Required for Vercel)
DATABASE_URL=

# OAuth (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Organization
SYSTEM_OWNER_EMAIL=
ORGANIZATION_NAME=

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

1. **Always use RLS context**: Call `setDatabaseContext()` before queries
2. **Never bypass RLS**: Use `executeWithContext()` wrapper
3. **Validate auth on API routes**: Check `getAuthFromCookies()` result
4. **CORS restrictions**: Only allow approved origins (see `src/lib/cors.ts`)
5. **Rate limiting**: Applied on sensitive API routes
6. **Audit logging**: User actions logged in `user_activity` table

## Development Best Practices

### Manual and Systematic Approach ⚠️

**CRITICAL**: When fixing issues, especially production bugs, always take a manual and systematic approach:

1. **Avoid Bulk Automation Scripts** ❌
   - Scripts that modify multiple files or environment variables at once can mask issues
   - Automated fixes often miss edge cases or create new problems
   - Example: `fix-vercel-env.sh` looked for `NEXT_PUBLIC_*` vars that didn't exist, silently skipped them

2. **Manual Investigation First** ✅
   - Read error messages carefully and trace the root cause
   - Check actual state (Vercel env vars, file contents, build output)
   - Verify assumptions before applying fixes
   - Example: Check `vercel env ls` to see what variables actually exist

3. **Fix One Thing at a Time** ✅
   - Make single, focused changes
   - Test each change before moving to the next
   - Commit each fix separately with clear messages
   - Example: Fix env validation, then logger, then OAuth - each as separate commits

4. **Verify at Each Step** ✅
   - TypeScript compilation: `npx tsc --noEmit`
   - Build locally: `npm run build`
   - Check deployment status after each change
   - Test in browser before marking as complete

### Environment Variables - Critical Patterns

**NEXT_PUBLIC_* Variables** (Client-Side):
- Required for any env var accessed in browser/client components
- Must use **inline** access for Next.js static replacement:
  ```typescript
  // ✅ Correct - inline access in object literal
  const config = {
    url: process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
  };

  // ❌ Wrong - intermediate variable breaks replacement
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const config = { url };
  ```

**Server-Only Variables**:
- No prefix needed
- Access via `getEnv()` or direct `process.env`
- Never expose secrets to client bundle

**Vercel-Specific**:
- Always verify variable names match between code and Vercel dashboard
- Use `vercel env ls` to inspect actual variable names
- Remember: `SUPABASE_URL` ≠ `NEXT_PUBLIC_SUPABASE_URL`

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
2. Import `getAuthFromCookies()` and `executeWithContext()`
3. Validate authentication
4. Use `executeWithContext()` for database queries
5. Add CORS headers if needed (see `src/lib/cors.ts`)

### Adding a New Database Table

1. Create migration in `migrations/0XX_description.sql`
2. Define table schema with RLS policies
3. Add type definitions in `src/types/`
4. Create database operations in `src/lib/db-*.ts`
5. Create TanStack Query hooks in `src/hooks/`

### Adding a New UI Component

1. Check if shadcn/ui component exists (`src/components/ui/`)
2. Create feature component in appropriate directory
3. Use Tailwind classes with `cn()` utility
4. Import from `@/components/ui` for base components
5. Follow existing component patterns (props, state, queries)

## Testing Strategy

**No formal test suite currently**. Manual testing approach:

1. Test in development with `npm run dev`
2. Verify TypeScript with `npm run build`
3. Check ESLint with `npm run lint`
4. Manual testing of features in UI
5. Database queries tested via Supabase dashboard

## Deployment (Vercel)

1. Push to `main` branch
2. Vercel auto-builds and deploys
3. Environment variables managed in Vercel dashboard
4. Migrations run via Supabase dashboard
5. Monitor logs in Vercel dashboard

**Pre-deployment checklist**:
- ✅ `npm run lint` passes
- ✅ `npm run build` succeeds
- ✅ Environment variables configured
- ✅ Database migrations applied

## Troubleshooting

### RLS Access Denied Errors

**Symptom**: "new row violates row-level security policy"

**Fix**: Ensure `setDatabaseContext()` called before query. Use `executeWithContext()`.

### TypeScript Errors

**Never disable `strict` mode**. Fix type errors properly:
- Add explicit type annotations
- Use optional chaining (`?.`) for nullable data
- Define proper interfaces in `src/types/`

### Auth Issues

Check:
1. Supabase Auth configured correctly
2. Google OAuth credentials valid
3. Redirect URLs match production domain
4. Cookies enabled in browser

## Documentation References

- [README.md](./README.md) - Project overview
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Database migrations
- [SECURITY_AUDIT_2025-09-28.md](./SECURITY_AUDIT_2025-09-28.md) - Security review
- [PERFORMANCE_OPTIMIZATION_2025-09-28.md](./PERFORMANCE_OPTIMIZATION_2025-09-28.md) - Performance analysis

## Support

Technical support: `administracion@ipupy.org.py`