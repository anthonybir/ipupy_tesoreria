import { type NextRequest, NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/auth-context";
import { executeWithContext } from "@/lib/db";
import { firstOrDefault, firstOrNull, expectOne } from "@/lib/db-helpers";
import { setCORSHeaders } from "@/lib/cors";

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

// GET /api/accounting - Get accounting records
async function handleGet(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "ledger";
    const church_id = searchParams.get("church_id");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const status = searchParams.get("status");

    switch (type) {
      case "ledger":
        return await getMonthlyLedger(auth, church_id, month, year, status);
      case "expenses":
        return await getExpenses(auth, church_id, month, year);
      case "entries":
        return await getAccountingEntries(auth, church_id, month, year);
      case "summary":
        return await getAccountingSummary(auth, church_id, month, year);
      default:
        const response = NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
        setCORSHeaders(response);
        return response;
    }
  } catch (error) {
    console.error("Error in accounting GET:", error);
    const response = NextResponse.json(
      { error: "Error fetching accounting data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// Get monthly ledger records
async function getMonthlyLedger(
  auth: AuthContext | null,
  church_id: string | null,
  month: string | null,
  year: string | null,
  status: string | null,
) {
  let query = `
    SELECT
      ml.*,
      c.name as church_name,
      c.city as church_city
    FROM monthly_ledger ml
    JOIN churches c ON ml.church_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  let paramCount = 0;

  if (church_id) {
    paramCount++;
    query += ` AND ml.church_id = $${paramCount}`;
    params.push(church_id);
  }

  if (month) {
    paramCount++;
    query += ` AND ml.month = $${paramCount}`;
    params.push(month);
  }

  if (year) {
    paramCount++;
    query += ` AND ml.year = $${paramCount}`;
    params.push(year);
  }

  if (status) {
    paramCount++;
    query += ` AND ml.status = $${paramCount}`;
    params.push(status);
  }

  query += ` ORDER BY ml.year DESC, ml.month DESC, c.name ASC`;

  const result = await executeWithContext(auth, query, params);

  const response = NextResponse.json({
    success: true,
    data: result.rows
  });

  setCORSHeaders(response);
  return response;
}

// Get expense records
async function getExpenses(
  auth: AuthContext | null,
  church_id: string | null,
  month: string | null,
  year: string | null,
) {
  const filters: string[] = [];
  const values: (string | number)[] = [];

  if (church_id) {
    values.push(church_id);
    filters.push(`e.church_id = $${values.length}`);
  }

  if (month && year) {
    values.push(month);
    filters.push(`EXTRACT(MONTH FROM e.date) = $${values.length}`);
    values.push(year);
    filters.push(`EXTRACT(YEAR FROM e.date) = $${values.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await executeWithContext(auth, 
    `
    SELECT
      e.*,
      c.name as church_name
    FROM expense_records e
    JOIN churches c ON e.church_id = c.id
    ${whereClause}
    ORDER BY e.date DESC, e.created_at DESC
  `,
    values
  );

  const categoryTotals = await executeWithContext(auth, 
    `
    SELECT
      category,
      COUNT(*) as count,
      SUM(amount) as total
    FROM expense_records e
    ${whereClause}
    GROUP BY category
    ORDER BY total DESC
  `,
    values
  );

  const response = NextResponse.json({
    success: true,
    data: result.rows,
    categoryTotals: categoryTotals.rows
  });

  setCORSHeaders(response);
  return response;
}

// Get accounting entries (double-entry bookkeeping)
async function getAccountingEntries(
  auth: AuthContext | null,
  church_id: string | null,
  month: string | null,
  year: string | null,
) {
  const filters: string[] = [];
  const values: (string | number)[] = [];

  if (church_id) {
    values.push(church_id);
    filters.push(`ae.church_id = $${values.length}`);
  }

  if (month && year) {
    values.push(month);
    filters.push(`EXTRACT(MONTH FROM ae.date) = $${values.length}`);
    values.push(year);
    filters.push(`EXTRACT(YEAR FROM ae.date) = $${values.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await executeWithContext(auth, 
    `
    SELECT
      ae.*,
      c.name as church_name
    FROM accounting_entries ae
    JOIN churches c ON ae.church_id = c.id
    ${whereClause}
    ORDER BY ae.date DESC, ae.id DESC
  `,
    values
  );

  const trialBalance = await executeWithContext(auth, 
    `
    SELECT
      account_code,
      account_name,
      SUM(debit) as total_debit,
      SUM(credit) as total_credit,
      SUM(debit - credit) as balance
    FROM accounting_entries ae
    ${whereClause}
    GROUP BY account_code, account_name
    ORDER BY account_code
  `,
    values
  );

  const response = NextResponse.json({
    success: true,
    data: result.rows,
    trialBalance: trialBalance.rows
  });

  setCORSHeaders(response);
  return response;
}

// Get accounting summary for a period
async function getAccountingSummary(
  auth: AuthContext | null,
  church_id: string | null,
  month: string | null,
  year: string | null,
) {
  const reportFilters: string[] = [];
  const reportValues: (string | number)[] = [];

  if (church_id) {
    reportValues.push(church_id);
    reportFilters.push(`church_id = $${reportValues.length}`);
  }

  if (month && year) {
    reportValues.push(month);
    reportFilters.push(`month = $${reportValues.length}`);
    reportValues.push(year);
    reportFilters.push(`year = $${reportValues.length}`);
  }

  const reportWhere = reportFilters.length > 0 ? `WHERE ${reportFilters.join(" AND ")}` : "";

  const income = await executeWithContext(auth, 
    `
    SELECT
      SUM(diezmos) as total_diezmos,
      SUM(ofrendas) as total_ofrendas,
      SUM(anexos) as total_anexos,
      SUM(total_entradas) as total_income,
      COUNT(*) as report_count
    FROM reports
    ${reportWhere}
  `,
    reportValues
  );

  const expenseFilters: string[] = [];
  const expenseValues: (string | number)[] = [];

  if (church_id) {
    expenseValues.push(church_id);
    expenseFilters.push(`church_id = $${expenseValues.length}`);
  }

  if (month && year) {
    expenseValues.push(month);
    expenseFilters.push(`EXTRACT(MONTH FROM date) = $${expenseValues.length}`);
    expenseValues.push(year);
    expenseFilters.push(`EXTRACT(YEAR FROM date) = $${expenseValues.length}`);
  }

  const expenseWhere = expenseFilters.length > 0 ? `WHERE ${expenseFilters.join(" AND ")}` : "";

  const expenses = await executeWithContext(auth, 
    `
    SELECT
      SUM(amount) as total_expenses,
      COUNT(*) as expense_count
    FROM expense_records
    ${expenseWhere}
  `,
    expenseValues
  );

  const movementFilters: string[] = [];
  const movementValues: (string | number)[] = [];

  if (church_id) {
    movementValues.push(church_id);
    movementFilters.push(`r.church_id = $${movementValues.length}`);
  }

  if (month && year) {
    movementValues.push(month);
    movementFilters.push(`r.month = $${movementValues.length}`);
    movementValues.push(year);
    movementFilters.push(`r.year = $${movementValues.length}`);
  }

  const movementWhere = movementFilters.length > 0 ? `WHERE ${movementFilters.join(" AND ")}` : "";

  const movements = await executeWithContext(auth, 
    `
    SELECT
      SUM(amount) as total_movements,
      COUNT(*) as movement_count
    FROM fund_movements fm
    JOIN reports r ON fm.report_id = r.id
    ${movementWhere}
  `,
    movementValues
  );

  const ledgerFilters: string[] = [];
  const ledgerValues: (string | number)[] = [];

  if (church_id) {
    ledgerValues.push(church_id);
    ledgerFilters.push(`church_id = $${ledgerValues.length}`);
  }

  if (month && year) {
    ledgerValues.push(month);
    ledgerFilters.push(`month = $${ledgerValues.length}`);
    ledgerValues.push(year);
    ledgerFilters.push(`year = $${ledgerValues.length}`);
  }

  const ledgerWhere = ledgerFilters.length > 0 ? `WHERE ${ledgerFilters.join(" AND ")}` : "";

  const ledger = await executeWithContext(auth, 
    `
    SELECT
      status,
      opening_balance,
      closing_balance,
      closed_at,
      closed_by
    FROM monthly_ledger
    ${ledgerWhere}
    ORDER BY id DESC
    LIMIT 1
  `,
    ledgerValues
  );

  const incomeRow = firstOrDefault(income.rows, {});
  const expensesRow = firstOrDefault(expenses.rows, {});
  const movementsRow = firstOrDefault(movements.rows, {});
  const ledgerRow = firstOrDefault(ledger.rows, { status: "not_created" });

  const response = NextResponse.json({
    success: true,
    summary: {
      income: incomeRow,
      expenses: expensesRow,
      movements: movementsRow,
      ledger: ledgerRow,
      netResult: Number(incomeRow['total_income'] || 0) - Number(expensesRow['total_expenses'] || 0)
    }
  });

  setCORSHeaders(response);
  return response;
}

// POST /api/accounting - Create accounting records
async function handlePost(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const rawBody = await req.json();
    if (typeof rawBody !== "object" || rawBody === null) {
      const response = NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    const body = rawBody as Record<string, unknown>;
    const action = (typeof body['type'] === "string" ? body['type'] : "expense") as AccountingAction;

    switch (action) {
      case "expense":
        return await createExpense(user, body as ExpenseCreatePayload, user.email || "");
      case "entry":
        return await createAccountingEntry(user, body as AccountingEntriesRequest, user.email || "");
      case "open_ledger":
        return await openMonthlyLedger(user, body as LedgerOpenPayload, user.email || "");
      case "close_ledger":
        return await closeMonthlyLedger(user, body as LedgerClosePayload, user.email || "");
      default:
        const response = NextResponse.json({ error: "Invalid type" }, { status: 400 });
        setCORSHeaders(response);
        return response;
    }
  } catch (error) {
    console.error("Error in accounting POST:", error);
    const response = NextResponse.json(
      { error: "Error creating accounting record", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// Create expense record
async function createExpense(auth: AuthContext | null, data: ExpenseCreatePayload, userEmail: string) {
  const required: Array<keyof ExpenseCreatePayload> = [
    "church_id",
    "date",
    "concept",
    "category",
    "amount",
  ];

  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      const response = NextResponse.json({ error: `${field as string} is required` }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }
  }

  const result = await executeWithContext<ExpenseRecord>(auth,
    `INSERT INTO expense_records (
      church_id, date, concept, category, amount,
      provider, document_number, approved_by, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      data.church_id,
      data.date,
      data.concept,
      data.category,
      data.amount,
      data.provider ?? null,
      data.document_number ?? null,
      data.approved_by ?? userEmail,
      data.notes ?? null,
      userEmail
    ]
  );

  // Create corresponding accounting entry
  await executeWithContext(auth, 
    `INSERT INTO accounting_entries (
      church_id, date, account_code, account_name,
      debit, credit, reference, description, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      data.church_id,
      data.date,
      "5000", // Expense account code
      data.category,
      data.amount,
      0,
      `EXP-${expectOne(result.rows).id}`,
      data.concept,
      userEmail
    ]
  );

  const response = NextResponse.json({
    success: true,
    data: expectOne(result.rows),
    message: "Expense record created successfully"
  }, { status: 201 });

  setCORSHeaders(response);
  return response;
}

// Create accounting entry (double-entry)
async function createAccountingEntry(auth: AuthContext | null, data: AccountingEntriesRequest, userEmail: string) {
  let entries: AccountingEntryPayload[];

  if ("entries" in data) {
    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      const response = NextResponse.json({ error: "entries must be a non-empty array" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }
    entries = data.entries;
  } else {
    entries = [data];
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
        const response = NextResponse.json({ error: `Entry field ${field as string} is required` }, { status: 400 });
        setCORSHeaders(response);
        return response;
      }
    }
  }

  const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit ?? 0), 0);
  const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit ?? 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    const response = NextResponse.json({
      error: "Debits must equal credits",
      totalDebit,
      totalCredit
    }, { status: 400 });
    setCORSHeaders(response);
    return response;
  }

  const results: AccountingEntry[] = [];

  for (const entry of entries) {
    const result = await executeWithContext<AccountingEntry>(auth,
      `INSERT INTO accounting_entries (
        church_id, date, account_code, account_name,
        debit, credit, reference, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        entry.church_id,
        entry.date,
        entry.account_code,
        entry.account_name,
        entry.debit ?? 0,
        entry.credit ?? 0,
        entry.reference ?? null,
        entry.description,
        userEmail
      ]
    );
    const row = expectOne(result.rows);
    results.push(row);
  }

  const response = NextResponse.json({
    success: true,
    data: results,
    message: `Created ${results.length} accounting entries`
  }, { status: 201 });

  setCORSHeaders(response);
  return response;
}

// Open monthly ledger
async function openMonthlyLedger(auth: AuthContext | null, data: LedgerOpenPayload, userEmail: string) {
  const { church_id, month, year } = data;

  if (!church_id || !month || !year) {
    const response = NextResponse.json({ error: "church_id, month, and year are required" }, { status: 400 });
    setCORSHeaders(response);
    return response;
  }

  // Check if ledger already exists
  const existing = await executeWithContext(auth, 
    `SELECT id, status FROM monthly_ledger WHERE church_id = $1 AND month = $2 AND year = $3`,
    [church_id, month, year]
  );

  const existingRow = firstOrNull(existing.rows);
  if (existingRow) {
    const response = NextResponse.json({
      error: `Ledger already exists with status: ${existingRow['status'] || 'unknown'}`
    }, { status: 409 });
    setCORSHeaders(response);
    return response;
  }

  // Get previous month's closing balance
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const previous = await executeWithContext(auth,
    `SELECT closing_balance FROM monthly_ledger
     WHERE church_id = $1 AND month = $2 AND year = $3`,
    [church_id, prevMonth, prevYear]
  );

  const previousRow = firstOrNull(previous.rows);
  const openingBalance = previousRow?.['closing_balance'] || 0;

  // Create new ledger
  const result = await executeWithContext<MonthlyLedger>(auth,
    `INSERT INTO monthly_ledger (
      church_id, month, year, opening_balance,
      closing_balance, total_income, total_expenses,
      status, created_by
    ) VALUES ($1, $2, $3, $4, $5, 0, 0, 'open', $6)
    RETURNING *`,
    [church_id, month, year, openingBalance, openingBalance, userEmail]
  );

  const response = NextResponse.json({
    success: true,
    data: expectOne(result.rows),
    message: "Monthly ledger opened successfully"
  }, { status: 201 });

  setCORSHeaders(response);
  return response;
}

// Close monthly ledger
async function closeMonthlyLedger(auth: AuthContext | null, data: LedgerClosePayload, userEmail: string) {
  const { church_id, month, year, notes } = data;

  if (!church_id || !month || !year) {
    const response = NextResponse.json({ error: "church_id, month, and year are required" }, { status: 400 });
    setCORSHeaders(response);
    return response;
  }

  // Get ledger
  const ledger = await executeWithContext(auth, 
    `SELECT * FROM monthly_ledger WHERE church_id = $1 AND month = $2 AND year = $3`,
    [church_id, month, year]
  );

  const ledgerRow = firstOrNull(ledger.rows);
  if (!ledgerRow) {
    const response = NextResponse.json({ error: "Ledger not found" }, { status: 404 });
    setCORSHeaders(response);
    return response;
  }

  if (ledgerRow['status'] === "closed") {
    const response = NextResponse.json({ error: "Ledger is already closed" }, { status: 409 });
    setCORSHeaders(response);
    return response;
  }

  // Calculate totals
  const income = await executeWithContext(auth,
    `SELECT SUM(total_entradas) as total FROM reports
     WHERE church_id = $1 AND month = $2 AND year = $3`,
    [church_id, month, year]
  );

  const expenses = await executeWithContext(auth,
    `SELECT SUM(amount) as total FROM expense_records
     WHERE church_id = $1
     AND EXTRACT(MONTH FROM date) = $2
     AND EXTRACT(YEAR FROM date) = $3`,
    [church_id, month, year]
  );

  const incomeRow = firstOrNull(income.rows);
  const expensesRow = firstOrNull(expenses.rows);
  const totalIncome = Number(incomeRow?.['total'] || 0);
  const totalExpenses = Number(expensesRow?.['total'] || 0);
  const closingBalance = parseFloat(String(ledgerRow['opening_balance'])) + totalIncome - totalExpenses;

  // Update ledger
  const result = await executeWithContext<MonthlyLedger>(auth,
    `UPDATE monthly_ledger SET
      closing_balance = $1,
      total_income = $2,
      total_expenses = $3,
      status = 'closed',
      closed_at = CURRENT_TIMESTAMP,
      closed_by = $4,
      notes = $5
    WHERE church_id = $6 AND month = $7 AND year = $8
    RETURNING *`,
    [
      closingBalance,
      totalIncome,
      totalExpenses,
      userEmail,
      notes ?? null,
      church_id,
      month,
      year
    ]
  );

  const response = NextResponse.json({
    success: true,
    data: expectOne(result.rows),
    message: "Monthly ledger closed successfully"
  });

  setCORSHeaders(response);
  return response;
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