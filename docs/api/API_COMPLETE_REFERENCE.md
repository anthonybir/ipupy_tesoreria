# API Complete Reference - IPU PY Tesorería

**Last Updated**: 2025-10-06
**API Version**: 2.0
**Base URL**: `https://ipupytesoreria.vercel.app/api`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Role System](#role-system)
4. [Common Patterns](#common-patterns)
5. [Error Handling](#error-handling)
6. [Core Endpoints](#core-endpoints)
7. [Admin Endpoints](#admin-endpoints)
8. [Financial Endpoints](#financial-endpoints)
9. [Fund Events Endpoints](#fund-events-endpoints)
10. [Providers Endpoints](#providers-endpoints)

---

## Overview

Next.js 15 serverless API built with TypeScript, featuring:
- **Authentication**: Supabase Auth with session cookies
- **Authorization**: Row Level Security (RLS) + role-based access
- **Database**: PostgreSQL 16 with pgBouncer connection pooling
- **Security**: CORS, rate limiting, input validation, audit logging

### Key Features

- ✅ Type-safe with Zod validation
- ✅ RLS context enforcement on all operations
- ✅ Audit trail for all mutations
- ✅ Transaction support for complex operations
- ✅ Pagination & filtering on list endpoints
- ✅ CORS-compliant for cross-origin requests

---

## Authentication

### Session-Based Auth

All protected routes require valid Supabase Auth session via httpOnly cookies.

**Authentication Flow**:
1. User authenticates via Supabase Auth (Google OAuth)
2. Session established with httpOnly cookies
3. API routes validate session via `requireAuth(req)`
4. RLS context set automatically for database queries

**No Authorization Headers Required** - Authentication via cookies only.

### Auth Helper Functions

```typescript
// Require authentication (throws 401 if not authenticated)
const auth = await requireAuth(req);

// Optional authentication (returns null if not authenticated)
const auth = await getAuthContext(req);

// Check role authorization
if (auth.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Auth Context Object

```typescript
interface AuthContext {
  userId: string;           // UUID from profiles table
  email: string;            // User email
  role: RoleType;           // User role (see Role System)
  churchId: number | null;  // Church ID (null for admin/treasurer)
}
```

---

## Role System

### Current Role Hierarchy (6 Roles)

After migrations 051-054 (October 2025), the **treasurer role has been consolidated to national scope**:

| Level | Role | Scope | Key Permissions |
|-------|------|-------|----------------|
| 7 | `admin` | System-wide | Full access, user management, system config |
| 6 | `treasurer` | **All churches (national)** | **National treasury operations, report approval, cross-church visibility** |
| 5 | `fund_director` | Assigned funds | Fund event management, budget approval |
| 4 | `pastor` | Single church | Church leadership, report submission, user management |
| 2 | `church_manager` | Single church | View-only church administration |
| 1 | `secretary` | Single church | Basic data entry, limited access |

**Key Changes (Migrations 053-054)**:
- `national_treasurer` role merged into `treasurer` role
- Treasurer role now operates at **national scope** (all churches)
- Old `church_treasurer` role eliminated in earlier migration 051

### Role Capabilities

**treasurer** (National Scope - Consolidated in Migration 053):
- ✅ Submit monthly financial reports for any church
- ✅ Manage transactions across all churches
- ✅ Record offerings and tithes nationally
- ✅ Upload deposit receipts for all churches
- ✅ View all church financial data
- ✅ Approve submitted reports
- ✅ View consolidated financial data
- ✅ Generate national fund reports
- ✅ Manage month-end reconciliation
- ✅ Manage providers (all churches)
- ❌ Cannot modify system configuration

---

## Common Patterns

### Request/Response Format

**Successful Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed" // Optional
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "details": "Additional error context", // Optional
  "code": "ERROR_CODE" // Optional
}
```

### Pagination

List endpoints support pagination via query parameters:

```typescript
GET /api/resource?limit=50&offset=0

Response:
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Filtering

Common filter patterns:

```typescript
// Date range filtering
?date_from=2025-01-01&date_to=2025-12-31

// Status filtering
?status=approved

// Church filtering
?church_id=5

// Search filtering
?search=asuncion
```

### RLS Context Enforcement

All database operations automatically enforce RLS via `executeWithContext()`:

```typescript
// Automatic RLS enforcement
const result = await executeWithContext(auth, query, params);

// Transaction with RLS
await executeTransaction(auth, async (client) => {
  // All queries in transaction use auth context
});
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET/PUT/DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry, constraint violation |
| 422 | Unprocessable Entity | Zod validation failure |
| 500 | Internal Server Error | Server error |

### Common Error Codes

```typescript
// Validation errors
{
  "error": "Validation failed",
  "details": {
    "field": "month",
    "message": "Month must be between 1 and 12"
  }
}

// RLS policy violation
{
  "error": "Access denied",
  "code": "RLS_POLICY_VIOLATION"
}

// Duplicate entry
{
  "error": "Ya existe un reporte para este período",
  "code": "DUPLICATE_ENTRY"
}
```

---

## Core Endpoints

### Health Check

#### `GET /api/health`

Check API health status.

**Auth**: None required

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-06T12:00:00Z",
  "version": "2.0",
  "database": "connected"
}
```

---

### Dashboard

#### `GET /api/dashboard`

Get dashboard overview with key metrics.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "user": {
    "email": "tesorero@ipupy.org.py",
    "role": "treasurer",
    "name": "Juan Pérez",
    "churchId": 5
  },
  "metrics": {
    "totalReports": 12,
    "pendingReports": 2,
    "totalIncome": 45000000,
    "totalExpenses": 8500000,
    "nationalFund": 4500000
  },
  "recentActivity": [...]
}
```

**Role Scoping**:
- **pastor/church_manager/secretary**: Church-specific metrics only
- **treasurer/admin**: System-wide metrics (national scope)

#### `GET /api/dashboard-init`

Initialize dashboard data (first load optimization).

**Auth**: Required

**Response**: Similar to `/api/dashboard` but includes pre-loaded reference data.

---

### Churches

#### `GET /api/churches`

List all churches.

**Auth**: Required

**Query Parameters**:
- `search` - Search by name or city
- `active` - Filter by active status (default: true)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Primera Iglesia Central",
      "city": "Asunción",
      "pastor": "Rev. Juan Pérez",
      "pastor_cedula": "1234567",
      "pastor_grado": "Licenciado",
      "pastor_posicion": "Pastor",
      "active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/churches`

Create new church (admin only).

**Auth**: Required (admin role)

**Request Body**:
```json
{
  "name": "Nueva Iglesia",
  "city": "Fernando de la Mora",
  "pastor": "Rev. Carlos López",
  "pastor_cedula": "9876543",
  "pastor_grado": "Licenciado",
  "pastor_posicion": "Pastor Principal"
}
```

#### `PUT /api/churches`

Update church information (admin only).

**Auth**: Required (admin role)

**Request Body**:
```json
{
  "id": 5,
  "name": "Iglesia Actualizada",
  "city": "Ciudad del Este"
}
```

---

### Monthly Reports

#### `GET /api/reports`

List monthly financial reports.

**Auth**: Required

**Query Parameters**:
- `church_id` - Filter by church (required for treasurers)
- `month` - Month (1-12)
- `year` - Year
- `status` - Filter by status (pendiente_admin, approved, etc.)
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "church_id": 5,
      "church_name": "Primera Iglesia Central",
      "month": 9,
      "year": 2025,
      "diezmos": 5000000,
      "ofrendas": 3000000,
      "fondo_nacional": 800000,
      "total_entradas": 8000000,
      "honorarios_pastoral": 2500000,
      "estado": "approved",
      "numero_deposito": "DEP-202509-001",
      "fecha_deposito": "2025-09-25",
      "submission_source": "platform_online",
      "entered_by": "tesorero@ipupy.org.py",
      "created_at": "2025-09-26T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 120,
    "limit": 50,
    "offset": 0
  },
  "summary": {
    "totalDiezmos": 120000000,
    "totalOfrendas": 75000000,
    "totalFondoNacional": 19500000
  }
}
```

#### `POST /api/reports`

Create monthly report.

**Auth**: Required (treasurer, pastor, or admin)

**Request Body**:
```json
{
  "church_id": 5,
  "month": 10,
  "year": 2025,
  "diezmos": 5500000,
  "ofrendas": 3200000,
  "misiones": 600000,
  "lazos_amor": 150000,
  "mision_posible": 120000,
  "apy": 80000,
  "iba": 55000,
  "caballeros": 110000,
  "damas": 90000,
  "jovenes": 65000,
  "ninos": 45000,
  "servicios": 320000,
  "energia_electrica": 280000,
  "agua": 95000,
  "recoleccion_basura": 55000,
  "mantenimiento": 110000,
  "materiales": 45000,
  "otros_gastos": 25000,
  "numero_deposito": "DEP-202510-001",
  "fecha_deposito": "2025-10-25",
  "aportantes": [
    {
      "first_name": "María",
      "last_name": "Gómez",
      "document": "5123456",
      "amount": 2500000
    },
    {
      "first_name": "Carlos",
      "last_name": "López",
      "document": "4022333",
      "amount": 3000000
    }
  ]
}
```

**Calculated Fields** (automatic):
- `fondo_nacional` = 10% of (diezmos + ofrendas)
- `total_entradas` = Sum of all income fields
- `total_salidas_calculadas` = Sum of designated + operational expenses
- `honorarios_pastoral` = Net remaining after expenses and 10%
- `saldo_mes` = total_entradas - total_salidas_calculadas

**Validation**:
- ✅ Aportantes sum must match diezmos amount (±1 Gs tolerance)
- ✅ Each aportante requires first_name OR last_name OR document
- ✅ No duplicate reports for same church/month/year
- ✅ Amount fields must be >= 0

**Response**: Returns created report with calculated totals.

#### `PUT /api/reports`

Update existing report (before approval).

**Auth**: Required (report owner or admin)

**Request Body**: Same as POST, must include `id` field.

---

### Auth & User Management

#### `GET /api/auth/me`

Get current user profile.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "tesorero@ipupy.org.py",
    "full_name": "Juan Pérez",
    "role": "treasurer",
    "church_id": 5,
    "church_name": "Primera Iglesia Central",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

## Admin Endpoints

All admin endpoints require `admin` role.

### User Management

#### `GET /api/admin/users`

List all system users.

**Auth**: Required (admin)

**Query Parameters**:
- `role` - Filter by role
- `church_id` - Filter by church
- `is_active` - Filter by active status

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "usuario@ipupy.org.py",
      "full_name": "María López",
      "role": "treasurer",
      "church_id": 3,
      "church_name": "Iglesia Central",
      "is_active": true,
      "role_assigned_at": "2025-05-15T00:00:00Z",
      "created_at": "2025-01-10T00:00:00Z"
    }
  ]
}
```

#### `POST /api/admin/users`

Create new user or assign role.

**Auth**: Required (admin)

**Request Body**:
```json
{
  "email": "nuevo@ipupy.org.py",
  "full_name": "Pedro Ramírez",
  "role": "treasurer",
  "church_id": 7,
  "send_welcome_email": true
}
```

**Response**: Returns created user profile.

#### `PUT /api/admin/users`

Update user role or status.

**Auth**: Required (admin)

**Request Body**:
```json
{
  "user_id": "uuid",
  "role": "pastor",
  "church_id": 7,
  "is_active": true
}
```

---

### Report Administration

#### `GET /api/admin/reports`

Get all reports with admin filters.

**Auth**: Required (admin or treasurer)

**Query Parameters**: Same as `/api/reports` but without church_id restriction.

#### `POST /api/admin/reports/approve`

Approve or reject submitted report.

**Auth**: Required (treasurer or admin)

**Request Body**:
```json
{
  "report_id": 123,
  "action": "approve", // or "reject"
  "rejection_reason": "Falta comprobante de depósito" // Required if rejecting
}
```

**State Transitions**:
- `pendiente_admin` → `approved` (treasurer approval)
- `pendiente_admin` → `rejected` (with reason)

---

### Fund Director Management

#### `GET /api/admin/fund-directors`

List fund director assignments.

**Auth**: Required (admin)

**Query Parameters**:
- `profile_id` - Filter by user
- `fund_id` - Filter by fund
- `church_id` - Filter by church

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "profile_id": "uuid",
      "fund_id": 2,
      "church_id": null,
      "notes": "Director de Fondo de Misiones",
      "profiles": {
        "email": "director@ipupy.org.py",
        "full_name": "Luis Martínez"
      },
      "funds": {
        "name": "Fondo de Misiones"
      },
      "created_at": "2025-03-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/admin/fund-directors`

Assign fund director to fund(s).

**Auth**: Required (admin)

**Request Body**:
```json
{
  "profile_id": "uuid",
  "fund_id": 2,
  "church_id": null, // Optional: restrict to specific church
  "notes": "Responsable de gestión de eventos"
}
```

**Validation**:
- User must have `fund_director` role
- Cannot duplicate assignment

#### `DELETE /api/admin/fund-directors?id=1`

Remove fund director assignment.

**Auth**: Required (admin)

---

### System Configuration

#### `GET /api/admin/configuration`

Get system configuration.

**Auth**: Required (admin)

**Query Parameters**:
- `section` - Filter by section (general, financial, security, etc.)

**Response**:
```json
{
  "success": true,
  "data": {
    "financial": {
      "fondoNacionalPercentage": 10,
      "reportDeadlineDay": 5,
      "requireReceipts": true,
      "receiptMinAmount": 100000,
      "autoCalculateTotals": true
    },
    "security": {
      "sessionTimeout": 3600,
      "requireMFA": false,
      "auditLogRetention": 365
    }
  }
}
```

#### `POST /api/admin/configuration`

Update system configuration.

**Auth**: Required (admin)

**Request Body**:
```json
{
  "section": "financial",
  "data": {
    "fondoNacionalPercentage": 12,
    "reportDeadlineDay": 7
  }
}
```

---

## Financial Endpoints

### Funds

#### `GET /api/financial/funds`

List all funds with balances.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "funds": [
    {
      "id": 1,
      "name": "Fondo General",
      "type": "general",
      "balance": 45000000,
      "last_movement_date": "2025-10-05",
      "status": "active"
    },
    {
      "id": 2,
      "name": "Fondo de Misiones",
      "type": "designated",
      "balance": 8500000,
      "last_movement_date": "2025-10-03",
      "status": "active"
    }
  ],
  "totalBalance": 53500000
}
```

---

### Transactions

#### `GET /api/financial/transactions`

List financial transactions.

**Auth**: Required (treasurer+)

**Query Parameters**:
- `fund_id` - Filter by fund
- `type` - Filter by income/expense
- `from_date` - Start date (ISO format)
- `to_date` - End date (ISO format)
- `limit` / `offset` - Pagination

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fund_id": 1,
      "fund_name": "Fondo General",
      "type": "income",
      "amount": 5000000,
      "description": "Transferencia de diezmos - Sep 2025",
      "reference": "REPORT-2025-09-001",
      "transaction_date": "2025-09-28",
      "created_by": "tesorero@ipupy.org.py",
      "created_at": "2025-09-28T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 350,
    "limit": 50,
    "offset": 0
  }
}
```

#### `POST /api/financial/transactions`

Create manual transaction.

**Auth**: Required (treasurer or admin)

**Request Body**:
```json
{
  "fund_id": 1,
  "type": "expense",
  "amount": 2000000,
  "description": "Pago de servicios generales",
  "reference": "FACTURA-2025-001",
  "transaction_date": "2025-10-05"
}
```

---

## Fund Events Endpoints

Complete workflow for event budgeting and actuals tracking.

### Fund Events

#### `GET /api/fund-events`

List fund events.

**Auth**: Required

**Query Parameters**:
- `status` - draft, submitted, approved, rejected, pending_revision
- `fund_id` - Filter by fund
- `church_id` - Filter by church
- `date_from` / `date_to` - Filter by event date
- `limit` / `offset` - Pagination

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fund_id": 2,
      "fund_name": "Fondo de Misiones",
      "church_id": null,
      "name": "Campaña Evangelística 2025",
      "description": "Campaña en Interior del país",
      "event_date": "2025-11-15",
      "status": "submitted",
      "total_budget": 15000000,
      "total_income": 0,
      "total_expense": 0,
      "created_by": "director@ipupy.org.py",
      "created_by_name": "Luis Martínez",
      "submitted_at": "2025-10-01T00:00:00Z",
      "created_at": "2025-09-28T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0
  },
  "stats": {
    "draft": 5,
    "submitted": 3,
    "approved": 15,
    "rejected": 2,
    "pending_revision": 0
  }
}
```

**Role Scoping**:
- **fund_director**: See only assigned funds
- **treasurer/admin**: See all events (national scope)

#### `POST /api/fund-events`

Create fund event with budget.

**Auth**: Required (fund_director+)

**Request Body**:
```json
{
  "fund_id": 2,
  "church_id": null,
  "name": "Campaña Evangelística Interior",
  "description": "Campaña de 3 días en Encarnación",
  "event_date": "2025-12-10",
  "budget_items": [
    {
      "description": "Alquiler de local",
      "projected_amount": 3000000
    },
    {
      "description": "Transporte de equipo",
      "projected_amount": 2500000
    },
    {
      "description": "Materiales promocionales",
      "projected_amount": 1500000
    }
  ]
}
```

**Response**: Returns created event with `status: "draft"`.

---

### Fund Event Management

#### `GET /api/fund-events/[id]`

Get event details including budget and actuals.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "fund_id": 2,
    "name": "Campaña Evangelística 2025",
    "event_date": "2025-11-15",
    "status": "approved",
    "budget_items": [
      {
        "id": 1,
        "description": "Alquiler de local",
        "projected_amount": 3000000
      }
    ],
    "actuals": [
      {
        "id": 1,
        "line_type": "expense",
        "description": "Alquiler Local Evangelístico",
        "amount": 2800000,
        "transaction_date": "2025-11-10",
        "receipt_number": "FACT-001"
      }
    ],
    "totals": {
      "budgeted": 7000000,
      "actual_income": 8500000,
      "actual_expense": 6200000,
      "variance": 2300000
    }
  }
}
```

#### `PUT /api/fund-events/[id]`

Update event details (draft only).

**Auth**: Required (event creator or admin)

**Request Body**: Same as POST

#### `POST /api/fund-events/[id]/submit`

Submit event for treasurer approval.

**Auth**: Required (event creator)

**State Transition**: `draft` → `submitted`

#### `POST /api/fund-events/[id]/approve`

Approve event and create ledger transactions.

**Auth**: Required (treasurer or admin)

**State Transition**: `submitted` → `approved`

**Side Effects**:
- Creates fund_transactions for all actuals
- Updates fund_balances
- Logs approval in fund_event_audit

---

### Budget Items

#### `GET /api/fund-events/[id]/budget`

List budget line items.

#### `POST /api/fund-events/[id]/budget`

Add budget line item (draft only).

**Request Body**:
```json
{
  "description": "Nueva partida presupuestaria",
  "projected_amount": 1500000,
  "notes": "Opcional"
}
```

#### `PUT /api/fund-events/[id]/budget/[budgetItemId]`

Update budget item (draft only).

#### `DELETE /api/fund-events/[id]/budget/[budgetItemId]`

Delete budget item (draft only).

---

### Actuals (Income/Expense)

#### `GET /api/fund-events/[id]/actuals`

List actual income/expenses.

#### `POST /api/fund-events/[id]/actuals`

Record actual income or expense.

**Auth**: Required (event creator)

**Request Body**:
```json
{
  "line_type": "expense",
  "description": "Pago de servicios",
  "amount": 2500000,
  "transaction_date": "2025-11-12",
  "receipt_number": "FACT-2025-001",
  "provider_id": 5, // Optional
  "notes": "Factura adjunta"
}
```

#### `PUT /api/fund-events/[id]/actuals/[actualId]`

Update actual entry (before event approval).

#### `DELETE /api/fund-events/[id]/actuals/[actualId]`

Delete actual entry (before event approval).

---

## Providers Endpoints

Centralized provider registry (migration 027).

### Providers

#### `GET /api/providers`

List providers.

**Auth**: Required

**Query Parameters**:
- `categoria` - Filter by category
- `es_activo` - Filter by active status
- `limit` / `offset` - Pagination

**Response**:
```json
{
  "data": [
    {
      "id": 1,
      "ruc": "80012345-6",
      "nombre": "Empresa de Servicios SA",
      "tipo_identificacion": "ruc",
      "razon_social": "EMPRESA DE SERVICIOS SOCIEDAD ANÓNIMA",
      "direccion": "Av. Principal 123",
      "telefono": "021-123456",
      "email": "contacto@empresa.com.py",
      "categoria": "servicios",
      "es_activo": true,
      "es_especial": false,
      "created_at": "2025-05-10T00:00:00Z"
    }
  ],
  "count": 45
}
```

#### `POST /api/providers`

Create new provider.

**Auth**: Required (treasurer+)

**Request Body**:
```json
{
  "ruc": "80098765-4",
  "nombre": "Proveedor Nuevo",
  "tipo_identificacion": "ruc",
  "razon_social": "PROVEEDOR NUEVO SRL",
  "direccion": "Calle Secundaria 456",
  "telefono": "0981-123456",
  "email": "proveedor@example.com",
  "categoria": "materiales"
}
```

**Validation**:
- RUC must be unique (auto-deduplication across churches)
- Required: ruc, nombre, tipo_identificacion

#### `PUT /api/providers`

Update provider information.

**Auth**: Required (treasurer+)

**Request Body**: Same as POST, must include `id`.

#### `DELETE /api/providers?id=5`

Soft delete provider (sets es_activo = false).

**Auth**: Required (treasurer+)

---

### Provider Utilities

#### `GET /api/providers/check-ruc?ruc=80012345-6`

Check if RUC already exists.

**Auth**: Required

**Response**:
```json
{
  "exists": true,
  "provider": {
    "id": 1,
    "nombre": "Empresa Existente"
  }
}
```

#### `GET /api/providers/search?q=empresa`

Search providers by name or RUC.

**Auth**: Required

**Query Parameters**:
- `q` - Search query (min 3 characters)

---

## Additional Endpoints

### Donors

#### `GET /api/donors`

List donors with tithe history.

**Auth**: Required

#### `POST /api/donors`

Register new donor.

**Auth**: Required (secretary+)

---

### People

#### `GET /api/people`

List church members and related people.

**Auth**: Required

---

### Worship Records

#### `GET /api/worship-records`

List worship service attendance records.

**Auth**: Required

#### `POST /api/worship-records`

Record worship service attendance.

**Auth**: Required (secretary+)

---

### Accounting

#### `GET /api/accounting`

Get accounting data for reports.

**Auth**: Required (treasurer+)

---

### Data Export

#### `GET /api/data`

Export data in various formats.

**Auth**: Required (admin)

**Query Parameters**:
- `format` - json, csv, excel
- `type` - reports, churches, donors, all
- `from_date` / `to_date` - Date range

---

## Rate Limiting & CORS

### Rate Limits

- **Default**: 100 requests/minute per IP
- **Admin endpoints**: 50 requests/minute
- **Export endpoints**: 10 requests/minute

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696789012
```

### CORS

**Allowed Origins**:
- `https://ipupytesoreria.vercel.app`
- `http://localhost:3000` (development)

**Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers**: Content-Type, Authorization

---

## Changelog

### Version 2.0 (October 2025)

- ✅ **Treasurer Role Consolidation** (Migrations 051-054)
  - Merged church_treasurer into treasurer role
  - Simplified permission model
  - Updated all API endpoints

- ✅ **Treasurer Role Consolidation** (Migrations 040, 051-054)
  - Added national_treasurer role (migration 040, level 6)
  - Consolidated into treasurer role (migration 053, level 6)
  - National scope with cross-church visibility
  - Report and fund event approval workflow

- ✅ **Provider Registry** (Migration 027)
  - Centralized provider management
  - RUC deduplication
  - Category management

- ✅ **Fund Events System** (Migration 026)
  - Budget planning
  - Actual tracking
  - Approval workflow

### Version 1.0 (January 2025)

- Initial API release
- Basic CRUD operations
- Role-based access control
- RLS enforcement

---

**Documentation Version**: 2.0
**Last Updated**: 2025-10-06
**Maintained By**: Technical Team
**Support**: administracion@ipupy.org.py
