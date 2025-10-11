import { type NextRequest, NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/auth-context";
import { setCORSHeaders } from "@/lib/cors";
import type { ApiResponse } from "@/types/utils";
import { getAuthenticatedConvexClient } from "@/lib/convex-server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getChurchConvexId } from "@/lib/convex-id-mapping";

interface MonthlyLedger {
  id?: number;
  church_id: number;
  month: number;
  year: number;
  opening_balance: number;
  closing_balance: number;
  total_income: number;
  total_expenses: number;
  status: "open" | "closed" | "reconciled";
  closed_at?: string;
  closed_by?: string;
  notes?: string;
}

interface ExpenseRecord {
  id?: number;
  church_id: number;
  date: string;
  concept: string;
  category: string;
  amount: number;
  provider?: string;
  document_number?: string;
  approved_by?: string;
  notes?: string;
}

interface AccountingEntry {
  id?: number;
  church_id: number;
  date: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance?: number;
  reference?: string;
  description: string;
}

type ExpenseCreatePayload = {
  church_id: number;
  date: string;
  concept: string;
  category: string;
  amount: number;
  provider?: string | null;
  document_number?: string | null;
  approved_by?: string | null;
  notes?: string | null;
};

type AccountingEntryPayload = {
  church_id: number;
  date: string;
  account_code: string;
  account_name: string;
  debit?: number;
  credit?: number;
  reference?: string | null;
  description: string;
};

type AccountingEntriesRequest = { entries: AccountingEntryPayload[] } | AccountingEntryPayload;

type LedgerOpenPayload = {
  church_id: number;
  month: number;
  year: number;
};

type LedgerClosePayload = LedgerOpenPayload & {
  notes?: string | null;
};

type AccountingAction = "expense" | "entry" | "open_ledger" | "close_ledger";

const corsJson = <T extends ApiResponse<unknown>>(
  payload: T,
  init?: ResponseInit,
): NextResponse => {
  const response = NextResponse.json(payload, init);
  setCORSHeaders(response);
  return response;
};

const corsError = (message: string, status: number, details?: unknown): NextResponse =>
  corsJson<ApiResponse<never>>(
    {
      success: false,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );

type LedgerStatus = "open" | "closed" | "reconciled";

const ACCOUNTING_STATUSES: ReadonlySet<LedgerStatus> = new Set([
  "open",
  "closed",
  "reconciled",
]);

interface ConvexQueryParams {
  type: string;
  churchIdParam: string | null;
  monthParam: string | null;
  yearParam: string | null;
  statusParam: string | null;
}

function parseOptionalInt(value: string | null): { valid: boolean; value: number | null } {
  if (value === null || value.trim().length === 0) {
    return { valid: true, value: null };
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return { valid: false, value: null };
  }

  return { valid: true, value: parsed };
}

function parseStatusParam(value: string | null): { valid: boolean; value: LedgerStatus | undefined } {
  if (value === null || value.trim().length === 0) {
    return { valid: true, value: undefined };
  }

  const normalized = value.trim().toLowerCase();
  if (ACCOUNTING_STATUSES.has(normalized as LedgerStatus)) {
    return { valid: true, value: normalized as LedgerStatus };
  }

  return { valid: false, value: undefined };
}

function normalizeDateInput(input: string): string {
  const timestamp = Date.parse(input);
  if (Number.isNaN(timestamp)) {
    throw new Error("Invalid date format");
  }
  return new Date(timestamp).toISOString();
}

type ConvexLedgerResponse = {
  id: number | null;
  convex_id: string;
  month: number;
  year: number;
  opening_balance: number;
  closing_balance: number;
  total_income: number;
  total_expenses: number;
  status: LedgerStatus;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
};

type ConvexEntryResponse = {
  id: number | null;
  convex_id: string;
  date: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number | null;
  reference: string | null;
  description: string;
};


function mapLedgerResponseToLegacy(
  ledger: ConvexLedgerResponse,
  churchId: number
): MonthlyLedger {
  return {
    ...(ledger.id !== null ? { id: ledger.id } : {}),
    church_id: churchId,
    month: ledger.month,
    year: ledger.year,
    opening_balance: ledger.opening_balance,
    closing_balance: ledger.closing_balance,
    total_income: ledger.total_income,
    total_expenses: ledger.total_expenses,
    status: ledger.status,
    ...(ledger.closed_at !== null ? { closed_at: ledger.closed_at } : {}),
    ...(ledger.closed_by !== null ? { closed_by: ledger.closed_by } : {}),
    ...(ledger.notes !== null ? { notes: ledger.notes } : {}),
  };
}

function mapEntryResponseToLegacy(
  entry: ConvexEntryResponse,
  fallbackChurchId: number
): AccountingEntry {
  return {
    ...(entry.id !== null ? { id: entry.id } : {}),
    church_id: fallbackChurchId,
    date: entry.date,
    account_code: entry.account_code,
    account_name: entry.account_name,
    debit: entry.debit,
    credit: entry.credit,
    ...(entry.balance !== null ? { balance: entry.balance } : {}),
    ...(entry.reference !== null ? { reference: entry.reference } : {}),
    description: entry.description,
  };
}

function buildLegacyExpenseResponse(
  payload: ExpenseCreatePayload,
  userEmail: string
): ExpenseRecord {
  return {
    id: 0,
    church_id: payload.church_id,
    date: normalizeDateInput(payload.date),
    concept: payload.concept,
    category: payload.category,
    amount: payload.amount,
    ...(payload.provider !== null && payload.provider !== undefined ? { provider: payload.provider } : {}),
    ...(payload.document_number !== null && payload.document_number !== undefined ? { document_number: payload.document_number } : {}),
    approved_by: payload.approved_by ?? userEmail,
    ...(payload.notes !== null && payload.notes !== undefined ? { notes: payload.notes } : {}),
  };
}

// GET /api/accounting - Get accounting records
async function handleGet(req: NextRequest) {
  try {
    const _auth = await getAuthContext(); // Auth context available for future server-side checks
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "ledger";
    const churchIdParam = searchParams.get("church_id");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");
    const statusParam = searchParams.get("status");

    return await handleGetConvex({
      type,
      churchIdParam,
      monthParam,
      yearParam,
      statusParam,
    });
  } catch (error) {
    console.error("Error in accounting GET:", error);
    return corsError(
      "Error fetching accounting data",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

async function handleGetConvex({
  type,
  churchIdParam,
  monthParam,
  yearParam,
  statusParam,
}: ConvexQueryParams): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();

    const churchResult = parseOptionalInt(churchIdParam);
    if (!churchResult.valid) {
      return corsError("Invalid church_id parameter", 400);
    }

    const monthResult = parseOptionalInt(monthParam);
    if (
      !monthResult.valid ||
      (monthResult.value !== null && (monthResult.value < 1 || monthResult.value > 12))
    ) {
      return corsError("Invalid month parameter", 400);
    }

    const yearResult = parseOptionalInt(yearParam);
    if (!yearResult.valid || (yearResult.value !== null && yearResult.value < 0)) {
      return corsError("Invalid year parameter", 400);
    }

    const statusResult = parseStatusParam(statusParam);
    if (!statusResult.valid) {
      return corsError("Invalid status parameter", 400);
    }

    let churchConvexId: Id<"churches"> | undefined;
    if (churchResult.value !== null) {
      if (churchResult.value <= 0) {
        return corsError("Invalid church_id parameter", 400);
      }

      const lookup = await getChurchConvexId(client, churchResult.value);
      if (!lookup) {
        return corsError("Church not found", 404);
      }
      churchConvexId = lookup;
    }

    switch (type) {
      case "summary": {
        const args = {
          ...(churchConvexId ? { church_id: churchConvexId } : {}),
          ...(monthResult.value !== null ? { month: monthResult.value } : {}),
          ...(yearResult.value !== null ? { year: yearResult.value } : {}),
        };

        const summary = await client.query(api.accounting.getSummary, args);
        return corsJson({
          success: true,
          data: summary,
        });
      }
      case "ledger": {
        const args = {
          ...(churchConvexId ? { church_id: churchConvexId } : {}),
          ...(monthResult.value !== null ? { month: monthResult.value } : {}),
          ...(yearResult.value !== null ? { year: yearResult.value } : {}),
          ...(statusResult.value ? { status: statusResult.value } : {}),
        };

        const ledgers = await client.query(api.monthlyLedgers.listLedgers, args);
        return corsJson({
          success: true,
          data: ledgers,
        });
      }
      case "expenses": {
        const args = {
          ...(churchConvexId ? { church_id: churchConvexId } : {}),
          ...(monthResult.value !== null ? { month: monthResult.value } : {}),
          ...(yearResult.value !== null ? { year: yearResult.value } : {}),
        };

        const [expenses, categoryTotals] = await Promise.all([
          client.query(api.expenseRecords.listExpenses, args),
          client.query(api.expenseRecords.getCategoryTotals, args),
        ]);

        return corsJson({
          success: true,
          data: expenses,
          categoryTotals,
        });
      }
      case "entries": {
        const args = {
          ...(churchConvexId ? { church_id: churchConvexId } : {}),
          ...(monthResult.value !== null ? { month: monthResult.value } : {}),
          ...(yearResult.value !== null ? { year: yearResult.value } : {}),
        };

        const [entries, trialBalance] = await Promise.all([
          client.query(api.accountingEntries.listEntries, args),
          client.query(api.accountingEntries.getTrialBalance, args),
        ]);

        return corsJson({
          success: true,
          data: entries,
          trialBalance,
        });
      }
      default:
        return corsError("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Error fetching accounting data from Convex:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = message.toLowerCase().includes("no autenticado") ? 401 : 500;
    return corsError("Error fetching accounting data", statusCode, message);
  }
}

// POST /api/accounting - Create accounting records
async function handlePost(req: NextRequest) {
  try {
    const user = await getAuthContext();
    if (!user) {
      return corsError("Authentication required", 401);
    }

    const rawBody = await req.json();
    if (typeof rawBody !== "object" || rawBody === null) {
      return corsError("Invalid request payload", 400);
    }

    const body = rawBody as Record<string, unknown>;
    const action = (typeof body['type'] === "string" ? body['type'] : "expense") as AccountingAction;

    return await handlePostConvex(user, action, body);
  } catch (error) {
    console.error("Error in accounting POST:", error);
    return corsError(
      "Error creating accounting record",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

async function handlePostConvex(
  user: AuthContext,
  action: AccountingAction,
  rawBody: Record<string, unknown>
): Promise<NextResponse> {
  const client = await getAuthenticatedConvexClient();

  try {
    switch (action) {
      case "expense":
        return await createExpenseConvex(client, rawBody as ExpenseCreatePayload, user.email || "");
      case "entry":
        return await createAccountingEntryConvex(client, rawBody as AccountingEntriesRequest);
      case "open_ledger":
        return await openMonthlyLedgerConvex(client, rawBody as LedgerOpenPayload);
      case "close_ledger":
        return await closeMonthlyLedgerConvex(client, rawBody as LedgerClosePayload);
      default:
        return corsError("Invalid type", 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Convex accounting POST failed:", error);
    return corsError(message, 400, message);
  }
}

async function createExpenseConvex(
  client: Awaited<ReturnType<typeof getAuthenticatedConvexClient>>,
  data: ExpenseCreatePayload,
  userEmail: string
): Promise<NextResponse> {
  const required: Array<keyof ExpenseCreatePayload> = [
    "church_id",
    "date",
    "concept",
    "category",
    "amount",
  ];

  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      return corsError(`${field as string} is required`, 400);
    }
  }

  const churchConvexId = await getChurchConvexId(client, data.church_id);
  if (!churchConvexId) {
    return corsError("Church not found", 404);
  }

  const isoDate = normalizeDateInput(String(data.date));

  // Build args object with conditional spreads from the start to avoid type inference issues
  const convexArgs = {
    church_id: churchConvexId,
    date: isoDate,
    concept: data.concept,
    category: data.category,
    amount: data.amount,
    ...(data.provider !== null && data.provider !== undefined ? { provider: data.provider } : {}),
    ...(data.document_number !== null && data.document_number !== undefined ? { document_number: data.document_number } : {}),
    ...(data.approved_by ?? userEmail ? { approved_by: data.approved_by ?? userEmail } : {}),
    ...(data.notes !== null && data.notes !== undefined ? { notes: data.notes } : {}),
  };

  const result = await client.mutation(api.accountingEntries.createExpenseWithEntry, convexArgs);

  const legacyExpense = buildLegacyExpenseResponse({ ...data, date: isoDate }, userEmail);

  return corsJson<ApiResponse<ExpenseRecord> & { message: string; meta: Record<string, unknown> }>(
    {
      success: true,
      data: legacyExpense,
      message: "Expense record created successfully",
      meta: {
        expenseConvexId: result.expense.convex_id,
        accountingEntryConvexId: result.entry.convex_id,
      },
    },
    { status: 201 }
  );
}

async function createAccountingEntryConvex(
  client: Awaited<ReturnType<typeof getAuthenticatedConvexClient>>,
  body: AccountingEntriesRequest
): Promise<NextResponse> {
  let entries: AccountingEntryPayload[];

  if ("entries" in body) {
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return corsError("entries must be a non-empty array", 400);
    }
    entries = body.entries;
  } else {
    entries = [body];
  }

  const requiredEntryFields: Array<keyof AccountingEntryPayload> = [
    "church_id",
    "date",
    "account_code",
    "account_name",
    "description",
  ];

  for (const entry of entries) {
    for (const field of requiredEntryFields) {
      if (entry[field] === undefined || entry[field] === null || entry[field] === "") {
        return corsError(`Entry field ${field as string} is required`, 400);
      }
    }
  }

  const uniqueChurchIds = Array.from(new Set(entries.map((entry) => entry.church_id)));
  const convexChurchMap = new Map<number, Id<"churches">>();

  for (const churchId of uniqueChurchIds) {
    if (typeof churchId !== "number" || Number.isNaN(churchId)) {
      return corsError("Invalid church_id", 400);
    }
    const convexId = await getChurchConvexId(client, churchId);
    if (!convexId) {
      return corsError(`Church ${churchId} not found`, 404);
    }
    convexChurchMap.set(churchId, convexId);
  }

  const convexPayload: Array<{
    church_id: Id<"churches">;
    date: string;
    account_code: string;
    account_name: string;
    debit?: number;
    credit?: number;
    reference?: string;
    description: string;
    expense_record_id?: Id<"expense_records">;
    report_id?: Id<"reports">;
  }> = [];

  for (const entry of entries) {
    const convexId = convexChurchMap.get(entry.church_id);
    if (!convexId) {
      return corsError(`Church ${entry.church_id} not found`, 404);
    }

    const entryPayload: {
      church_id: Id<"churches">;
      date: string;
      account_code: string;
      account_name: string;
      description: string;
      debit?: number;
      credit?: number;
      reference?: string;
      expense_record_id?: Id<"expense_records">;
      report_id?: Id<"reports">;
    } = {
      church_id: convexId,
      date: normalizeDateInput(String(entry.date)),
      account_code: entry.account_code,
      account_name: entry.account_name,
      description: entry.description,
      ...(entry.debit !== undefined ? { debit: entry.debit } : {}),
      ...(entry.credit !== undefined ? { credit: entry.credit } : {}),
      ...(entry.reference !== null && entry.reference !== undefined ? { reference: entry.reference } : {}),
    };

    convexPayload.push(entryPayload);
  }

  const result = await client.mutation(api.accountingEntries.createEntries, {
    entries: convexPayload,
  });

  const legacyEntries = result.map((entry, index) => {
    const originalEntry = entries[index];
    if (!originalEntry) {
      throw new Error(`Missing original entry at index ${index}`);
    }
    return mapEntryResponseToLegacy(entry, originalEntry.church_id);
  });

  return corsJson<ApiResponse<typeof legacyEntries> & { message: string }>(
    {
      success: true,
      data: legacyEntries,
      message: `Created ${legacyEntries.length} accounting entries`,
    },
    { status: 201 }
  );
}

async function openMonthlyLedgerConvex(
  client: Awaited<ReturnType<typeof getAuthenticatedConvexClient>>,
  payload: LedgerOpenPayload
): Promise<NextResponse> {
  const { church_id, month, year } = payload;

  if (!church_id || !month || !year) {
    return corsError("church_id, month, and year are required", 400);
  }

  const churchConvexId = await getChurchConvexId(client, church_id);
  if (!churchConvexId) {
    return corsError("Church not found", 404);
  }

  const ledger = await client.mutation(api.monthlyLedgers.openLedger, {
    church_id: churchConvexId,
    month,
    year,
  });

  return corsJson<ApiResponse<MonthlyLedger> & { message: string }>(
    {
      success: true,
      data: mapLedgerResponseToLegacy(ledger, church_id),
      message: "Monthly ledger opened successfully",
    },
    { status: 201 }
  );
}

async function closeMonthlyLedgerConvex(
  client: Awaited<ReturnType<typeof getAuthenticatedConvexClient>>,
  payload: LedgerClosePayload
): Promise<NextResponse> {
  const { church_id, month, year } = payload;

  if (!church_id || !month || !year) {
    return corsError("church_id, month, and year are required", 400);
  }

  const churchConvexId = await getChurchConvexId(client, church_id);
  if (!churchConvexId) {
    return corsError("Church not found", 404);
  }

  // Build args object with conditional spreads from the start to avoid type inference issues
  const closeArgs = {
    church_id: churchConvexId,
    month,
    year,
    ...(payload.notes !== null && payload.notes !== undefined ? { notes: payload.notes } : {}),
  };

  const ledger = await client.mutation(api.monthlyLedgers.closeLedger, closeArgs);

  return corsJson<ApiResponse<MonthlyLedger> & { message: string }>(
    {
      success: true,
      data: mapLedgerResponseToLegacy(ledger, church_id),
      message: "Monthly ledger closed successfully",
    },
    { status: 200 }
  );
}

// OPTIONS handler for CORS
export async function OPTIONS(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleGet(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handlePost(req);
}
