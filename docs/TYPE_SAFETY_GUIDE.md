# Type Safety Guide - IPU PY Tesorería

**Last Updated:** 2025-10-02

## Overview

This project enforces **maximum TypeScript type safety** to prevent runtime errors and improve code quality. The following patterns are **mandatory** and enforced via pre-commit hooks.

## Table of Contents

- [Enforcement Mechanisms](#enforcement-mechanisms)
- [TypeScript Configuration](#typescript-configuration)
- [Prohibited Patterns](#prohibited-patterns)
- [Required Patterns](#required-patterns)
- [API Route Patterns](#api-route-patterns)
- [Database Query Patterns](#database-query-patterns)
- [React Component Patterns](#react-component-patterns)
- [Type Utilities](#type-utilities)
- [Common Fixes](#common-fixes)

---

## Enforcement Mechanisms

### Pre-Commit Hooks

All commits are validated with:
- ✅ `tsc --noEmit` - Zero TypeScript errors
- ✅ `eslint --max-warnings 0` - Zero ESLint warnings
- ✅ Type safety checks on all `.ts` and `.tsx` files

**Pre-commit hooks will BLOCK commits with type errors.**

### CI/CD Pipeline

GitHub Actions runs:
- `npm run typecheck` - TypeScript compilation check
- `npm run lint:strict` - ESLint with zero warnings

### Build Process

`npm run build` includes TypeScript compilation and will fail on type errors.

---

## TypeScript Configuration

### Strict Flags (Enforced)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false
  }
}
```

**What this means:**
- All functions must have explicit return statements or return types
- Array/object access must handle `undefined` values
- Optional properties cannot be set to `undefined` explicitly
- Index signatures require bracket notation

---

## Prohibited Patterns

### ❌ Using `any` Type

**Never use `any`** - it defeats the purpose of TypeScript.

```typescript
// ❌ WRONG
function parseData(value: any) {
  return value.toString();
}

// ✅ CORRECT
function parseData(value: unknown): string {
  return String(value);
}
```

### ❌ Type Assertions Without Guards

```typescript
// ❌ WRONG
const user = response.data as User;

// ✅ CORRECT
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data;
}
const user = isUser(response.data) ? response.data : null;
```

### ❌ Non-null Assertions

```typescript
// ❌ WRONG (avoid unless absolutely necessary)
const value = maybeNull!.property;

// ✅ CORRECT
const value = maybeNull?.property ?? defaultValue;
```

### ❌ useState Without Generics

```typescript
// ❌ WRONG
const [user, setUser] = useState(null);

// ✅ CORRECT
const [user, setUser] = useState<User | null>(null);
```

### ❌ Disabling ESLint Rules

```typescript
// ❌ WRONG
/* eslint-disable @typescript-eslint/no-explicit-any */

// ✅ CORRECT - Fix the type instead
```

---

## Required Patterns

### ✅ Explicit Function Return Types (Exported Functions)

```typescript
// ✅ Required for exported functions
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

// ✅ Async functions must specify Promise<T>
export async function fetchUser(id: string): Promise<User | null> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

### ✅ Type Guards for Runtime Checks

```typescript
// ✅ Define type guards for API responses
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

// Usage
const data = await fetchJson('/api/user');
if (isValidUser(data)) {
  console.log(data.email); // Type-safe access
}
```

### ✅ Discriminated Unions for API Responses

```typescript
// ✅ Use discriminated unions
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Type-safe handling
const response = await fetchData();
if (response.success) {
  console.log(response.data); // TypeScript knows data exists
} else {
  console.error(response.error); // TypeScript knows error exists
}
```

---

## API Route Patterns

### Template: Next.js API Route

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db';
import { type ApiResponse, parseIntegerStrict } from '@/types/utils';

// Define request body type
type RequestBody = {
  name: string;
  amount: number;
};

// Define response data type
type ResponseData = {
  id: number;
  name: string;
  amount: number;
  createdAt: string;
};

/**
 * POST /api/example - Create a new record
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // 1. Authenticate user
    const auth: AuthContext | null = await requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body: unknown = await req.json();
    if (!isValidRequestBody(body)) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos' },
        { status: 400 }
      );
    }

    // 3. Execute database operation with RLS context
    const result = await executeWithContext<ResponseData>(
      auth,
      async (client) => {
        const queryResult = await client.query<ResponseData>(
          `INSERT INTO records (name, amount, created_by)
           VALUES ($1, $2, $3)
           RETURNING id, name, amount, created_at as "createdAt"`,
          [body.name, body.amount, auth.userId]
        );
        return queryResult.rows[0]!; // Safe because INSERT RETURNING always returns row
      }
    );

    // 4. Return typed response
    const response: ApiResponse<ResponseData> = {
      success: true,
      data: result,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/example error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Type guard for request body
function isValidRequestBody(body: unknown): body is RequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'name' in body &&
    'amount' in body &&
    typeof body.name === 'string' &&
    body.name.trim().length > 0 &&
    typeof body.amount === 'number' &&
    body.amount > 0
  );
}
```

---

## Database Query Patterns

### Type-Safe Query Execution

```typescript
import { type PoolClient } from 'pg';
import { executeWithContext } from '@/lib/db';
import { type AuthContext } from '@/lib/auth-supabase';

// 1. Define database row type (snake_case matches database)
type ChurchRow = {
  id: number;
  name: string;
  city: string;
  created_at: string;
};

// 2. Define application domain type (camelCase for TypeScript)
type Church = {
  id: number;
  name: string;
  city: string;
  createdAt: string;
};

// 3. Normalize database row to domain type
function normalizeChurch(row: ChurchRow): Church {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    createdAt: row.created_at,
  };
}

// 4. Type-safe query function
async function getChurches(auth: AuthContext): Promise<Church[]> {
  return executeWithContext<Church[]>(auth, async (client: PoolClient) => {
    const result = await client.query<ChurchRow>(`
      SELECT id, name, city, created_at
      FROM churches
      WHERE active = true
      ORDER BY name
    `);
    return result.rows.map(normalizeChurch);
  });
}
```

### Handling Optional Query Results

```typescript
// ✅ Type-safe single row retrieval
async function getChurchById(
  auth: AuthContext,
  id: number
): Promise<Church | null> {
  return executeWithContext<Church | null>(auth, async (client) => {
    const result = await client.query<ChurchRow>(
      'SELECT * FROM churches WHERE id = $1',
      [id]
    );

    // Handle undefined with nullish coalescing
    const row = result.rows[0] ?? null;
    return row ? normalizeChurch(row) : null;
  });
}
```

---

## React Component Patterns

### Component Props with Explicit Types

```typescript
import { type ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
}: ButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  );
}
```

### useState with Explicit Generics

```typescript
import { useState } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
};

function UserProfile() {
  // ✅ Always provide type parameter
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Type-safe access
  return user ? <div>{user.name}</div> : <div>No user</div>;
}
```

### Event Handlers with Explicit Types

```typescript
import { type ChangeEvent, type FormEvent } from 'react';

function LoginForm() {
  const [email, setEmail] = useState<string>('');

  // ✅ Explicit event type
  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setEmail(event.target.value);
  };

  // ✅ Explicit form event type
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // Submit logic
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={handleEmailChange} />
    </form>
  );
}
```

---

## Type Utilities

### Use Project Type Utilities

```typescript
import {
  parseChurchId,
  parseFundId,
  sanitizeString,
  type ApiResponse,
  type ChurchId,
  type FundId,
} from '@/types/utils';

// ✅ Use branded types for type safety
function transferFunds(fromId: FundId, toId: FundId, amount: number): void {
  // TypeScript prevents passing non-validated IDs
}

// ✅ Safe parsing with validation
const churchId = parseChurchId(req.query.church_id);
if (churchId === null) {
  return NextResponse.json({ error: 'Invalid church ID' }, { status: 400 });
}

// ✅ Safe string sanitization
const name = sanitizeString(req.body.name);
if (name === null) {
  return NextResponse.json({ error: 'Name is required' }, { status: 400 });
}
```

---

## Common Fixes

### Fix: `noUncheckedIndexedAccess` Errors

**Error:** `Object is possibly 'undefined'`

```typescript
// ❌ ERROR: TypeScript cannot guarantee array has element
const first = array[0];

// ✅ FIX: Use optional chaining or nullish coalescing
const first = array[0] ?? null;
const first = array[0] ?? defaultValue;

// ✅ FIX: Check length first
if (array.length > 0) {
  const first = array[0]; // Now TypeScript knows it exists
}
```

### Fix: `noPropertyAccessFromIndexSignature` Errors

**Error:** `Property 'x' comes from an index signature, so it must be accessed with ['x']`

```typescript
// ❌ ERROR: TypeScript sees dynamic property access
const value = obj.dynamicProperty;

// ✅ FIX: Use bracket notation
const value = obj['dynamicProperty'];

// ✅ BETTER: Define explicit type
type MyObject = {
  dynamicProperty: string;
  anotherProp: number;
};
const obj: MyObject = ...;
const value = obj.dynamicProperty; // Now works
```

### Fix: `exactOptionalPropertyTypes` Errors

**Error:** `Type 'X | undefined' is not assignable to type 'X'`

```typescript
// ❌ ERROR: Cannot explicitly pass undefined to optional prop
<Component optional={undefined} />

// ✅ FIX: Define prop type to accept undefined explicitly
type Props = {
  optional?: string | undefined; // Explicitly allow undefined
};

// ✅ OR: Don't pass the prop at all
<Component />
```

### Fix: Missing Return Types

```typescript
// ❌ WARNING: Missing return type
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

// ✅ FIX: Add explicit return type
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}
```

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
- [Project Type Utilities](../src/types/utils.ts)
- [API Type Definitions](../src/types/api.ts)
- [Financial Type Definitions](../src/types/financial.ts)

---

## Questions?

If you encounter type errors you're unsure how to fix:

1. Read the TypeScript error message carefully
2. Check this guide for similar patterns
3. Use type utilities from `@/types/utils`
4. Ask the team in #dev-typescript channel

**Remember:** Type errors are caught at compile time to prevent runtime bugs. Embrace strict typing!
