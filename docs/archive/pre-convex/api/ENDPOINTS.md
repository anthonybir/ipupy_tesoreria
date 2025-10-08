# API Endpoints Reference

**Last Updated**: 2025-10-05
**Audit Task**: MEDIUM #16

## Overview

All API routes follow Next.js 15 App Router conventions and enforce:
- **RLS (Row Level Security)** via `executeWithContext()` session variables
- **Authentication** via Supabase Auth (getAuthContext)
- **Authorization** via role-based permissions
- **CORS** restrictions (see `src/lib/cors.ts`)

## Authentication Pattern

All protected routes follow this pattern:

```typescript
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  
  if (!auth) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!['admin', 'national_treasurer'].includes(auth.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const result = await executeWithContext(auth, `SELECT * FROM ...`);
  return NextResponse.json(result.rows);
}
```

## Base URL

- **Production**: `https://ipupytesoreria.vercel.app/api`
- **Development**: `http://localhost:3000/api`

---

## Public Endpoints

### GET /api/health
**Auth**: None  
**Returns**: `{ status: 'ok' }`

---

## Authentication

### GET /api/auth/me
**Auth**: Required  
**Returns**: Current user profile

---

## Churches

### GET /api/churches
**Auth**: Required  
**Scope**: Admin sees all, others see own church (RLS)  
**Query**: `include_inactive` (boolean)

### POST /api/churches
**Auth**: Admin only  
**Body**: `{ name, pastor, location, phone }`

### PUT /api/churches?id=X
**Auth**: Admin only

### DELETE /api/churches?id=X
**Auth**: Admin only (soft delete)

---

## Monthly Reports

### GET /api/reports
**Auth**: Required  
**Scope**: RLS-based  
**Query**: `church_id`, `year`, `month`, `estado`

### POST /api/reports
**Auth**: Church treasurer/pastor  
**Note**: `fondo_nacional`, `total_entradas`, `total_salidas`, `saldo_mes` are GENERATED columns - do NOT provide
**Race Prevention**: Uses `ON CONFLICT DO NOTHING` (HIGH #7)

### PUT /api/reports?id=X
**Auth**: Treasurer/pastor (own church)  
**RLS**: Prevents modification of approved reports (HIGH #5)

### POST /api/reports/approve
**Auth**: Admin or national_treasurer  
**Validation** (CRITICAL #2):
- Deposit photo required
- Amount must match `fondo_nacional + total_designados` (±₲100)

---

## Funds

### GET /api/financial/funds
**Auth**: Required  
**Returns**: Funds with calculated balances

### POST /api/financial/funds
**Auth**: Admin or national_treasurer  
**Forbidden**: fund_director (read-only)

### PUT /api/financial/funds?id=X
**Auth**: Admin or national_treasurer

### DELETE /api/financial/funds?id=X
**Auth**: Admin or national_treasurer  
**Behavior**: Hard delete if no transactions, soft delete otherwise

---

## Transactions

### GET /api/financial/transactions
**Auth**: Required  
**Scope**: RLS-based  
**Query**: `fund_id`, `church_id`, `start_date`, `end_date`

### POST /api/financial/transactions
**Auth**: Admin or national_treasurer  
**Validation**: `amount_in` and `amount_out` cannot both be > 0

---

## Fund Events

### GET /api/fund-events
**Auth**: Required  
**Scope**:
- Fund directors: Own funds only
- Admin/national_treasurer: All
- Church roles: Own church only

### POST /api/fund-events
**Auth**: Church treasurer/pastor

### PUT /api/fund-events/[id]
**Auth**: Church treasurer/pastor  
**Status**: `draft` → `submitted` (treasurer)  
**Forbidden**: Treasurer cannot approve (CRITICAL #1)

### POST /api/fund-events/[id]/approve
**Auth**: Admin or national_treasurer ONLY  
**Process** (migrations 029, 043, 048):
1. Lock fund with FOR UPDATE (MEDIUM #15)
2. Validate balance (CRITICAL #4)
3. Create transactions
4. Update fund balance
5. Record movements

---

## Providers

### GET /api/providers
**Auth**: Required

### POST /api/providers
**Auth**: Church treasurer/pastor  
**Deduplication**: Uses `find_provider_by_ruc()` (migration 027)

### GET /api/providers/check-ruc?ruc=X
**Auth**: Required

### GET /api/providers/search?q=X
**Auth**: Required

---

## Donors

### GET /api/donors
**Auth**: Church treasurer/pastor  
**Scope**: Own church only (RLS)

### POST /api/donors
**Auth**: Church treasurer/pastor

---

## Admin Endpoints

### GET /api/admin/users
**Auth**: Admin only

### POST /api/admin/users
**Auth**: Admin only

### GET /api/admin/reports/approve
**Auth**: Admin or national_treasurer

### GET /api/admin/configuration
**Auth**: Admin only

### PUT /api/admin/configuration
**Auth**: Admin only

---

## Security Best Practices

### 1. Always Use RLS Context
```typescript
// ❌ NEVER
const result = await pool.query('SELECT ...');

// ✅ ALWAYS
const result = await executeWithContext(auth, 'SELECT ...');
```

### 2. Pre-commit Hook Enforcement
Pre-commit hook prevents `pool.query()` in API routes (HIGH #6)

### 3. CORS Configuration
```typescript
import { setCORSHeaders } from '@/lib/cors';
setCORSHeaders(response);
```

---

## Error Format

```json
{
  "error": "Error message",
  "details": "Optional context"
}
```

**Status Codes**:
- 200 - Success
- 201 - Created
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 409 - Conflict
- 500 - Internal Server Error

---

## Database Functions

### process_fund_event_approval(event_id UUID, approved_by UUID)
**Migrations**: 029, 043 (negative balance), 048 (FOR UPDATE)  
**Returns**: JSON with transaction details

**Safeguards**:
1. FOR UPDATE lock (MEDIUM #15)
2. Negative balance prevention (CRITICAL #4)
3. Atomic transactions
4. Audit trail

---

## Testing

See `tests/workflows/`:
- `report-submission.test.ts`
- `event-approval.test.ts`
- `fund-transactions.test.ts`

---

## Related Docs

- [Business Logic](../database/BUSINESS_LOGIC.md)
- [Security Audit](../SECURITY_AUDIT_2025-09-28.md)
- [Action Checklist](../audits/ACTION_CHECKLIST.md)
