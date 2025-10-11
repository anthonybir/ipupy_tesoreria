/**
 * Accounting Utilities - Transaction Categories and Supporting Queries
 *
 * Phase 1 deliverables from WS7 plan:
 *  - Internal mutations for migrating transaction categories from Postgres.
 *  - Read-only query for listing categories (Convex-native consumers).
 *
 * The internal mutations intentionally skip user-level auth checks because they
 * are executed via scripts using the Convex admin key. Do not expose them to
 * untrusted clients.
 */

import { v } from "convex/values";
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { getAuthContext } from "./lib/auth";
import { isAdmin, requireChurch, requireMinRole } from "./lib/permissions";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeString(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getPeriodRange(
  month?: number | null,
  year?: number | null
): { start: number; end: number } | null {
  if (!month || !year) {
    return null;
  }
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(month === 12 ? year + 1 : year, month % 12, 1);
  return { start, end };
}

function toIsoString(value?: number | null): string | null {
  if (!value || Number.isNaN(value)) {
    return null;
  }
  return new Date(value).toISOString();
}

function resolveExpenseTimestamp(expense: Doc<"expense_records">): number {
  if (expense.date && !Number.isNaN(expense.date)) {
    return expense.date;
  }
  return expense.fecha_comprobante;
}

function getExpenseAmount(expense: Doc<"expense_records">): number {
  if (typeof expense.amount === "number" && !Number.isNaN(expense.amount)) {
    return expense.amount;
  }
  return expense.total_factura ?? 0;
}

// -----------------------------------------------------------------------------
// Internal Mutations (used by migration scripts)
// -----------------------------------------------------------------------------

type CreateCategoryArgs = {
  category_name: string;
  category_type: "income" | "expense";
  description?: string;
  is_system: boolean;
  is_active: boolean;
  supabase_id?: number;
  created_at?: number;
};

export const createCategory = internalMutation({
  args: {
    category_name: v.string(),
    category_type: v.union(v.literal("income"), v.literal("expense")),
    description: v.optional(v.string()),
    is_system: v.boolean(),
    is_active: v.boolean(),
    supabase_id: v.optional(v.number()),
    created_at: v.optional(v.number()),
  },
  handler: async (ctx: MutationCtx, args: CreateCategoryArgs) => {
    const now = Date.now();
    const description = normalizeString(args.description);

    const payload = {
      category_name: args.category_name.trim(),
      category_type: args.category_type,
      ...(description ? { description } : {}),
      is_system: args.is_system,
      is_active: args.is_active,
      ...(args.supabase_id !== undefined ? { supabase_id: args.supabase_id } : {}),
      created_at: args.created_at ?? now,
    };

    return await ctx.db.insert("transactionCategories", payload);
  },
});

export const updateCategoryParent = internalMutation({
  args: {
    id: v.id("transactionCategories"),
    parent_category_id: v.id("transactionCategories"),
  },
  handler: async (ctx: MutationCtx, args) => {
    await ctx.db.patch(args.id, {
      parent_category_id: args.parent_category_id,
    });
  },
});

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export const listCategories = query({
  args: {
    type: v.optional(v.union(v.literal("income"), v.literal("expense"))),
    include_inactive: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const categoryType = args.type;
    const categoryCursor = categoryType
      ? ctx.db
          .query("transactionCategories")
          .withIndex("by_type", (q) => q.eq("category_type", categoryType))
      : ctx.db.query("transactionCategories");

    let categories = await categoryCursor.collect();

    if (!args.include_inactive) {
      categories = categories.filter((category) => category.is_active);
    }

    categories.sort((a, b) =>
      a.category_name.localeCompare(b.category_name, "es", {
        sensitivity: "base",
      })
    );

    return categories;
  },
});

type AccountingSummary = {
  income: {
    total_diezmos: number;
    total_ofrendas: number;
    total_anexos: number;
    total_income: number;
    report_count: number;
  };
  expenses: {
    total_expenses: number;
    expense_count: number;
  };
  movements: {
    total_movements: number;
    movement_count: number;
  };
  ledger: {
    status: string;
    opening_balance?: number;
    closing_balance?: number;
    total_income?: number;
    total_expenses?: number;
    closed_at?: string | null;
    closed_by?: string | null;
    notes?: string | null;
    month?: number;
    year?: number;
  };
  netResult: number;
};

function enforceChurchScope(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  explicit?: Id<"churches">
): Id<"churches"> | undefined {
  if (explicit) {
    if (!isAdmin(auth)) {
      requireChurch(auth, explicit);
    }
    return explicit;
  }

  if (!isAdmin(auth) && auth.churchId) {
    return auth.churchId;
  }

  return undefined;
}

export const getSummary = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AccountingSummary> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const churchId = enforceChurchScope(auth, args.church_id ?? undefined);
    const range = getPeriodRange(args.month ?? null, args.year ?? null);

    // ---------------------------------------------------------------------
    // Reports / Income aggregation
    // ---------------------------------------------------------------------
    let reportsQuery = ctx.db.query("reports");

    if (churchId) {
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("church_id"), churchId)
      );
    } else if (!isAdmin(auth) && auth.churchId) {
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("church_id"), auth.churchId as Id<"churches">)
      );
    }

    if (args.year !== undefined) {
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("year"), args.year as number)
      );
    }

    if (args.month !== undefined) {
      reportsQuery = reportsQuery.filter((q) =>
        q.eq(q.field("month"), args.month as number)
      );
    }

    const reports = await reportsQuery.collect();

    const incomeTotals = reports.reduce(
      (acc, report) => {
        acc.total_diezmos += report.diezmos ?? 0;
        acc.total_ofrendas += report.ofrendas ?? 0;
        acc.total_anexos += report.anexos ?? 0;
        acc.total_income += report.total_entradas ?? 0;
        return acc;
      },
      {
        total_diezmos: 0,
        total_ofrendas: 0,
        total_anexos: 0,
        total_income: 0,
      }
    );

    const income = {
      ...incomeTotals,
      report_count: reports.length,
    };

    // ---------------------------------------------------------------------
    // Expenses aggregation
    // ---------------------------------------------------------------------
    let expensesQuery = ctx.db.query("expense_records");

    if (churchId) {
      expensesQuery = expensesQuery.filter((q) =>
        q.eq(q.field("church_id"), churchId)
      );
    } else if (!isAdmin(auth) && auth.churchId) {
      expensesQuery = expensesQuery.filter((q) =>
        q.eq(q.field("church_id"), auth.churchId as Id<"churches">)
      );
    }

    let expenses = await expensesQuery.collect();

    if (range) {
      expenses = expenses.filter((expense) => {
        const timestamp = resolveExpenseTimestamp(expense);
        return timestamp >= range.start && timestamp < range.end;
      });
    }

    const expenseTotals = expenses.reduce(
      (acc, expense) => acc + getExpenseAmount(expense),
      0
    );

    const expensesSummary = {
      total_expenses: expenseTotals,
      expense_count: expenses.length,
    };

    // ---------------------------------------------------------------------
    // Transactions (movements) aggregation
    // ---------------------------------------------------------------------
    let transactionsQuery = ctx.db.query("transactions");

    if (churchId) {
      transactionsQuery = transactionsQuery.filter((q) =>
        q.eq(q.field("church_id"), churchId)
      );
    } else if (!isAdmin(auth) && auth.churchId) {
      transactionsQuery = transactionsQuery.filter((q) =>
        q.eq(q.field("church_id"), auth.churchId as Id<"churches">)
      );
    }

    let transactions = await transactionsQuery.collect();

    if (range) {
      transactions = transactions.filter((transaction) =>
        transaction.date >= range.start && transaction.date < range.end
      );
    }

    const movementsSummary = transactions.reduce(
      (acc, transaction) => {
        return {
          total_movements:
            acc.total_movements + transaction.amount_in + transaction.amount_out,
          movement_count: acc.movement_count + 1,
        };
      },
      { total_movements: 0, movement_count: 0 }
    );

    // ---------------------------------------------------------------------
    // Ledger snapshot
    // ---------------------------------------------------------------------
    let ledgersQuery = ctx.db.query("monthlyLedgers");

    if (churchId) {
      ledgersQuery = ledgersQuery.filter((q) =>
        q.eq(q.field("church_id"), churchId)
      );
    } else if (!isAdmin(auth) && auth.churchId) {
      ledgersQuery = ledgersQuery.filter((q) =>
        q.eq(q.field("church_id"), auth.churchId as Id<"churches">)
      );
    }

    if (args.year !== undefined) {
      ledgersQuery = ledgersQuery.filter((q) =>
        q.eq(q.field("year"), args.year as number)
      );
    }
    if (args.month !== undefined) {
      ledgersQuery = ledgersQuery.filter((q) =>
        q.eq(q.field("month"), args.month as number)
      );
    }

    const ledgers = await ledgersQuery.collect();

    ledgers.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      if (a.month !== b.month) {
        return b.month - a.month;
      }
      return b._creationTime - a._creationTime;
    });

    const ledgerDoc = ledgers[0] ?? null;

    const ledger = ledgerDoc
      ? {
          status: ledgerDoc.status,
          opening_balance: ledgerDoc.opening_balance,
          closing_balance: ledgerDoc.closing_balance,
          total_income: ledgerDoc.total_income,
          total_expenses: ledgerDoc.total_expenses,
          closed_at: toIsoString(ledgerDoc.closed_at ?? null),
          closed_by: ledgerDoc.closed_by ?? null,
          notes: ledgerDoc.notes ?? null,
          month: ledgerDoc.month,
          year: ledgerDoc.year,
        }
      : {
          status: "not_created",
        };

    const netResult = income.total_income - expensesSummary.total_expenses;

    return {
      income,
      expenses: expensesSummary,
      movements: movementsSummary,
      ledger,
      netResult,
    };
  },
});
