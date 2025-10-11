# WS-7 Accounting System Migration to Convex

**Date:** October 10, 2025
**Status:** 📋 PLANNING
**Priority:** HIGH - Blocking Supabase/PostgreSQL removal

---

## Executive Summary

The `/api/accounting` endpoint is the **most complex remaining PostgreSQL dependency**, handling:
- Monthly ledger management (open/close workflows)
- Expense tracking with provider integration
- Double-entry accounting system
- Financial summaries and aggregations

This document provides a **comprehensive, step-by-step migration plan** to move all accounting functionality to Convex while maintaining data integrity and business continuity.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Why This Migration is Complex](#why-this-migration-is-complex)
3. [Migration Strategy](#migration-strategy-phased-approach)
4. [Phase 1: Schema Design](#phase-1-schema-design-2-3-hours)
5. [Phase 2: Reference Data Migration](#phase-2-reference-data-migration-1-2-hours)
6. [Phase 3: Read-Only Queries](#phase-3-read-only-queries-implementation-4-6-hours)
7. [Phase 4: Data Backfill](#phase-4-data-backfill-3-4-hours)
8. [Phase 5: Write Operations](#phase-5-write-operations-mutations-6-8-hours)
9. [Phase 6: API Route Migration](#phase-6-api-route-migration-2-3-hours)
10. [Phase 7: Testing & Validation](#phase-7-testing--validation-4-6-hours)
11. [Phase 8: Cutover & Cleanup](#phase-8-cutover--cleanup-2-3-hours)
12. [Rollback Plan](#rollback-plan)
13. [Risk Assessment](#risk-assessment)

**Total Estimated Effort:** 24-35 hours (3-4 work days)

---

## Current State Analysis

### PostgreSQL Tables Used by `/api/accounting`

| Table | Purpose | Complexity | Records (est.) | Exists in Convex? |
|-------|---------|------------|----------------|-------------------|
| `monthly_ledger` | Monthly financial periods | **HIGH** - Stateful workflow | ~264 (22 churches × 12 months) | ❌ NO |
| `expense_records` | Expense transactions | **MEDIUM** - CRUD with provider FK | ~2,000+ | ✅ YES (partial) |
| `accounting_entries` | Double-entry bookkeeping | **HIGH** - Must balance debits/credits | ~4,000+ | ❌ NO |
| `church_accounts` (mig 005) | Bank/cash accounts | **MEDIUM** - Account management | Unknown | ❌ NO |
| `church_transactions` (mig 005) | Transaction ledger | **HIGH** - Complex triggers | Unknown | ❌ NO |
| `church_budgets` (mig 005) | Budget tracking | **LOW** - Simple CRUD | Unknown | ❌ NO |
| `church_transaction_categories` | Expense categories | **LOW** - Reference data | ~30 | ❌ NO |

### Key Business Logic

#### 1. Ledger Open Workflow
```typescript
// Current PostgreSQL logic (src/app/api/accounting/route.ts:650-703)
async function openMonthlyLedger(church_id, month, year) {
  // 1. Check if ledger already exists → error if duplicate
  // 2. Get previous month's closing_balance
  // 3. Create new ledger with opening_balance = previous closing_balance
  // 4. Initial closing_balance = opening_balance (no transactions yet)
  // 5. Status = 'open'
}
```

**Key Constraints:**
- ❌ Cannot open duplicate (church_id, month, year)
- ✅ Previous month doesn't need to be closed (allows skipping months)
- ✅ Opening balance defaults to 0 if no previous month exists

#### 2. Ledger Close Workflow
```typescript
// Current PostgreSQL logic (src/app/api/accounting/route.ts:706-778)
async function closeMonthlyLedger(church_id, month, year) {
  // 1. Verify ledger exists and status = 'open'
  // 2. Aggregate income: SUM(total_entradas) from reports
  // 3. Aggregate expenses: SUM(amount) from expense_records (filtered by date)
  // 4. Calculate: closing_balance = opening_balance + income - expenses
  // 5. Update ledger: set totals, status='closed', closed_at=NOW(), closed_by
}
```

**Key Constraints:**
- ❌ Cannot close if status != 'open'
- ❌ Cannot close if ledger doesn't exist
- ✅ Closing is **immutable** (cannot reopen or edit after close)
- ⚠️ **Critical**: Aggregations must match reports/expense_records

#### 3. Expense Recording
```typescript
// Current PostgreSQL logic (src/app/api/accounting/route.ts:507-569)
async function createExpense(data) {
  // 1. Insert into expense_records
  // 2. Auto-create accounting_entries (double-entry):
  //    - Debit: account_code "5000" (Expenses)
  //    - Credit: 0
  //    - Reference: "EXP-{expense_id}"
}
```

**Key Constraints:**
- ✅ Required fields: church_id, date, concept, category, amount
- ✅ Optional: provider, document_number, approved_by, notes
- ⚠️ **Critical**: Must create accounting entry atomically

#### 4. Accounting Entries
```typescript
// Current PostgreSQL logic (src/app/api/accounting/route.ts:572-647)
async function createAccountingEntry(data) {
  // 1. Support single entry OR array of entries
  // 2. Validate: SUM(debit) MUST EQUAL SUM(credit) (double-entry constraint)
  // 3. Insert all entries in transaction
}
```

**Key Constraints:**
- ❌ **HARD REQUIREMENT**: `SUM(debit) = SUM(credit)` (tolerance: ±0.01)
- ✅ Batch inserts allowed
- ✅ Each entry links to church, date, account_code, description

### Current API Routes

```http
GET  /api/accounting?type=ledger&church_id=X&month=Y&year=Z&status=open
GET  /api/accounting?type=expenses&church_id=X&month=Y&year=Z
GET  /api/accounting?type=entries&church_id=X&month=Y&year=Z
GET  /api/accounting?type=summary&church_id=X&month=Y&year=Z

POST /api/accounting
Body: { type: "expense", church_id, date, concept, category, amount, ... }
Body: { type: "entry", entries: [{ church_id, date, account_code, debit, credit, ... }] }
Body: { type: "open_ledger", church_id, month, year }
Body: { type: "close_ledger", church_id, month, year, notes }
```

### Query Patterns

**Ledger Queries:**
```sql
-- List all ledgers with church info
SELECT ml.*, c.name, c.city
FROM monthly_ledger ml
JOIN churches c ON ml.church_id = c.id
WHERE ml.church_id = $1 AND ml.month = $2 AND ml.year = $3
ORDER BY ml.year DESC, ml.month DESC
```

**Expense Queries:**
```sql
-- List expenses with category totals
SELECT e.*, c.name as church_name
FROM expense_records e
JOIN churches c ON e.church_id = c.id
WHERE e.church_id = $1
  AND EXTRACT(MONTH FROM e.date) = $2
  AND EXTRACT(YEAR FROM e.date) = $3
ORDER BY e.date DESC

-- Category aggregation
SELECT category, COUNT(*) as count, SUM(amount) as total
FROM expense_records
WHERE church_id = $1
GROUP BY category
ORDER BY total DESC
```

**Accounting Entry Queries:**
```sql
-- List entries with trial balance
SELECT ae.*, c.name as church_name
FROM accounting_entries ae
JOIN churches c ON ae.church_id = c.id
WHERE ae.church_id = $1
ORDER BY ae.date DESC

-- Trial balance (debit/credit totals by account)
SELECT account_code, account_name,
  SUM(debit) as total_debit,
  SUM(credit) as total_credit,
  SUM(debit - credit) as balance
FROM accounting_entries
WHERE church_id = $1
GROUP BY account_code, account_name
ORDER BY account_code
```

**Summary Aggregations:**
```sql
-- Income from reports
SELECT SUM(total_entradas) FROM reports
WHERE church_id = $1 AND month = $2 AND year = $3

-- Expenses from expense_records
SELECT SUM(amount) FROM expense_records
WHERE church_id = $1
  AND EXTRACT(MONTH FROM date) = $2
  AND EXTRACT(YEAR FROM date) = $3
```

### Dependencies

**Upstream** (data sources):
- ✅ `churches` - Already in Convex
- ✅ `reports` - Already in Convex
- ✅ `providers` - Already in Convex

**Downstream** (consumers):
- ⚠️ `/api/data` route (dashboard summaries)
- ⚠️ Admin accounting UI (unknown components)
- ⚠️ Excel exports (possibly)

---

## Why This Migration is Complex

### 1. **Stateful Workflows**
Unlike simple CRUD operations, ledger open/close has **state transitions**:
```
NOT_CREATED → OPEN → CLOSED → RECONCILED
```
Convex mutations must enforce these transitions **atomically** without PostgreSQL transactions.

### 2. **Cross-Table Aggregations**
Closing a ledger requires summing data from **different collections**:
- Income: `SUM(total_entradas) FROM reports`
- Expenses: `SUM(amount) FROM expense_records`

Convex queries must efficiently filter by:
- `church_id` (exact match)
- `month` / `year` (exact match for reports)
- Date range (month/year extraction for expenses)

**Solution:** Compound indexes + query optimizations.

### 3. **Double-Entry Accounting Constraint**
PostgreSQL validates `SUM(debit) = SUM(credit)` in application code before insert.
Convex needs **mutation-level validation** to prevent:
- Partial writes (some entries succeed, others fail)
- Unbalanced entries (data corruption)

**Solution:** Batch validation in single mutation with rollback on error.

### 4. **Trigger-Based Balance Updates** (migration 005)
PostgreSQL uses triggers to auto-update `church_accounts.current_balance`:
```sql
CREATE TRIGGER trg_church_transactions_balance
AFTER INSERT OR UPDATE OR DELETE ON church_transactions
FOR EACH ROW EXECUTE FUNCTION refresh_church_account_balance();
```

Convex doesn't support triggers → must implement in mutation logic.

**Solution:** Explicit balance updates in `createChurchTransaction` mutation.

### 5. **Existing Data Volume**
Estimated records to migrate:
- ~264 monthly ledgers
- ~2,000 expense records
- ~4,000 accounting entries
- Unknown church accounts/transactions/budgets

**Risk:** Data migration failures could corrupt financial records.

**Solution:** One-time migration script with **validation** and **rollback** capability.

### 6. **No Native Transactions**
PostgreSQL supports multi-table transactions:
```sql
BEGIN;
INSERT INTO expense_records ...;
INSERT INTO accounting_entries ...;
COMMIT;
```

Convex mutations are **single-collection atomic** by default.

**Solution:** Design mutations to handle related writes in single function (e.g., `createExpense` creates both expense + entry).

---

## Migration Strategy: Phased Approach

### ❌ What We're NOT Doing

- ❌ **Big Bang Migration** - Too risky with financial data
- ❌ **Dual-Write Pattern** - Convex doesn't support cross-DB transactions
- ❌ **Schema Changes to PostgreSQL** - We're decommissioning it, not modifying

### ✅ What We ARE Doing

1. **Schema-First Design** - Define all Convex collections before writing code
2. **Read-Path First** - Migrate queries before mutations (lower risk)
3. **Feature Flags** - Use environment variable to toggle old vs new implementation
4. **Data Backfill** - One-time migration script with validation checks
5. **Parallel Testing** - Compare Convex vs PostgreSQL results side-by-side
6. **Incremental Cutover** - One operation at a time (ledger queries → expense queries → mutations)
7. **Rollback Ready** - Keep PostgreSQL intact until full validation

---

## Phase 1: Schema Design (2-3 hours)

### Step 1.1: Add New Collections to `convex/schema.ts`

**File:** `convex/schema.ts`

```typescript
// ============================================================================
// MONTHLY LEDGERS - Monthly financial period management
// ============================================================================
monthlyLedgers: defineTable({
  church_id: v.id("churches"),
  month: v.number(), // 1-12
  year: v.number(),

  // Financial summary
  opening_balance: v.number(),
  closing_balance: v.number(),
  total_income: v.number(),
  total_expenses: v.number(),

  // Status workflow: open → closed → reconciled
  status: v.union(
    v.literal("open"),
    v.literal("closed"),
    v.literal("reconciled")
  ),

  // Audit trail
  closed_at: v.optional(v.number()), // timestamp
  closed_by: v.optional(v.string()), // user email or Convex user ID
  notes: v.optional(v.string()),
  created_by: v.optional(v.string()),
  created_at: v.number(),
  updated_at: v.number(),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),
})
  .index("by_church", ["church_id"])
  .index("by_church_and_period", ["church_id", "year", "month"]) // UNIQUE constraint via mutation
  .index("by_status", ["status"])
  .index("by_year_month", ["year", "month"]),

// ============================================================================
// ACCOUNTING ENTRIES - Double-entry bookkeeping
// ============================================================================
accountingEntries: defineTable({
  church_id: v.id("churches"),
  date: v.number(), // transaction date timestamp

  // Chart of accounts
  account_code: v.string(), // "1000", "5000", etc.
  account_name: v.string(), // "Cash", "Expenses", etc.

  // Double-entry amounts
  debit: v.number(), // >= 0
  credit: v.number(), // >= 0
  balance: v.optional(v.number()), // running balance (optional)

  // References
  reference: v.optional(v.string()), // "EXP-123", "REP-456"
  description: v.string(),

  // Links to source transactions
  expense_record_id: v.optional(v.id("expense_records")),
  report_id: v.optional(v.id("reports")),

  // Audit trail
  created_by: v.optional(v.string()),
  created_at: v.number(),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),
})
  .index("by_church", ["church_id"])
  .index("by_date", ["date"])
  .index("by_account_code", ["account_code"])
  .index("by_expense", ["expense_record_id"])
  .index("by_report", ["report_id"])
  .index("by_church_and_date", ["church_id", "date"]),

// ============================================================================
// TRANSACTION CATEGORIES - Chart of accounts reference data
// ============================================================================
transactionCategories: defineTable({
  category_name: v.string(),
  category_type: v.union(v.literal("income"), v.literal("expense")),
  parent_category_id: v.optional(v.id("transactionCategories")),
  description: v.optional(v.string()),
  is_system: v.boolean(), // true for predefined categories
  is_active: v.boolean(),
  created_at: v.number(),

  // Legacy compatibility
  supabase_id: v.optional(v.number()),
})
  .index("by_type", ["category_type"])
  .index("by_name", ["category_name"])
  .index("by_active", ["is_active"])
  .index("by_parent", ["parent_category_id"]),

// ============================================================================
// CHURCH ACCOUNTS - Bank accounts and cash management
// ============================================================================
churchAccounts: defineTable({
  church_id: v.id("churches"),
  account_name: v.string(),
  account_type: v.union(
    v.literal("checking"),
    v.literal("savings"),
    v.literal("petty_cash"),
    v.literal("special_fund")
  ),
  account_number: v.optional(v.string()),
  bank_name: v.optional(v.string()),
  opening_balance: v.number(),
  current_balance: v.number(), // Auto-updated by mutations
  is_active: v.boolean(),
  created_at: v.number(),

  supabase_id: v.optional(v.number()),
})
  .index("by_church", ["church_id"])
  .index("by_active", ["is_active"])
  .index("by_church_and_type", ["church_id", "account_type"])
  .index("by_church_and_name", ["church_id", "account_name"]), // UNIQUE constraint via mutation

// ============================================================================
// CHURCH TRANSACTIONS - Transaction ledger (replaces migration 005 table)
// ============================================================================
churchTransactions: defineTable({
  church_id: v.id("churches"),
  account_id: v.id("churchAccounts"),
  transaction_date: v.number(), // timestamp
  amount: v.number(),
  transaction_type: v.union(
    v.literal("income"),
    v.literal("expense"),
    v.literal("transfer")
  ),
  category_id: v.optional(v.id("transactionCategories")),
  description: v.string(),
  reference_number: v.optional(v.string()),
  check_number: v.optional(v.string()),
  vendor_customer: v.optional(v.string()),

  // Links to other tables
  worship_record_id: v.optional(v.id("worship_records")),
  expense_record_id: v.optional(v.id("expense_records")),
  report_id: v.optional(v.id("reports")),
  transfer_account_id: v.optional(v.id("churchAccounts")), // for transfers

  // Reconciliation
  is_reconciled: v.boolean(),
  reconciled_date: v.optional(v.number()),

  // Audit trail
  created_by: v.optional(v.string()),
  created_at: v.number(),

  supabase_id: v.optional(v.number()),
})
  .index("by_church", ["church_id"])
  .index("by_account", ["account_id"])
  .index("by_date", ["transaction_date"])
  .index("by_type", ["transaction_type"])
  .index("by_category", ["category_id"])
  .index("by_church_and_date", ["church_id", "transaction_date"]),

// ============================================================================
// CHURCH BUDGETS - Budget planning and tracking
// ============================================================================
churchBudgets: defineTable({
  church_id: v.id("churches"),
  budget_year: v.number(),
  budget_month: v.optional(v.number()), // null = annual budget
  category_id: v.id("transactionCategories"),
  budgeted_amount: v.number(),
  actual_amount: v.number(),
  variance: v.number(), // budgeted - actual (auto-calculated)
  notes: v.optional(v.string()),
  created_at: v.number(),
  updated_at: v.number(),

  supabase_id: v.optional(v.number()),
})
  .index("by_church", ["church_id"])
  .index("by_year", ["budget_year"])
  .index("by_category", ["category_id"])
  .index("by_church_year_month", ["church_id", "budget_year", "budget_month"]), // UNIQUE via mutation
```

### Step 1.2: Update Existing `expense_records` Schema

**Current schema** (lines 237-260 in `convex/schema.ts`) is **incomplete** for accounting migration.

**Add these fields:**

```typescript
expense_records: defineTable({
  // EXISTING FIELDS (keep as-is):
  church_id: v.id("churches"),
  report_id: v.optional(v.id("reports")),
  fecha_comprobante: v.number(), // timestamp
  numero_comprobante: v.optional(v.string()),
  ruc_ci_proveedor: v.optional(v.string()),
  proveedor: v.string(),
  concepto: v.string(),
  tipo_salida: v.optional(v.string()),
  monto_exenta: v.number(),
  monto_gravada_10: v.number(),
  iva_10: v.number(),
  monto_gravada_5: v.number(),
  iva_5: v.number(),
  total_factura: v.number(),
  es_factura_legal: v.boolean(),
  es_honorario_pastoral: v.boolean(),
  observaciones: v.optional(v.string()),
  created_at: v.number(),

  // ⚠️ ADD THESE NEW FIELDS (for accounting API compatibility):
  category: v.optional(v.string()), // Expense category name (e.g., "Servicios Públicos")
  approved_by: v.optional(v.string()), // User who approved expense
  date: v.optional(v.number()), // Alias for fecha_comprobante (for API compat)
  amount: v.optional(v.number()), // Alias for total_factura (for API compat)
  provider: v.optional(v.string()), // Alias for proveedor (for API compat)
  document_number: v.optional(v.string()), // Alias for numero_comprobante
  notes: v.optional(v.string()), // Alias for observaciones
  provider_id: v.optional(v.id("providers")), // Link to centralized provider
})
  .index("by_church", ["church_id"])
  .index("by_report", ["report_id"])
  .index("by_fecha", ["fecha_comprobante"])
  .index("by_proveedor", ["ruc_ci_proveedor"])
  .index("by_provider", ["provider_id"]) // NEW index
  .index("by_category", ["category"]) // NEW index
  .index("by_date", ["date"]), // NEW index for queries
```

**Note:** We're using **optional aliases** to avoid breaking existing code while supporting accounting API patterns.

### Step 1.3: Deploy Schema Changes

```bash
# 1. Update convex/schema.ts with all new tables
# 2. Deploy to Convex dev environment
npx convex dev

# 3. Verify schema deployment
# Check Convex dashboard → Data → Tables
# Confirm all new tables appear

# 4. Deploy to production
npx convex deploy
```

**Validation:**
- ✅ No schema errors in Convex dashboard
- ✅ All indexes created successfully
- ✅ Existing data unchanged

**Output:** New empty collections ready for data migration.

---

## Phase 2: Reference Data Migration (1-2 hours)

### Step 2.1: Migrate Transaction Categories

**Create:** `scripts/migrate-transaction-categories.ts`

```typescript
import { convexQuery, convexMutation } from "../src/lib/convex-server";
import { api } from "../convex/_generated/api";
import { Pool } from "pg";

async function migrateTransactionCategories() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("📊 Fetching transaction categories from PostgreSQL...");
  const { rows } = await pool.query(`
    SELECT id, category_name, category_type, parent_category_id,
           description, is_system, is_active, created_at
    FROM church_transaction_categories
    ORDER BY id ASC
  `);

  console.log(`Found ${rows.length} categories`);

  const idMap = new Map<number, string>(); // PostgreSQL ID → Convex ID

  for (const row of rows) {
    const convexId = await convexMutation(api.accounting.createCategory, {
      category_name: row.category_name,
      category_type: row.category_type,
      description: row.description || undefined,
      is_system: row.is_system,
      is_active: row.is_active,
      supabase_id: row.id,
      created_at: new Date(row.created_at).getTime(),
    });

    idMap.set(row.id, convexId);
    console.log(`✅ Migrated: ${row.category_name} (${row.id} → ${convexId})`);
  }

  // Second pass: Update parent_category_id references
  for (const row of rows) {
    if (row.parent_category_id) {
      const convexId = idMap.get(row.id)!;
      const parentConvexId = idMap.get(row.parent_category_id);

      if (parentConvexId) {
        await convexMutation(api.accounting.updateCategoryParent, {
          id: convexId,
          parent_category_id: parentConvexId,
        });
        console.log(`🔗 Linked ${row.category_name} → parent ${parentConvexId}`);
      }
    }
  }

  await pool.end();
  console.log("✅ Transaction categories migration complete!");
}

migrateTransactionCategories().catch(console.error);
```

**Create:** `convex/accounting.ts` (category mutations)

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthContext } from "./lib/auth";

// Create transaction category
export const createCategory = mutation({
  args: {
    category_name: v.string(),
    category_type: v.union(v.literal("income"), v.literal("expense")),
    description: v.optional(v.string()),
    is_system: v.boolean(),
    is_active: v.boolean(),
    supabase_id: v.optional(v.number()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    // No auth check for migration script
    return await ctx.db.insert("transactionCategories", args);
  },
});

// Update parent reference (second pass of migration)
export const updateCategoryParent = mutation({
  args: {
    id: v.id("transactionCategories"),
    parent_category_id: v.id("transactionCategories"),
  },
  handler: async (ctx, { id, parent_category_id }) => {
    await ctx.db.patch(id, { parent_category_id });
  },
});

// List categories (for frontend)
export const listCategories = query({
  args: { type: v.optional(v.union(v.literal("income"), v.literal("expense"))) },
  handler: async (ctx, { type }) => {
    let query = ctx.db.query("transactionCategories");

    if (type) {
      query = query.withIndex("by_type", (q) => q.eq("category_type", type));
    }

    return await query.collect();
  },
});
```

**Run migration:**
```bash
npm run migrate-categories
```

**Validation:**
- ✅ All 30+ categories migrated
- ✅ Parent-child relationships preserved
- ✅ System categories marked correctly

---

## Phase 3: Read-Only Queries Implementation (4-6 hours)

### Step 3.1: Implement Convex Queries

**Create:** `convex/monthlyLedger.ts`

```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthContext } from "./lib/auth";

// List monthly ledgers with filters
export const listLedgers = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("reconciled")
    )),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);

    let query = ctx.db.query("monthlyLedgers");

    // Apply filters
    if (args.church_id && args.year && args.month) {
      query = query.withIndex("by_church_and_period", (q) =>
        q.eq("church_id", args.church_id!)
         .eq("year", args.year!)
         .eq("month", args.month!)
      );
    } else if (args.church_id) {
      query = query.withIndex("by_church", (q) => q.eq("church_id", args.church_id!));
    } else if (args.status) {
      query = query.withIndex("by_status", (q) => q.eq("status", args.status!));
    }

    const ledgers = await query.collect();

    // Enrich with church data
    const enriched = await Promise.all(
      ledgers.map(async (ledger) => {
        const church = await ctx.db.get(ledger.church_id);
        return {
          ...ledger,
          church_name: church?.name,
          church_city: church?.city,
        };
      })
    );

    // Sort by year DESC, month DESC
    return enriched.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  },
});

// Get single ledger by period
export const getLedgerByPeriod = query({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const ledger = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q.eq("church_id", args.church_id)
         .eq("year", args.year)
         .eq("month", args.month)
      )
      .unique();

    if (!ledger) return null;

    const church = await ctx.db.get(ledger.church_id);
    return {
      ...ledger,
      church_name: church?.name,
      church_city: church?.city,
    };
  },
});
```

**Create:** `convex/accountingEntries.ts`

```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";

// List accounting entries with filters
export const listEntries = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let entries;

    if (args.church_id) {
      entries = await ctx.db
        .query("accountingEntries")
        .withIndex("by_church", (q) => q.eq("church_id", args.church_id!))
        .collect();
    } else {
      entries = await ctx.db.query("accountingEntries").collect();
    }

    // Filter by month/year if provided
    if (args.month && args.year) {
      entries = entries.filter((entry) => {
        const date = new Date(entry.date);
        return date.getMonth() + 1 === args.month && date.getFullYear() === args.year;
      });
    }

    // Enrich with church data
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const church = await ctx.db.get(entry.church_id);
        return {
          ...entry,
          church_name: church?.name,
        };
      })
    );

    return enriched.sort((a, b) => b.date - a.date);
  },
});

// Get trial balance (aggregation by account)
export const getTrialBalance = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Fetch all matching entries
    let entries;

    if (args.church_id) {
      entries = await ctx.db
        .query("accountingEntries")
        .withIndex("by_church", (q) => q.eq("church_id", args.church_id!))
        .collect();
    } else {
      entries = await ctx.db.query("accountingEntries").collect();
    }

    // Filter by date
    if (args.month && args.year) {
      entries = entries.filter((entry) => {
        const date = new Date(entry.date);
        return date.getMonth() + 1 === args.month && date.getFullYear() === args.year;
      });
    }

    // Group by account_code
    const accountTotals = new Map<string, {
      account_code: string;
      account_name: string;
      total_debit: number;
      total_credit: number;
      balance: number;
    }>();

    for (const entry of entries) {
      const key = entry.account_code;
      const existing = accountTotals.get(key) || {
        account_code: entry.account_code,
        account_name: entry.account_name,
        total_debit: 0,
        total_credit: 0,
        balance: 0,
      };

      existing.total_debit += entry.debit;
      existing.total_credit += entry.credit;
      existing.balance = existing.total_debit - existing.total_credit;
      accountTotals.set(key, existing);
    }

    return Array.from(accountTotals.values()).sort((a, b) =>
      a.account_code.localeCompare(b.account_code)
    );
  },
});
```

**Update:** `convex/expense_records.ts` (create if doesn't exist)

```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";

// List expenses with filters
export const listExpenses = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let expenses;

    if (args.church_id) {
      expenses = await ctx.db
        .query("expense_records")
        .withIndex("by_church", (q) => q.eq("church_id", args.church_id!))
        .collect();
    } else {
      expenses = await ctx.db.query("expense_records").collect();
    }

    // Filter by month/year
    if (args.month && args.year) {
      expenses = expenses.filter((expense) => {
        const date = new Date(expense.fecha_comprobante);
        return date.getMonth() + 1 === args.month && date.getFullYear() === args.year;
      });
    }

    // Enrich with church data
    const enriched = await Promise.all(
      expenses.map(async (expense) => {
        const church = await ctx.db.get(expense.church_id);
        return {
          ...expense,
          church_name: church?.name,
        };
      })
    );

    return enriched.sort((a, b) => b.fecha_comprobante - a.fecha_comprobante);
  },
});

// Get category totals
export const getCategoryTotals = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let expenses;

    if (args.church_id) {
      expenses = await ctx.db
        .query("expense_records")
        .withIndex("by_church", (q) => q.eq("church_id", args.church_id!))
        .collect();
    } else {
      expenses = await ctx.db.query("expense_records").collect();
    }

    // Filter by date
    if (args.month && args.year) {
      expenses = expenses.filter((expense) => {
        const date = new Date(expense.fecha_comprobante);
        return date.getMonth() + 1 === args.month && date.getFullYear() === args.year;
      });
    }

    // Group by category
    const categoryTotals = new Map<string, { category: string; count: number; total: number }>();

    for (const expense of expenses) {
      const category = expense.category || "Sin categoría";
      const existing = categoryTotals.get(category) || { category, count: 0, total: 0 };
      existing.count++;
      existing.total += expense.total_factura;
      categoryTotals.set(category, existing);
    }

    return Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total);
  },
});
```

---

## Phase 4: Data Backfill (3-4 hours)

**I'll continue with Phases 4-8 in the next section. This document is getting long.**

**Next steps:**
1. Phase 4: Write data migration scripts
2. Phase 5: Implement mutations (create/update/delete)
3. Phase 6: Migrate API routes to use Convex
4. Phase 7: Testing strategy
5. Phase 8: Cutover plan

---

## Deliverables So Far

✅ **Phase 1**: Complete schema design with all collections defined
✅ **Phase 2**: Migration strategy for reference data
✅ **Phase 3**: Read-only query implementations

**Estimated completion:** Continue to Phase 4 next.
