import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { type Doc, type Id } from "./_generated/dataModel";
import { getAuthContext } from "./lib/auth";
import {
  isAdmin,
  requireChurch,
  requireMinRole,
} from "./lib/permissions";

type LedgerDoc = Doc<"monthlyLedgers">;
type ChurchDoc = Doc<"churches"> | null;

type LedgerResponse = {
  id: number | null;
  convex_id: Id<"monthlyLedgers">;
  church_id: number | null;
  church_convex_id: Id<"churches">;
  church_name: string | null;
  church_city: string | null;
  month: number;
  year: number;
  opening_balance: number;
  closing_balance: number;
  total_income: number;
  total_expenses: number;
  status: "open" | "closed" | "reconciled";
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toISOString(value?: number | null): string | null {
  if (!value || Number.isNaN(value)) {
    return null;
  }
  return new Date(value).toISOString();
}

function resolveExpenseTimestamp(expense: Doc<"expense_records">): number {
  if (typeof expense.date === "number" && !Number.isNaN(expense.date)) {
    return expense.date;
  }
  return expense.fecha_comprobante;
}

async function loadChurchMap(
  ctx: Parameters<typeof getAuthContext>[0],
  churchIds: Id<"churches">[]
): Promise<Map<Id<"churches">, ChurchDoc>> {
  const uniqueIds = Array.from(new Set(churchIds));

  const records = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  const map = new Map<Id<"churches">, ChurchDoc>();

  records.forEach((record, index) => {
    const key = uniqueIds[index];
    if (!key) {
      return;
    }
    map.set(key, record ?? null);
  });

  return map;
}

function serializeLedger(ledger: LedgerDoc, church: ChurchDoc): LedgerResponse {
  return {
    id: ledger.supabase_id ?? null,
    convex_id: ledger._id,
    church_id: church?.supabase_id ?? null,
    church_convex_id: ledger.church_id,
    church_name: church?.name ?? null,
    church_city: church?.city ?? null,
    month: ledger.month,
    year: ledger.year,
    opening_balance: ledger.opening_balance,
    closing_balance: ledger.closing_balance,
    total_income: ledger.total_income,
    total_expenses: ledger.total_expenses,
    status: ledger.status,
    closed_at: toISOString(ledger.closed_at ?? null),
    closed_by: ledger.closed_by ?? null,
    notes: ledger.notes ?? null,
    created_by: ledger.created_by ?? null,
    created_at:
      toISOString(ledger.created_at) ?? toISOString(ledger._creationTime) ?? new Date(0).toISOString(),
    updated_at:
      toISOString(ledger.updated_at) ?? toISOString(ledger._creationTime) ?? new Date(0).toISOString(),
  };
}

export const listLedgers = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("open"), v.literal("closed"), v.literal("reconciled"))
    ),
  },
  handler: async (ctx, args): Promise<LedgerResponse[]> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    if (args.church_id && !isAdmin(auth)) {
      requireChurch(auth, args.church_id);
    }

    let records: LedgerDoc[];
    if (args.church_id && args.year && args.month) {
      records = await ctx.db
        .query("monthlyLedgers")
        .withIndex("by_church_and_period", (q) =>
          q
            .eq("church_id", args.church_id as Id<"churches">)
            .eq("year", args.year as number)
            .eq("month", args.month as number)
        )
        .collect();
    } else if (args.church_id) {
      records = await ctx.db
        .query("monthlyLedgers")
        .withIndex("by_church", (q) =>
          q.eq("church_id", args.church_id as Id<"churches">)
        )
        .collect();
    } else if (args.status) {
      records = await ctx.db
        .query("monthlyLedgers")
        .withIndex("by_status", (q) =>
          q.eq("status", args.status as LedgerDoc["status"])
        )
        .collect();
    } else {
      records = await ctx.db.query("monthlyLedgers").collect();
    }

    const scoped =
      isAdmin(auth) || !auth.churchId
        ? records
        : records.filter((ledger) => ledger.church_id === auth.churchId);

    if (scoped.length === 0) {
      return [];
    }

    const churchMap = await loadChurchMap(
      ctx,
      scoped.map((ledger) => ledger.church_id)
    );

    const serialized = scoped.map((ledger) =>
      serializeLedger(ledger, churchMap.get(ledger.church_id) ?? null)
    );

    serialized.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      if (a.month !== b.month) {
        return b.month - a.month;
      }
      return a.church_name?.localeCompare(b.church_name ?? "", "es") ?? 0;
    });

    return serialized;
  },
});

export const getLedgerByPeriod = query({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args): Promise<LedgerResponse | null> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    if (!isAdmin(auth)) {
      requireChurch(auth, args.church_id);
    }

    const ledger = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q
          .eq("church_id", args.church_id)
          .eq("year", args.year)
          .eq("month", args.month)
      )
      .unique();

    if (!ledger) {
      return null;
    }

    if (!isAdmin(auth) && auth.churchId && ledger.church_id !== auth.churchId) {
      return null;
    }

    const church = await ctx.db.get(ledger.church_id);
    return serializeLedger(ledger, church);
  },
});

export const openLedger = mutation({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args): Promise<LedgerResponse> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const existing = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q
          .eq("church_id", args.church_id)
          .eq("year", args.year)
          .eq("month", args.month)
      )
      .unique();

    if (existing) {
      throw new Error(
        `El libro mensual para ${args.month}/${args.year} ya existe (estado: ${existing.status})`
      );
    }

    const prevMonth = args.month === 1 ? 12 : args.month - 1;
    const prevYear = args.month === 1 ? args.year - 1 : args.year;

    const previous = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q
          .eq("church_id", args.church_id)
          .eq("year", prevYear)
          .eq("month", prevMonth)
      )
      .unique();

    const openingBalance = previous?.closing_balance ?? 0;
    const now = Date.now();

    const ledgerId = await ctx.db.insert("monthlyLedgers", {
      church_id: args.church_id,
      month: args.month,
      year: args.year,
      opening_balance: openingBalance,
      closing_balance: openingBalance,
      total_income: 0,
      total_expenses: 0,
      status: "open" as const,
      created_by: auth.email,
      created_at: now,
      updated_at: now,
    });

    const created = await ctx.db.get(ledgerId);
    if (!created) {
      throw new Error("No se pudo crear el libro mensual");
    }

    const church = await ctx.db.get(created.church_id);
    return serializeLedger(created, church ?? null);
  },
});

export const closeLedger = mutation({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<LedgerResponse> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const ledger = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q
          .eq("church_id", args.church_id)
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

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_church_and_period", (q) =>
        q
          .eq("church_id", args.church_id)
          .eq("year", args.year)
          .eq("month", args.month)
      )
      .collect();

    const totalIncome = reports.reduce((sum, report) => sum + report.total_entradas, 0);

    const expenseDocs = await ctx.db
      .query("expense_records")
      .withIndex("by_church", (q) => q.eq("church_id", args.church_id))
      .collect();

    const totalExpenses = expenseDocs.reduce((sum, expense) => {
      const ts = resolveExpenseTimestamp(expense);
      const date = new Date(ts);
      const matchesMonth = date.getUTCMonth() + 1 === args.month;
      const matchesYear = date.getUTCFullYear() === args.year;
      return matchesMonth && matchesYear ? sum + expense.total_factura : sum;
    }, 0);

    const closingBalance = ledger.opening_balance + totalIncome - totalExpenses;
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

    const updated = await ctx.db.get(ledger._id);
    if (!updated) {
      throw new Error("No se pudo actualizar el libro mensual");
    }

    const church = await ctx.db.get(updated.church_id);
    return serializeLedger(updated, church ?? null);
  },
});

export const createLedgerFromMigration = internalMutation({
  args: {
    church_id: v.id("churches"),
    month: v.number(),
    year: v.number(),
    opening_balance: v.number(),
    closing_balance: v.number(),
    total_income: v.number(),
    total_expenses: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("reconciled")
    ),
    closed_at: v.optional(v.number()),
    closed_by: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    supabase_id: v.number(),
  },
  handler: async (ctx, args) => {
    const payload: Omit<LedgerDoc, "_id" | "_creationTime"> = {
      church_id: args.church_id,
      month: args.month,
      year: args.year,
      opening_balance: args.opening_balance,
      closing_balance: args.closing_balance,
      total_income: args.total_income,
      total_expenses: args.total_expenses,
      status: args.status,
      ...(args.closed_at !== undefined ? { closed_at: args.closed_at } : {}),
      ...(args.closed_by ? { closed_by: args.closed_by } : {}),
      ...(args.notes ? { notes: args.notes } : {}),
      ...(args.created_by ? { created_by: args.created_by } : {}),
      created_at: args.created_at,
      updated_at: args.updated_at,
      supabase_id: args.supabase_id,
    };

    const existingBySupabase = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_supabase_id", (q) => q.eq("supabase_id", args.supabase_id))
      .unique();

    if (existingBySupabase) {
      await ctx.db.patch(existingBySupabase._id, payload);
      return existingBySupabase._id;
    }

    const existingByPeriod = await ctx.db
      .query("monthlyLedgers")
      .withIndex("by_church_and_period", (q) =>
        q
          .eq("church_id", args.church_id)
          .eq("year", args.year)
          .eq("month", args.month)
      )
      .unique();

    if (existingByPeriod) {
      await ctx.db.patch(existingByPeriod._id, payload);
      return existingByPeriod._id;
    }

    return await ctx.db.insert("monthlyLedgers", payload);
  },
});
