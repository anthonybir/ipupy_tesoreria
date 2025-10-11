# WS-7 Accounting Migration to Convex - Part 2

**Continuation of:** [WS7_ACCOUNTING_MIGRATION_PLAN.md](./WS7_ACCOUNTING_MIGRATION_PLAN.md)

This document covers Phases 4-8 of the accounting system migration.

---

> **Update · 2025-10-10:** The `USE_CONVEX_ACCOUNTING` feature flag referenced
> throughout this plan has been removed. Steps that toggle the flag can be
> skipped.

## Phase 4: Data Backfill (3-4 hours)

### Step 4.1: Monthly Ledger Migration Script

**Create:** `scripts/migrate-monthly-ledgers.ts`

```typescript
import { convexMutation } from "../src/lib/convex-server";
import { api } from "../convex/_generated/api";
import { Pool } from "pg";
import { Id } from "../convex/_generated/dataModel";

async function migrateMonthlyLedgers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("📊 Fetching monthly ledgers from PostgreSQL...");
  const { rows } = await pool.query(`
    SELECT ml.*, c.name as church_name
    FROM monthly_ledger ml
    JOIN churches c ON ml.church_id = c.id
    ORDER BY ml.id ASC
  `);

  console.log(`Found ${rows.length} monthly ledgers`);

  // Load church ID mapping (Supabase → Convex)
  const churchMapResult = await pool.query(`
    SELECT id, name FROM churches
  `);

  // Fetch Convex churches to build ID map
  const convexChurches = await convexQuery(api.churches.list);
  const churchIdMap = new Map<number, Id<"churches">>();

  for (const pgChurch of churchMapResult.rows) {
    const convexChurch = convexChurches.find((c: any) =>
      c.supabase_id === pgChurch.id
    );
    if (convexChurch) {
      churchIdMap.set(pgChurch.id, convexChurch._id);
    }
  }

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const churchConvexId = churchIdMap.get(row.church_id);
      if (!churchConvexId) {
        console.error(`❌ Church not found for ledger ${row.id} (church_id: ${row.church_id})`);
        failed++;
        continue;
      }

      await convexMutation(api.monthlyLedger.createLedgerFromMigration, {
        church_id: churchConvexId,
        month: row.month,
        year: row.year,
        opening_balance: parseFloat(row.opening_balance),
        closing_balance: parseFloat(row.closing_balance),
        total_income: parseFloat(row.total_income),
        total_expenses: parseFloat(row.total_expenses),
        status: row.status,
        closed_at: row.closed_at ? new Date(row.closed_at).getTime() : undefined,
        closed_by: row.closed_by || undefined,
        notes: row.notes || undefined,
        created_by: row.created_by || undefined,
        created_at: new Date(row.created_at || Date.now()).getTime(),
        updated_at: new Date(row.updated_at || Date.now()).getTime(),
        supabase_id: row.id,
      });

      success++;
      console.log(`✅ Migrated ledger: ${row.church_name} ${row.month}/${row.year} (${row.id})`);
    } catch (error) {
      console.error(`❌ Failed to migrate ledger ${row.id}:`, error);
      failed++;
    }
  }

  await pool.end();
  console.log(`\n✅ Monthly ledger migration complete!`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${rows.length}`);
}

migrateMonthlyLedgers().catch(console.error);
```

**Add to** `convex/monthlyLedger.ts`:

```typescript
// Migration-only mutation (no auth checks)
export const createLedgerFromMigration = mutation({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
    opening_balance: v.number(),
    closing_balance: v.number(),
    total_income: v.number(),
    total_expenses: v.number(),
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("reconciled")),
    closed_at: v.optional(v.number()),
    closed_by: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    supabase_id: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicates
    const existing = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q.eq("church_id", args.church_id)
         .eq("year", args.year)
         .eq("month", args.month)
      )
      .unique();

    if (existing) {
      throw new Error(`Duplicate ledger: ${args.month}/${args.year} for church ${args.church_id}`);
    }

    return await ctx.db.insert("monthlyLedgers", args);
  },
});
```

### Step 4.2: Accounting Entries Migration

**Create:** `scripts/migrate-accounting-entries.ts`

```typescript
import { convexMutation, convexQuery } from "../src/lib/convex-server";
import { api } from "../convex/_generated/api";
import { Pool } from "pg";

async function migrateAccountingEntries() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("📊 Fetching accounting entries from PostgreSQL...");
  const { rows } = await pool.query(`
    SELECT ae.*, c.name as church_name
    FROM accounting_entries ae
    JOIN churches c ON ae.church_id = c.id
    ORDER BY ae.id ASC
  `);

  console.log(`Found ${rows.length} accounting entries`);

  // Build church ID map
  const convexChurches = await convexQuery(api.churches.list);
  const churchIdMap = new Map<number, any>();
  for (const c of convexChurches) {
    if (c.supabase_id) {
      churchIdMap.set(c.supabase_id, c._id);
    }
  }

  // Build expense_records ID map (if entries reference expenses)
  const convexExpenses = await convexQuery(api.admin.listExpenseRecords, {});
  const expenseIdMap = new Map<number, any>();
  for (const e of convexExpenses) {
    if (e.supabase_id) {
      expenseIdMap.set(e.supabase_id, e._id);
    }
  }

  // Build reports ID map (if entries reference reports)
  const convexReports = await convexQuery(api.reports.listAll, {});
  const reportIdMap = new Map<number, any>();
  for (const r of convexReports) {
    if (r.supabase_id) {
      reportIdMap.set(r.supabase_id, r._id);
    }
  }

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const churchConvexId = churchIdMap.get(row.church_id);
      if (!churchConvexId) {
        console.error(`❌ Church not found for entry ${row.id}`);
        failed++;
        continue;
      }

      await convexMutation(api.accountingEntries.createEntryFromMigration, {
        church_id: churchConvexId,
        date: new Date(row.date).getTime(),
        account_code: row.account_code,
        account_name: row.account_name,
        debit: parseFloat(row.debit),
        credit: parseFloat(row.credit),
        balance: row.balance ? parseFloat(row.balance) : undefined,
        reference: row.reference || undefined,
        description: row.description,
        expense_record_id: row.expense_record_id
          ? expenseIdMap.get(row.expense_record_id)
          : undefined,
        report_id: row.report_id ? reportIdMap.get(row.report_id) : undefined,
        created_by: row.created_by || undefined,
        created_at: new Date(row.created_at || Date.now()).getTime(),
        supabase_id: row.id,
      });

      success++;
      if (success % 100 === 0) {
        console.log(`✅ Migrated ${success} entries...`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate entry ${row.id}:`, error);
      failed++;
    }
  }

  await pool.end();
  console.log(`\n✅ Accounting entries migration complete!`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${rows.length}`);
}

migrateAccountingEntries().catch(console.error);
```

**Add to** `convex/accountingEntries.ts`:

```typescript
// Migration-only mutation
export const createEntryFromMigration = mutation({
  args: {
    church_id: v.id("churches"),
    date: v.number(),
    account_code: v.string(),
    account_name: v.string(),
    debit: v.number(),
    credit: v.number(),
    balance: v.optional(v.number()),
    reference: v.optional(v.string()),
    description: v.string(),
    expense_record_id: v.optional(v.id("expense_records")),
    report_id: v.optional(v.id("reports")),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    supabase_id: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accountingEntries", args);
  },
});
```

### Step 4.3: Validation Script

**Create:** `scripts/validate-accounting-migration.ts`

```typescript
import { convexQuery } from "../src/lib/convex-server";
import { api } from "../convex/_generated/api";
import { Pool } from "pg";

async function validateMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("🔍 Validating accounting migration...\n");

  // 1. Count comparison
  console.log("📊 Record counts:");
  const pgLedgers = await pool.query("SELECT COUNT(*) FROM monthly_ledger");
  const convexLedgers = await convexQuery(api.monthlyLedger.listLedgers, {});
  console.log(`  Ledgers: PostgreSQL=${pgLedgers.rows[0]?.count}, Convex=${convexLedgers.length}`);

  const pgEntries = await pool.query("SELECT COUNT(*) FROM accounting_entries");
  const convexEntries = await convexQuery(api.accountingEntries.listEntries, {});
  console.log(`  Entries: PostgreSQL=${pgEntries.rows[0]?.count}, Convex=${convexEntries.length}`);

  const pgCategories = await pool.query("SELECT COUNT(*) FROM church_transaction_categories");
  const convexCategories = await convexQuery(api.accounting.listCategories, {});
  console.log(`  Categories: PostgreSQL=${pgCategories.rows[0]?.count}, Convex=${convexCategories.length}\n`);

  // 2. Sample data verification
  console.log("🔍 Sample data verification:");
  const samplePgLedger = await pool.query(`
    SELECT * FROM monthly_ledger ORDER BY id DESC LIMIT 1
  `);
  const sampleConvexLedger = convexLedgers.sort((a, b) =>
    (b.supabase_id || 0) - (a.supabase_id || 0)
  )[0];

  if (samplePgLedger.rows[0] && sampleConvexLedger) {
    const pg = samplePgLedger.rows[0];
    const cx = sampleConvexLedger;
    console.log(`  Latest Ledger (ID ${pg.id}):`);
    console.log(`    Opening Balance: PG=${pg.opening_balance}, Convex=${cx.opening_balance}`);
    console.log(`    Closing Balance: PG=${pg.closing_balance}, Convex=${cx.closing_balance}`);
    console.log(`    Status: PG=${pg.status}, Convex=${cx.status}`);
  }

  // 3. Aggregation checks
  console.log("\n📈 Aggregation checks:");
  const pgTotalDebit = await pool.query("SELECT SUM(debit) as total FROM accounting_entries");
  const convexTotalDebit = convexEntries.reduce((sum, e) => sum + e.debit, 0);
  console.log(`  Total Debits: PG=${pgTotalDebit.rows[0]?.total}, Convex=${convexTotalDebit}`);

  const pgTotalCredit = await pool.query("SELECT SUM(credit) as total FROM accounting_entries");
  const convexTotalCredit = convexEntries.reduce((sum, e) => sum + e.credit, 0);
  console.log(`  Total Credits: PG=${pgTotalCredit.rows[0]?.total}, Convex=${convexTotalCredit}`);

  // 4. Check balance (debits = credits)
  const diff = Math.abs(convexTotalDebit - convexTotalCredit);
  console.log(`  Balance Check: Difference=${diff.toFixed(2)} (should be < 1.00)\n`);

  await pool.end();

  if (diff < 1.00) {
    console.log("✅ Validation PASSED - Data migration successful!");
  } else {
    console.log("❌ Validation FAILED - Balance mismatch!");
  }
}

validateMigration().catch(console.error);
```

### Step 4.4: Run Migrations

```bash
# 1. Migrate reference data
npm run migrate-categories

# 2. Migrate monthly ledgers
npm run migrate-ledgers

# 3. Migrate accounting entries
npm run migrate-entries

# 4. Validate migration
npm run validate-accounting-migration
```

**Update** `package.json`:

```json
{
  "scripts": {
    "migrate-categories": "tsx scripts/migrate-transaction-categories.ts",
    "migrate-ledgers": "tsx scripts/migrate-monthly-ledgers.ts",
    "migrate-entries": "tsx scripts/migrate-accounting-entries.ts",
    "validate-accounting-migration": "tsx scripts/validate-accounting-migration.ts"
  }
}
```

---

## Phase 5: Write Operations (Mutations) (6-8 hours)

### Step 5.1: Ledger Open/Close Mutations

**Add to** `convex/monthlyLedger.ts`:

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthContext } from "./lib/auth";

// Open new monthly ledger
export const openLedger = mutation({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Verify authentication and permissions
    const auth = await getAuthContext(ctx);
    if (!["admin", "treasurer"].includes(auth.role)) {
      throw new Error("No autorizado para abrir períodos contables");
    }

    // 2. Check for duplicate
    const existing = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q.eq("church_id", args.church_id)
         .eq("year", args.year)
         .eq("month", args.month)
      )
      .unique();

    if (existing) {
      throw new Error(
        `El libro mensual para ${args.month}/${args.year} ya existe con estado: ${existing.status}`
      );
    }

    // 3. Get previous month's closing balance
    const prevMonth = args.month === 1 ? 12 : args.month - 1;
    const prevYear = args.month === 1 ? args.year - 1 : args.year;

    const previousLedger = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q.eq("church_id", args.church_id)
         .eq("year", prevYear)
         .eq("month", prevMonth)
      )
      .unique();

    const openingBalance = previousLedger?.closing_balance || 0;

    // 4. Create new ledger
    const now = Date.now();
    const ledgerId = await ctx.db.insert("monthlyLedgers", {
      church_id: args.church_id,
      month: args.month,
      year: args.year,
      opening_balance: openingBalance,
      closing_balance: openingBalance, // Initial = opening (no transactions yet)
      total_income: 0,
      total_expenses: 0,
      status: "open",
      created_by: auth.email,
      created_at: now,
      updated_at: now,
    });

    // 5. Log to userActivity
    await ctx.db.insert("userActivity", {
      user_id: auth.userId,
      action: "ledger_opened",
      details: `Abrió libro mensual ${args.month}/${args.year}`,
      timestamp: now,
    });

    return ledgerId;
  },
});

// Close monthly ledger
export const closeLedger = mutation({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Verify authentication and permissions
    const auth = await getAuthContext(ctx);
    if (!["admin", "treasurer"].includes(auth.role)) {
      throw new Error("No autorizado para cerrar períodos contables");
    }

    // 2. Get ledger
    const ledger = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q.eq("church_id", args.church_id)
         .eq("year", args.year)
         .eq("month", args.month)
      )
      .unique();

    if (!ledger) {
      throw new Error("Libro mensual no encontrado");
    }

    if (ledger.status !== "open") {
      throw new Error(`El libro mensual ya está en estado: ${ledger.status}`);
    }

    // 3. Aggregate income from reports
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_church_and_period", (q) =>
        q.eq("church_id", args.church_id)
         .eq("year", args.year)
         .eq("month", args.month)
      )
      .collect();

    const totalIncome = reports.reduce((sum, r) => sum + r.total_entradas, 0);

    // 4. Aggregate expenses from expense_records
    const allExpenses = await ctx.db
      .query("expense_records")
      .withIndex("by_church", (q) => q.eq("church_id", args.church_id))
      .collect();

    // Filter by month/year
    const expensesInPeriod = allExpenses.filter((e) => {
      const date = new Date(e.fecha_comprobante);
      return date.getMonth() + 1 === args.month && date.getFullYear() === args.year;
    });

    const totalExpenses = expensesInPeriod.reduce((sum, e) => sum + e.total_factura, 0);

    // 5. Calculate closing balance
    const closingBalance = ledger.opening_balance + totalIncome - totalExpenses;

    // 6. Update ledger
    const now = Date.now();
    await ctx.db.patch(ledger._id, {
      total_income: totalIncome,
      total_expenses: totalExpenses,
      closing_balance: closingBalance,
      status: "closed",
      closed_at: now,
      closed_by: auth.email,
      notes: args.notes,
      updated_at: now,
    });

    // 7. Log to userActivity
    await ctx.db.insert("userActivity", {
      user_id: auth.userId,
      action: "ledger_closed",
      details: `Cerró libro mensual ${args.month}/${args.year} - Balance final: ₲${closingBalance.toLocaleString()}`,
      timestamp: now,
    });

    return ledger._id;
  },
});
```

### Step 5.2: Expense & Accounting Entry Mutations

**Add to** `convex/accountingEntries.ts`:

```typescript
// Create expense with auto-generated accounting entry
export const createExpenseWithEntry = mutation({
  args: {
    // Expense fields
    church_id: v.id("churches"),
    date: v.string(), // ISO date string
    concept: v.string(),
    category: v.string(),
    amount: v.number(),
    provider: v.optional(v.string()),
    document_number: v.optional(v.string()),
    approved_by: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Verify authentication
    const auth = await getAuthContext(ctx);
    if (!["admin", "treasurer", "pastor"].includes(auth.role)) {
      throw new Error("No autorizado para registrar gastos");
    }

    // 2. Create expense record
    const now = Date.now();
    const expenseDate = new Date(args.date).getTime();

    const expenseId = await ctx.db.insert("expense_records", {
      church_id: args.church_id,
      fecha_comprobante: expenseDate,
      concepto: args.concept,
      proveedor: args.provider || "N/A",
      numero_comprobante: args.document_number,
      tipo_salida: args.category,
      monto_exenta: args.amount, // Simplified - assume all exempt
      monto_gravada_10: 0,
      iva_10: 0,
      monto_gravada_5: 0,
      iva_5: 0,
      total_factura: args.amount,
      es_factura_legal: false,
      es_honorario_pastoral: args.category === "Honorarios Pastorales",
      observaciones: args.notes,
      created_at: now,

      // New fields for accounting API compatibility
      category: args.category,
      approved_by: args.approved_by || auth.email,
      date: expenseDate,
      amount: args.amount,
      provider: args.provider,
      document_number: args.document_number,
      notes: args.notes,
    });

    // 3. Auto-create accounting entry (double-entry)
    await ctx.db.insert("accountingEntries", {
      church_id: args.church_id,
      date: expenseDate,
      account_code: "5000", // Expense account code
      account_name: args.category,
      debit: args.amount,
      credit: 0,
      reference: `EXP-${expenseId}`,
      description: args.concept,
      expense_record_id: expenseId,
      created_by: auth.email,
      created_at: now,
    });

    // 4. Log to userActivity
    await ctx.db.insert("userActivity", {
      user_id: auth.userId,
      action: "expense_created",
      details: `Registró gasto: ${args.concept} - ₲${args.amount.toLocaleString()}`,
      timestamp: now,
    });

    return expenseId;
  },
});

// Create accounting entries (batch)
export const createEntries = mutation({
  args: {
    entries: v.array(
      v.object({
        church_id: v.id("churches"),
        date: v.string(),
        account_code: v.string(),
        account_name: v.string(),
        debit: v.optional(v.number()),
        credit: v.optional(v.number()),
        reference: v.optional(v.string()),
        description: v.string(),
      })
    ),
  },
  handler: async (ctx, { entries }) => {
    // 1. Verify authentication
    const auth = await getAuthContext(ctx);
    if (!["admin", "treasurer"].includes(auth.role)) {
      throw new Error("No autorizado para crear asientos contables");
    }

    // 2. Validate double-entry constraint
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Los débitos deben igualar los créditos. Débito: ${totalDebit}, Crédito: ${totalCredit}`
      );
    }

    // 3. Insert all entries
    const now = Date.now();
    const entryIds = [];

    for (const entry of entries) {
      const entryId = await ctx.db.insert("accountingEntries", {
        church_id: entry.church_id,
        date: new Date(entry.date).getTime(),
        account_code: entry.account_code,
        account_name: entry.account_name,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        reference: entry.reference,
        description: entry.description,
        created_by: auth.email,
        created_at: now,
      });
      entryIds.push(entryId);
    }

    // 4. Log to userActivity
    await ctx.db.insert("userActivity", {
      user_id: auth.userId,
      action: "entries_created",
      details: `Creó ${entries.length} asientos contables`,
      timestamp: now,
    });

    return entryIds;
  },
});
```

### Step 5.3: Accounting Summary Query

**Add to** `convex/monthlyLedger.ts`:

```typescript
// Get comprehensive accounting summary for a period
export const getAccountingSummary = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Get income from reports
    let reports;
    if (args.church_id && args.month && args.year) {
      reports = await ctx.db
        .query("reports")
        .withIndex("by_church_and_period", (q) =>
          q.eq("church_id", args.church_id!)
           .eq("year", args.year!)
           .eq("month", args.month!)
        )
        .collect();
    } else if (args.church_id) {
      reports = await ctx.db
        .query("reports")
        .withIndex("by_church", (q) => q.eq("church_id", args.church_id!))
        .collect();
    } else {
      reports = await ctx.db.query("reports").collect();
    }

    const totalIncome = reports.reduce((sum, r) => sum + r.total_entradas, 0);
    const reportCount = reports.length;

    // 2. Get expenses from expense_records
    let expenses;
    if (args.church_id) {
      expenses = await ctx.db
        .query("expense_records")
        .withIndex("by_church", (q) => q.eq("church_id", args.church_id!))
        .collect();
    } else {
      expenses = await ctx.db.query("expense_records").collect();
    }

    // Filter by month/year if provided
    if (args.month && args.year) {
      expenses = expenses.filter((e) => {
        const date = new Date(e.fecha_comprobante);
        return date.getMonth() + 1 === args.month && date.getFullYear() === args.year;
      });
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + e.total_factura, 0);
    const expenseCount = expenses.length;

    // 3. Get fund movements (if applicable)
    // This would need to query the transactions table if needed

    // 4. Get ledger status
    let ledger = null;
    if (args.church_id && args.month && args.year) {
      ledger = await ctx.db
        .query("monthlyLedgers")
        .withIndex("by_church_and_period", (q) =>
          q.eq("church_id", args.church_id!)
           .eq("year", args.year!)
           .eq("month", args.month!)
        )
        .unique();
    }

    // 5. Calculate net result
    const netResult = totalIncome - totalExpenses;

    return {
      income: {
        total_income: totalIncome,
        report_count: reportCount,
      },
      expenses: {
        total_expenses: totalExpenses,
        expense_count: expenseCount,
      },
      ledger: ledger || { status: "not_created" },
      netResult,
    };
  },
});
```

---

## Phase 6: API Route Migration (2-3 hours)

### Step 6.1: Update `/api/accounting` to Use Convex

**Strategy:** Feature flag approach - toggle between PostgreSQL and Convex.

**Environment variable:** `.env.local`

```bash
# Feature flag: Use Convex for accounting (default: false)
# Legacy (flag removed Oct 10, 2025)
```

**Update:** `src/app/api/accounting/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { setCORSHeaders } from "@/lib/cors";
import type { ApiResponse } from "@/types/utils";

// Feature flag
// Legacy: feature flag removed Oct 10, 2025
const USE_CONVEX = true;

// GET handler
export async function GET(req: NextRequest) {
  if (!USE_CONVEX) {
    // Legacy PostgreSQL implementation (existing code)
    return handleGetPostgres(req);
  }

  // NEW: Convex implementation
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "ledger";
    const church_id = searchParams.get("church_id");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const status = searchParams.get("status");

    let data;

    switch (type) {
      case "ledger":
        data = await fetchQuery(api.monthlyLedger.listLedgers, {
          church_id: church_id || undefined,
          month: month ? parseInt(month) : undefined,
          year: year ? parseInt(year) : undefined,
          status: status as any,
        });
        break;

      case "expenses":
        const expenses = await fetchQuery(api.expenseRecords.listExpenses, {
          church_id: church_id || undefined,
          month: month ? parseInt(month) : undefined,
          year: year ? parseInt(year) : undefined,
        });
        const categoryTotals = await fetchQuery(api.expenseRecords.getCategoryTotals, {
          church_id: church_id || undefined,
          month: month ? parseInt(month) : undefined,
          year: year ? parseInt(year) : undefined,
        });
        data = { data: expenses, categoryTotals };
        break;

      case "entries":
        const entries = await fetchQuery(api.accountingEntries.listEntries, {
          church_id: church_id || undefined,
          month: month ? parseInt(month) : undefined,
          year: year ? parseInt(year) : undefined,
        });
        const trialBalance = await fetchQuery(api.accountingEntries.getTrialBalance, {
          church_id: church_id || undefined,
          month: month ? parseInt(month) : undefined,
          year: year ? parseInt(year) : undefined,
        });
        data = { data: entries, trialBalance };
        break;

      case "summary":
        data = await fetchQuery(api.monthlyLedger.getAccountingSummary, {
          church_id: church_id || undefined,
          month: month ? parseInt(month) : undefined,
          year: year ? parseInt(year) : undefined,
        });
        break;

      default:
        return corsError("Invalid type parameter", 400);
    }

    return corsJson({ success: true, data });
  } catch (error) {
    console.error("Error in accounting GET:", error);
    return corsError(
      "Error fetching accounting data",
      500,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// POST handler
export async function POST(req: NextRequest) {
  if (!USE_CONVEX) {
    // Legacy PostgreSQL implementation
    return handlePostPostgres(req);
  }

  // NEW: Convex implementation
  try {
    const body = await req.json();
    const action = body.type || "expense";

    let result;

    switch (action) {
      case "expense":
        result = await fetchMutation(api.accountingEntries.createExpenseWithEntry, {
          church_id: body.church_id,
          date: body.date,
          concept: body.concept,
          category: body.category,
          amount: body.amount,
          provider: body.provider,
          document_number: body.document_number,
          approved_by: body.approved_by,
          notes: body.notes,
        });
        return corsJson({
          success: true,
          data: result,
          message: "Gasto registrado exitosamente",
        }, { status: 201 });

      case "entry":
        const entries = body.entries || [body];
        result = await fetchMutation(api.accountingEntries.createEntries, { entries });
        return corsJson({
          success: true,
          data: result,
          message: `Creados ${result.length} asientos contables`,
        }, { status: 201 });

      case "open_ledger":
        result = await fetchMutation(api.monthlyLedger.openLedger, {
          church_id: body.church_id,
          month: body.month,
          year: body.year,
        });
        return corsJson({
          success: true,
          data: result,
          message: "Libro mensual abierto exitosamente",
        }, { status: 201 });

      case "close_ledger":
        result = await fetchMutation(api.monthlyLedger.closeLedger, {
          church_id: body.church_id,
          month: body.month,
          year: body.year,
          notes: body.notes,
        });
        return corsJson({
          success: true,
          data: result,
          message: "Libro mensual cerrado exitosamente",
        });

      default:
        return corsError("Invalid type", 400);
    }
  } catch (error) {
    console.error("Error in accounting POST:", error);
    return corsError(
      "Error creating accounting record",
      500,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Helper functions
const corsJson = <T>(payload: T, init?: ResponseInit): NextResponse => {
  const response = NextResponse.json(payload, init);
  setCORSHeaders(response);
  return response;
};

const corsError = (message: string, status: number, details?: unknown): NextResponse =>
  corsJson(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status }
  );

// Keep legacy PostgreSQL handlers (existing code)
async function handleGetPostgres(req: NextRequest) {
  // ... existing PostgreSQL implementation ...
}

async function handlePostPostgres(req: NextRequest) {
  // ... existing PostgreSQL implementation ...
}
```

### Step 6.2: Update Frontend Hooks (Optional - Phase 7)

**Create:** `src/hooks/useAccounting.ts` (Convex-native hook)

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useMonthlyLedgers(filters?: {
  church_id?: Id<"churches">;
  month?: number;
  year?: number;
  status?: "open" | "closed" | "reconciled";
}) {
  return useQuery(api.monthlyLedger.listLedgers, filters || {});
}

export function useAccountingEntries(filters?: {
  church_id?: Id<"churches">;
  month?: number;
  year?: number;
}) {
  return useQuery(api.accountingEntries.listEntries, filters || {});
}

export function useAccountingSummary(filters?: {
  church_id?: Id<"churches">;
  month?: number;
  year?: number;
}) {
  return useQuery(api.monthlyLedger.getAccountingSummary, filters || {});
}
```

---

## Phase 7: Testing & Validation (4-6 hours)

### Step 7.1: Unit Tests (Optional)

**Create:** `tests/unit/accounting.test.ts`

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

test("openLedger creates new ledger with correct opening balance", async () => {
  const t = convexTest(schema);

  // 1. Create church
  const churchId = await t.run(async (ctx) => {
    return await ctx.db.insert("churches", {
      name: "Iglesia Test",
      city: "Asunción",
      pastor: "Pastor Test",
      active: true,
      created_at: Date.now(),
    });
  });

  // 2. Open ledger for January 2025
  const ledgerId = await t.mutation(api.monthlyLedger.openLedger, {
    church_id: churchId,
    month: 1,
    year: 2025,
  });

  // 3. Verify ledger
  const ledger = await t.run(async (ctx) => ctx.db.get(ledgerId));
  expect(ledger).toBeDefined();
  expect(ledger?.opening_balance).toBe(0); // First month = 0
  expect(ledger?.status).toBe("open");
});

test("closeLedger aggregates income and expenses correctly", async () => {
  const t = convexTest(schema);

  // Setup: Create church, open ledger, add reports and expenses
  // ...

  // Close ledger
  await t.mutation(api.monthlyLedger.closeLedger, {
    church_id: churchId,
    month: 1,
    year: 2025,
  });

  // Verify aggregations
  const ledger = await t.run(async (ctx) =>
    ctx.db.query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q.eq("church_id", churchId).eq("year", 2025).eq("month", 1)
      )
      .unique()
  );

  expect(ledger?.total_income).toBe(expectedIncome);
  expect(ledger?.total_expenses).toBe(expectedExpenses);
  expect(ledger?.closing_balance).toBe(openingBalance + income - expenses);
});

test("createExpenseWithEntry enforces double-entry constraint", async () => {
  const t = convexTest(schema);

  // Create expense
  const expenseId = await t.mutation(api.accountingEntries.createExpenseWithEntry, {
    church_id: churchId,
    date: "2025-01-15",
    concept: "Factura de luz",
    category: "Energía Eléctrica",
    amount: 500000,
  });

  // Verify accounting entry was created
  const entry = await t.run(async (ctx) =>
    ctx.db.query("accountingEntries")
      .withIndex("by_expense", (q) => q.eq("expense_record_id", expenseId))
      .unique()
  );

  expect(entry).toBeDefined();
  expect(entry?.debit).toBe(500000);
  expect(entry?.credit).toBe(0);
  expect(entry?.account_code).toBe("5000");
});
```

### Step 7.2: Integration Testing

**Manual test checklist:**

```markdown
# Accounting Migration Test Checklist

## Setup
- [ ] Deploy Convex schema with all new tables
- [ ] Run migration scripts (categories, ledgers, entries)
- [ ] Run validation script (all counts match)
- [ ] (Legacy) `USE_CONVEX_ACCOUNTING` flag removed — no action required

## Ledger Operations
- [ ] **Open new ledger** (API: POST /api/accounting type=open_ledger)
  - [ ] Opens successfully with correct opening balance
  - [ ] Returns error if duplicate (church_id, month, year)
  - [ ] Carries forward previous month's closing balance

- [ ] **Close ledger** (API: POST /api/accounting type=close_ledger)
  - [ ] Aggregates income from reports correctly
  - [ ] Aggregates expenses from expense_records correctly
  - [ ] Calculates closing balance = opening + income - expenses
  - [ ] Sets status to 'closed' (immutable)
  - [ ] Returns error if ledger doesn't exist or already closed

- [ ] **List ledgers** (API: GET /api/accounting?type=ledger)
  - [ ] Filters by church_id correctly
  - [ ] Filters by month/year correctly
  - [ ] Filters by status correctly
  - [ ] Returns church name and city (enriched)

## Expense Operations
- [ ] **Create expense** (API: POST /api/accounting type=expense)
  - [ ] Creates expense_records entry
  - [ ] Auto-creates accounting_entries entry (debit=amount, credit=0)
  - [ ] Links expense and entry via expense_record_id
  - [ ] Returns error if required fields missing

- [ ] **List expenses** (API: GET /api/accounting?type=expenses)
  - [ ] Filters by church_id correctly
  - [ ] Filters by month/year correctly
  - [ ] Returns category totals (aggregation)
  - [ ] Sorts by date descending

## Accounting Entries
- [ ] **Create entries** (API: POST /api/accounting type=entry)
  - [ ] Accepts array of entries
  - [ ] Validates debit = credit constraint
  - [ ] Returns error if unbalanced
  - [ ] Creates all entries atomically

- [ ] **List entries** (API: GET /api/accounting?type=entries)
  - [ ] Filters by church_id correctly
  - [ ] Filters by month/year correctly
  - [ ] Returns trial balance (account totals)

## Summary Queries
- [ ] **Get summary** (API: GET /api/accounting?type=summary)
  - [ ] Returns income totals from reports
  - [ ] Returns expense totals from expense_records
  - [ ] Returns ledger status
  - [ ] Calculates net result correctly

## Edge Cases
- [ ] Attempt to close non-existent ledger (should fail)
- [ ] Attempt to close already-closed ledger (should fail)
- [ ] Create expense with invalid church_id (should fail)
- [ ] Create unbalanced accounting entries (should fail)
- [ ] Open duplicate ledger for same period (should fail)

## Performance
- [ ] List 1000+ accounting entries (< 2 seconds)
- [ ] Close ledger with 100+ reports and expenses (< 5 seconds)
- [ ] Trial balance aggregation (< 1 second)

## Comparison (Convex vs PostgreSQL)
- [ ] Query results match between implementations
- [ ] Aggregations match (tolerance ±0.01)
- [ ] Data integrity maintained
```

### Step 7.3: Parallel Testing Script

**Create:** `scripts/compare-accounting-results.ts`

```typescript
import { fetchQuery } from "convex/nextjs";
import { api } from "../convex/_generated/api";
import { Pool } from "pg";

async function compareResults() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("🔍 Comparing Convex vs PostgreSQL accounting results...\n");

  // Test 1: Ledger count
  const pgLedgerCount = await pool.query("SELECT COUNT(*) FROM monthly_ledger");
  const convexLedgers = await fetchQuery(api.monthlyLedger.listLedgers, {});
  console.log(`Ledger count: PG=${pgLedgerCount.rows[0]?.count}, Convex=${convexLedgers.length}`);

  // Test 2: Trial balance for specific period
  const church_id = ".."; // Get a sample church ID
  const month = 10;
  const year = 2025;

  const pgTrialBalance = await pool.query(`
    SELECT account_code, SUM(debit) as total_debit, SUM(credit) as total_credit
    FROM accounting_entries ae
    JOIN churches c ON ae.church_id = c.id
    WHERE c.id = $1
      AND EXTRACT(MONTH FROM ae.date) = $2
      AND EXTRACT(YEAR FROM ae.date) = $3
    GROUP BY account_code
    ORDER BY account_code
  `, [church_id, month, year]);

  const convexTrialBalance = await fetchQuery(api.accountingEntries.getTrialBalance, {
    church_id: church_id as any,
    month,
    year,
  });

  console.log("\nTrial Balance Comparison:");
  for (const pgRow of pgTrialBalance.rows) {
    const convexRow = convexTrialBalance.find((r: any) => r.account_code === pgRow.account_code);
    const debitMatch = Math.abs(parseFloat(pgRow.total_debit) - (convexRow?.total_debit || 0)) < 0.01;
    const creditMatch = Math.abs(parseFloat(pgRow.total_credit) - (convexRow?.total_credit || 0)) < 0.01;

    console.log(`  ${pgRow.account_code}: ${debitMatch && creditMatch ? "✅" : "❌"}`);
  }

  await pool.end();
}

compareResults().catch(console.error);
```

---

## Phase 8: Cutover & Cleanup (2-3 hours)

### Step 8.1: Production Deployment

```bash
# 1. Deploy Convex schema and functions to production
npx convex deploy

# 2. Run data migration scripts on production
npm run migrate-categories
npm run migrate-ledgers
npm run migrate-entries
npm run validate-accounting-migration

# 3. Deploy Next.js with feature flag enabled
# (Legacy) Flag removed — skip `vercel env add` step
# Enter: true

# 4. Deploy Next.js app
vercel --prod
```

### Step 8.2: Monitoring & Validation (Week 1)

**Checklist:**
- [ ] Monitor Convex dashboard for errors
- [ ] Check Vercel logs for `/api/accounting` route failures
- [ ] Verify user-reported data accuracy
- [ ] Compare PostgreSQL vs Convex query results daily
- [ ] Ensure all mutations (open/close ledger, create expense) work

**Rollback trigger:** If >5% error rate or data mismatch, roll back to the previous deployment (feature flag no longer available).

### Step 8.3: PostgreSQL Deprecation (Week 2+)

**Only after 1 week of successful Convex operation:**

```bash
# 1. Remove feature flag (legacy – already removed)
# Delete USE_CONVEX_ACCOUNTING env var (no longer required)

# 2. Delete PostgreSQL code paths from route.ts
# Remove handleGetPostgres and handlePostPostgres functions

# 3. Delete PostgreSQL helper functions
rm src/lib/db.ts
rm src/lib/db-context.ts
rm src/lib/db-helpers.ts
rm src/lib/db-admin.ts

# 4. Remove pg dependency
npm uninstall pg @types/pg

# 5. Drop PostgreSQL tables (CAUTION!)
# DO NOT DROP until you have verified 100% data integrity
# Keep PostgreSQL as backup for 1 month before dropping
```

---

## Rollback Plan

### Emergency Rollback (Production Issue)

**Trigger:** Critical data errors, high failure rate (>5%), or financial discrepancies.

**Steps:**

1. **Immediate:** Disable Convex accounting in production
   ```bash
   vercel env rm USE_CONVEX_ACCOUNTING production
   # or set to false
   ```

2. **Deploy fix:**
   ```bash
   vercel --prod
   ```

3. **Verify:** Confirm PostgreSQL path is active
   ```bash
   curl https://ipupytesoreria.vercel.app/api/accounting?type=ledger
   ```

4. **Investigate:** Review Convex logs and error reports
5. **Fix issues** before re-enabling Convex

### Data Correction Rollback

**If Convex data is corrupted:**

1. **Stop writes:** Temporarily disable Convex mutations (feature flag removed)
2. **Clear Convex tables:**
   ```typescript
   // scripts/clear-accounting-tables.ts
   await convexMutation(api.admin.clearTable, { table: "monthlyLedgers" });
   await convexMutation(api.admin.clearTable, { table: "accountingEntries" });
   await convexMutation(api.admin.clearTable, { table: "transactionCategories" });
   ```
3. **Re-run migrations** from PostgreSQL source of truth
4. **Validate** before re-enabling

---

## Risk Assessment

### High Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Double-entry constraint violation** | 🔴 CRITICAL - Data corruption | Validate `SUM(debit) = SUM(credit)` in mutation |
| **Ledger close aggregation mismatch** | 🔴 CRITICAL - Wrong balances | Parallel testing PostgreSQL vs Convex |
| **Migration data loss** | 🔴 CRITICAL - Missing records | Validation script with count checks |
| **Race condition in ledger open** | 🟡 MEDIUM - Duplicate ledgers | Use unique index + mutation check |
| **Performance degradation** | 🟡 MEDIUM - Slow queries | Proper compound indexes |

### Medium Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Date filtering accuracy** | 🟡 MEDIUM - Wrong period data | Test month/year extraction thoroughly |
| **Church ID mapping errors** | 🟡 MEDIUM - Wrong church data | Validate ID maps in migration |
| **Expense-entry link breakage** | 🟡 MEDIUM - Orphaned records | Atomic creation in single mutation |

### Low Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Category reference data** | 🟢 LOW - Static data | One-time migration with validation |
| **Trial balance calculation** | 🟢 LOW - Display only | Compare against PostgreSQL |
| **Summary query performance** | 🟢 LOW - Not time-critical | Add indexes as needed |

---

## Success Criteria

**Phase completion criteria:**

- ✅ **Phase 1:** All schemas deployed without errors
- ✅ **Phase 2:** All 30+ categories migrated with parent links preserved
- ✅ **Phase 3:** Queries return matching results vs PostgreSQL
- ✅ **Phase 4:** 100% of data migrated with validation passing
- ✅ **Phase 5:** All mutations work (open/close ledger, create expense/entry)
- ✅ **Phase 6:** API route toggles between implementations via feature flag
- ✅ **Phase 7:** All test checklist items pass
- ✅ **Phase 8:** 1 week of production use with <1% error rate

**Overall success:**

- 🎯 Zero data loss or corruption
- 🎯 All accounting operations functional in Convex
- 🎯 Performance equal or better than PostgreSQL
- 🎯 PostgreSQL can be safely decommissioned

---

## Next Steps

After completing this migration, the following routes remain:

1. ⚠️ `/api/worship-records` - Worship attendance tracking
2. ⚠️ `/api/data` - Dashboard summary widgets
3. ⚠️ `/api/financial/fund-movements` - Fund transfer logic

**Suggested order:** Complete accounting first (highest complexity), then worship-records (medium), then data (lowest risk).

---

## Appendix A: Schema Quick Reference

### New Convex Collections

- `monthlyLedgers` - Financial period management
- `accountingEntries` - Double-entry bookkeeping
- `transactionCategories` - Chart of accounts
- `churchAccounts` - Bank/cash accounts (migration 005)
- `churchTransactions` - Transaction ledger (migration 005)
- `churchBudgets` - Budget tracking (migration 005)

### Updated Collections

- `expense_records` - Added accounting API compatibility fields

### Key Indexes

- `by_church_and_period` - Essential for ledger queries
- `by_church_and_date` - Essential for entry filtering
- `by_account_code` - Essential for trial balance

---

## Appendix B: Migration Scripts Summary

| Script | Purpose | Runtime |
|--------|---------|---------|
| `migrate-transaction-categories.ts` | Migrate reference data | ~1 min |
| `migrate-monthly-ledgers.ts` | Migrate ledger periods | ~2 min |
| `migrate-accounting-entries.ts` | Migrate all entries | ~5-10 min |
| `validate-accounting-migration.ts` | Validation checks | ~1 min |
| `compare-accounting-results.ts` | Parallel testing | ~2 min |

**Total migration time:** ~15-20 minutes for all data.

---

**End of Part 2**

See [WS7_ACCOUNTING_MIGRATION_PLAN.md](./WS7_ACCOUNTING_MIGRATION_PLAN.md) for Phases 1-3.
