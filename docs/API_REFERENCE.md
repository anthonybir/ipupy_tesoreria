# API Reference - IPU PY Tesorería

> **Note**: For detailed endpoint-by-endpoint documentation, see [`docs/api/API_COMPLETE_REFERENCE.md`](./api/API_COMPLETE_REFERENCE.md).

## Overview

IPU PY Tesorería provides two API layers:

1. **Convex Functions** (Primary) - TypeScript functions with real-time subscriptions
2. **REST API Routes** (Compatibility) - Next.js API routes that wrap Convex functions

**Base URL**: `https://ipupytesoreria.vercel.app/api`
**Convex URL**: `https://your-deployment.convex.cloud`

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       v             v
┌─────────────┐  ┌──────────────┐
│ Convex      │  │ REST API     │
│ Functions   │  │ Routes       │
│ (Direct)    │  │ (Wrapper)    │
└──────┬──────┘  └──────┬───────┘
       │                │
       │                v
       │         ┌──────────────┐
       │         │ Convex HTTP  │
       │         │ Client       │
       │         └──────┬───────┘
       │                │
       └────────────────┘
                │
         ┌──────v──────┐
         │   Convex    │
         │   Backend   │
         └─────────────┘
```

## Authentication

### NextAuth v5 + Convex OIDC

All API requests must be authenticated:

**Frontend (Convex Direct)**:
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Authenticated automatically via ConvexProvider
function MyComponent() {
  const churches = useQuery(api.churches.list);
  const createReport = useMutation(api.reports.create);

  // Session handled by NextAuth + OIDC bridge
  // No manual token passing required
}
```

**Server-side (REST API)**:
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // ... authenticated request
}
```

### Authorization

Authorization is enforced in Convex functions using role-based checks:

```typescript
// convex/reports.ts
export const approveReport = mutation({
  args: { reportId: v.id("monthlyReports") },
  handler: async (ctx, { reportId }) => {
    // Check auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Load user
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .unique();

    // Check role
    if (!["admin", "treasurer"].includes(user.role)) {
      throw new Error("Unauthorized");
    }

    // ... perform operation
  },
});
```

## Convex Functions API

### Queries (Read-only)

Queries are reactive - components automatically update when data changes.

#### Churches

```typescript
// List all churches (filtered by role)
api.churches.list()
// Returns: Church[]

// Get single church
api.churches.get({ id: Id<"churches"> })
// Returns: Church | null
```

#### Monthly Reports

```typescript
// Get report for specific month
api.reports.get({
  churchId: Id<"churches">,
  year: number,
  month: number
})
// Returns: MonthlyReport | null

// List reports for church
api.reports.listForChurch({
  churchId: Id<"churches">,
  year?: number
})
// Returns: MonthlyReport[]

// List all reports (admin/treasurer only)
api.reports.listAll({
  year?: number,
  month?: number,
  status?: "draft" | "submitted" | "approved"
})
// Returns: MonthlyReport[]
```

#### Fund Events

```typescript
// List events for fund
api.fundEvents.listForFund({
  fundId: Id<"funds">,
  status?: "draft" | "submitted" | "approved" | "rejected"
})
// Returns: FundEvent[]

// Get single event
api.fundEvents.get({ id: Id<"fundEvents"> })
// Returns: FundEvent | null

// List events requiring approval (treasurer/admin)
api.fundEvents.listPendingApproval()
// Returns: FundEvent[]
```

#### Funds

```typescript
// List all funds
api.funds.list()
// Returns: Fund[]

// Get fund with balance
api.funds.getWithBalance({
  fundId: Id<"funds">,
  churchId?: Id<"churches">
})
// Returns: { fund: Fund, balance: number }
```

### Mutations (Write operations)

Mutations modify data and trigger reactive updates.

#### Monthly Reports

```typescript
// Create draft report
api.reports.create({
  churchId: Id<"churches">,
  month: number,
  year: number,
  diezmos: number,
  ofrendas: number,
  // ... other fields
})
// Returns: MonthlyReport

// Submit report for approval
api.reports.submit({ reportId: Id<"monthlyReports"> })
// Returns: MonthlyReport

// Approve report (treasurer/admin only)
api.reports.approve({ reportId: Id<"monthlyReports"> })
// Returns: MonthlyReport

// Reject report (treasurer/admin only)
api.reports.reject({
  reportId: Id<"monthlyReports">,
  reason: string
})
// Returns: MonthlyReport
```

#### Fund Events

```typescript
// Create fund event
api.fundEvents.create({
  fundId: Id<"funds">,
  eventName: string,
  eventDate: string, // ISO date
  budgetItems: Array<{
    description: string,
    estimatedAmount: number,
    category: string
  }>
})
// Returns: FundEvent

// Submit for approval
api.fundEvents.submit({ id: Id<"fundEvents"> })
// Returns: FundEvent

// Approve event (treasurer/admin only)
api.fundEvents.approve({ id: Id<"fundEvents"> })
// Returns: FundEvent

// Reject event
api.fundEvents.reject({
  id: Id<"fundEvents">,
  reason: string
})
// Returns: FundEvent

// Add actual results (after event)
api.fundEvents.addActuals({
  id: Id<"fundEvents">,
  actualItems: Array<{
    description: string,
    actualAmount: number,
    category: string,
    receiptNumber?: string
  }>
})
// Returns: FundEvent
```

#### Fund Transactions

```typescript
// Create transaction
api.fundTransactions.create({
  fundId: Id<"funds">,
  churchId?: Id<"churches">,
  amount: number, // Positive = income, Negative = expense
  transactionType: "deposit" | "withdrawal" | "transfer" | "adjustment",
  description: string,
  transactionDate: string, // ISO date
  receiptNumber?: string
})
// Returns: FundTransaction
```

### Actions (External operations)

Actions can call external APIs and don't have reactive subscriptions.

```typescript
// Send email notification
api.actions.sendEmailNotification({
  to: string,
  subject: string,
  body: string
})
// Returns: { success: boolean }

// Export data to Excel
api.actions.exportToExcel({
  reportIds: Id<"monthlyReports">[]
})
// Returns: { url: string }
```

## REST API Routes (Compatibility Layer)

### Standard Response Format

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Error response:
```json
{
  "success": false,
  "data": null,
  "error": "Error message"
}
```

### Churches

#### GET `/api/churches`

List all churches (filtered by user role).

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "k17abc...",
      "church_id": 1,
      "name": "Iglesia Central",
      "city": "Asunción",
      "pastor": "Pastor Name",
      "supabase_id": 1
    }
  ]
}
```

#### GET `/api/churches/:id`

Get single church details.

### Monthly Reports

#### GET `/api/reports`

Query parameters:
- `churchId` (optional)
- `year` (optional)
- `month` (optional)
- `status` (optional): "draft" | "submitted" | "approved"

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "k17def...",
      "church_id": 1,
      "month": 1,
      "year": 2025,
      "diezmos": 5000000,
      "ofrendas": 2000000,
      "fondo_nacional": 700000,
      "status": "approved"
    }
  ]
}
```

#### POST `/api/reports`

Create new monthly report.

**Request Body**:
```json
{
  "churchId": "k17abc...",
  "month": 1,
  "year": 2025,
  "diezmos": 5000000,
  "ofrendas": 2000000,
  "honorarios_pastorales": 1000000,
  "total_entradas": 5000000,
  "total_salidas": 3000000,
  "numero_deposito": "123456",
  "fecha_deposito": "2025-01-15"
}
```

#### POST `/api/reports/:id/submit`

Submit report for approval.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "k17def...",
    "status": "submitted",
    "submitted_at": 1704096000000
  },
  "message": "Report submitted successfully"
}
```

#### POST `/api/reports/:id/approve`

Approve report (treasurer/admin only).

#### POST `/api/reports/:id/reject`

Reject report with reason.

**Request Body**:
```json
{
  "reason": "Missing deposit receipt"
}
```

### Fund Events

#### GET `/api/fund-events`

Query parameters:
- `fundId` (optional)
- `churchId` (optional)
- `status` (optional)

#### GET `/api/fund-events/:id`

Get single fund event with full details.

#### POST `/api/fund-events`

Create new fund event.

**Request Body**:
```json
{
  "fund_id": "k17xyz...",
  "event_name": "Campaña Nacional",
  "event_date": "2025-03-15",
  "description": "Campaña evangelística nacional",
  "budget_items": [
    {
      "description": "Alquiler de local",
      "estimated_amount": 2000000,
      "category": "venue"
    },
    {
      "description": "Publicidad",
      "estimated_amount": 1000000,
      "category": "marketing"
    }
  ]
}
```

#### POST `/api/fund-events/:id/submit`

Submit event for approval.

#### POST `/api/fund-events/:id/approve`

Approve fund event (treasurer/admin only).

#### POST `/api/fund-events/:id/reject`

Reject fund event with reason.

#### PUT `/api/fund-events/:id/actuals`

Add actual results after event completion.

**Request Body**:
```json
{
  "actual_items": [
    {
      "description": "Alquiler de local",
      "actual_amount": 1800000,
      "category": "venue",
      "receipt_number": "REC-001"
    }
  ]
}
```

### Dashboard

#### GET `/api/dashboard`

Get dashboard metrics (filtered by role).

**Response**:
```json
{
  "success": true,
  "data": {
    "total_churches": 22,
    "reports_pending": 5,
    "reports_this_month": 18,
    "total_diezmos": 50000000,
    "total_ofrendas": 20000000,
    "fondo_nacional_balance": 15000000,
    "recent_activity": []
  }
}
```

### Admin Endpoints

#### GET `/api/admin/users`

List all users (admin only).

#### PUT `/api/admin/users/:id/role`

Change user role (admin only).

**Request Body**:
```json
{
  "role": "pastor" | "treasurer" | "secretary" | "church_manager" | "fund_director" | "admin"
}
```

#### GET `/api/admin/activity-logs`

Query user activity logs (admin only).

Query parameters:
- `userId` (optional)
- `action` (optional)
- `startDate` (optional)
- `endDate` (optional)

## Error Codes

| Code | Meaning |
|------|---------|
| 401  | Unauthorized - Not authenticated |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist |
| 422  | Unprocessable Entity - Validation error |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error |

## Rate Limiting

REST API routes may implement rate limiting:

- **Default**: 100 requests per minute per IP
- **Auth endpoints**: 10 requests per minute per IP
- **Admin endpoints**: 50 requests per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704096000
```

## Pagination

Convex queries support pagination:

```typescript
// Get paginated results
const result = await ctx.db
  .query("monthlyReports")
  .order("desc")
  .paginate({ numItems: 20, cursor: null });

// Returns:
// {
//   page: MonthlyReport[],
//   isDone: boolean,
//   continueCursor: string
// }
```

REST API pagination (query parameters):
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

## Real-time Subscriptions

Convex provides automatic real-time updates:

```typescript
function ReportsPage() {
  // Automatically updates when data changes
  const reports = useQuery(api.reports.listAll);

  // If another user creates/updates a report,
  // this component re-renders with new data automatically
  return <ReportsList reports={reports} />;
}
```

No polling or manual refetching required!

## Code Examples

### Creating a Report (Convex)

```typescript
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function CreateReportForm() {
  const createReport = useMutation(api.reports.create);

  const handleSubmit = async (data: FormData) => {
    try {
      const report = await createReport({
        churchId: data.churchId,
        month: data.month,
        year: data.year,
        diezmos: data.diezmos,
        ofrendas: data.ofrendas,
        // ...
      });
      toast.success("Report created!");
    } catch (error) {
      toast.error(error.message);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Creating a Report (REST)

```typescript
async function createReport(data: ReportData) {
  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
}
```

## TypeScript Types

Convex provides auto-generated types:

```typescript
import { Doc, Id } from "@/convex/_generated/dataModel";

// Document types
type Church = Doc<"churches">;
type MonthlyReport = Doc<"monthlyReports">;
type FundEvent = Doc<"fundEvents">;

// ID types
type ChurchId = Id<"churches">;
type ReportId = Id<"monthlyReports">;

// Function return types are inferred
const churches = useQuery(api.churches.list);
// Type: Church[] | undefined
```

## Best Practices

1. **Prefer Convex Direct**: Use Convex functions directly when possible for real-time updates
2. **Use REST for Legacy**: Only use REST API routes for backward compatibility
3. **Handle Loading States**: Convex queries return `undefined` while loading
4. **Error Boundaries**: Wrap components in error boundaries for failed queries
5. **Optimistic Updates**: Use Convex optimistic updates for better UX
6. **Batch Operations**: Combine multiple updates in single mutation when possible

## Migration from REST to Convex

```typescript
// BEFORE (REST API)
const [reports, setReports] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/reports')
    .then(r => r.json())
    .then(data => setReports(data.data))
    .finally(() => setLoading(false));
}, []);

// AFTER (Convex)
const reports = useQuery(api.reports.listAll);
// Loading state: reports === undefined
// Loaded state: reports is Report[]
// Auto-updates when data changes!
```

## References

- [Convex Functions Documentation](https://docs.convex.dev/functions)
- [Convex React Hooks](https://docs.convex.dev/client/react)
- [Complete API Reference](./api/API_COMPLETE_REFERENCE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CONVEX_SCHEMA.md](./CONVEX_SCHEMA.md)
- [SECURITY.md](./SECURITY.md)
