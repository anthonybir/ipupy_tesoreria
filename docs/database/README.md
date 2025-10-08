# Database Documentation - IPU PY Tesorería

**Last Updated**: 2025-01-08  
**Database**: Convex Document Database  
**Total Collections**: 15+  
**Schema Version**: 4.0.0 (Post-Migration)

---

## ⚠️ MIGRATION NOTICE

This system **migrated from Supabase PostgreSQL to Convex** in January 2025. Legacy documentation for PostgreSQL schema is archived in `docs/database/legacy/`.

**Migration Status**: ✅ Complete  
**Legacy SQL Migrations**: Available in `migrations/` (reference only)  
**Current Schema**: Defined in `convex/schema.ts` (TypeScript)

---

## Overview

The IPUPY_Tesoreria database is a comprehensive financial management system designed for a multi-church organization with centralized treasury operations. It now runs on **Convex**, a TypeScript-first document database with real-time subscriptions and code-based authorization.

### Key Characteristics

- **Multi-tenant**: Supports 22 churches with role-based access control
- **Dual-scope**: National-level funds + Church-level operations
- **ACID compliant**: Convex handles transactions automatically
- **Code-based Authorization**: TypeScript functions replace PostgreSQL RLS
- **Real-time**: All queries support live subscriptions
- **Type-safe**: Full TypeScript integration from schema to UI

---

## Quick Navigation

### Core Documentation

1. **[CONVEX_SCHEMA.md](../CONVEX_SCHEMA.md)** - Complete schema reference (15+ collections)
2. **[AUTHORIZATION.md](./AUTHORIZATION.md)** - Code-based authorization patterns
3. **[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)** - Workflows and data relationships
4. **[INDEXES.md](./INDEXES.md)** - Convex indexes for performance
5. **[MIGRATION_FROM_SUPABASE.md](../CONVEX_MIGRATION_STATUS.md)** - Migration documentation

### By Topic

- **Church Management**: churches, profiles (church-scoped users)
- **Financial Reports**: monthlyReports, reportStatusHistory
- **Fund Management**: funds, fundBalances, fundTransactions, fundEvents
- **User System**: profiles, userActivity (audit log)
- **Providers**: providers (centralized vendor registry)
- **Donors**: donors (tither/donor information)
- **Audit**: userActivity, fundEventAudit

---

## Database Architecture

### Conceptual Model

```
┌─────────────────────────────────────────────────────────────┐
│                     NATIONAL LEVEL                           │
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Profiles  │───→│     Funds    │←───│ Fund Events  │  │
│  │  (users)    │    │  (9 funds)   │    │  (budgets)   │  │
│  └─────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                   │          │
│         │                    ↓                   │          │
│         │            ┌───────────────┐           │          │
│         │            │ Fund Balances │           │          │
│         │            └───────────────┘           │          │
│         │                                        │          │
└─────────┼────────────────────────────────────────┼──────────┘
          │                                        │
┌─────────┼────────────────────────────────────────┼──────────┐
│         │             CHURCH LEVEL               │          │
│         ↓                                        ↓          │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Churches   │───→│   Reports    │    │ Transactions │  │
│  │ (22 total)  │    │  (monthly)   │    │   (ledger)   │  │
│  └─────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                              │
│         ↓                    ↓                              │
│  ┌─────────────┐    ┌──────────────┐                      │
│  │   Profiles  │    │   Providers  │                      │
│  │  (pastors)  │    │  (vendors)   │                      │
│  └─────────────┘    └──────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                  ┌──────────────────────────┐
                  │     AUDIT & SYSTEM       │
                  │                          │
                  │  • userActivity          │
                  │  • systemConfiguration   │
                  └──────────────────────────┘
```

### Collection Categories

#### 1. Core Financial Collections (8 collections)
- **monthlyReports** - Monthly financial reports from churches
- **funds** - 9 national fund definitions
- **fundBalances** - Current balance per fund per church
- **fundTransactions** - Transaction ledger
- **fundEvents** - Event budgeting and planning
- **fundEventBudgetItems** - Line items for events
- **fundEventActuals** - Actual income/expenses post-event
- **providers** - Centralized vendor registry

#### 2. Church Management Collections (2 collections)
- **churches** - 22 IPU Paraguay churches
- **profiles** - User profiles with church assignments

#### 3. Audit & System Collections (5 collections)
- **userActivity** - Complete audit trail
- **systemConfiguration** - Admin-configurable settings
- **fundEventAudit** - Event change tracking
- **reportStatusHistory** - Report approval workflow
- **donors** - Donor/tither information

---

## Convex Document Database

### Key Differences from PostgreSQL

| Feature | PostgreSQL (Old) | Convex (New) |
|---------|------------------|--------------|
| **Schema** | SQL DDL migrations | TypeScript validators |
| **IDs** | UUIDs | Convex IDs (`Id<"collection">`) |
| **Relationships** | Foreign keys | Document references |
| **Authorization** | Row Level Security (RLS) | Code-based functions |
| **Queries** | SQL strings | TypeScript functions |
| **Real-time** | Manual polling | Built-in subscriptions |
| **Transactions** | BEGIN/COMMIT | Automatic |

### Schema Definition Pattern

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  churches: defineTable({
    name: v.string(),
    city: v.string(),
    pastor: v.optional(v.string()),
    phone: v.optional(v.string()),
    active: v.boolean(),
    
    // Legacy compatibility
    supabase_id: v.optional(v.string()),
    
    // Timestamps (Unix milliseconds)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_supabase_id", ["supabase_id"])
  .index("by_active", ["active"]),
  
  // ... other collections
});
```

### Document ID Pattern

```typescript
// Convex auto-generates IDs
const reportId: Id<"monthlyReports"> = await ctx.db.insert("monthlyReports", {
  churchId: "jd7xyz...", // Id<"churches">
  month: 1,
  year: 2025,
  // ...
});

// Reading with ID
const report = await ctx.db.get(reportId);

// Legacy compatibility: preserve supabase_id
const church = await ctx.db
  .query("churches")
  .withIndex("by_supabase_id", (q) => 
    q.eq("supabase_id", "550e8400-e29b-41d4-a716-446655440000")
  )
  .unique();
```

---

## Authorization Model

### From RLS to Code-Based Authorization

**Old (PostgreSQL RLS)**:
```sql
CREATE POLICY "Users can view own church reports"
ON reports FOR SELECT
USING (church_id = app_current_user_church_id());
```

**New (Convex TypeScript)**:
```typescript
// convex/reports.ts
export const listForChurch = query({
  args: { churchId: v.id("churches") },
  handler: async (ctx, { churchId }) => {
    // 1. Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // 2. Load user profile
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .unique();

    // 3. Check permissions
    if (!["admin", "national_treasurer"].includes(user.role)) {
      if (user.churchId !== churchId) {
        throw new Error("Unauthorized: Can only view your church");
      }
    }

    // 4. Return authorized data
    return await ctx.db
      .query("monthlyReports")
      .withIndex("by_church", (q) => q.eq("churchId", churchId))
      .collect();
  },
});
```

### Role Hierarchy (7 Roles)

| Level | Role | Scope | Access Pattern |
|-------|------|-------|----------------|
| 6 | admin | ALL | Full access to all collections |
| 5 | national_treasurer | ALL (national) | All funds, all reports, all churches |
| 4 | fund_director | assigned_funds | Only assigned funds + events |
| 3 | pastor | own_church | Own church data only |
| 2 | treasurer | own_church | Own church financial data |
| 1 | church_manager | own_church | Own church (view-only) |
| 0 | secretary | own_church | Limited church data |

**Authorization Helpers**:
```typescript
// convex/lib/auth.ts
export async function requireAuth(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  
  const user = await ctx.db
    .query("profiles")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .unique();
  
  if (!user) throw new Error("User profile not found");
  return user;
}

export async function requireRole(ctx, allowedRoles: string[]) {
  const user = await requireAuth(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Unauthorized: requires ${allowedRoles.join(", ")}`);
  }
  return user;
}
```

See **[AUTHORIZATION.md](./AUTHORIZATION.md)** for complete authorization patterns.

---

## Data Integrity

### Validators (Type Safety)

Convex uses TypeScript validators instead of database constraints:

```typescript
// convex/schema.ts
monthlyReports: defineTable({
  churchId: v.id("churches"),          // Must be valid church ID
  month: v.number(),                    // Validated in mutation
  year: v.number(),                     // Validated in mutation
  diezmos: v.number(),                  // Validated >= 0 in mutation
  ofrendas: v.number(),                 // Validated >= 0 in mutation
  fondoNacional: v.number(),            // Calculated automatically
  
  status: v.union(
    v.literal("draft"),
    v.literal("submitted"),
    v.literal("approved"),
    v.literal("rejected")
  ),                                     // Enum validation
  
  createdBy: v.id("profiles"),          // Must be valid profile ID
  createdAt: v.number(),                // Unix timestamp
  updatedAt: v.number(),                // Unix timestamp
})
.index("by_church", ["churchId"])
.index("by_church_date", ["churchId", "year", "month"])
.index("by_status", ["status"]);
```

### Unique Constraints

```typescript
// Enforce uniqueness in mutations
export const create = mutation({
  args: {
    churchId: v.id("churches"),
    month: v.number(),
    year: v.number(),
    // ...
  },
  handler: async (ctx, args) => {
    // Check for existing report
    const existing = await ctx.db
      .query("monthlyReports")
      .withIndex("by_church_date", (q) =>
        q.eq("churchId", args.churchId)
         .eq("year", args.year)
         .eq("month", args.month)
      )
      .unique();

    if (existing) {
      throw new Error("Report already exists for this month");
    }

    // Create report...
  },
});
```

### Referential Integrity

```typescript
// Check parent exists before creating child
export const createReport = mutation({
  handler: async (ctx, args) => {
    // Verify church exists
    const church = await ctx.db.get(args.churchId);
    if (!church) {
      throw new Error("Church not found");
    }

    // Create report with valid reference
    return await ctx.db.insert("monthlyReports", {
      churchId: args.churchId,
      // ...
    });
  },
});
```

---

## Performance Optimization

### Indexes

Convex indexes are defined in schema:

```typescript
// convex/schema.ts
monthlyReports: defineTable({
  // ... fields
})
.index("by_church", ["churchId"])                      // Filter by church
.index("by_church_date", ["churchId", "year", "month"]) // Compound index
.index("by_status", ["status"])                        // Filter by status
.index("by_created", ["createdAt"]);                   // Sort by date
```

### Query Patterns

**Optimal patterns**:
```typescript
// ✅ Use indexed columns
const reports = await ctx.db
  .query("monthlyReports")
  .withIndex("by_church_date", (q) =>
    q.eq("churchId", churchId).eq("year", 2025).eq("month", 1)
  )
  .unique();

// ✅ Use pagination for large results
const reports = await ctx.db
  .query("monthlyReports")
  .withIndex("by_church", (q) => q.eq("churchId", churchId))
  .paginate(paginationOpts);

// ✅ Use order for sorting with index
const recent = await ctx.db
  .query("userActivity")
  .withIndex("by_created", (q) => q.eq("userId", userId))
  .order("desc")
  .take(50);
```

**Anti-patterns**:
```typescript
// ❌ Collect all then filter (slow)
const allReports = await ctx.db.query("monthlyReports").collect();
const filtered = allReports.filter(r => r.churchId === churchId);

// ❌ No pagination for large results
const allActivity = await ctx.db.query("userActivity").collect();

// ✅ Use indexed query instead
const reports = await ctx.db
  .query("monthlyReports")
  .withIndex("by_church", (q) => q.eq("churchId", churchId))
  .collect();
```

See **[INDEXES.md](./INDEXES.md)** for complete index documentation.

---

## Real-time Subscriptions

Convex provides automatic real-time updates:

```typescript
// Client component
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ReportsList({ churchId }) {
  // Automatically re-renders when data changes
  const reports = useQuery(api.reports.listForChurch, { churchId });

  if (reports === undefined) return <div>Loading...</div>;

  return (
    <ul>
      {reports.map((report) => (
        <li key={report._id}>
          {report.month}/{report.year} - ₲{report.diezmos + report.ofrendas}
        </li>
      ))}
    </ul>
  );
}
```

---

## Migration from Supabase

### Data Preservation

All legacy data preserved with `supabase_id` fields:

```typescript
// Every collection has optional supabase_id
churches: defineTable({
  name: v.string(),
  // ... other fields
  supabase_id: v.optional(v.string()),
})
.index("by_supabase_id", ["supabase_id"]);

// Query by legacy ID
const church = await ctx.db
  .query("churches")
  .withIndex("by_supabase_id", (q) => 
    q.eq("supabase_id", legacyUUID)
  )
  .unique();
```

### Migration Process

1. **Export from Supabase**: `scripts/export-supabase.ts`
2. **Transform data**: `scripts/transform-for-convex.ts`
3. **Import to Convex**: `npx convex import --table churches data.jsonl`
4. **Verify data**: Compare record counts and spot-check critical data

### Migration Status

See **[CONVEX_MIGRATION_STATUS.md](../CONVEX_MIGRATION_STATUS.md)** for detailed migration documentation.

---

## Common Query Patterns

### Get User Church Data

```typescript
// Authorization handled in function
export const getMyReports = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    
    // User's church reports only
    return await ctx.db
      .query("monthlyReports")
      .withIndex("by_church", (q) => q.eq("churchId", user.churchId))
      .collect();
  },
});
```

### Get National Fund Summary

```typescript
// Admin/treasurer can see all funds
export const getFundSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "national_treasurer"]);

    const funds = await ctx.db.query("funds").collect();
    
    const summary = await Promise.all(
      funds.map(async (fund) => {
        const balances = await ctx.db
          .query("fundBalances")
          .withIndex("by_fund", (q) => q.eq("fundId", fund._id))
          .collect();

        const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);

        return {
          fundName: fund.name,
          totalBalance,
          churchCount: balances.length,
        };
      })
    );

    return summary;
  },
});
```

### Audit User Actions

```typescript
export const getUserActivity = query({
  args: { userId: v.id("profiles"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit = 50 }) => {
    await requireAuth(ctx);

    return await ctx.db
      .query("userActivity")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});
```

---

## Backup & Recovery

### Convex Automatic Backups

- **Point-in-time recovery**: Last 7 days (Pro plan)
- **Data export**: `npx convex export` (JSONL format)
- **Managed by Convex**: No manual backup configuration needed

### Manual Exports

```bash
# Export all data
npx convex export

# Export specific collection
npx convex export --table churches > churches-backup.jsonl

# Import data
npx convex import --table churches churches-backup.jsonl
```

---

## Development Guidelines

### Working with Convex

1. **Always verify authentication**:
   ```typescript
   export const sensitiveQuery = query({
     handler: async (ctx) => {
       const user = await requireAuth(ctx);
       // ... authorized operations
     },
   });
   ```

2. **Use TypeScript validators**:
   ```typescript
   export const create = mutation({
     args: {
       amount: v.number(),
       email: v.string(),
       churchId: v.id("churches"),
     },
     handler: async (ctx, args) => {
       // Validate business rules
       if (args.amount < 0) {
         throw new Error("Amount cannot be negative");
       }
       // ...
     },
   });
   ```

3. **Leverage real-time subscriptions**:
   ```typescript
   // Client component automatically updates
   const reports = useQuery(api.reports.listForChurch, { churchId });
   ```

4. **Test with Convex Dashboard**:
   - Navigate to https://dashboard.convex.dev
   - Use Function Playground to test queries/mutations
   - Monitor real-time logs

---

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Error**: `Not authenticated`

**Cause**: No valid session or OIDC token

**Fix**:
```typescript
// Ensure NextAuth session exists
const session = await getServerSession(authOptions);

// Convex uses session.user.email for OIDC lookup
```

#### 2. Unauthorized Access

**Error**: `Unauthorized: Can only access your church`

**Cause**: User trying to access data outside their scope

**Fix**:
```typescript
// Check user's role and church assignment
const user = await requireAuth(ctx);
console.log("User role:", user.role);
console.log("User churchId:", user.churchId);
```

#### 3. Invalid ID References

**Error**: `Document not found`

**Cause**: Using wrong ID type or non-existent document

**Fix**:
```typescript
// Verify document exists before referencing
const church = await ctx.db.get(churchId);
if (!church) {
  throw new Error("Church not found");
}
```

#### 4. Index Not Found

**Error**: `No index found for query`

**Cause**: Query uses field without index

**Fix**:
```typescript
// Add index to schema.ts
churches: defineTable({ /* ... */ })
  .index("by_city", ["city"]); // Add missing index

// Run: npx convex dev (auto-applies schema changes)
```

---

## External References

### Documentation Links

- **[Convex Documentation](https://docs.convex.dev)**
- **[Convex React Integration](https://docs.convex.dev/client/react)**
- **[Convex Schema Guide](https://docs.convex.dev/database/schemas)**
- **[Convex Authentication](https://docs.convex.dev/auth)**

### Related Project Docs

- **[CONVEX_SCHEMA.md](../CONVEX_SCHEMA.md)** - Complete schema reference
- **[AUTHORIZATION.md](./AUTHORIZATION.md)** - Authorization patterns
- **[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)** - Business workflows
- **[CONVEX_MIGRATION_STATUS.md](../CONVEX_MIGRATION_STATUS.md)** - Migration docs
- **[DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md)** - Development guide

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 4.0.0 | 2025-01-08 | Complete rewrite for Convex migration |
| 1.0 | 2025-10-06 | Initial PostgreSQL documentation (archived) |

---

**Maintained By**: Technical Documentation Team  
**Last Review**: 2025-01-08  
**Next Review**: 2025-02-08  
**Status**: ✅ Current (Post-Convex Migration)
