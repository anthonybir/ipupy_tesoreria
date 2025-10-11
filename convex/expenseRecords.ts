import { query } from "./_generated/server";
import { v } from "convex/values";
import { type Doc, type Id } from "./_generated/dataModel";
import { getAuthContext } from "./lib/auth";
import {
  isAdmin,
  requireChurch,
  requireMinRole,
} from "./lib/permissions";

type ExpenseDoc = Doc<"expense_records">;
type ChurchDoc = Doc<"churches"> | null;
type ReportDoc = Doc<"reports"> | null;

type ExpenseResponse = {
  id: number | null;
  convex_id: Id<"expense_records">;
  church_id: number | null;
  church_convex_id: Id<"churches">;
  church_name: string | null;
  church_city: string | null;
  report_id: number | null;
  report_convex_id: Id<"reports"> | null;
  date: string;
  concept: string;
  category: string | null;
  amount: number;
  provider: string | null;
  provider_ruc: string | null;
  document_number: string | null;
  approved_by: string | null;
  notes: string | null;
  is_legal_invoice: boolean;
  is_pastoral_fee: boolean;
  total_factura: number;
  created_at: string;
};

type CategoryTotalsRow = {
  category: string;
  count: number;
  total: number;
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

function resolveExpenseDate(expense: ExpenseDoc): number {
  if (expense.date && !Number.isNaN(expense.date)) {
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

function serializeExpense(
  expense: ExpenseDoc,
  church: ChurchDoc,
  report: ReportDoc
): ExpenseResponse {
  const amount = expense.amount ?? expense.total_factura;
  const providerName =
    expense.provider ?? expense.proveedor ?? null;
  const documentNumber =
    expense.document_number ?? expense.numero_comprobante ?? null;
  const notes = expense.notes ?? expense.observaciones ?? null;

  return {
    id: expense.supabase_id ?? null,
    convex_id: expense._id,
    church_id: church?.supabase_id ?? null,
    church_convex_id: expense.church_id,
    church_name: church?.name ?? null,
    church_city: church?.city ?? null,
    report_id: report?.supabase_id ?? null,
    report_convex_id: expense.report_id ?? null,
    date: toISOString(resolveExpenseDate(expense)),
    concept: expense.concepto,
    category: expense.category ?? null,
    amount,
    provider: providerName,
    provider_ruc: expense.ruc_ci_proveedor ?? null,
    document_number: documentNumber,
    approved_by: expense.approved_by ?? null,
    notes,
    is_legal_invoice: expense.es_factura_legal,
    is_pastoral_fee: expense.es_honorario_pastoral,
    total_factura: expense.total_factura,
    created_at: toISOString(expense.created_at ?? expense._creationTime),
  };
}

function filterByAccess(
  expenses: ExpenseDoc[],
  auth: Awaited<ReturnType<typeof getAuthContext>>
): ExpenseDoc[] {
  if (isAdmin(auth) || !auth.churchId) {
    return expenses;
  }
  return expenses.filter((expense) => expense.church_id === auth.churchId);
}

export const listExpenses = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ExpenseResponse[]> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    if (args.church_id && !isAdmin(auth)) {
      requireChurch(auth, args.church_id);
    }

    const range = getPeriodRange(args.month ?? undefined, args.year ?? undefined);

    let records: ExpenseDoc[];
    if (args.church_id) {
      records = await ctx.db
        .query("expense_records")
        .withIndex("by_church", (q) =>
          q.eq("church_id", args.church_id as Id<"churches">)
        )
        .collect();
    } else if (range) {
      records = await ctx.db
        .query("expense_records")
        .withIndex("by_date", (q) =>
          q.gte("date", range.start).lt("date", range.end)
        )
        .collect();
    } else {
      records = await ctx.db.query("expense_records").collect();
    }

    if (range) {
      records = records.filter((expense) => {
        const expenseDate = resolveExpenseDate(expense);
        return expenseDate >= range.start && expenseDate < range.end;
      });
    }

    const scoped = filterByAccess(records, auth);

    if (scoped.length === 0) {
      return [];
    }

    const reportIds = scoped
      .map((expense) => expense.report_id)
      .filter((id): id is Id<"reports"> => id !== null && id !== undefined);

    const [churchMap, reportMap] = await Promise.all([
      loadChurchMap(ctx, scoped.map((expense) => expense.church_id)),
      loadReportMap(ctx, reportIds),
    ]);

    const serialized = scoped.map((expense) =>
      serializeExpense(
        expense,
        churchMap.get(expense.church_id) ?? null,
        expense.report_id ? reportMap.get(expense.report_id) ?? null : null
      )
    );

    serialized.sort((a, b) => b.date.localeCompare(a.date));
    return serialized;
  },
});

export const getCategoryTotals = query({
  args: {
    church_id: v.optional(v.id("churches")),
    month: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<CategoryTotalsRow[]> => {
    const auth = await getAuthContext(ctx);
    requireMinRole(auth, "treasurer");

    if (args.church_id && !isAdmin(auth)) {
      requireChurch(auth, args.church_id);
    }

    const range = getPeriodRange(args.month ?? undefined, args.year ?? undefined);

    let records: ExpenseDoc[];
    if (args.church_id) {
      records = await ctx.db
        .query("expense_records")
        .withIndex("by_church", (q) =>
          q.eq("church_id", args.church_id as Id<"churches">)
        )
        .collect();
    } else if (range) {
      records = await ctx.db
        .query("expense_records")
        .withIndex("by_date", (q) =>
          q.gte("date", range.start).lt("date", range.end)
        )
        .collect();
    } else {
      records = await ctx.db.query("expense_records").collect();
    }

    if (range) {
      records = records.filter((expense) => {
        const expenseDate = resolveExpenseDate(expense);
        return expenseDate >= range.start && expenseDate < range.end;
      });
    }

    const scoped = filterByAccess(records, auth);

    const totals = new Map<string, CategoryTotalsRow>();

    for (const expense of scoped) {
      const key = expense.category ?? "Sin categoría";
      const entry = totals.get(key) ?? { category: key, count: 0, total: 0 };
      entry.count += 1;
      entry.total += expense.amount ?? expense.total_factura;
      totals.set(key, entry);
    }

    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  },
});

