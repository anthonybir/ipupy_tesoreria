# Comprehensive CRUD Remediation Plan
**Date**: 2025-09-30
**Status**: ACTION REQUIRED
**Priority**: HIGH

---

## Executive Summary

This document outlines a **comprehensive remediation plan** to address all identified CRUD operation issues across the IPU PY Tesorería application. The plan is organized by priority tier and provides specific file locations, code changes, and testing requirements for each fix.

### Scope
- **50+ files** require changes
- **30+ API routes** need standardization
- **12 application pages** need updates
- **Estimated effort**: 40-60 hours total

### Priority Tiers
- 🔴 **P0 (Critical)**: Security/RLS issues - 16 hours
- 🟡 **P1 (High)**: Missing CRUD operations - 12 hours
- 🟢 **P2 (Medium)**: Consistency improvements - 16 hours
- ⚪ **P3 (Low)**: Quality-of-life enhancements - 8 hours

---

## 🔴 P0 - CRITICAL SECURITY & RLS FIXES (16 hours)

### Issue #1: RLS Context Bypass in Anonymous GET Endpoints
**Risk**: RLS policies fail silently when `authContext` is null
**Affected Routes**: 7 endpoints
**Effort**: 4 hours

#### Problem
When `executeWithContext()` receives `null` auth context, RLS session variables (`app.current_user_*`) are not set, causing permission denied errors at database level.

**Code Reference** ([src/lib/db.ts:318-330](src/lib/db.ts#L318-330)):
```typescript
if (authContext) {  // ← Only sets context if auth exists
  await client.query(
    `SELECT set_config('app.current_user_id', $1, true), ...`,
    [authContext.userId || '00000000-0000-0000-0000-000000000000', ...]
  );
}
```

#### Files to Fix

**1. `/api/financial/funds/route.ts` - GET handler**
Location: [src/app/api/financial/funds/route.ts:21-30](src/app/api/financial/funds/route.ts#L21-30)

```typescript
// BEFORE
async function handleGet(req: NextRequest) {
  const auth = await getAuthContext(req); // ← Can be null
  const fundRows = await fetchFundBalances(auth, { includeInactive, type });
  // ...
}

// AFTER
async function handleGet(req: NextRequest) {
  const auth = await requireAuth(req); // ← Throws 401 if null
  const fundRows = await fetchFundBalances(auth, { includeInactive, type });
  // ...
}
```

**2. `/api/financial/transactions/route.ts` - GET handler**
Location: [src/app/api/financial/transactions/route.ts:42-44](src/app/api/financial/transactions/route.ts#L42-44)

```typescript
// BEFORE
async function handleGet(req: NextRequest) {
  const auth = await getAuthContext(req); // ← Can be null
  // ...
}

// AFTER
async function handleGet(req: NextRequest) {
  const auth = await requireAuth(req); // ← Throws 401 if null
  // ...
}
```

**3. `/api/churches/route.ts` - GET handler**
Location: [src/app/api/churches/route.ts:29-40](src/app/api/churches/route.ts#L29-40)

**DECISION REQUIRED**: Document as intentional public endpoint OR require auth

If keeping public:
```typescript
// Add to SECURITY.md
## Public Endpoints

### GET /api/churches
- **Public**: Yes (church directory)
- **Rationale**: Church list is public information
- **Rate Limiting**: 100 req/min per IP
- **RLS**: Returns only active churches via service account context
```

If requiring auth:
```typescript
// Replace getAuthContext with requireAuth
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); // ← Require auth
  const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE active = true');
  return jsonResponse(result.rows ?? [], origin);
}
```

**4. `/api/reports/route.ts` - GET handler**
Location: [src/app/api/reports/route.ts:988-996](src/app/api/reports/route.ts#L988-996)

**DECISION REQUIRED**: Document as intentional OR require auth

```typescript
// CURRENT BEHAVIOR: Returns empty array when unauthenticated
const auth = await getAuthContext(request);
if (!auth) {
  return jsonResponse([], origin); // ← Silent failure
}

// RECOMMENDED: Require auth for financial data
const auth = await requireAuth(request);
const rows = await handleGetReports(request, auth);
return jsonResponse(rows, origin);
```

**5-7. Fund Events, Worship Records, Admin APIs**

Apply same pattern to:
- `/api/fund-events/route.ts` - Already uses `requireAuth()` ✅
- `/api/worship-records/route.ts` - Check GET handler
- `/api/admin/*/route.ts` - All should require auth

#### Testing Checklist
- [ ] Unauthenticated GET requests return 401 (not 500 or empty data)
- [ ] Authenticated requests work normally
- [ ] RLS policies enforce church_id scoping correctly
- [ ] Error messages don't leak sensitive info

---

### Issue #2: Manual Transaction Blocks Break Atomicity
**Risk**: Partial commits on error, connection leaks
**Affected Files**: 3 route files
**Effort**: 6 hours

#### Problem
Current code uses `executeWithContext(auth, 'BEGIN')` which opens separate connections, breaking transaction atomicity.

**Evidence** ([src/app/api/fund-events/route.ts:173-190](src/app/api/fund-events/route.ts#L173-190)):
```typescript
await executeWithContext(auth, 'BEGIN'); // ← New connection #1

try {
  const eventResult = await executeWithContext(auth, `INSERT INTO fund_events...`); // ← New connection #2
  // ... more queries on different connections
  await executeWithContext(auth, 'COMMIT'); // ← New connection #3
} catch (error) {
  await executeWithContext(auth, 'ROLLBACK'); // ← New connection #4 (too late!)
  throw error;
}
```

**Each `executeWithContext` call gets a fresh pool connection**, so BEGIN/COMMIT happen on different connections!

#### Solution: Use `executeTransaction` Wrapper

**Create new utility** in `src/lib/db.ts`:

```typescript
/**
 * Execute multiple statements in a single atomic transaction.
 * All queries share the same connection and RLS context.
 */
export async function executeTransaction<T>(
  authContext: AuthContext | null,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Set RLS context once for entire transaction
    if (authContext) {
      await client.query(
        `SELECT
          set_config('app.current_user_id', $1, true),
          set_config('app.current_user_role', $2, true),
          set_config('app.current_user_church_id', $3, true)`,
        [
          authContext.userId || '00000000-0000-0000-0000-000000000000',
          authContext.role || '',
          String(authContext.churchId || 0)
        ]
      );
    }

    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

#### Files to Refactor

**1. `/api/fund-events/route.ts` - POST handler**
Location: [src/app/api/fund-events/route.ts:150-210](src/app/api/fund-events/route.ts#L150-210)

```typescript
// BEFORE
await executeWithContext(auth, 'BEGIN');
try {
  const eventResult = await executeWithContext(auth, `INSERT INTO fund_events...`, [params]);
  const event = eventResult.rows[0];

  if (body.budget_items && body.budget_items.length > 0) {
    for (const item of body.budget_items) {
      await executeWithContext(auth, `INSERT INTO fund_event_budget_items...`, [params]);
    }
  }

  await executeWithContext(auth, 'COMMIT');
  return NextResponse.json({ success: true, data: event }, { status: 201 });
} catch (error) {
  await executeWithContext(auth, 'ROLLBACK');
  throw error;
}

// AFTER
const result = await executeTransaction(auth, async (client) => {
  const eventResult = await client.query<FundEvent>(
    `INSERT INTO fund_events (fund_id, church_id, name, description, event_date, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft')
     RETURNING *`,
    [body.fund_id, body.church_id, body.name, body.description, body.event_date, auth.userId]
  );
  const event = eventResult.rows[0];

  if (body.budget_items && body.budget_items.length > 0) {
    for (const item of body.budget_items) {
      await client.query(
        `INSERT INTO fund_event_budget_items (event_id, category, description, projected_amount)
         VALUES ($1, $2, $3, $4)`,
        [event.id, item.category, item.description, item.projected_amount]
      );
    }
  }

  return event;
});

return NextResponse.json({ success: true, data: result }, { status: 201 });
```

**2. `/api/fund-events/[id]/route.ts` - PUT handler**
Location: [src/app/api/fund-events/[id]/route.ts](src/app/api/fund-events/[id]/route.ts) (similar pattern)

**3. `/api/worship-records/route.ts`**
Location: [src/app/api/worship-records/route.ts](src/app/api/worship-records/route.ts) (similar pattern)

#### Testing Checklist
- [ ] Transaction rollback works on error (verify no partial data)
- [ ] Multiple inserts commit atomically
- [ ] Connection pool doesn't leak
- [ ] RLS context persists across all queries in transaction

---

### Issue #3: Unhandled RLS Policy Violations Return Generic 500s
**Risk**: Poor UX, security info leakage
**Affected Routes**: 15+ endpoints
**Effort**: 6 hours

#### Problem
RLS violations and constraint errors leak as generic 500s with raw Postgres messages.

**Example** ([src/app/api/churches/route.ts:67-86](src/app/api/churches/route.ts#L67-86)):
```typescript
try {
  const result = await executeWithContext(auth, `INSERT INTO churches...`, [params]);
  return jsonResponse(result.rows[0], origin, 201);
} catch (error) {
  if ((error as { code?: string }).code === '23505') { // ← Only handles unique violation
    return jsonResponse({ error: 'La iglesia ya existe' }, origin, 400);
  }
  console.error('Error creando iglesia:', error);
  return jsonResponse({ error: 'No se pudo crear la iglesia' }, origin, 500); // ← Generic
}
```

**Missing error codes**:
- `42501` - RLS policy violation
- `23503` - Foreign key violation
- `23514` - Check constraint violation
- `P0001` - Custom raise_exception

#### Solution: Centralized Error Handler

**Create** `src/lib/api-errors.ts`:

```typescript
import { NextResponse } from 'next/server';

type PostgresError = {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
  table?: string;
};

export function handleDatabaseError(
  error: unknown,
  origin: string | null,
  context?: string
): NextResponse {
  const pgError = error as PostgresError;
  const isDev = process.env.NODE_ENV === 'development';

  // RLS policy violation
  if (pgError.code === '42501') {
    return NextResponse.json(
      {
        error: 'No tiene permisos para realizar esta operación',
        details: isDev ? pgError.message : undefined
      },
      { status: 403, headers: buildCORSHeaders(origin) }
    );
  }

  // Unique constraint violation
  if (pgError.code === '23505') {
    const field = pgError.constraint?.replace(/_pkey|_key$/g, '');
    return NextResponse.json(
      {
        error: `Ya existe un registro con este ${field || 'valor'}`,
        details: isDev ? pgError.detail : undefined
      },
      { status: 409, headers: buildCORSHeaders(origin) }
    );
  }

  // Foreign key violation
  if (pgError.code === '23503') {
    return NextResponse.json(
      {
        error: 'Referencia inválida. Verifique que los registros relacionados existan',
        details: isDev ? pgError.detail : undefined
      },
      { status: 400, headers: buildCORSHeaders(origin) }
    );
  }

  // Check constraint violation
  if (pgError.code === '23514') {
    return NextResponse.json(
      {
        error: 'Los datos no cumplen con las restricciones del sistema',
        constraint: pgError.constraint,
        details: isDev ? pgError.message : undefined
      },
      { status: 400, headers: buildCORSHeaders(origin) }
    );
  }

  // Custom raised exceptions
  if (pgError.code === 'P0001') {
    return NextResponse.json(
      { error: pgError.message || 'Error de validación' },
      { status: 400, headers: buildCORSHeaders(origin) }
    );
  }

  // Generic database error
  console.error(`Database error in ${context}:`, error);
  return NextResponse.json(
    {
      error: 'Error interno del servidor',
      details: isDev ? (error instanceof Error ? error.message : String(error)) : undefined
    },
    { status: 500, headers: buildCORSHeaders(origin) }
  );
}
```

#### Refactor All Routes to Use Handler

**Example** for `/api/churches/route.ts`:

```typescript
import { handleDatabaseError } from '@/lib/api-errors';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    const auth = await requireAuth(request);
    const { name, city, pastor, phone, email, ruc, cedula, grado, posicion } = await request.json();

    if (!name || !city || !pastor) {
      return jsonResponse({ error: 'Nombre, ciudad y pastor son requeridos' }, origin, 400);
    }

    const result = await executeWithContext(
      auth,
      `INSERT INTO churches (name, city, pastor, phone, email, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, city, pastor, phone || '', email || '', ruc || '', cedula || '', grado || '', posicion || '']
    );

    return jsonResponse(result.rows[0], origin, 201);
  } catch (error) {
    return handleDatabaseError(error, origin, 'POST /api/churches');
  }
}
```

#### Files to Update (Priority Order)

1. ✅ `/api/churches/route.ts` - POST, PUT, DELETE
2. ✅ `/api/reports/route.ts` - POST, PUT, DELETE
3. ✅ `/api/financial/funds/route.ts` - POST, PUT, DELETE
4. ✅ `/api/financial/transactions/route.ts` - POST, PUT, DELETE
5. ✅ `/api/providers/route.ts` - POST, PUT, DELETE
6. ✅ `/api/fund-events/**/*.ts` - All mutations
7. ⚪ All other admin endpoints

#### Testing Checklist
- [ ] RLS violations return 403 with clear message
- [ ] Unique violations return 409 with field name
- [ ] Foreign key violations return 400 with guidance
- [ ] Development mode shows details, production doesn't
- [ ] Logs contain full error context

---

## 🟡 P1 - HIGH PRIORITY: MISSING CRUD OPERATIONS (12 hours)

### Issue #4: Churches - Missing Email Field Persistence
**Risk**: Data loss on every create/update
**Effort**: 1 hour

#### Problem
Form collects `email` but API discards it.

**Evidence**:
- Form: [src/components/Churches/ChurchForm.tsx:65](src/components/Churches/ChurchForm.tsx#L65) ✅ Captures email
- Hook: [src/hooks/useChurchMutations.ts:13-23](src/hooks/useChurchMutations.ts#L13-23) ✅ Includes email
- API POST: [src/app/api/churches/route.ts:61](src/app/api/churches/route.ts#L61) ❌ Omits email
- API PUT: [src/app/api/churches/route.ts:105](src/app/api/churches/route.ts#L105) ❌ Omits email

#### Solution

**1. Verify database schema supports email**

```sql
-- Check if column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'churches' AND column_name = 'email';

-- Add if missing
ALTER TABLE churches ADD COLUMN IF NOT EXISTS email TEXT;
```

**Schema check** via Supabase shows NO email column. Must add migration.

**2. Create migration `030_add_church_email.sql`**:

```sql
-- Migration 030: Add email column to churches table
ALTER TABLE churches ADD COLUMN IF NOT EXISTS email TEXT;

-- Update RLS policies to allow email access
-- (RLS already allows SELECT * so email is automatically included)

-- Add index for email lookups (optional)
CREATE INDEX IF NOT EXISTS idx_churches_email ON churches(email) WHERE email IS NOT NULL;

COMMENT ON COLUMN churches.email IS 'Correo institucional de contacto de la iglesia';
```

**3. Update API POST handler** [src/app/api/churches/route.ts:61-76](src/app/api/churches/route.ts#L61-76):

```typescript
// BEFORE
const { name, city, pastor, phone, ruc, cedula, grado, posicion } = await request.json();

const result = await executeWithContext(
  auth,
  `INSERT INTO churches (name, city, pastor, phone, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   RETURNING *`,
  [name, city, pastor, phone || '', ruc || '', cedula || '', grado || '', posicion || '']
);

// AFTER
const { name, city, pastor, phone, email, ruc, cedula, grado, posicion } = await request.json();

const result = await executeWithContext(
  auth,
  `INSERT INTO churches (name, city, pastor, phone, email, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
   RETURNING *`,
  [name, city, pastor, phone || '', email || '', ruc || '', cedula || '', grado || '', posicion || '']
);
```

**4. Update API PUT handler** [src/app/api/churches/route.ts:105-117](src/app/api/churches/route.ts#L105-117):

```typescript
// BEFORE
const { name, city, pastor, phone, ruc, cedula, grado, posicion, active } = await request.json();

const result = await executeWithContext(
  auth,
  `UPDATE churches
   SET name = $1, city = $2, pastor = $3, phone = $4, pastor_ruc = $5,
       pastor_cedula = $6, pastor_grado = $7, pastor_posicion = $8, active = $9, updated_at = CURRENT_TIMESTAMP
   WHERE id = $10
   RETURNING *`,
  [name, city, pastor, phone, ruc, cedula, grado, posicion, active, churchId]
);

// AFTER
const { name, city, pastor, phone, email, ruc, cedula, grado, posicion, active } = await request.json();

const result = await executeWithContext(
  auth,
  `UPDATE churches
   SET name = $1, city = $2, pastor = $3, phone = $4, email = $5, pastor_ruc = $6,
       pastor_cedula = $7, pastor_grado = $8, pastor_posicion = $9, active = $10, updated_at = CURRENT_TIMESTAMP
   WHERE id = $11
   RETURNING *`,
  [name, city, pastor, phone, email, ruc, cedula, grado, posicion, active, churchId]
);
```

**5. Update TypeScript types** [src/types/api.ts](src/types/api.ts):

```typescript
export type ChurchRecord = {
  id: number;
  name: string;
  city: string;
  pastor: string;
  phone: string;
  email: string; // ← Add this
  // ... rest
};

export type RawChurchRecord = {
  id: number;
  name: string;
  city: string;
  pastor: string;
  phone: string | null;
  email: string | null; // ← Add this
  // ... rest
};
```

**6. Update normalization** [src/types/api.ts](src/types/api.ts):

```typescript
export const normalizeChurchRecord = (raw: RawChurchRecord): ChurchRecord => ({
  id: raw.id,
  name: raw.name,
  city: raw.city || '',
  pastor: raw.pastor || '',
  phone: raw.phone || '',
  email: raw.email || '', // ← Add this
  // ... rest
});
```

#### Testing Checklist
- [ ] Run migration: `supabase migration up`
- [ ] Create church with email → verify in DB
- [ ] Update church email → verify persistence
- [ ] GET churches includes email in response
- [ ] UI displays email in contact column

---

### Issue #5: Churches - Missing Update/Deactivate UI Controls
**Risk**: CRUD incomplete, hooks unused
**Effort**: 3 hours

#### Problem
Hooks exist but UI has no edit/delete buttons.

**Evidence**: [src/components/Churches/ChurchesView.tsx:78-88](src/components/Churches/ChurchesView.tsx#L78-88) only shows "Ver reportes" link.

#### Solution

**1. Create edit dialog component** `src/components/Churches/ChurchEditDialog.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/Shared';
import { useUpdateChurch } from '@/hooks/useChurchMutations';
import type { ChurchRecord } from '@/types/api';

type Props = {
  church: ChurchRecord | null;
  open: boolean;
  onClose: () => void;
};

export function ChurchEditDialog({ church, open, onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    city: '',
    pastor: '',
    phone: '',
    email: '',
    ruc: '',
    cedula: '',
    grado: '',
    posicion: '',
    active: true
  });

  const updateChurch = useUpdateChurch(church?.id ?? 0);

  useEffect(() => {
    if (church) {
      setForm({
        name: church.name,
        city: church.city,
        pastor: church.pastor,
        phone: church.phone || '',
        email: church.email || '',
        ruc: church.ruc || '',
        cedula: church.cedula || '',
        grado: church.grado || '',
        posicion: church.position || '',
        active: church.active
      });
    }
  }, [church]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!church) return;

    try {
      await updateChurch.mutateAsync(form);
      toast.success('Iglesia actualizada correctamente');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Iglesia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField htmlFor="edit-name" label="Nombre" required>
              <input
                id="edit-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
                required
              />
            </FormField>

            <FormField htmlFor="edit-city" label="Ciudad" required>
              <input
                id="edit-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
                required
              />
            </FormField>

            <FormField htmlFor="edit-pastor" label="Pastor/a" required>
              <input
                id="edit-pastor"
                type="text"
                value={form.pastor}
                onChange={(e) => setForm({ ...form, pastor: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
                required
              />
            </FormField>

            <FormField htmlFor="edit-phone" label="Teléfono">
              <input
                id="edit-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-email" label="Correo">
              <input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-ruc" label="RUC">
              <input
                id="edit-ruc"
                type="text"
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-cedula" label="Cédula">
              <input
                id="edit-cedula"
                type="text"
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-grado" label="Grado">
              <input
                id="edit-grado"
                type="text"
                value={form.grado}
                onChange={(e) => setForm({ ...form, grado: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-posicion" label="Posición">
              <input
                id="edit-posicion"
                type="text"
                value={form.posicion}
                onChange={(e) => setForm({ ...form, posicion: e.target.value })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              />
            </FormField>

            <FormField htmlFor="edit-active" label="Estado">
              <select
                id="edit-active"
                value={form.active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                className="rounded-xl border border-[var(--absd-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </FormField>
          </div>

          <div className="flex gap-3 justify-end border-t pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={updateChurch.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateChurch.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**2. Update ChurchesView actions column** [src/components/Churches/ChurchesView.tsx:78-88](src/components/Churches/ChurchesView.tsx#L78-88):

```typescript
'use client';

import { useState } from 'react';
import { ChurchEditDialog } from '@/components/Churches/ChurchEditDialog';
import { useDeactivateChurch } from '@/hooks/useChurchMutations';
// ... other imports

export default function ChurchesView() {
  const [editingChurch, setEditingChurch] = useState<ChurchRecord | null>(null);
  const deactivateChurch = useDeactivateChurch();

  // ... existing state and logic

  const handleDeactivate = async (church: ChurchRecord) => {
    if (!confirm(`¿Está seguro de desactivar "${church.name}"?`)) return;

    try {
      await deactivateChurch.mutateAsync({ churchId: church.id });
      toast.success('Iglesia desactivada correctamente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al desactivar');
    }
  };

  const columns: Array<DataTableColumn<ChurchRecord>> = [
    // ... existing columns
    {
      id: 'actions',
      header: 'Acciones',
      render: (church) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingChurch(church)}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeactivate(church)}
            disabled={!church.active}
          >
            {church.active ? 'Desactivar' : 'Inactiva'}
          </Button>
          <Link
            href={`/reports?tab=history&churchId=${church.id}`}
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs"
          >
            Ver reportes
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* ... existing JSX */}

      <ChurchEditDialog
        church={editingChurch}
        open={!!editingChurch}
        onClose={() => setEditingChurch(null)}
      />
    </div>
  );
}
```

#### Testing Checklist
- [ ] Edit button opens dialog with pre-filled data
- [ ] Save updates church and refreshes table
- [ ] Deactivate button prompts confirmation
- [ ] Deactivate sets `active = false`
- [ ] Inactive churches show grayed-out state

---

### Issue #6: Reports - History Tab Hides RLS/Auth Errors
**Risk**: Silent failures mistaken for empty data
**Effort**: 1 hour

#### Problem
History tab renders table even when query fails, showing empty state instead of error.

**Evidence**: [src/components/Reports/ReportsView.tsx:190-220](src/components/Reports/ReportsView.tsx#L190-220)

```typescript
// CURRENT: No error handling
const historyColumns = useMemo(() => { /* ... */ }, []);

return (
  <DataTable
    data={historyQuery.data || []} // ← Shows empty array on error
    columns={historyColumns}
    loading={historyQuery.isLoading}
  />
);
```

#### Solution

**Update ReportsView.tsx**:

```typescript
// BEFORE
return (
  <DataTable
    data={historyQuery.data || []}
    columns={historyColumns}
    loading={historyQuery.isLoading}
    emptyContent="No se encontraron informes"
  />
);

// AFTER
if (historyQuery.isError) {
  return (
    <ErrorState
      title="Error al cargar informes"
      message={historyQuery.error?.message || 'No se pudieron cargar los informes históricos'}
      action={
        <Button onClick={() => historyQuery.refetch()}>
          Reintentar
        </Button>
      }
    />
  );
}

return (
  <DataTable
    data={historyQuery.data || []}
    columns={historyColumns}
    loading={historyQuery.isLoading}
    emptyContent="No se encontraron informes"
  />
);
```

Same pattern for:
- Submission tab
- Dashboard stats
- Any `useQuery` results

#### Testing Checklist
- [ ] Invalid auth token shows error (not empty table)
- [ ] RLS violation shows 403 error with message
- [ ] Network error shows retry button
- [ ] Success case still renders table normally

---

### Issue #7: Transactions - Bulk Create 207 Status Ignored by Client
**Risk**: Users miss partial failures
**Effort**: 2 hours

#### Problem
API returns `207 Multi-Status` with `errors[]` array, but client treats any non-2xx as fatal.

**Evidence**:
- API: [src/app/api/financial/transactions/route.ts:152](src/app/api/financial/transactions/route.ts#L152) returns 207
- Client: [src/components/Transactions/TransactionsView.tsx:236](src/components/Transactions/TransactionsView.tsx#L236) throws on !response.ok

#### Solution

**1. Update client to handle 207** in `src/components/Transactions/TransactionsView.tsx`:

```typescript
// BEFORE
const handleBulkCreate = async (transactions: TransactionInput[]) => {
  const response = await fetch('/api/financial/transactions', {
    method: 'POST',
    body: JSON.stringify({ transactions })
  });

  if (!response.ok) {
    throw new Error('Error al crear transacciones');
  }

  const data = await response.json();
  toast.success(`${data.created} transacciones creadas`);
};

// AFTER
const handleBulkCreate = async (transactions: TransactionInput[]) => {
  const response = await fetch('/api/financial/transactions', {
    method: 'POST',
    body: JSON.stringify({ transactions })
  });

  const data = await response.json();

  if (response.status === 207) {
    // Partial success
    const { created, failed, errors } = data;

    if (created > 0) {
      toast.success(`${created} transacciones creadas correctamente`);
    }

    if (failed > 0 && errors && errors.length > 0) {
      // Show detailed errors
      const errorList = errors.map((err: { index: number; error: string }) =>
        `Fila ${err.index + 1}: ${err.error}`
      ).join('\n');

      toast.error(
        <div>
          <div className="font-semibold mb-2">{failed} transacciones fallaron:</div>
          <div className="text-xs whitespace-pre-line">{errorList}</div>
        </div>,
        { duration: 10000 }
      );
    }

    // Don't throw - some succeeded
    return data;
  }

  if (!response.ok) {
    throw new Error(data.error || 'Error al crear transacciones');
  }

  toast.success(`${data.created} transacciones creadas`);
  return data;
};
```

**2. Add visual feedback** for partial errors:

```typescript
// Add state to track partial errors
const [bulkErrors, setBulkErrors] = useState<Array<{ index: number; error: string }>>([]);

// After bulk create:
if (response.status === 207 && data.errors) {
  setBulkErrors(data.errors);
}

// Render errors below form
{bulkErrors.length > 0 && (
  <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
    <h4 className="font-semibold text-red-900 mb-2">
      Errores en {bulkErrors.length} transacciones:
    </h4>
    <ul className="space-y-1">
      {bulkErrors.map(({ index, error }) => (
        <li key={index} className="text-sm text-red-800">
          <span className="font-medium">Fila {index + 1}:</span> {error}
        </li>
      ))}
    </ul>
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setBulkErrors([])}
      className="mt-2"
    >
      Cerrar
    </Button>
  </div>
)}
```

#### Testing Checklist
- [ ] All transactions succeed → success toast
- [ ] Some fail → success + error list
- [ ] All fail → error-only toast
- [ ] Error details show row number and reason
- [ ] User can correct and retry failed rows

---

### Issue #8: Admin Configuration - Raw Fetch & No Loading States
**Risk**: Poor UX, silent failures
**Effort**: 5 hours

#### Problem
Admin configuration page uses raw `fetch()` with console-only errors and global loading flag.

**Evidence**: [src/app/admin/configuration/page.tsx:174-1115](src/app/admin/configuration/page.tsx#L174-1115)

```typescript
// CURRENT: Single loading flag for everything
const [loading, setLoading] = useState(false);

const handleSave = async () => {
  setLoading(true); // ← Freezes entire UI
  try {
    const response = await fetch('/api/admin/configuration', {
      method: 'POST',
      body: JSON.stringify(systemConfig)
    });
    if (!response.ok) throw new Error('Failed'); // ← Generic error
  } catch (error) {
    console.error(error); // ← Silent failure
  } finally {
    setLoading(false);
  }
};
```

#### Solution

**Refactor to TanStack Query hooks** - create `src/hooks/useAdminConfiguration.ts`:

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchJson } from '@/lib/api-client';

type SystemConfig = {
  systemName: string;
  organizationName: string;
  // ... all fields
};

type SecurityConfig = {
  // ... fields
};

// Separate hooks for each section
export function useSystemConfig() {
  return useQuery({
    queryKey: ['admin', 'config', 'system'],
    queryFn: () => fetchJson<SystemConfig>('/api/admin/configuration?section=system'),
    staleTime: 2 * 60 * 1000
  });
}

export function useSecurityConfig() {
  return useQuery({
    queryKey: ['admin', 'config', 'security'],
    queryFn: () => fetchJson<SecurityConfig>('/api/admin/configuration?section=security'),
    staleTime: 2 * 60 * 1000
  });
}

// Separate mutations for each section
export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: SystemConfig) =>
      fetchJson('/api/admin/configuration', {
        method: 'POST',
        body: JSON.stringify({ section: 'system', ...config })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'system'] });
      toast.success('Configuración del sistema actualizada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    }
  });
}

export function useUpdateSecurityConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: SecurityConfig) =>
      fetchJson('/api/admin/configuration', {
        method: 'POST',
        body: JSON.stringify({ section: 'security', ...config })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'security'] });
      toast.success('Configuración de seguridad actualizada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    }
  });
}
```

**Update ConfigurationPage component**:

```typescript
'use client';

import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/useAdminConfiguration';

const SystemConfigSection = () => {
  const { data: config, isLoading, isError, error } = useSystemConfig();
  const updateConfig = useUpdateSystemConfig();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={error?.message} />;

  const handleSave = () => {
    updateConfig.mutate(config);
  };

  return (
    <SectionCard title="Configuración del Sistema">
      {/* Form fields */}
      <Button
        onClick={handleSave}
        loading={updateConfig.isPending} // ← Section-specific loading
      >
        Guardar cambios
      </Button>
    </SectionCard>
  );
};
```

#### Files to Refactor

1. ✅ `src/hooks/useAdminConfiguration.ts` - Create new file
2. ✅ `src/app/admin/configuration/page.tsx` - Replace fetch with hooks
3. ✅ Split into sub-components:
   - `SystemConfigSection.tsx`
   - `SecurityConfigSection.tsx`
   - `IntegrationConfigSection.tsx`
   - `NotificationConfigSection.tsx`

#### Testing Checklist
- [ ] Each section loads independently
- [ ] Section-specific loading spinners
- [ ] Error states show retry buttons
- [ ] Saving one section doesn't freeze others
- [ ] Success/error toasts for each operation

---

## 🟢 P2 - MEDIUM PRIORITY: CONSISTENCY IMPROVEMENTS (16 hours)

### Issue #9: Standardize Fetch Usage Across All Hooks
**Risk**: Inconsistent error handling, missing headers
**Effort**: 6 hours

#### Problem
Some hooks use raw `fetch()`, others use `fetchJson()` helper.

**Evidence**: [src/hooks/useProviders.ts:64-68](src/hooks/useProviders.ts#L64-68) uses raw fetch

#### Solution

**Update all hooks to use** `fetchJson()` from `@/lib/api-client`:

**Files to update**:
1. ✅ `src/hooks/useProviders.ts` - Lines 64, 74, 99, 119, 150, 164
2. ✅ `src/hooks/useAdminData.ts` - All fetch calls
3. ✅ `src/hooks/useFundEvents.ts` - All fetch calls
4. ✅ Any other hooks using raw fetch

**Before**:
```typescript
const response = await fetch('/api/providers');
if (!response.ok) {
  throw new Error('Error al cargar proveedores');
}
return response.json();
```

**After**:
```typescript
return fetchJson<{ data: Provider[]; count: number }>('/api/providers');
// fetchJson handles errors, no-store, and throws consistent errors
```

#### Testing Checklist
- [ ] All hooks use `fetchJson()`
- [ ] Errors propagate consistently
- [ ] No caching issues (cache: 'no-store' applied)
- [ ] TypeScript types enforced on responses

---

### Issue #10: Standardize RLS Pattern Across All APIs
**Risk**: Maintenance burden, inconsistent behavior
**Effort**: 8 hours

#### Problem
Two patterns in use: `executeWithContext()` vs. direct Supabase client.

#### Solution

**Refactor these routes to** `executeWithContext()`:

1. ✅ `/api/financial/funds/route.ts` - POST/PUT/DELETE (currently uses `createClient()`)
2. ✅ `/api/providers/route.ts` - All methods (currently uses `createClient()`)
3. ✅ `/api/admin/users/route.ts` - Verify uses proper pattern

**Standard template**:

```typescript
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  try {
    const auth = await requireAuth(req);
    const body = await req.json();

    // Validation
    if (!body.required_field) {
      return jsonResponse({ error: 'Campo requerido faltante' }, origin, 400);
    }

    // Database operation with RLS context
    const result = await executeWithContext(
      auth,
      `INSERT INTO table (...) VALUES (...) RETURNING *`,
      [params]
    );

    return jsonResponse(result.rows[0], origin, 201);
  } catch (error) {
    return handleDatabaseError(error, origin, 'POST /api/...');
  }
}
```

#### Testing Checklist
- [ ] All routes use `executeWithContext()` or `executeTransaction()`
- [ ] RLS session variables set correctly
- [ ] No direct Supabase client usage (except service account operations)
- [ ] Consistent error handling via `handleDatabaseError()`

---

### Issue #11: Fund Events - Stats Query Placeholder Misalignment
**Risk**: Wrong query results
**Effort**: 30 minutes

#### Problem
Stats query reuses `params` array after pagination placeholders added.

**Evidence**: [src/app/api/fund-events/route.ts:108-119](src/app/api/fund-events/route.ts#L108-119)

```typescript
const query = `SELECT ... LIMIT $5 OFFSET $6`; // ← params.length = 6
const result = await executeWithContext(auth, query, params);

const statsQuery = `SELECT ... FROM fund_events ${whereClause}`;
const statsResult = await executeWithContext(auth, statsQuery, params); // ← Uses all 6 params!
```

#### Solution

```typescript
// Save original params before adding pagination
const queryParams = [...params];
const statsParams = [...params]; // ← Separate copy for stats

// Add pagination to queryParams only
if (limit && offset) {
  queryParams.push(limit, offset);
  query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
}

const result = await executeWithContext(auth, query, queryParams);
const statsResult = await executeWithContext(auth, statsQuery, statsParams); // ← Uses original params
```

#### Testing Checklist
- [ ] Stats counts match actual data (no off-by-one errors)
- [ ] Pagination doesn't affect stats
- [ ] Filters apply to both queries correctly

---

### Issue #12: Provider Reactivation Path Missing
**Risk**: Dead-end for soft-deleted providers
**Effort**: 1.5 hours

#### Problem
DELETE sets `es_activo = false` with no UI to reverse.

#### Solution

**1. Add reactivate mutation** to `src/hooks/useProviders.ts`:

```typescript
export function useProviders(options: UseProvidersOptions = {}) {
  // ... existing code

  const reactivateProvider = useMutation({
    mutationFn: async (id: number) => {
      return fetchJson<{ data: Provider }>('/api/providers', {
        method: 'PUT',
        body: JSON.stringify({ id, es_activo: true })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Proveedor reactivado correctamente');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al reactivar');
    }
  });

  return {
    // ... existing returns
    reactivateProvider
  };
}
```

**2. Update UI** in `src/components/Providers/ProviderManagementView.tsx`:

```typescript
const { deleteProvider, reactivateProvider } = useProviders();

// In actions column:
render: (provider) => (
  <div className="flex gap-2">
    <Button size="sm" variant="ghost" onClick={() => handleEdit(provider)}>
      Editar
    </Button>
    {provider.es_activo ? (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => deleteProvider.mutate(provider.id)}
      >
        Desactivar
      </Button>
    ) : (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => reactivateProvider.mutate(provider.id)}
      >
        Reactivar
      </Button>
    )}
  </div>
)
```

#### Testing Checklist
- [ ] Inactive providers show "Reactivar" button
- [ ] Reactivate sets `es_activo = true`
- [ ] Table refreshes after reactivation
- [ ] Active providers show "Desactivar"

---

## ⚪ P3 - LOW PRIORITY: QUALITY OF LIFE (8 hours)

### Issue #13: Add Client-Side Validation Before API Calls
**Effort**: 3 hours

Prevent invalid submissions by validating on client:
- Transactions: reject zero amounts
- Providers: validate RUC format
- Reports: validate date ranges
- Churches: validate email format

### Issue #14: Add Optimistic UI Updates
**Effort**: 2 hours

Improve perceived performance:
- Church create/update
- Provider create/update
- Transaction create

### Issue #15: Add Keyboard Shortcuts
**Effort**: 1 hour

Power user features:
- `Ctrl+S` to save forms
- `Esc` to close dialogs
- `/` to focus search

### Issue #16: Add Data Export to Excel
**Effort**: 2 hours

Export capabilities:
- Church directory → Excel
- Transaction ledger → Excel
- Provider list → Excel

---

## Testing Strategy

### Unit Tests (Not currently implemented)

**Priority test suites to add**:

1. **API Error Handler** (`src/lib/api-errors.ts`)
   ```typescript
   describe('handleDatabaseError', () => {
     it('returns 403 for RLS violations');
     it('returns 409 for unique constraints');
     it('hides details in production');
   });
   ```

2. **executeTransaction Wrapper** (`src/lib/db.ts`)
   ```typescript
   describe('executeTransaction', () => {
     it('commits on success');
     it('rolls back on error');
     it('sets RLS context');
     it('releases connection');
   });
   ```

### Integration Tests

**Critical flows to test**:

1. ✅ Churches CRUD
   - Create with all fields including email
   - Update church details
   - Deactivate church
   - Verify email persists

2. ✅ Reports submission
   - Church submits report
   - Admin approves report
   - Transactions auto-generated
   - Fund balances updated

3. ✅ Transactions bulk create
   - All succeed → 201
   - Some fail → 207 with errors
   - All fail → 400

4. ✅ RLS enforcement
   - Church user can only see own data
   - Admin can see all churches
   - Fund director restricted to assigned funds

5. ✅ Transaction atomicity
   - Fund event creation with budget items
   - Report with donors and attachments
   - Bulk transaction rollback

### Manual Testing Checklist

**Before deployment**:

- [ ] Login as admin → verify all access
- [ ] Login as church user → verify restricted access
- [ ] Login as fund director → verify read-only
- [ ] Create church with email → verify persistence
- [ ] Edit church → verify all fields update
- [ ] Submit report → verify transactions created
- [ ] Bulk create transactions → verify partial failure handling
- [ ] Create fund event → verify atomic creation
- [ ] Approve fund event → verify transaction generation
- [ ] Export data → verify Excel format
- [ ] Unauthenticated request → verify 401

---

## Deployment Plan

### Phase 1: Critical Security Fixes (Week 1)
**Deploy immediately after testing**

1. ✅ Create `executeTransaction()` wrapper
2. ✅ Create `handleDatabaseError()` helper
3. ✅ Fix RLS context on GET endpoints
4. ✅ Refactor fund-events transactions
5. ✅ Add error handling to all routes
6. 🧪 Run integration tests
7. 🚀 Deploy to staging
8. 🧪 Manual smoke test
9. 🚀 Deploy to production

### Phase 2: Missing CRUD Operations (Week 2)

1. ✅ Migration 030: Add church email column
2. ✅ Update churches API (POST/PUT)
3. ✅ Add ChurchEditDialog component
4. ✅ Add reports history error handling
5. ✅ Fix transactions 207 status handling
6. ✅ Refactor admin configuration page
7. 🧪 Test all CRUD flows
8. 🚀 Deploy to staging
9. 🚀 Deploy to production

### Phase 3: Consistency Improvements (Week 3)

1. ✅ Standardize all hooks to `fetchJson()`
2. ✅ Refactor funds/providers to `executeWithContext()`
3. ✅ Fix fund events stats query
4. ✅ Add provider reactivation
5. 🧪 Regression test suite
6. 🚀 Deploy to production

### Phase 4: QOL Enhancements (Week 4)

1. ⚪ Client-side validation
2. ⚪ Optimistic updates
3. ⚪ Keyboard shortcuts
4. ⚪ Excel exports
5. 🚀 Deploy to production

---

## Risk Mitigation

### Rollback Plan

**If issues arise post-deployment**:

1. **Database changes**: Migrations are forward-only (no rollback needed for adding columns)
2. **API changes**: Backward compatible (old clients still work)
3. **UI changes**: Feature-flagged where possible

### Monitoring

**Track these metrics post-deploy**:

- 401/403 error rates (should decrease with better auth)
- 500 error rates (should decrease with error handler)
- Transaction rollback frequency
- API response times
- User error reports

### Communication

**Stakeholder updates**:

- Week 1: Security hardening complete
- Week 2: All CRUD paths functional
- Week 3: Codebase standardized
- Week 4: UX improvements live

---

## Appendix A: File Change Summary

### Files to Create (New)

1. `src/lib/api-errors.ts` - Centralized error handler
2. `src/components/Churches/ChurchEditDialog.tsx` - Edit UI
3. `src/hooks/useAdminConfiguration.ts` - Admin config hooks
4. `migrations/030_add_church_email.sql` - DB migration

### Files to Modify (Major Changes)

1. `src/lib/db.ts` - Add `executeTransaction()`
2. `src/app/api/churches/route.ts` - Email persistence + error handling
3. `src/app/api/fund-events/route.ts` - Transaction refactor
4. `src/app/api/fund-events/[id]/route.ts` - Transaction refactor
5. `src/app/api/financial/funds/route.ts` - RLS pattern + error handling
6. `src/app/api/financial/transactions/route.ts` - RLS + 207 handling
7. `src/app/api/providers/route.ts` - RLS pattern
8. `src/app/api/reports/route.ts` - Error handling
9. `src/components/Churches/ChurchesView.tsx` - Add edit/delete UI
10. `src/components/Reports/ReportsView.tsx` - Error states
11. `src/components/Transactions/TransactionsView.tsx` - 207 handling
12. `src/app/admin/configuration/page.tsx` - TanStack Query refactor

### Files to Modify (Minor Changes)

13. `src/types/api.ts` - Add email to ChurchRecord
14. `src/hooks/useProviders.ts` - Use fetchJson + reactivation
15. `src/hooks/useAdminData.ts` - Use fetchJson
16. `src/hooks/useFundEvents.ts` - Use fetchJson

**Total**: 4 new files, 16 modified files

---

## Appendix B: Estimated Hours Breakdown

| Task | Hours |
|------|-------|
| **P0 - Critical** | |
| RLS context fixes (7 endpoints) | 4 |
| Transaction atomicity refactor | 6 |
| Error handler + apply to routes | 6 |
| **P1 - High** | |
| Church email persistence | 1 |
| Church edit/delete UI | 3 |
| Reports error states | 1 |
| Transactions 207 handling | 2 |
| Admin config refactor | 5 |
| **P2 - Medium** | |
| Standardize fetchJson usage | 6 |
| RLS pattern standardization | 8 |
| Fund events stats fix | 0.5 |
| Provider reactivation | 1.5 |
| **P3 - Low** | |
| Client validation | 3 |
| Optimistic updates | 2 |
| Keyboard shortcuts | 1 |
| Excel exports | 2 |
| **Testing** | |
| Integration test suite | 8 |
| Manual testing | 4 |
| **Documentation** | |
| Update SECURITY.md | 1 |
| Update README.md | 1 |
| **TOTAL** | **66 hours** |

---

## Appendix C: Decision Log

### Decisions Pending User Input

1. **Public GET endpoints** (churches, reports)
   - Option A: Require auth (recommended)
   - Option B: Document as intentional + rate limit

2. **File upload strategy** (report attachments)
   - Option A: Migrate to Supabase Storage (recommended)
   - Option B: Keep local filesystem + add cleanup

3. **Testing approach**
   - Option A: Add full test suite (recommended)
   - Option B: Manual testing only

4. **Deployment cadence**
   - Option A: Weekly releases (recommended)
   - Option B: Single big-bang release

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Status**: AWAITING APPROVAL
