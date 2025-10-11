import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { type Doc, type Id } from "./_generated/dataModel";
import { getAuthContext } from "./lib/auth";
import {
  isAdmin,
  requireChurch,
  requireMinRole,
} from "./lib/permissions";

type EntryDoc = Doc<"accountingEntries">;
type ChurchDoc = Doc<"churches"> | null;
type ExpenseDoc = Doc<"expense_records"> | null;
type ReportDoc = Doc<"reports"> | null;

type EntryResponse = {
  id: number | null;
  convex_id: Id<"accountingEntries">;
  church_id: number | null;
  church_convex_id: Id<"churches">;
  church_name: string | null;
  date: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number | null;
  reference: string | null;
  description: string;
  expense_record_id: number | null;
  expense_record_convex_id: Id<"expense_records"> | null;
  report_id: number | null;
  report_convex_id: Id<"reports"> | null;
  created_by: string | null;
  created_at: string;
};

type TrialBalanceRow = {
  account_code: string;
  account_name: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

function toISOString(value?: number | null): string {
  if (!value || Number.isNaN(value)) {
    return new Date(0).toISOString();
  }
  return new Date(value).toISOString();
}

function getPeriodRange(
  month?: number,
  year?: number
): { start: number; end: number } | null {
  if (!month || !year) {
    return null;
  }

  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(month === 12 ? year + 1 : year, month % 12, 1);
  return { start, end };
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

async function loadExpenseMap(
  ctx: Parameters<typeof getAuthContext>[0],
  expenseIds: Id<"expense_records">[]
): Promise<Map<Id<"expense_records">, ExpenseDoc>> {
  const uniqueIds = Array.from(new Set(expenseIds));
  const records = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  const map = new Map<Id<"expense_records">, ExpenseDoc>();
  records.forEach((record, index) => {
    const key = uniqueIds[index];
    if (!key) {
      return;
    }
    map.set(key, record ?? null);
  });
  return map;
}

async function loadReportMap(
  ctx: Parameters<typeof getAuthContext>[0],
  reportIds: Id<"reports">[]
): Promise<Map<Id<"reports">, ReportDoc>> {
  const uniqueIds = Array.from(new Set(reportIds));
  const records = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  const map = new Map<Id<"reports">, ReportDoc>();
  records.forEach((record, index) => {
    const key = uniqueIds[index];
    if (!key) {
      return;
    }
    map.set(key, record ?? null);
  });
  return map;
}

function serializeEntry(
  entry: EntryDoc,
  church: ChurchDoc,
  expense: ExpenseDoc,
  report: ReportDoc
): EntryResponse {
  return {
    id: entry.supabase_id ?? null,
    convex_id: entry._id,
    church_id: church?.supabase_id ?? null,
    church_convex_id: entry.church_id,
    church_name: church?.name ?? null,
    date: toISOString(entry.date),
    account_code: entry.account_code,
    account_name: entry.account_name,
    debit: entry.debit,
    credit: entry.credit,
    balance: entry.balance ?? null,
    reference: entry.reference ?? null,
    description: entry.description,
    expense_record_id: expense?.supabase_id ?? null,
    expense_record_convex_id: entry.expense_record_id ?? null,
    report_id: report?.supabase_id ?? null,
    report_convex_id: entry.report_id ?? null,
    created_by: entry.created_by ?? null,
    created_at: toISOString(entry.created_at ?? entry._creationTime),
  };
}

async function hydrateEntry(
  ctx: Parameters<typeof getAuthContext>[0],
  entryId: Id<"accountingEntries">
): Promise<EntryResponse> {
  const entry = await ctx.db.get(entryId);
  if (!entry) {
    throw new Error("Registro contable no encontrado después de la inserción");
  }

  const [church, expense, report] = await Promise.all([
    ctx.db.get(entry.church_id),
    entry.expense_record_id ? ctx.db.get(entry.expense_record_id) : Promise.resolve(null),
    entry.report_id ? ctx.db.get(entry.report_id) : Promise.resolve(null),
  ]);

  return serializeEntry(entry, church ?? null, expense, report);
}

type ExpenseMutationSnapshot = {
  convex_id: Id<"expense_records">;
  church_convex_id: Id<"churches">;
  church_supabase_id: number | null;
  date: string;
  concept: string;
  category: string | null;
  amount: number;
};

async function serializeExpenseSnapshot(
  ctx: Parameters<typeof getAuthContext>[0],
  expenseId: Id<"expense_records">
): Promise<ExpenseMutationSnapshot> {
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new Error("Gasto creado no encontrado");
  }

  const church = await ctx.db.get(expense.church_id);
  const amount = expense.amount ?? expense.total_factura;
  const dateMs = typeof expense.date === "number" ? expense.date : expense.fecha_comprobante;

  return {
    convex_id: expense._id,
    church_convex_id: expense.church_id,
    church_supabase_id: church?.supabase_id ?? null,
    date: toISOString(dateMs) ?? new Date(dateMs).toISOString(),
    concept: expense.concepto,
    category: expense.category ?? null,
    amount,
  };
}

function filterByAccess(
  entries: EntryDoc[],
  auth: Awaited<ReturnType<typeof getAuthContext>>
): EntryDoc[] {
  if (isAdmin(auth) || !auth.churchId) {
    return entries;
  }
  return entries.filter((entry) => entry.church_id === auth.churchId);
}

export const listEntries = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<EntryResponse[]> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    if (args.church_id && !isAdmin(auth)) {
      requireChurch(auth, args.church_id);
    }

    const range = getPeriodRange(args.month, args.year);

    let records: EntryDoc[];
    if (args.church_id && range) {
      records = await ctx.db
        .query("accountingEntries")
        .withIndex("by_church_and_date", (q) =>
          q
            .eq("church_id", args.church_id as Id<"churches">)
            .gte("date", range.start)
            .lt("date", range.end)
        )
        .collect();
    } else if (args.church_id) {
      records = await ctx.db
        .query("accountingEntries")
        .withIndex("by_church", (q) =>
          q.eq("church_id", args.church_id as Id<"churches">)
        )
        .collect();
    } else if (range) {
      records = await ctx.db
        .query("accountingEntries")
        .withIndex("by_date", (q) =>
          q.gte("date", range.start).lt("date", range.end)
        )
        .collect();
    } else {
      records = await ctx.db.query("accountingEntries").collect();
    }
    const scoped = filterByAccess(records, auth);

    if (scoped.length === 0) {
      return [];
    }

    const expenseIds = scoped
      .map((entry) => entry.expense_record_id)
      .filter((id): id is Id<"expense_records"> => id !== null && id !== undefined);
    const reportIds = scoped
      .map((entry) => entry.report_id)
      .filter((id): id is Id<"reports"> => id !== null && id !== undefined);

    const [churchMap, expenseMap, reportMap] = await Promise.all([
      loadChurchMap(ctx, scoped.map((entry) => entry.church_id)),
      loadExpenseMap(ctx, expenseIds),
      loadReportMap(ctx, reportIds),
    ]);

    const serialized = scoped.map((entry) =>
      serializeEntry(
        entry,
        churchMap.get(entry.church_id) ?? null,
        entry.expense_record_id ? expenseMap.get(entry.expense_record_id) ?? null : null,
        entry.report_id ? reportMap.get(entry.report_id) ?? null : null
      )
    );

    serialized.sort((a, b) => {
      if (a.date === b.date) {
        return a.account_code.localeCompare(b.account_code, "es");
      }
      return b.date.localeCompare(a.date);
    });

    return serialized;
  },
});

export const getTrialBalance = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<TrialBalanceRow[]> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    if (args.church_id && !isAdmin(auth)) {
      requireChurch(auth, args.church_id);
    }

    const range = getPeriodRange(args.month, args.year);

    let records: EntryDoc[];
    if (args.church_id && range) {
      records = await ctx.db
        .query("accountingEntries")
        .withIndex("by_church_and_date", (q) =>
          q
            .eq("church_id", args.church_id as Id<"churches">)
            .gte("date", range.start)
            .lt("date", range.end)
        )
        .collect();
    } else if (args.church_id) {
      records = await ctx.db
        .query("accountingEntries")
        .withIndex("by_church", (q) =>
          q.eq("church_id", args.church_id as Id<"churches">)
        )
        .collect();
    } else if (range) {
      records = await ctx.db
        .query("accountingEntries")
        .withIndex("by_date", (q) =>
          q.gte("date", range.start).lt("date", range.end)
        )
        .collect();
    } else {
      records = await ctx.db.query("accountingEntries").collect();
    }
    const scoped = filterByAccess(records, auth);

    const totals = new Map<string, TrialBalanceRow>();

    for (const entry of scoped) {
      const key = entry.account_code;
      const existing = totals.get(key) ?? {
        account_code: entry.account_code,
        account_name: entry.account_name,
        total_debit: 0,
        total_credit: 0,
        balance: 0,
      };

      existing.total_debit += entry.debit;
      existing.total_credit += entry.credit;
      existing.balance = existing.total_debit - existing.total_credit;
      totals.set(key, existing);
    }

    return Array.from(totals.values()).sort((a, b) =>
      a.account_code.localeCompare(b.account_code, "es")
    );
  },
});

export const createExpenseWithEntry = mutation({
  args: {
    church_id: v.id("churches"),
    date: v.string(),
    concept: v.string(),
    category: v.string(),
    amount: v.number(),
    provider: v.optional(v.string()),
    document_number: v.optional(v.string()),
    approved_by: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const now = Date.now();
    const expenseDate = new Date(args.date).getTime();
    if (Number.isNaN(expenseDate)) {
      throw new Error("Fecha de gasto inválida");
    }

    const approvedBy = args.approved_by ?? auth.email;

    const expenseId = await ctx.db.insert("expense_records", {
      church_id: args.church_id,
      fecha_comprobante: expenseDate,
      concepto: args.concept,
      proveedor: args.provider ?? "N/A",
      ...(args.document_number ? { numero_comprobante: args.document_number } : {}),
      tipo_salida: args.category,
      monto_exenta: args.amount,
      monto_gravada_10: 0,
      iva_10: 0,
      monto_gravada_5: 0,
      iva_5: 0,
      total_factura: args.amount,
      es_factura_legal: false,
      es_honorario_pastoral: args.category === "Honorarios Pastorales",
      ...(args.notes ? { observaciones: args.notes } : {}),
      created_at: now,
      category: args.category,
      ...(approvedBy ? { approved_by: approvedBy } : {}),
      date: expenseDate,
      amount: args.amount,
      ...(args.provider ? { provider: args.provider } : {}),
      ...(args.document_number ? { document_number: args.document_number } : {}),
      ...(args.notes ? { notes: args.notes } : {}),
    });

    const entryId = await ctx.db.insert("accountingEntries", {
      church_id: args.church_id,
      date: expenseDate,
      account_code: "5000",
      account_name: args.category,
      debit: args.amount,
      credit: 0,
      reference: `EXP-${expenseId}`,
      description: args.concept,
      expense_record_id: expenseId,
      ...(auth.email ? { created_by: auth.email } : {}),
      created_at: now,
    });

    const expenseSnapshot = await serializeExpenseSnapshot(ctx, expenseId);
    const entrySnapshot = await hydrateEntry(ctx, entryId);

    return {
      expense: expenseSnapshot,
      entry: entrySnapshot,
    };
  },
});

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
        expense_record_id: v.optional(v.id("expense_records")),
        report_id: v.optional(v.id("reports")),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.entries.length === 0) {
      throw new Error("Se requiere al menos un asiento contable");
    }

    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    const normalized = args.entries.map((entry) => {
      const debit = entry.debit ?? 0;
      const credit = entry.credit ?? 0;
      if (debit < 0 || credit < 0) {
        throw new Error("Los montos no pueden ser negativos");
      }
      if (debit === 0 && credit === 0) {
        throw new Error("Cada asiento debe tener débito o crédito");
      }
      const timestamp = new Date(entry.date).getTime();
      if (Number.isNaN(timestamp)) {
        throw new Error("Fecha de asiento inválida");
      }
      return {
        ...entry,
        dateMs: timestamp,
        debit,
        credit,
      };
    });

    const net = normalized.reduce((sum, entry) => sum + entry.debit - entry.credit, 0);
    if (Math.abs(net) > 0.01) {
      throw new Error("La suma de débitos y créditos debe ser cero");
    }

    const now = Date.now();
    const responses: EntryResponse[] = [];

    for (const entry of normalized) {
      const entryId = await ctx.db.insert("accountingEntries", {
        church_id: entry.church_id,
        date: entry.dateMs,
        account_code: entry.account_code,
        account_name: entry.account_name,
        debit: entry.debit,
        credit: entry.credit,
        ...(entry.reference ? { reference: entry.reference } : {}),
        description: entry.description,
        ...(entry.expense_record_id ? { expense_record_id: entry.expense_record_id } : {}),
        ...(entry.report_id ? { report_id: entry.report_id } : {}),
        ...(auth.email ? { created_by: auth.email } : {}),
        created_at: now,
      });

      responses.push(await hydrateEntry(ctx, entryId));
    }

    return responses;
  },
});

export const createEntryFromMigration = internalMutation({
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
    const payload: Omit<EntryDoc, "_id" | "_creationTime"> = {
      church_id: args.church_id,
      date: args.date,
      account_code: args.account_code,
      account_name: args.account_name,
      debit: args.debit,
      credit: args.credit,
      ...(args.balance !== undefined ? { balance: args.balance } : {}),
      ...(args.reference ? { reference: args.reference } : {}),
      description: args.description,
      ...(args.expense_record_id ? { expense_record_id: args.expense_record_id } : {}),
      ...(args.report_id ? { report_id: args.report_id } : {}),
      ...(args.created_by ? { created_by: args.created_by } : {}),
      created_at: args.created_at,
      ...(args.supabase_id !== undefined ? { supabase_id: args.supabase_id } : {}),
    };

    const existingBySupabase = await ctx.db
      .query("accountingEntries")
      .withIndex("by_supabase_id", (q) => q.eq("supabase_id", args.supabase_id))
      .unique();

    if (existingBySupabase) {
      await ctx.db.patch(existingBySupabase._id, payload);
      return existingBySupabase._id;
    }

    return await ctx.db.insert("accountingEntries", payload);
  },
});
