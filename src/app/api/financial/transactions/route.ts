import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { executeWithContext, executeTransaction } from "@/lib/db";
import { setCORSHeaders } from "@/lib/cors";
import { createTransaction as createLedgerTransaction } from "@/app/api/reports/route-helpers";
import { handleApiError } from "@/lib/api-errors";

type GenericRecord = Record<string, unknown>;

interface Transaction {
  id: number;
  date: string;
  fund_id: number;
  fund_name?: string;
  church_id?: number;
  church_name?: string;
  report_id?: number;
  concept: string;
  provider?: string;
  provider_id?: number;
  document_number?: string;
  amount_in: number;
  amount_out: number;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

interface TransactionInput {
  date: string;
  fund_id: number;
  church_id?: number;
  report_id?: number;
  concept: string;
  provider?: string;
  provider_id?: number;
  document_number?: string;
  amount_in?: number;
  amount_out?: number;
}

// GET /api/financial/transactions - Get transactions with filters
async function handleGet(req: NextRequest) {
  try {
    // Require auth context for RLS - financial data should not be public
    const { requireAuth } = await import('@/lib/auth-context');
    const auth = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const fund_id = searchParams.get("fund_id");
    const church_id = searchParams.get("church_id");
    const date_from = searchParams.get("date_from");
    const date_to = searchParams.get("date_to");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";

    const limitNumber = Number.isNaN(Number(limit)) ? 100 : parseInt(limit, 10);
    const offsetNumber = Number.isNaN(Number(offset)) ? 0 : parseInt(offset, 10);

    const filters: string[] = [];
    const filterValues: (string | number)[] = [];

    if (fund_id) {
      filterValues.push(fund_id);
      filters.push(`t.fund_id = $${filterValues.length}`);
    }

    if (church_id) {
      filterValues.push(church_id);
      filters.push(`t.church_id = $${filterValues.length}`);
    }

    if (date_from) {
      filterValues.push(date_from);
      filters.push(`t.date >= $${filterValues.length}`);
    }

    if (date_to) {
      filterValues.push(date_to);
      filters.push(`t.date <= $${filterValues.length}`);
    }

    if (month && year) {
      filterValues.push(month);
      filters.push(`EXTRACT(MONTH FROM t.date) = $${filterValues.length}`);
      filterValues.push(year);
      filters.push(`EXTRACT(YEAR FROM t.date) = $${filterValues.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const listQuery = `
      SELECT
        t.*,
        f.name as fund_name,
        c.name as church_name
      FROM transactions t
      LEFT JOIN funds f ON t.fund_id = f.id
      LEFT JOIN churches c ON t.church_id = c.id
      ${whereClause}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $${filterValues.length + 1}
      OFFSET $${filterValues.length + 2}
    `;

    const result = await executeWithContext<Transaction>(auth, listQuery, [...filterValues, limitNumber, offsetNumber]);

    const totalsQuery = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(amount_in), 0) as total_in,
        COALESCE(SUM(amount_out), 0) as total_out
      FROM transactions t
      ${whereClause}
    `;

    const totals = await executeWithContext<{
      total_count: string;
      total_in: string;
      total_out: string
    }>(auth, totalsQuery, filterValues);

    const response = NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(totals.rows[0].total_count)
      },
      totals: {
        count: parseInt(totals.rows[0].total_count),
        total_in: parseFloat(totals.rows[0].total_in),
        total_out: parseFloat(totals.rows[0].total_out),
        balance: parseFloat(totals.rows[0].total_in) - parseFloat(totals.rows[0].total_out)
      }
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/financial/transactions');
  }
}

// POST /api/financial/transactions - Create transaction(s)
async function handlePost(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    if (user.role === 'fund_director') {
      const response = NextResponse.json({ error: "Fund directors have read-only access" }, { status: 403 });
      setCORSHeaders(response);
      return response;
    }

    const body = await req.json();
    const transactions = Array.isArray(body) ? body : [body];

    if (transactions.length === 0) {
      const response = NextResponse.json({ error: "No transactions to create" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    const results: GenericRecord[] = [];
    const errors: { transaction: unknown; error: string }[] = [];

    for (const transaction of transactions) {
      try {
        // Validate required fields
        if (!transaction.date || !transaction.fund_id || !transaction.concept) {
          errors.push({
            transaction,
            error: "Missing required fields: date, fund_id, concept"
          });
          continue;
        }

        // Validate amounts
        const amountIn = parseFloat(transaction.amount_in || 0);
        const amountOut = parseFloat(transaction.amount_out || 0);

        if ((amountIn === 0 && amountOut === 0) || (amountIn > 0 && amountOut > 0)) {
          errors.push({
            transaction,
            error: "Transaction must have either amount_in or amount_out (not both or neither)"
          });
          continue;
        }

        // Insert transaction using shared helper for consistency
        const createdTransaction = await createLedgerTransaction({
          date: transaction.date,
          fund_id: transaction.fund_id,
          church_id: transaction.church_id ?? null,
          report_id: transaction.report_id ?? null,
          concept: transaction.concept,
          provider: transaction.provider ?? null,
          provider_id: transaction.provider_id ?? null,
          document_number: transaction.document_number ?? null,
          amount_in: amountIn,
          amount_out: amountOut,
          created_by: user.email
        }, user);

        results.push(createdTransaction);
      } catch (error) {
        errors.push({
          transaction,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    const response = NextResponse.json({
      success: errors.length === 0,
      created: results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${results.length} transaction(s)${errors.length > 0 ? `, ${errors.length} failed` : ""}`
    }, { status: errors.length === 0 ? 201 : 207 });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/financial/transactions');
  }
}

// PUT /api/financial/transactions?id=X - Update a transaction
async function handlePut(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    if (user.role === 'fund_director') {
      const response = NextResponse.json({ error: "Fund directors have read-only access" }, { status: 403 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("id");

    if (!transactionId) {
      const response = NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    const body: Partial<TransactionInput> = await req.json();

    // Get existing transaction
    const existing = await executeWithContext<Transaction>(user,
      `SELECT * FROM transactions WHERE id = $1`,
      [transactionId]
    );

    if (existing.rows.length === 0) {
      const response = NextResponse.json({ error: "Transaction not found" }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    const oldTransaction = existing.rows[0];

    // Build update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramCount = 0;

    if (body.date !== undefined) {
      paramCount++;
      updates.push(`date = $${paramCount}`);
      values.push(body.date);
    }

    if (body.concept !== undefined) {
      paramCount++;
      updates.push(`concept = $${paramCount}`);
      values.push(body.concept);
    }

    if (body.provider !== undefined) {
      paramCount++;
      updates.push(`provider = $${paramCount}`);
      values.push(body.provider);
    }

    if (body.document_number !== undefined) {
      paramCount++;
      updates.push(`document_number = $${paramCount}`);
      values.push(body.document_number);
    }

    if (body.amount_in !== undefined || body.amount_out !== undefined) {
      const newAmountIn = body.amount_in ?? oldTransaction.amount_in;
      const newAmountOut = body.amount_out ?? oldTransaction.amount_out;

      paramCount++;
      updates.push(`amount_in = $${paramCount}`);
      values.push(newAmountIn);

      paramCount++;
      updates.push(`amount_out = $${paramCount}`);
      values.push(newAmountOut);

      // Update fund balance difference
      const oldBalance = Number(oldTransaction.amount_in) - Number(oldTransaction.amount_out);
      const newBalance = Number(newAmountIn) - Number(newAmountOut);
      const balanceDiff = newBalance - oldBalance;

      if (balanceDiff !== 0) {
        await executeWithContext(user, 
          `UPDATE funds
           SET current_balance = current_balance + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [balanceDiff, oldTransaction.fund_id]
        );
      }
    }

    if (updates.length === 0) {
      const response = NextResponse.json({ error: "No fields to update" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    paramCount++;
    values.push(transactionId);

    const result = await executeWithContext<Transaction>(user,
      `UPDATE transactions SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    const response = NextResponse.json({
      success: true,
      data: result.rows[0],
      message: "Transaction updated successfully"
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'PUT /api/financial/transactions');
  }
}

// DELETE /api/financial/transactions?id=X - Delete a transaction
async function handleDelete(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    if (user.role === 'fund_director') {
      const response = NextResponse.json({ error: "Fund directors have read-only access" }, { status: 403 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("id");

    if (!transactionId) {
      const response = NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    let deletedFundId: number | null = null;

    await executeTransaction(user ?? null, async (client) => {
      const existing = await client.query<Transaction>(
        `SELECT * FROM transactions WHERE id = $1`,
        [transactionId]
      );

      if (existing.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = existing.rows[0];
      deletedFundId = transaction.fund_id;

      await client.query(`DELETE FROM fund_movements_enhanced WHERE transaction_id = $1`, [transactionId]);
      await client.query(`DELETE FROM transactions WHERE id = $1`, [transactionId]);

      await client.query(
        `UPDATE funds
         SET current_balance = COALESCE((
           SELECT SUM(amount_in - amount_out)
           FROM transactions
           WHERE fund_id = $1
         ), 0),
             updated_at = NOW()
         WHERE id = $1`,
        [transaction.fund_id]
      );
    });

    const response = NextResponse.json({
      success: true,
      message: "Transaction deleted successfully",
      fundId: deletedFundId
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'DELETE /api/financial/transactions');
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}

export async function GET(req: NextRequest) {
  return handleGet(req);
}

export async function POST(req: NextRequest) {
  return handlePost(req);
}

export async function PUT(req: NextRequest) {
  return handlePut(req);
}

export async function DELETE(req: NextRequest) {
  return handleDelete(req);
}