# Common Development Tasks - IPU PY Tesorería

Recipe-style guide for frequent development tasks. Each task includes step-by-step instructions, code examples, common pitfalls, and links to relevant documentation.

**Target Audience**: Developers working on features and bug fixes.

---

## Table of Contents

1. [Adding a New API Endpoint](#adding-a-new-api-endpoint)
2. [Creating a New Database Table](#creating-a-new-database-table)
3. [Adding a New UI Component](#adding-a-new-ui-component)
4. [Adding a New Page/Route](#adding-a-new-page-route)
5. [Working with TanStack Query Hooks](#working-with-tanstack-query-hooks)
6. [Testing Database Queries with RLS](#testing-database-queries-with-rls)
7. [Adding a New Role Permission](#adding-a-new-role-permission)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Running Database Migrations](#running-database-migrations)
10. [Debugging RLS Issues](#debugging-rls-issues)
11. [Adding Validation Schemas](#adding-validation-schemas)
12. [Working with TypeScript Strict Mode](#working-with-typescript-strict-mode)

---

## Adding a New API Endpoint

### Overview

Create a new API route with proper authentication, RLS context, error handling, and TypeScript types.

### Step-by-Step

#### 1. Create Route File

```bash
# Create directory and file
mkdir -p src/app/api/example
touch src/app/api/example/route.ts
```

#### 2. Implement Route Handler

```typescript
// src/app/api/example/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireAuth } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { handleApiError } from '@/lib/api-errors';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

// Define types
type ResponseData = {
  id: number;
  name: string;
  createdAt: string;
};

type RequestBody = {
  name: string;
  description?: string;
};

// GET handler - Public endpoint example
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');

  // Handle CORS preflight
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  try {
    // Get auth (optional for public endpoints)
    const auth = await getAuthContext(request);

    // Execute query with RLS context
    const result = await executeWithContext(auth, async (client) => {
      return await client.query<ResponseData>(`
        SELECT id, name, created_at as "createdAt"
        FROM example_table
        ORDER BY created_at DESC
      `);
    });

    return NextResponse.json(result.rows, {
      headers: buildCorsHeaders(origin)
    });
  } catch (error) {
    return handleApiError(error, origin, 'GET /api/example');
  }
}

// POST handler - Protected endpoint example
export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  try {
    // Require authentication
    const auth = await requireAuth(request);

    // Parse request body
    const body = (await request.json()) as unknown;

    // Validate request body
    if (!isValidRequestBody(body)) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400, headers: buildCorsHeaders(origin) }
      );
    }

    // Execute query with RLS context
    const result = await executeWithContext(auth, async (client) => {
      const queryResult = await client.query<ResponseData>(
        `INSERT INTO example_table (name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, name, created_at as "createdAt"`,
        [body.name, body.description ?? null, auth.userId]
      );
      return queryResult.rows[0]!; // Safe: INSERT RETURNING always returns row
    });

    return NextResponse.json(result, {
      status: 201,
      headers: buildCorsHeaders(origin)
    });
  } catch (error) {
    return handleApiError(error, origin, 'POST /api/example');
  }
}

// Type guard for request validation
function isValidRequestBody(body: unknown): body is RequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'name' in body &&
    typeof body.name === 'string' &&
    body.name.trim().length > 0
  );
}
```

#### 3. Add CORS Configuration (if needed)

```typescript
// src/lib/cors.ts - Already configured
// Allowed origins: localhost:3000, production domain
// No changes needed unless adding new origin
```

#### 4. Test the Endpoint

```bash
# Start dev server
npm run dev

# Test GET (public)
curl http://localhost:3000/api/example

# Test POST (requires auth token)
curl -X POST http://localhost:3000/api/example \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"name":"Test Item"}'
```

### Common Pitfalls

❌ **Forgetting to use `executeWithContext()`**
```typescript
// Wrong - RLS will deny access
const result = await pool.query('SELECT * FROM table');

// Correct
const result = await executeWithContext(auth, async (client) => {
  return await client.query('SELECT * FROM table');
});
```

❌ **Not handling CORS preflight**
```typescript
// Add OPTIONS handler
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request) ?? NextResponse.json({}, { status: 405 });
}
```

❌ **Missing return type annotations**
```typescript
// Wrong - implicit return type
export async function GET(request: NextRequest) {
  // ...
}

// Correct - explicit return type
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ...
}
```

### Related Documentation

- [API Reference](../API_REFERENCE.md)
- [Type Safety Guide](./TYPE_SAFETY_GUIDE.md) - API Route Patterns
- [RLS Policies](../database/RLS_POLICIES.md)

---

## Creating a New Database Table

### Overview

Add a new table with proper migration, TypeScript types, RLS policies, and database operations.

### Step-by-Step

#### 1. Create Migration File

```bash
# Find next migration number
ls migrations/ | tail -1
# Output: 041_security_hardening.sql

# Create new migration (042)
touch migrations/042_add_example_table.sql
```

#### 2. Write Migration SQL

```sql
-- migrations/042_add_example_table.sql

-- Description: Add example_table for [feature description]
-- Author: [Your Name]
-- Date: 2025-10-06

-- Create table
CREATE TABLE IF NOT EXISTS example_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  church_id INTEGER REFERENCES churches(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_example_table_church_id ON example_table(church_id);
CREATE INDEX idx_example_table_created_by ON example_table(created_by);
CREATE INDEX idx_example_table_created_at ON example_table(created_at DESC);

-- Enable RLS
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy 1: Church isolation for SELECT
CREATE POLICY "Church isolation on example_table"
ON example_table FOR SELECT
USING (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id)
);

-- Policy 2: Only admin and church users can insert
CREATE POLICY "Church users can create example_table"
ON example_table FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor') AND
  (app_current_user_role() = 'admin' OR app_user_owns_church(church_id))
);

-- Policy 3: Only admin and creators can update
CREATE POLICY "Creators can update example_table"
ON example_table FOR UPDATE
USING (
  app_current_user_role() = 'admin' OR
  (app_user_owns_church(church_id) AND created_by = app_current_user_id())
)
WITH CHECK (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id)
);

-- Add updated_at trigger
CREATE TRIGGER update_example_table_updated_at
  BEFORE UPDATE ON example_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add to migration history
INSERT INTO migration_history (version, description, applied_at)
VALUES ('042', 'Add example_table with RLS policies', NOW());
```

#### 3. Define TypeScript Types

```typescript
// src/types/example.ts

// Database row type (snake_case matches database)
export type ExampleTableRow = {
  id: number;
  name: string;
  description: string | null;
  church_id: number;
  created_by: string; // UUID
  created_at: string;
  updated_at: string;
};

// Application domain type (camelCase for TypeScript)
export type ExampleItem = {
  id: number;
  name: string;
  description: string | null;
  churchId: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// Normalizer function
export function normalizeExampleItem(row: ExampleTableRow): ExampleItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    churchId: row.church_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Create/Update payload types
export type CreateExampleItemPayload = {
  name: string;
  description?: string;
  churchId: number;
};

export type UpdateExampleItemPayload = Partial<CreateExampleItemPayload>;
```

#### 4. Create Database Operations

```typescript
// src/lib/db-example.ts
import { executeWithContext } from '@/lib/db';
import { type AuthContext } from '@/lib/auth-supabase';
import {
  type ExampleTableRow,
  type ExampleItem,
  type CreateExampleItemPayload,
  normalizeExampleItem,
} from '@/types/example';

export async function getExampleItems(
  auth: AuthContext,
  churchId?: number
): Promise<ExampleItem[]> {
  return executeWithContext(auth, async (client) => {
    const whereClause = churchId ? 'WHERE church_id = $1' : '';
    const params = churchId ? [churchId] : [];

    const result = await client.query<ExampleTableRow>(
      `SELECT * FROM example_table ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(normalizeExampleItem);
  });
}

export async function createExampleItem(
  auth: AuthContext,
  payload: CreateExampleItemPayload
): Promise<ExampleItem> {
  return executeWithContext(auth, async (client) => {
    const result = await client.query<ExampleTableRow>(
      `INSERT INTO example_table (name, description, church_id, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payload.name, payload.description ?? null, payload.churchId, auth.userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create example item');
    }

    return normalizeExampleItem(row);
  });
}
```

#### 5. Apply Migration

**Option A: Supabase Dashboard**

1. Open Supabase Dashboard → SQL Editor
2. Paste migration SQL
3. Run query
4. Verify table created: Tables → example_table

**Option B: Supabase CLI**

```bash
# Push migration to remote
supabase db push

# Verify migration
supabase db remote commit
```

#### 6. Verify Migration

```sql
-- Check table exists
SELECT * FROM example_table LIMIT 1;

-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'example_table';
-- Output: rowsecurity = true

-- Check policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'example_table';
```

### Common Pitfalls

❌ **Forgetting to enable RLS**
```sql
-- Always include this
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;
```

❌ **Missing indexes on foreign keys**
```sql
-- Add indexes for performance
CREATE INDEX idx_example_table_church_id ON example_table(church_id);
```

❌ **Not testing RLS policies**
```sql
-- Test as different roles
SET LOCAL app.current_user_role = 'treasurer';
SET LOCAL app.current_user_church_id = 1;
SELECT * FROM example_table; -- Should only see church 1 data
```

### Related Documentation

- [Database Schema Reference](../database/SCHEMA_REFERENCE.md)
- [RLS Policies Guide](../database/RLS_POLICIES.md)
- [Migration History](../migrations/MIGRATION_HISTORY.md)

---

## Adding a New UI Component

### Overview

Create a new React component following project patterns with proper TypeScript types, Tailwind styling, and accessibility.

### Step-by-Step

#### 1. Determine Component Type

**Base UI Component** (shadcn/ui):
- Location: `src/components/ui/`
- Radix UI primitives styled with Tailwind
- Examples: button, dialog, select

**Feature Component**:
- Location: `src/components/[Feature]/`
- Business logic components
- Examples: ChurchList, ReportForm, FundCard

#### 2. Create Component File

```bash
# Feature component example
mkdir -p src/components/Example
touch src/components/Example/ExampleCard.tsx
```

#### 3. Implement Component

```typescript
// src/components/Example/ExampleCard.tsx
'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// Define prop types
type ExampleCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'danger';
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
};

export function ExampleCard({
  title,
  description,
  icon,
  variant = 'default',
  onClick,
  className,
  children,
}: ExampleCardProps): JSX.Element {
  // Variant styles
  const variantStyles = {
    default: 'border-gray-200 hover:border-gray-300',
    primary: 'border-primary-500 bg-primary-50 hover:bg-primary-100',
    danger: 'border-red-500 bg-red-50 hover:bg-red-100',
  };

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-4 transition-colors',
        variantStyles[variant],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        {icon && <div className="text-xl">{icon}</div>}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-600 mb-3">{description}</p>
      )}

      {/* Children content */}
      {children}
    </div>
  );
}
```

#### 4. Add Component Export

```typescript
// src/components/Example/index.ts
export { ExampleCard } from './ExampleCard';
export type { ExampleCardProps } from './ExampleCard';
```

#### 5. Use Component

```typescript
// src/app/(routes)/example/page.tsx
import { ExampleCard } from '@/components/Example';

export default function ExamplePage(): JSX.Element {
  return (
    <div className="space-y-4">
      <ExampleCard
        title="Card Title"
        description="Card description text"
        variant="primary"
        onClick={() => console.log('Clicked')}
      >
        <p>Card content</p>
      </ExampleCard>
    </div>
  );
}
```

### shadcn/ui Component Example

```bash
# Add shadcn component
npx shadcn@latest add badge

# This creates:
# src/components/ui/badge.tsx
```

```typescript
// Use shadcn component
import { Badge } from '@/components/ui/badge';

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Error</Badge>
```

### Common Pitfalls

❌ **Not using `cn()` utility for className merging**
```typescript
// Wrong - classes may conflict
<div className={`base-class ${className}`}>

// Correct - proper merging
<div className={cn('base-class', className)}>
```

❌ **Missing accessibility attributes**
```typescript
// Add role, tabIndex, keyboard handlers for interactive elements
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
```

❌ **Forgetting 'use client' directive**
```typescript
// Add at top of file for client components
'use client';
```

### Related Documentation

- [Components Documentation](../COMPONENTS.md)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## Adding a New Page/Route

### Overview

Create a new page in Next.js 15 App Router with proper layout, authentication, and data fetching.

### Step-by-Step

#### 1. Create Page Directory

```bash
# Create route directory
mkdir -p src/app/\(routes\)/example

# Create page file
touch src/app/\(routes\)/example/page.tsx
```

#### 2. Implement Page Component

```typescript
// src/app/(routes)/example/page.tsx
import { type Metadata } from 'next';
import { ExampleList } from '@/components/Example/ExampleList';

// Page metadata
export const metadata: Metadata = {
  title: 'Example Page | IPU PY Tesorería',
  description: 'Example feature for IPU PY treasury management',
};

export default function ExamplePage(): JSX.Element {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Example Page
        </h1>
        <p className="text-gray-600 mt-2">
          Description of what this page does
        </p>
      </div>

      {/* Page Content */}
      <ExampleList />
    </div>
  );
}
```

#### 3. Add Client Component with Data Fetching

```typescript
// src/components/Example/ExampleList.tsx
'use client';

import { useExampleItems } from '@/hooks/useExampleItems';
import { ExampleCard } from './ExampleCard';
import { Skeleton } from '@/components/ui/skeleton';

export function ExampleList(): JSX.Element {
  const { data: items, isLoading, error } = useExampleItems();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600">
        Error: {error.message}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No items found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <ExampleCard
          key={item.id}
          title={item.name}
          description={item.description ?? undefined}
        />
      ))}
    </div>
  );
}
```

#### 4. Add Navigation Link

```typescript
// src/components/Layout/Sidebar.tsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Iglesias', href: '/churches', icon: BuildingIcon },
  { name: 'Reportes', href: '/reports', icon: DocumentIcon },
  // Add new link
  { name: 'Example', href: '/example', icon: StarIcon },
];
```

#### 5. Add Protected Route (Optional)

```typescript
// src/middleware.ts - Already configured
// Protected routes automatically require authentication

// To make route admin-only, check role in page:
import { requireAdmin } from '@/lib/auth-supabase';

export default async function AdminExamplePage(): Promise<JSX.Element> {
  // This will throw if not admin
  const auth = await requireAdmin();

  return <div>Admin-only content</div>;
}
```

### Dynamic Routes

```bash
# Create dynamic route
mkdir -p src/app/\(routes\)/example/[id]
touch src/app/\(routes\)/example/[id]/page.tsx
```

```typescript
// src/app/(routes)/example/[id]/page.tsx
type PageProps = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ExampleDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const id = parseInt(params.id, 10);

  return (
    <div>
      <h1>Example Detail #{id}</h1>
    </div>
  );
}
```

### Common Pitfalls

❌ **Not exporting metadata**
```typescript
// Add metadata for SEO
export const metadata: Metadata = {
  title: 'Page Title | IPU PY',
  description: 'Page description',
};
```

❌ **Using client components for everything**
```typescript
// Server components by default (no 'use client')
// Only add 'use client' when needed:
// - useState, useEffect, event handlers
// - TanStack Query hooks
```

❌ **Incorrect params type for Next.js 15**
```typescript
// Correct params type
type PageProps = {
  params: { id: string };  // Not Promise<{ id: string }>
};
```

### Related Documentation

- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [Architecture Guide](../ARCHITECTURE.md)

---

## Working with TanStack Query Hooks

### Overview

Create data fetching hooks using TanStack Query v5 with proper TypeScript types and error handling.

### Step-by-Step

#### 1. Create Hook File

```bash
touch src/hooks/useExampleItems.ts
```

#### 2. Implement Query Hook

```typescript
// src/hooks/useExampleItems.ts
'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';
import { type ExampleItem } from '@/types/example';

// Query key factory
export const exampleKeys = {
  all: ['examples'] as const,
  lists: () => [...exampleKeys.all, 'list'] as const,
  list: (churchId?: number) =>
    [...exampleKeys.lists(), { churchId }] as const,
  detail: (id: number) => [...exampleKeys.all, 'detail', id] as const,
};

// Fetch function
async function fetchExampleItems(churchId?: number): Promise<ExampleItem[]> {
  const url = churchId
    ? `/api/example?churchId=${churchId}`
    : '/api/example';
  return fetchJson<ExampleItem[]>(url);
}

// Query hook
type UseExampleItemsOptions = {
  churchId?: number;
  enabled?: boolean;
};

export function useExampleItems(
  options: UseExampleItemsOptions = {}
): UseQueryResult<ExampleItem[], Error> {
  return useQuery({
    queryKey: exampleKeys.list(options.churchId),
    queryFn: () => fetchExampleItems(options.churchId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options.enabled,
  });
}

// Mutation hook
type CreateExampleItemPayload = {
  name: string;
  description?: string;
  churchId: number;
};

async function createExampleItem(
  payload: CreateExampleItemPayload
): Promise<ExampleItem> {
  return fetchJson<ExampleItem>('/api/example', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function useCreateExampleItem(): UseMutationResult<
  ExampleItem,
  Error,
  CreateExampleItemPayload
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createExampleItem,
    onSuccess: () => {
      // Invalidate all example queries
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
    },
  });
}
```

#### 3. Use Hook in Component

```typescript
// src/components/Example/ExampleList.tsx
'use client';

import { useExampleItems, useCreateExampleItem } from '@/hooks/useExampleItems';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export function ExampleList(): JSX.Element {
  // Query
  const {
    data: items,
    isLoading,
    error,
    refetch,
  } = useExampleItems({ churchId: 1 });

  // Mutation
  const { mutate: createItem, isPending } = useCreateExampleItem();

  const handleCreate = () => {
    createItem(
      {
        name: 'New Item',
        description: 'Item description',
        churchId: 1,
      },
      {
        onSuccess: () => {
          toast.success('Item created successfully');
        },
        onError: (error) => {
          toast.error(`Failed to create: ${error.message}`);
        },
      }
    );
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <Button onClick={handleCreate} disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Item'}
      </Button>

      <div className="mt-4">
        {items?.map((item) => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>
    </div>
  );
}
```

#### 4. Configure QueryClient Provider

```typescript
// src/app/providers.tsx - Already configured
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute default
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Common Patterns

#### Dependent Queries

```typescript
// Query B depends on Query A result
const { data: church } = useChurches();
const churchId = church?.[0]?.id;

const { data: reports } = useReports({
  churchId,
  enabled: !!churchId, // Only fetch when churchId available
});
```

#### Optimistic Updates

```typescript
export function useUpdateExampleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateExampleItem,
    onMutate: async (newItem) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: exampleKeys.lists() });

      // Snapshot previous value
      const previous = queryClient.getQueryData(exampleKeys.lists());

      // Optimistically update cache
      queryClient.setQueryData(exampleKeys.lists(), (old: ExampleItem[]) => {
        return old.map((item) =>
          item.id === newItem.id ? { ...item, ...newItem } : item
        );
      });

      return { previous };
    },
    onError: (err, newItem, context) => {
      // Rollback on error
      queryClient.setQueryData(exampleKeys.lists(), context?.previous);
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
    },
  });
}
```

### Common Pitfalls

❌ **Not using query key factories**
```typescript
// Wrong - inconsistent keys
queryKey: ['examples', 'list']
queryKey: ['examples'] // Will cause cache misses

// Correct - use factory
queryKey: exampleKeys.list()
```

❌ **Forgetting to invalidate queries after mutations**
```typescript
onSuccess: () => {
  // Always invalidate related queries
  queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
}
```

❌ **Not handling loading and error states**
```typescript
// Always handle all states
if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <DataDisplay data={data} />;
```

### Related Documentation

- [TanStack Query v5 Documentation](https://tanstack.com/query/latest)
- [Example Hooks](../../src/hooks)

---

## Testing Database Queries with RLS

### Overview

Test database queries locally to verify RLS policies work correctly for different roles.

### Step-by-Step

#### 1. Connect to Database

```bash
# Using psql
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Or use Supabase Studio
supabase studio
# Navigate to SQL Editor
```

#### 2. Set Session Context

```sql
-- Set user context for testing
SELECT set_config('app.current_user_id', 'test-user-uuid', false);
SELECT set_config('app.current_user_role', 'treasurer', false);
SELECT set_config('app.current_user_church_id', '1', false);

-- Verify context
SELECT
  current_setting('app.current_user_id', true) as user_id,
  current_setting('app.current_user_role', true) as role,
  current_setting('app.current_user_church_id', true) as church_id;
```

#### 3. Test Query with RLS

```sql
-- Test as treasurer (church_id = 1)
SELECT * FROM monthly_reports;
-- Should only return reports for church_id = 1

-- Try to access different church
SELECT * FROM monthly_reports WHERE church_id = 2;
-- Should return empty (RLS blocks)

-- Try to insert for different church
INSERT INTO monthly_reports (church_id, year, month)
VALUES (2, 2025, 10);
-- Should fail: "new row violates row-level security policy"
```

#### 4. Test Different Roles

```sql
-- Test as admin (full access)
SELECT set_config('app.current_user_role', 'admin', false);
SELECT * FROM monthly_reports;
-- Should return ALL reports

-- Test as secretary (read-only)
SELECT set_config('app.current_user_role', 'secretary', false);
INSERT INTO monthly_reports (church_id, year, month)
VALUES (1, 2025, 10);
-- Should fail: secretary cannot insert
```

#### 5. Test with Application Context

Create test script:

```typescript
// scripts/test-rls.ts
import { executeWithContext } from '@/lib/db';
import { type AuthContext } from '@/lib/auth-supabase';

async function testRLS() {
  const testAuth: AuthContext = {
    userId: 'test-user-uuid',
    email: 'test@ipupy.org.py',
    role: 'treasurer',
    churchId: 1,
  };

  try {
    // Test query
    const result = await executeWithContext(testAuth, async (client) => {
      return await client.query('SELECT * FROM monthly_reports');
    });

    console.log('Query succeeded:', result.rows.length, 'rows');
    console.log('First row church_id:', result.rows[0]?.church_id);
  } catch (error) {
    console.error('Query failed:', error);
  }
}

testRLS();
```

```bash
# Run test
ts-node scripts/test-rls.ts
```

### Common RLS Test Cases

#### Test 1: Church Isolation

```sql
-- As treasurer of church 1
SET LOCAL app.current_user_role = 'treasurer';
SET LOCAL app.current_user_church_id = 1;

-- Should see only church 1 data
SELECT church_id, COUNT(*)
FROM monthly_reports
GROUP BY church_id;
-- Expected: Only church_id = 1

-- Should fail to insert church 2 data
INSERT INTO monthly_reports (church_id, year, month)
VALUES (2, 2025, 10);
-- Expected: RLS violation error
```

#### Test 2: Role Permissions

```sql
-- Test role hierarchy
-- Secretary can read, cannot write
SET LOCAL app.current_user_role = 'secretary';
SELECT * FROM monthly_reports WHERE church_id = 1; -- Should succeed
UPDATE monthly_reports SET estado = 'approved' WHERE id = 1; -- Should fail

-- Treasurer can read and write
SET LOCAL app.current_user_role = 'treasurer';
UPDATE monthly_reports SET estado = 'approved' WHERE id = 1; -- Should succeed

-- Admin can do everything
SET LOCAL app.current_user_role = 'admin';
DELETE FROM monthly_reports WHERE id = 1; -- Should succeed (with caution!)
```

#### Test 3: Fund Director Access

```sql
-- Fund director should only see assigned funds
-- First create assignment
INSERT INTO fund_director_assignments (profile_id, fund_id)
VALUES ('fund-director-uuid', 1);

-- Test fund access
SET LOCAL app.current_user_id = 'fund-director-uuid';
SET LOCAL app.current_user_role = 'fund_director';

SELECT * FROM fund_transactions WHERE fund_id = 1; -- Should succeed
SELECT * FROM fund_transactions WHERE fund_id = 2; -- Should be empty (not assigned)
```

### Debugging RLS Issues

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'monthly_reports';
-- Output: rowsecurity = true

-- Check active policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'monthly_reports';

-- Check current context
SELECT
  app_current_user_id() as user_id,
  app_current_user_role() as role,
  app_current_user_church_id() as church_id;

-- Test helper functions
SELECT app_user_is_admin(); -- Should return true/false
SELECT app_user_owns_church(1); -- Should return true/false
```

### Common Pitfalls

❌ **Forgetting to set all context variables**
```sql
-- Wrong - incomplete context
SELECT set_config('app.current_user_role', 'treasurer', false);
-- Missing user_id and church_id!

-- Correct - set all three
SELECT set_config('app.current_user_id', 'uuid', false);
SELECT set_config('app.current_user_role', 'treasurer', false);
SELECT set_config('app.current_user_church_id', '1', false);
```

❌ **Using wrong user_id format**
```sql
-- Wrong - integer
SELECT set_config('app.current_user_id', '123', false);

-- Correct - UUID string
SELECT set_config('app.current_user_id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', false);
```

### Related Documentation

- [RLS Policies Guide](../database/RLS_POLICIES.md)
- [Database Context Implementation](../../src/lib/db-context.ts)

---

## Adding a New Role Permission

### Overview

Extend the role system with new permissions or create a new role type.

### Step-by-Step

#### 1. Determine Permission Type

**Option A: Add permission to existing role**
- Modify RLS policies
- Update role definition

**Option B: Create new role**
- Add to ProfileRole type
- Create migration
- Add RLS policies

### Adding Permission to Existing Role

#### 1. Update RLS Policy

```sql
-- migrations/042_add_treasurer_fund_access.sql

-- Allow treasurers to manage fund events
DROP POLICY IF EXISTS "Fund directors can create events" ON fund_events;

CREATE POLICY "Treasurers and fund directors can create events"
ON fund_events FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'fund_director') AND
  (
    app_current_user_role() IN ('admin', 'treasurer') OR
    (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
  )
);

-- Add to migration history
INSERT INTO migration_history (version, description, applied_at)
VALUES ('042', 'Grant treasurer access to fund events', NOW());
```

#### 2. Update Authorization Check

```typescript
// src/lib/authz.ts

export function canManageFundEvents(auth: AuthContext): boolean {
  // Admin and treasurer have full access
  if (auth.role === 'admin' || auth.role === 'treasurer') {
    return true;
  }

  // Fund directors have limited access
  if (auth.role === 'fund_director') {
    return true; // Check specific fund access elsewhere
  }

  return false;
}
```

#### 3. Update API Route

```typescript
// src/app/api/fund-events/route.ts

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);

  // Check permission
  if (!canManageFundEvents(auth)) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar eventos de fondos' },
      { status: 403 }
    );
  }

  // ... rest of handler
}
```

### Creating a New Role

#### 1. Create Migration

```sql
-- migrations/042_add_auditor_role.sql

-- Add new role to enum (if using enum type)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';

-- Or update role check constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'treasurer', 'pastor', 'church_manager', 'secretary', 'fund_director', 'auditor'));

-- Create RLS policies for auditor
CREATE POLICY "Auditors can view all reports"
ON monthly_reports FOR SELECT
USING (app_current_user_role() IN ('admin', 'auditor'));

CREATE POLICY "Auditors can view all transactions"
ON fund_transactions FOR SELECT
USING (app_current_user_role() IN ('admin', 'auditor'));

-- Auditor role level
CREATE OR REPLACE FUNCTION get_role_level(role_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'admin' THEN 6
    WHEN 'treasurer' THEN 5
    WHEN 'auditor' THEN 4  -- New role
    WHEN 'pastor' THEN 4
    WHEN 'church_manager' THEN 3
    WHEN 'secretary' THEN 2
    WHEN 'fund_director' THEN 2
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 2. Update TypeScript Types

```typescript
// src/lib/authz.ts

export const PROFILE_ROLES = [
  'admin',
  'treasurer',
  'pastor',
  'church_manager',
  'secretary',
  'fund_director',
  'auditor', // New role
] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

// Role descriptions
export const ROLE_DESCRIPTIONS: Record<ProfileRole, string> = {
  admin: 'Administrador',
  treasurer: 'Tesorero Nacional',
  pastor: 'Pastor',
  church_manager: 'Administrador de Iglesia',
  secretary: 'Secretario',
  fund_director: 'Director de Fondo',
  auditor: 'Auditor', // New role
};
```

#### 3. Update Role Permissions Matrix

```typescript
// docs/ROLES_AND_PERMISSIONS.md - Update matrix

| Resource | auditor |
|----------|---------|
| Reports | R (all) |
| Transactions | R (all) |
| Churches | R (all) |
| Users | - |
```

#### 4. Add UI for Role Selection

```typescript
// src/components/Admin/AdminUserDialog.tsx

const ROLE_OPTIONS: { value: ProfileRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'treasurer', label: 'Tesorero Nacional' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'church_manager', label: 'Administrador de Iglesia' },
  { value: 'secretary', label: 'Secretario' },
  { value: 'fund_director', label: 'Director de Fondo' },
  { value: 'auditor', label: 'Auditor' }, // New role
];
```

### Common Pitfalls

❌ **Not updating all RLS policies**
```sql
-- Check ALL tables for role-based policies
SELECT tablename, policyname
FROM pg_policies
WHERE qual LIKE '%current_user_role%'
OR with_check LIKE '%current_user_role%';
```

❌ **Forgetting to update TypeScript types**
```typescript
// Update all type definitions
// src/lib/authz.ts
// src/types/api.ts
// components using role checks
```

❌ **Not testing new role thoroughly**
```sql
-- Test all CRUD operations as new role
SET LOCAL app.current_user_role = 'auditor';
SELECT * FROM monthly_reports; -- Should work
INSERT INTO monthly_reports (...); -- Should fail
```

### Related Documentation

- [Roles and Permissions](../ROLES_AND_PERMISSIONS.md)
- [Authorization Implementation](../../src/lib/authz.ts)

---

## Deploying to Vercel

### Overview

Deploy application to Vercel with proper environment variables and build configuration.

### Step-by-Step

#### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel

# Login to Vercel
vercel login
```

#### 2. Link Project to Vercel

```bash
# Link existing Vercel project
vercel link

# Follow prompts:
# Set up "ipupy-tesoreria"? [Y/n] y
# Which scope? your-team-name
# Link to existing project? [Y/n] y
# What's the name? ipupy-tesoreria
```

#### 3. Configure Environment Variables

**Via Vercel Dashboard**:

1. Go to [vercel.com/dashboard](https://vercel.com)
2. Select project: `ipupy-tesoreria`
3. Settings → Environment Variables
4. Add variables for each environment:

| Variable | Environment | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | `https://[project].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | `eyJhbGci...` (secret!) |
| `DATABASE_URL` | Production, Preview | `postgresql://...` |
| `GOOGLE_CLIENT_ID` | Production | `[client-id].apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Production | `GOCSPX-...` |

**Via CLI**:

```bash
# Add production variable
vercel env add NEXT_PUBLIC_SUPABASE_URL production

# Pull environment variables to local
vercel env pull .env.local

# List all variables
vercel env ls
```

#### 4. Deploy to Production

**Option A: Git Push (Recommended)**

```bash
# Push to main branch
git checkout main
git pull origin main
git merge feature/my-feature
git push origin main

# Vercel automatically deploys
# Check deployment at: vercel.com/[team]/ipupy-tesoreria
```

**Option B: Manual Deploy**

```bash
# Deploy current directory
vercel --prod

# Output shows:
# Deploying...
# ✅ Production: https://ipupy-tesoreria.vercel.app [1m]
```

#### 5. Deploy Preview (Feature Branch)

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/new-feature

# Vercel automatically creates preview deployment
# URL: ipupy-tesoreria-[branch]-[team].vercel.app
```

#### 6. Monitor Deployment

```bash
# View deployment logs
vercel logs https://ipupy-tesoreria.vercel.app

# Check deployment status
vercel inspect https://ipupy-tesoreria.vercel.app
```

#### 7. Verify Deployment

1. **Check Build Logs**:
   - Vercel Dashboard → Deployments → [Latest] → Build Logs
   - Look for TypeScript errors, missing env vars

2. **Test Production**:
   ```bash
   # Check homepage
   curl https://ipupytesoreria.vercel.app

   # Check API route
   curl https://ipupytesoreria.vercel.app/api/churches
   ```

3. **Test Authentication**:
   - Visit https://ipupytesoreria.vercel.app
   - Try logging in with Google OAuth
   - Verify redirect works

### Common Deployment Issues

#### Issue 1: Build Fails with TypeScript Errors

**Fix**:
```bash
# Test build locally first
npm run build

# Fix any TypeScript errors
npm run typecheck

# Commit fixes and redeploy
git add .
git commit -m "fix: resolve TypeScript errors"
git push
```

#### Issue 2: Environment Variables Not Loading

**Fix**:

1. Verify variable names match exactly (case-sensitive)
2. Check variable is set for correct environment (Production/Preview)
3. Redeploy after adding variables:
   ```bash
   vercel --prod --force
   ```

#### Issue 3: OAuth Redirect Fails

**Fix**:

Add production domain to Google OAuth allowed redirects:

1. Google Cloud Console → OAuth 2.0 Client
2. Authorized redirect URIs:
   - `https://ipupytesoreria.vercel.app/auth/callback`
   - `https://ipupytesoreria.vercel.app/api/auth/callback`
3. Save and test

#### Issue 4: Database Connection Timeout

**Fix**:

Use connection pooler (port 6543 instead of 5432):

```bash
# Vercel Dashboard → Environment Variables
# Update DATABASE_URL to use pooler:
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres
```

### Rollback Deployment

```bash
# List recent deployments
vercel ls

# Promote previous deployment to production
vercel promote [deployment-url]

# Or via dashboard:
# Deployments → [Previous Version] → Promote to Production
```

### Custom Domain Setup

```bash
# Add custom domain
vercel domains add tesoreria.ipupy.org.py

# Configure DNS (A record):
# tesoreria.ipupy.org.py → 76.76.21.21 (Vercel)

# Wait for DNS propagation (~1 hour)
vercel domains verify tesoreria.ipupy.org.py
```

### Related Documentation

- [Vercel Deployment Docs](../deployment)
- [Environment Configuration](../../.env.example)

---

## Running Database Migrations

### Overview

Apply SQL migrations to update database schema safely in development and production.

### Step-by-Step

#### 1. Create Migration File

```bash
# Find next migration number
ls migrations/ | tail -1
# Output: 041_security_hardening.sql

# Create new migration
touch migrations/042_my_feature.sql
```

#### 2. Write Migration SQL

```sql
-- migrations/042_my_feature.sql

-- Description: [What this migration does]
-- Author: [Your Name]
-- Date: 2025-10-06
-- Dependencies: 041

-- Example: Add column
ALTER TABLE churches
ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Add index
CREATE INDEX IF NOT EXISTS idx_churches_website
ON churches(website) WHERE website IS NOT NULL;

-- Record migration
INSERT INTO migration_history (version, description, applied_at)
VALUES ('042', 'Add website column to churches', NOW());
```

#### 3. Test Migration Locally

**Option A: Supabase Studio**

1. Open Supabase Dashboard → SQL Editor
2. Paste migration SQL
3. Run query
4. Check for errors
5. Verify changes in Tables view

**Option B: psql Command Line**

```bash
# Connect to local database
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# Run migration file
\i migrations/042_my_feature.sql

# Verify changes
\d churches
# Should show new 'website' column

# Check migration history
SELECT * FROM migration_history ORDER BY applied_at DESC LIMIT 5;
```

#### 4. Apply to Remote Database

**Supabase Dashboard Method**:

1. Open production project on supabase.com
2. SQL Editor → New Query
3. Paste migration SQL
4. Review carefully (this is PRODUCTION!)
5. Run query
6. Verify in Tables view

**Supabase CLI Method**:

```bash
# Link to remote project
supabase link --project-ref [project-ref]

# Push migrations
supabase db push

# Or apply specific migration
psql "[production-database-url]" -f migrations/042_my_feature.sql
```

#### 5. Verify Migration Applied

```sql
-- Check migration history
SELECT * FROM migration_history
WHERE version = '042';
-- Should return one row

-- Verify table changes
\d churches
-- Check new columns/indexes exist

-- Test query with new column
SELECT id, name, website FROM churches LIMIT 5;
```

#### 6. Update Application Code

```typescript
// Update types
// src/types/api.ts

export type ChurchRecord = {
  id: number;
  name: string;
  city: string;
  website?: string | null; // New field
  // ... other fields
};

// Update queries
// src/lib/db-church.ts

const result = await client.query<ChurchRow>(`
  SELECT
    id,
    name,
    city,
    website,  -- Include new field
    ...
  FROM churches
`);
```

### Migration Patterns

#### Adding Column

```sql
-- Add column with default
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS column_name VARCHAR(255) DEFAULT '';

-- Add column without default
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS column_name INTEGER;

-- Add NOT NULL column (two-step process)
-- Step 1: Add as nullable with default
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS column_name VARCHAR(255) DEFAULT '';

-- Step 2: Make NOT NULL after backfilling data
UPDATE table_name SET column_name = 'value' WHERE column_name IS NULL;
ALTER TABLE table_name
ALTER COLUMN column_name SET NOT NULL;
```

#### Adding Index

```sql
-- Simple index
CREATE INDEX IF NOT EXISTS idx_table_column
ON table_name(column_name);

-- Partial index (condition)
CREATE INDEX IF NOT EXISTS idx_table_active
ON table_name(column_name) WHERE active = true;

-- Composite index
CREATE INDEX IF NOT EXISTS idx_table_multi
ON table_name(column1, column2);

-- Concurrent index (production, doesn't lock table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_column
ON table_name(column_name);
```

#### Adding Foreign Key

```sql
-- Add foreign key constraint
ALTER TABLE child_table
ADD CONSTRAINT fk_child_parent
FOREIGN KEY (parent_id)
REFERENCES parent_table(id)
ON DELETE CASCADE;  -- or RESTRICT, SET NULL

-- Add index on foreign key (important for performance)
CREATE INDEX IF NOT EXISTS idx_child_parent_id
ON child_table(parent_id);
```

#### Modifying RLS Policies

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "old_policy_name" ON table_name;

-- Create new policy
CREATE POLICY "new_policy_name"
ON table_name FOR SELECT
USING (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id)
);
```

### Migration Safety Checklist

Before running in production:

- [ ] Migration tested locally
- [ ] Backwards compatible (won't break running app)
- [ ] Default values provided for new NOT NULL columns
- [ ] Indexes created with `IF NOT EXISTS`
- [ ] RLS policies updated if table structure changed
- [ ] Migration recorded in `migration_history`
- [ ] No hardcoded values (use parameters)
- [ ] Transaction wrapped (BEGIN/COMMIT) if needed

### Rollback Migration

```sql
-- migrations/042_rollback.sql

-- Rollback example: Remove column
ALTER TABLE churches
DROP COLUMN IF EXISTS website;

-- Drop index
DROP INDEX IF EXISTS idx_churches_website;

-- Record rollback
INSERT INTO migration_history (version, description, applied_at)
VALUES ('042_rollback', 'Rollback: Remove website column', NOW());
```

### Common Pitfalls

❌ **Not using IF EXISTS/IF NOT EXISTS**
```sql
-- Wrong - will fail if already exists
CREATE INDEX idx_table_column ON table_name(column_name);

-- Correct
CREATE INDEX IF NOT EXISTS idx_table_column ON table_name(column_name);
```

❌ **Adding NOT NULL without default/backfill**
```sql
-- Wrong - will fail if table has rows
ALTER TABLE table_name
ADD COLUMN new_column VARCHAR(255) NOT NULL;

-- Correct - two-step process
ALTER TABLE table_name
ADD COLUMN new_column VARCHAR(255) DEFAULT '';

UPDATE table_name SET new_column = 'value' WHERE new_column IS NULL;

ALTER TABLE table_name
ALTER COLUMN new_column SET NOT NULL;
```

❌ **Forgetting to update RLS policies**
```sql
-- After adding new column with sensitive data
-- Update RLS policies to handle new column properly
```

### Related Documentation

- [Migration History](../migrations/MIGRATION_HISTORY.md)
- [Database Schema](../database/SCHEMA_REFERENCE.md)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)

---

## Debugging RLS Issues

### Overview

Diagnose and fix Row Level Security policy problems when queries fail or return unexpected results.

### Step-by-Step

#### 1. Identify the Problem

**Symptoms**:
- Query returns empty results when data exists
- "permission denied" errors
- Data visible in Supabase Studio but not in app

#### 2. Check if RLS is Enabled

```sql
-- Check table has RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'your_table_name';

-- Output should show: rowsecurity = true
```

#### 3. Verify Session Context is Set

```sql
-- Check current session context
SELECT
  current_setting('app.current_user_id', true) as user_id,
  current_setting('app.current_user_role', true) as role,
  current_setting('app.current_user_church_id', true) as church_id;

-- If all empty, context is not being set!
```

**Fix in code**:

```typescript
// Ensure using executeWithContext wrapper
import { executeWithContext } from '@/lib/db';

// ❌ Wrong - no context
const result = await pool.query('SELECT * FROM table');

// ✅ Correct - sets context
const result = await executeWithContext(auth, async (client) => {
  return await client.query('SELECT * FROM table');
});
```

#### 4. Check RLS Helper Functions

```sql
-- Test RLS helper functions work
SELECT app_current_user_id();
-- Should return: UUID or NULL

SELECT app_current_user_role();
-- Should return: role name or empty string

SELECT app_user_is_admin();
-- Should return: true/false

SELECT app_user_owns_church(1);
-- Should return: true/false based on church_id
```

#### 5. Review Active Policies

```sql
-- List all policies for table
SELECT
  policyname,
  cmd,  -- INSERT, SELECT, UPDATE, DELETE, ALL
  qual,  -- USING clause
  with_check  -- WITH CHECK clause
FROM pg_policies
WHERE tablename = 'your_table_name';
```

#### 6. Test Policy Logic Manually

```sql
-- Set test context
SELECT set_config('app.current_user_id', 'test-uuid', false);
SELECT set_config('app.current_user_role', 'treasurer', false);
SELECT set_config('app.current_user_church_id', '1', false);

-- Test query that's failing
SELECT * FROM monthly_reports WHERE church_id = 1;

-- Try as admin (should always work)
SELECT set_config('app.current_user_role', 'admin', false);
SELECT * FROM monthly_reports;
```

#### 7. Check for Policy Conflicts

```sql
-- Multiple policies with AND logic can be too restrictive
-- Example: Two SELECT policies both must pass

-- List all SELECT policies
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'your_table_name'
AND cmd = 'SELECT';

-- Check if policies conflict (both must be true)
```

#### 8. Bypass RLS Temporarily (Testing Only)

```sql
-- Disable RLS on table (DANGEROUS - testing only!)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Test query
SELECT * FROM table_name;

-- Re-enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- If query works with RLS disabled, issue is in policies
```

### Common RLS Problems

#### Problem 1: Context Not Set

**Symptom**: All queries return empty

**Diagnosis**:
```sql
SELECT current_setting('app.current_user_id', true);
-- Output: (empty) or NULL
```

**Fix**:
```typescript
// Always use executeWithContext
const result = await executeWithContext(auth, async (client) => {
  return await client.query(sql);
});
```

#### Problem 2: Wrong Role Name

**Symptom**: Queries fail unexpectedly

**Diagnosis**:
```sql
SELECT app_current_user_role();
-- Check output matches expected role

-- Check if role exists in profiles table
SELECT DISTINCT role FROM profiles;
```

**Fix**:
```typescript
// Ensure role names match database enum/constraint
const auth: AuthContext = {
  // ...
  role: 'treasurer', // Must match exactly (case-sensitive)
};
```

#### Problem 3: Church ID Mismatch

**Symptom**: User cannot see their own church's data

**Diagnosis**:
```sql
-- Check context church_id
SELECT app_current_user_church_id();
-- Output: 1

-- Check actual data
SELECT church_id, COUNT(*)
FROM monthly_reports
GROUP BY church_id;
-- Verify church_id = 1 exists
```

**Fix**:
```typescript
// Ensure churchId is set correctly
const auth = await getAuthContext(request);
console.log('Church ID:', auth.churchId);

// Verify profile has church_id set in database
```

#### Problem 4: Fund Director Access Denied

**Symptom**: Fund director cannot access assigned funds

**Diagnosis**:
```sql
-- Check assignment exists
SELECT * FROM fund_director_assignments
WHERE profile_id = 'fund-director-uuid';

-- Check helper function
SELECT set_config('app.current_user_id', 'fund-director-uuid', false);
SELECT set_config('app.current_user_role', 'fund_director', false);
SELECT app_user_has_fund_access(1);
-- Should return: true if assigned
```

**Fix**:
```sql
-- Create assignment if missing
INSERT INTO fund_director_assignments (profile_id, fund_id, assigned_by)
VALUES ('fund-director-uuid', 1, 'admin-uuid');
```

#### Problem 5: Policy Using Wrong Function

**Symptom**: Policy blocks access incorrectly

**Diagnosis**:
```sql
-- Review policy logic
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'fund_transactions';

-- Example bad policy:
-- USING (app_user_owns_church(fund_id))
-- fund_id is not a church_id!
```

**Fix**:
```sql
-- Correct the policy
DROP POLICY IF EXISTS "bad_policy" ON fund_transactions;

CREATE POLICY "correct_policy"
ON fund_transactions FOR SELECT
USING (
  app_current_user_role() = 'admin' OR
  app_user_owns_church(church_id)  -- Use correct column
);
```

### Debugging Workflow

1. **Reproduce issue locally**
   ```bash
   npm run dev
   # Try to reproduce the failing query
   ```

2. **Check application logs**
   ```typescript
   console.log('Auth context:', auth);
   console.log('Query params:', params);
   ```

3. **Test in Supabase Studio**
   ```sql
   -- Set same context as app
   SELECT set_config('app.current_user_id', '[actual-uuid]', false);
   SELECT set_config('app.current_user_role', '[actual-role]', false);
   SELECT set_config('app.current_user_church_id', '[actual-church]', false);

   -- Run failing query
   SELECT * FROM table_name;
   ```

4. **Simplify the query**
   ```sql
   -- Start with simplest query
   SELECT COUNT(*) FROM table_name;

   -- Add WHERE clauses one by one
   SELECT COUNT(*) FROM table_name WHERE church_id = 1;
   ```

5. **Check policy logic**
   ```sql
   -- Extract policy USING clause
   -- Test each condition separately

   SELECT app_current_user_role() = 'admin';  -- true/false?
   SELECT app_user_owns_church(1);  -- true/false?
   ```

6. **Fix and test**
   ```sql
   -- Update policy
   DROP POLICY IF EXISTS "policy_name" ON table_name;
   CREATE POLICY "policy_name" ON table_name FOR SELECT USING (...);

   -- Test immediately
   SELECT * FROM table_name;
   ```

### Prevention Tips

- Always use `executeWithContext()` wrapper
- Test RLS policies in SQL Editor before deploying
- Add logging to track context values
- Document policy logic in migration comments
- Create test users for each role
- Run integration tests with RLS enabled

### Related Documentation

- [RLS Policies Guide](../database/RLS_POLICIES.md)
- [Database Context Implementation](../../src/lib/db-context.ts)
- [TROUBLESHOOTING.md](../development/TROUBLESHOOTING.md)

---

## Adding Validation Schemas

### Overview

Add input validation using Zod schemas for type-safe runtime validation.

### Step-by-Step

#### 1. Install Zod (Already Installed)

```bash
# Zod is already in dependencies
npm list zod
# Output: zod@4.1.11
```

#### 2. Create Validation Schema

```typescript
// src/lib/validations/example.ts
import { z } from 'zod';

// Define schema
export const createExampleItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(255, 'Nombre no puede exceder 255 caracteres')
    .trim(),

  description: z
    .string()
    .max(1000, 'Descripción no puede exceder 1000 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),

  churchId: z
    .number()
    .int('ID de iglesia debe ser un número entero')
    .positive('ID de iglesia debe ser positivo'),

  amount: z
    .number()
    .nonnegative('Monto no puede ser negativo')
    .finite('Monto debe ser un número válido'),

  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD'),

  email: z
    .string()
    .email('Email inválido')
    .endsWith('@ipupy.org.py', 'Email debe ser del dominio @ipupy.org.py'),
});

// Export type from schema
export type CreateExampleItemPayload = z.infer<typeof createExampleItemSchema>;

// Update schema (partial of create schema)
export const updateExampleItemSchema = createExampleItemSchema.partial();

export type UpdateExampleItemPayload = z.infer<typeof updateExampleItemSchema>;
```

#### 3. Use in API Route

```typescript
// src/app/api/example/route.ts
import { createExampleItemSchema } from '@/lib/validations/example';
import { ValidationError } from '@/lib/api-errors';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    const body = await request.json();

    // Validate with Zod
    const result = createExampleItemSchema.safeParse(body);

    if (!result.success) {
      // Format Zod errors
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return NextResponse.json(
        {
          error: 'Datos de entrada inválidos',
          details: errors,
        },
        { status: 400 }
      );
    }

    // Use validated data (TypeScript knows the type!)
    const validatedData = result.data;

    // Execute database operation
    const newItem = await createExampleItem(auth, validatedData);

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/example');
  }
}
```

#### 4. Use in Form Components

```typescript
// src/components/Example/ExampleForm.tsx
'use client';

import { useState } from 'react';
import { createExampleItemSchema } from '@/lib/validations/example';
import { z } from 'zod';
import toast from 'react-hot-toast';

export function ExampleForm(): JSX.Element {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      churchId: parseInt(formData.get('churchId') as string, 10),
    };

    // Validate client-side
    const result = createExampleItemSchema.safeParse(data);

    if (!result.success) {
      // Show validation errors
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path.join('.');
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return;
    }

    // Submit validated data
    try {
      const response = await fetch('/api/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Error al crear item');
        return;
      }

      toast.success('Item creado exitosamente');
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name">Nombre</label>
        <input
          type="text"
          id="name"
          name="name"
          className="input"
        />
        {errors.name && (
          <p className="text-red-600 text-sm mt-1">{errors.name}</p>
        )}
      </div>

      {/* More fields... */}

      <button type="submit">Crear Item</button>
    </form>
  );
}
```

### Common Validation Patterns

#### Email with Domain Restriction

```typescript
const emailSchema = z
  .string()
  .email('Email inválido')
  .endsWith('@ipupy.org.py', 'Email debe ser del dominio @ipupy.org.py');
```

#### Phone Number (Paraguay)

```typescript
const phoneSchema = z
  .string()
  .regex(/^\d{9,10}$/, 'Teléfono debe tener 9-10 dígitos')
  .transform((val) => val.replace(/\D/g, '')); // Remove non-digits
```

#### RUC (Paraguay Tax ID)

```typescript
const rucSchema = z
  .string()
  .regex(/^\d{6,8}-\d$/, 'RUC debe tener formato XXXXXX-X')
  .refine(
    (val) => {
      // Custom RUC validation logic
      const [digits, checkDigit] = val.split('-');
      // Implement check digit validation
      return validateRUCCheckDigit(digits, checkDigit);
    },
    { message: 'RUC inválido' }
  );
```

#### Date Range

```typescript
const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  {
    message: 'Fecha de inicio debe ser anterior a fecha de fin',
    path: ['endDate'],
  }
);
```

#### Currency Amount

```typescript
const currencySchema = z
  .number()
  .nonnegative('Monto no puede ser negativo')
  .multipleOf(0.01, 'Monto debe tener máximo 2 decimales')
  .max(999999999.99, 'Monto excede el límite');
```

#### Conditional Fields

```typescript
const paymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'transfer', 'check']),
  bankName: z.string().optional(),
  checkNumber: z.string().optional(),
}).refine(
  (data) => {
    if (data.paymentMethod === 'transfer' && !data.bankName) {
      return false;
    }
    if (data.paymentMethod === 'check' && !data.checkNumber) {
      return false;
    }
    return true;
  },
  {
    message: 'Banco requerido para transferencias, número de cheque requerido para cheques',
  }
);
```

### Common Pitfalls

❌ **Not handling Zod parse errors**
```typescript
// Wrong - throws error on invalid data
const data = schema.parse(input);

// Correct - handle validation errors gracefully
const result = schema.safeParse(input);
if (!result.success) {
  // Handle errors
}
```

❌ **Forgetting to trim strings**
```typescript
// Add .trim() to prevent whitespace-only values
const schema = z.object({
  name: z.string().min(1).trim(), // ✅
});
```

❌ **Not using type inference**
```typescript
// Wrong - manual type definition
type Payload = { name: string; amount: number };
const schema = z.object({ name: z.string(), amount: z.number() });

// Correct - infer type from schema
const schema = z.object({ name: z.string(), amount: z.number() });
type Payload = z.infer<typeof schema>; // ✅
```

### Related Documentation

- [Zod Documentation](https://zod.dev/)
- [Existing Validations](../../src/lib/validations)

---

## Working with TypeScript Strict Mode

### Overview

Fix TypeScript errors when working with strict mode enabled (which is REQUIRED in this project).

### Common Type Errors and Fixes

#### Error 1: Object is possibly 'undefined'

**Cause**: `noUncheckedIndexedAccess` flag

```typescript
// ❌ Error: Object is possibly 'undefined'
const first = array[0];
const prop = obj['key'];

// ✅ Fix 1: Use nullish coalescing
const first = array[0] ?? null;
const prop = obj['key'] ?? defaultValue;

// ✅ Fix 2: Check length/existence first
if (array.length > 0) {
  const first = array[0]; // Now TypeScript knows it exists
}

if ('key' in obj) {
  const prop = obj['key']; // Type-safe
}

// ✅ Fix 3: Use optional chaining
const first = array[0]?.property;
```

#### Error 2: Property comes from index signature

**Cause**: `noPropertyAccessFromIndexSignature` flag

```typescript
// ❌ Error: Property 'dynamicProp' comes from index signature
const value = obj.dynamicProp;

// ✅ Fix 1: Use bracket notation
const value = obj['dynamicProp'];

// ✅ Fix 2: Define explicit type
type MyObject = {
  dynamicProp: string;
  otherProp: number;
};
const obj: MyObject = { dynamicProp: 'value', otherProp: 42 };
const value = obj.dynamicProp; // Now works
```

#### Error 3: Type 'X | undefined' not assignable

**Cause**: `exactOptionalPropertyTypes` flag

```typescript
// ❌ Error: Cannot assign undefined to optional property
<Component optional={undefined} />

// ✅ Fix 1: Don't pass prop at all
<Component />

// ✅ Fix 2: Explicitly allow undefined
type Props = {
  optional?: string | undefined;
};

// ✅ Fix 3: Use nullish coalescing
<Component optional={value ?? null} />
```

#### Error 4: Missing return statement

**Cause**: `noImplicitReturns` flag

```typescript
// ❌ Error: Not all code paths return a value
function getValue(condition: boolean): string {
  if (condition) {
    return 'yes';
  }
  // Missing return for else case
}

// ✅ Fix: Ensure all paths return
function getValue(condition: boolean): string {
  if (condition) {
    return 'yes';
  }
  return 'no';
}

// ✅ Alternative: Use early return
function getValue(condition: boolean): string {
  if (condition) {
    return 'yes';
  }

  return 'no'; // Default return
}
```

#### Error 5: useState without generic

```typescript
// ❌ Type inferred as 'never' or too broad
const [user, setUser] = useState(null);

// ✅ Always provide generic type
const [user, setUser] = useState<User | null>(null);
const [items, setItems] = useState<Item[]>([]);
const [loading, setLoading] = useState<boolean>(false);
```

#### Error 6: Missing function return type

```typescript
// ❌ Warning: Missing return type on exported function
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

// ✅ Add explicit return type
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

// ✅ For async functions
export async function fetchData(id: string): Promise<Data | null> {
  const response = await fetch(`/api/data/${id}`);
  return response.json();
}
```

### Type Safety Patterns

#### Type Guards

```typescript
// Define type guard function
function isValidUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data &&
    typeof data.id === 'string' &&
    typeof data.email === 'string'
  );
}

// Use type guard
const data: unknown = await fetchJson('/api/user');
if (isValidUser(data)) {
  console.log(data.email); // TypeScript knows data is User
}
```

#### Discriminated Unions

```typescript
// Define discriminated union
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Type-safe handling
const response: ApiResponse<User> = await fetchData();

if (response.success) {
  console.log(response.data); // TypeScript knows data exists
} else {
  console.error(response.error); // TypeScript knows error exists
}
```

#### Asserting Non-Null (Use Sparingly)

```typescript
// When you KNOW value exists (use with caution)
const result = await client.query('INSERT ... RETURNING *');
const row = result.rows[0]!; // Non-null assertion

// Better: Check first
if (result.rows.length === 0) {
  throw new Error('Insert failed');
}
const row = result.rows[0]; // Safe
```

### Pre-Commit Validation

```bash
# Run before committing
npm run validate

# This runs:
# 1. tsc --noEmit (type check)
# 2. eslint --max-warnings 0 (zero warnings)

# Fix type errors
npm run typecheck

# Fix linting
npm run lint --fix
```

### Related Documentation

- [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md)
- [tsconfig.json](../../tsconfig.json)

---

## Additional Resources

- **Documentation**: [docs/](../..)
- **Example Code**: [src/](../../src)
- **Migrations**: [migrations/](../../migrations)
- **Community**: administracion@ipupy.org.py

---

**Next**: Read [TROUBLESHOOTING.md](../development/TROUBLESHOOTING.md) for debugging guides.
