# Convex Schema Reference - IPU PY Tesorería

## Overview

This document describes the Convex database schema for IPU PY Tesorería. Unlike traditional SQL databases, Convex uses a TypeScript-first schema definition that provides compile-time type safety and automatic validation.

**Schema Location**: `/convex/schema.ts`

## Schema Philosophy

- **TypeScript-first**: Schema defined in code with full type safety
- **Document-based**: Collections store JSON-like documents
- **Indexes**: Explicitly defined for query optimization
- **No migrations**: Schema changes are deployed like code
- **Legacy compatibility**: `supabase_id` fields preserve IDs from PostgreSQL migration

## Core Collections

### profiles

User profiles with role-based permissions.

```typescript
profiles: defineTable({
  // Identity
  email: v.string(),
  fullName: v.optional(v.string()),

  // Authorization
  role: v.union(
    v.literal("admin"),
    v.literal("national_treasurer"),
    v.literal("fund_director"),
    v.literal("pastor"),
    v.literal("treasurer"),
    v.literal("church_manager"),
    v.literal("secretary")
  ),

  // Church association
  churchId: v.optional(v.id("churches")),

  // State
  isActive: v.boolean(),
  isAuthenticated: v.boolean(),
  onboardingStep: v.number(),
  lastSeenAt: v.optional(v.number()),

  // Legacy compatibility
  supabase_id: v.optional(v.string()),

  // Timestamps (Unix milliseconds)
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_email", ["email"])  // Primary lookup
.index("by_church", ["churchId"])
.index("by_supabase_id", ["supabase_id"])
.index("by_role", ["role"])
```

**Key Patterns:**
- Email is unique identifier for authentication (via OIDC)
- Role determines permissions (checked in each Convex function)
- Church ID optional (admin/national roles have no church)
- Unix timestamps (milliseconds since epoch)

**Example Query:**
```typescript
const user = await ctx.db
  .query("profiles")
  .withIndex("by_email", (q) => q.eq("email", "user@ipupy.org.py"))
  .unique();
```

---

### churches

22 IPU Paraguay local churches.

```typescript
churches: defineTable({
  // Basic info
  name: v.string(),
  city: v.string(),

  // Pastor details
  pastor: v.string(),
  cedula: v.optional(v.string()),
  grado: v.optional(v.string()),  // Pastoral rank
  posicion: v.optional(v.string()),  // Position

  // Legacy compatibility
  supabase_id: v.number(),  // Original PostgreSQL ID

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_name", ["name"])
.index("by_supabase_id", ["supabase_id"])
```

**Key Patterns:**
- Name is human-readable identifier
- Supabase ID required (preserves original IDs)
- Pre-loaded with 22 churches (no dynamic creation)

**Example Query:**
```typescript
const churches = await ctx.db
  .query("churches")
  .withIndex("by_name")
  .order("asc")
  .collect();
```

---

### monthlyReports

Monthly financial reports from each church.

```typescript
monthlyReports: defineTable({
  // Scope
  churchId: v.id("churches"),
  month: v.number(),  // 1-12
  year: v.number(),

  // Financial data
  diezmos: v.number(),  // Tithes
  ofrendas: v.number(),  // Offerings
  fondoNacional: v.number(),  // National fund (10% auto-calculated)
  honorariosPastorales: v.number(),  // Pastoral compensation
  totalEntradas: v.number(),  // Total income
  totalSalidas: v.number(),  // Total expenses
  saldoMes: v.number(),  // Monthly balance

  // Bank deposit
  numeroDeposito: v.optional(v.string()),
  fechaDeposito: v.optional(v.string()),  // ISO date string

  // Workflow
  status: v.union(
    v.literal("draft"),
    v.literal("submitted"),
    v.literal("approved")
  ),
  submissionSource: v.optional(v.string()),  // "manual" | "excel"
  manualReportSource: v.optional(v.string()),
  manualReportNotes: v.optional(v.string()),

  // Audit trail
  enteredBy: v.id("profiles"),
  enteredAt: v.number(),
  approvedBy: v.optional(v.id("profiles")),
  approvedAt: v.optional(v.number()),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_church", ["churchId"])
.index("by_date", ["year", "month"])
.index("by_church_date", ["churchId", "year", "month"])  // Composite index
.index("by_status", ["status"])
```

**Key Patterns:**
- Unique constraint enforced: one report per church/month/year
- Status workflow: draft → submitted → approved
- Fondo Nacional auto-calculated as 10% of (diezmos + ofrendas)
- Composite index for efficient church-month lookups

**Example Query:**
```typescript
const report = await ctx.db
  .query("monthlyReports")
  .withIndex("by_church_date", (q) =>
    q.eq("churchId", churchId).eq("year", 2025).eq("month", 1)
  )
  .unique();
```

---

### funds

Financial fund definitions (Fondo Nacional, Fondo Damas, etc.).

```typescript
funds: defineTable({
  // Identity
  name: v.string(),
  code: v.string(),  // Short code
  description: v.optional(v.string()),

  // Configuration
  isActive: v.boolean(),
  isChurchLevel: v.boolean(),  // true = each church has separate balance
  requiresApproval: v.boolean(),  // Transactions need approval

  // Legacy compatibility
  supabase_id: v.number(),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_code", ["code"])
.index("by_active", ["isActive"])
.index("by_supabase_id", ["supabase_id"])
```

**Key Patterns:**
- Predefined funds (not user-created)
- Church-level funds have separate balances per church
- National-level funds have single balance

---

### fundBalances

Current balance for each fund (per church or national).

```typescript
fundBalances: defineTable({
  fundId: v.id("funds"),
  churchId: v.optional(v.id("churches")),  // null for national funds
  balance: v.number(),
  lastTransactionAt: v.optional(v.number()),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_fund", ["fundId"])
.index("by_church", ["churchId"])
.index("by_fund_church", ["fundId", "churchId"])  // Composite
```

**Key Patterns:**
- Composite unique constraint: one balance per fund+church combination
- Balance updated by transactions (mutations are atomic)
- Church ID null for national-level funds

---

### fundTransactions

Ledger of all fund movements.

```typescript
fundTransactions: defineTable({
  // Scope
  fundId: v.id("funds"),
  churchId: v.optional(v.id("churches")),

  // Transaction details
  amount: v.number(),  // Positive = income, Negative = expense
  transactionType: v.union(
    v.literal("deposit"),
    v.literal("withdrawal"),
    v.literal("transfer"),
    v.literal("adjustment")
  ),
  description: v.string(),
  transactionDate: v.string(),  // ISO date

  // Supporting documents
  receiptNumber: v.optional(v.string()),
  referenceNumber: v.optional(v.string()),

  // Source (if from event)
  fundEventId: v.optional(v.id("fundEvents")),

  // Audit trail
  createdBy: v.id("profiles"),
  approvedBy: v.optional(v.id("profiles")),
  approvedAt: v.optional(v.number()),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_fund", ["fundId"])
.index("by_church", ["churchId"])
.index("by_event", ["fundEventId"])
.index("by_date", ["transactionDate"])
.index("by_fund_date", ["fundId", "transactionDate"])
```

**Key Patterns:**
- Immutable once created (no updates, only additions)
- Positive amounts = income, Negative = expenses
- Linked to fundEvents for budget-to-actual tracking

---

### fundEvents

Event budget planning and approval workflow.

```typescript
fundEvents: defineTable({
  // Scope
  fundId: v.id("funds"),
  churchId: v.optional(v.id("churches")),  // null for national events

  // Event details
  eventName: v.string(),
  eventDate: v.string(),  // ISO date
  description: v.optional(v.string()),

  // Budget planning (before event)
  budgetItems: v.array(v.object({
    description: v.string(),
    estimatedAmount: v.number(),
    category: v.string(),
  })),
  totalBudget: v.number(),

  // Actual results (after event)
  actualItems: v.optional(v.array(v.object({
    description: v.string(),
    actualAmount: v.number(),
    category: v.string(),
    receiptNumber: v.optional(v.string()),
  }))),
  totalActual: v.optional(v.number()),

  // Workflow
  status: v.union(
    v.literal("draft"),
    v.literal("submitted"),
    v.literal("approved"),
    v.literal("rejected")
  ),

  // Audit trail
  createdBy: v.id("profiles"),
  submittedBy: v.optional(v.id("profiles")),
  submittedAt: v.optional(v.number()),
  approvedBy: v.optional(v.id("profiles")),
  approvedAt: v.optional(v.number()),
  rejectedBy: v.optional(v.id("profiles")),
  rejectedAt: v.optional(v.number()),
  rejectionReason: v.optional(v.string()),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_fund", ["fundId"])
.index("by_church", ["churchId"])
.index("by_status", ["status"])
.index("by_date", ["eventDate"])
.index("by_fund_status", ["fundId", "status"])
```

**Key Patterns:**
- Two-phase: budget planning → actual results entry
- Approval workflow: draft → submitted → approved/rejected
- Budget items are embedded arrays (not separate collection)
- Upon approval, creates fundTransactions for actuals

---

### providers

Centralized provider registry (vendors, suppliers).

```typescript
providers: defineTable({
  // Identity
  name: v.string(),
  ruc: v.string(),  // Tax ID (unique across all churches)

  // Contact
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),

  // Association
  churchId: v.optional(v.id("churches")),  // Church that added provider

  // State
  isActive: v.boolean(),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_ruc", ["ruc"])  // Unique lookup
.index("by_church", ["churchId"])
.index("by_active", ["isActive"])
```

**Key Patterns:**
- RUC is unique identifier (deduplicated across churches)
- If provider exists, reuse (don't create duplicate)
- Church ID tracks which church added it first

---

### systemConfiguration

Admin-configurable system settings.

```typescript
systemConfiguration: defineTable({
  // Key-value store
  section: v.string(),  // e.g., "general", "financial", "security"
  key: v.string(),  // Setting name within section
  value: v.any(),  // JSON-serializable value

  // Audit trail
  updatedBy: v.id("profiles"),
  updatedAt: v.number(),
  createdAt: v.number(),
})
.index("by_section_key", ["section", "key"])  // Composite unique
```

**Key Patterns:**
- Unique constraint on (section, key) combination
- Value can be any JSON-compatible type
- Used for feature flags, limits, display preferences

**Example:**
```typescript
const config = await ctx.db
  .query("systemConfiguration")
  .withIndex("by_section_key", (q) =>
    q.eq("section", "financial").eq("key", "fondo_nacional_percentage")
  )
  .unique();
```

---

### userActivity

Complete audit trail of user actions.

```typescript
userActivity: defineTable({
  userId: v.id("profiles"),
  action: v.string(),  // e.g., "report.submit", "event.approve"
  details: v.any(),  // JSON with relevant info
  ipAddress: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  timestamp: v.number(),
})
.index("by_user", ["userId"])
.index("by_action", ["action"])
.index("by_timestamp", ["timestamp"])
.index("by_user_timestamp", ["userId", "timestamp"])
```

**Key Patterns:**
- Immutable log (no updates or deletes)
- Details field stores action-specific JSON
- Indexed for user activity history and security audits

---

## Authorization Patterns

Unlike PostgreSQL RLS, Convex authorization is implemented in code:

### Pattern 1: Require Authentication

```typescript
async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("profiles")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .unique();

  if (!user) {
    throw new Error("User profile not found");
  }

  return user;
}
```

### Pattern 2: Require Specific Role

```typescript
async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: string[]
) {
  const user = await requireAuth(ctx);

  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `Unauthorized: requires ${allowedRoles.join(" or ")}`
    );
  }

  return user;
}
```

### Pattern 3: Church-Scoped Access

```typescript
export const getChurchReports = query({
  args: { churchId: v.id("churches") },
  handler: async (ctx, { churchId }) => {
    const user = await requireAuth(ctx);

    // Admin sees all
    if (user.role === "admin") {
      return await ctx.db
        .query("monthlyReports")
        .withIndex("by_church", (q) => q.eq("churchId", churchId))
        .collect();
    }

    // Others only see their church
    if (user.churchId !== churchId) {
      throw new Error("Unauthorized: Can only access your church");
    }

    return await ctx.db
      .query("monthlyReports")
      .withIndex("by_church", (q) => q.eq("churchId", churchId))
      .collect();
  },
});
```

## Indexes Explained

### Simple Index

```typescript
.index("by_email", ["email"])
```

Allows efficient lookups by single field.

### Composite Index

```typescript
.index("by_church_date", ["churchId", "year", "month"])
```

Allows efficient queries with multiple filters in order:
- `churchId` alone
- `churchId + year`
- `churchId + year + month`

**Cannot use** for `year` alone or `month` alone.

### Index Usage Example

```typescript
// ✅ Uses composite index
const reports = await ctx.db
  .query("monthlyReports")
  .withIndex("by_church_date", (q) =>
    q.eq("churchId", church).eq("year", 2025).eq("month", 1)
  )
  .collect();

// ❌ Cannot use composite index (missing churchId)
const reports = await ctx.db
  .query("monthlyReports")
  .withIndex("by_church_date", (q) => q.eq("year", 2025))  // ERROR
  .collect();

// ✅ Use different index or scan
const reports = await ctx.db
  .query("monthlyReports")
  .withIndex("by_date", (q) => q.eq("year", 2025).eq("month", 1))
  .collect();
```

## Data Types

### Timestamps

Convex uses Unix timestamps (milliseconds since epoch):

```typescript
createdAt: v.number()  // e.g., 1704096000000

// JavaScript usage
createdAt: Date.now()
new Date(doc.createdAt)
```

### Dates (ISO Strings)

For user-facing dates, use ISO strings:

```typescript
eventDate: v.string()  // e.g., "2025-01-15"
fechaDeposito: v.optional(v.string())  // e.g., "2025-01-20"
```

### References

Use Convex IDs for references:

```typescript
churchId: v.id("churches")  // Type: Id<"churches">
enteredBy: v.id("profiles")  // Type: Id<"profiles">
```

### Arrays and Objects

Embedded data (not separate collections):

```typescript
budgetItems: v.array(v.object({
  description: v.string(),
  estimatedAmount: v.number(),
  category: v.string(),
}))
```

## Migration Notes

### From Supabase (PostgreSQL)

1. **IDs**: `supabase_id` field preserves original numeric IDs
2. **References**: Converted from numeric to Convex IDs (`Id<"table">`)
3. **Timestamps**: Converted from PostgreSQL timestamps to Unix milliseconds
4. **RLS**: Removed (replaced with code-based authorization)
5. **Unique constraints**: Enforced via indexes + query patterns
6. **Foreign keys**: Replaced with Convex ID references

### ID Mapping Strategy

To maintain API compatibility, responses include both IDs:

```typescript
// Convex document
{
  _id: "k17d3...",  // Convex ID
  supabase_id: 42,  // Legacy numeric ID
  name: "Iglesia Central"
}

// API response (mapped)
{
  id: "k17d3...",  // Convex ID as string
  church_id: 42,  // Legacy numeric ID for compatibility
  name: "Iglesia Central"
}
```

See `src/lib/convex-id-mapping.ts` for mapping utilities.

## Schema Evolution

### Adding New Fields

```typescript
// Add optional field
newField: v.optional(v.string())

// Deploy with: npx convex deploy
// Existing documents will have undefined for new field
```

### Removing Fields

```typescript
// 1. Mark as optional
oldField: v.optional(v.string())  // Was required

// 2. Deploy

// 3. Write migration to remove data

// 4. Remove from schema
```

### Changing Field Types

```typescript
// NOT SUPPORTED - create new field instead
// oldField: v.string()
newField: v.number()

// Migrate data in background
// Remove oldField when complete
```

## Performance Best Practices

1. **Use indexes** for all frequent queries
2. **Limit query results** with `.paginate()` for large datasets
3. **Avoid N+1 queries** - batch lookups with `Promise.all()`
4. **Embed related data** when it doesn't need separate queries
5. **Cache expensive calculations** in document fields

## Security Checklist

- ✅ Every query/mutation checks authentication
- ✅ Role permissions verified before operations
- ✅ Church-scoped data filtered by user's church
- ✅ Sensitive actions logged in userActivity
- ✅ Input validation using Convex validators
- ✅ No direct document access without permission check

## References

- [Convex Schema Documentation](https://docs.convex.dev/database/schemas)
- [Convex Indexes](https://docs.convex.dev/database/indexes)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
- [CONVEX_MIGRATION_PLAN.md](./CONVEX_MIGRATION_PLAN.md)
