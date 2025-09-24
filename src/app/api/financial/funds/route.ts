import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { execute } from "@/lib/db";
import { setCORSHeaders } from "@/lib/cors";

interface Fund {
  id: number;
  name: string;
  description: string;
  type: string;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface FundCreateInput {
  name: string;
  description?: string;
  type?: string;
  initial_balance?: number;
  is_active?: boolean;
}

interface FundUpdateInput extends Partial<FundCreateInput> {
  current_balance?: number;
}

// GET /api/financial/funds - Get all funds
async function handleGet(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const type = searchParams.get("type");

    let query = `
      SELECT
        id, name, description, type,
        current_balance,
        is_active, created_at, updated_at, created_by
      FROM funds
      WHERE 1=1
    `;
    const params: (string | number | boolean | null)[] = [];
    let paramCount = 0;

    if (!includeInactive) {
      query += ` AND is_active = true`;
    }

    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type);
    }

    query += ` ORDER BY is_active DESC, name ASC`;

    const fundsResult = await execute<Fund>(query, params);

    // Calculate actual balances from transactions for each fund
    const fundsWithBalances = await Promise.all(
      fundsResult.rows.map(async (fund) => {
        const balanceResult = await execute<{ balance: string }>(
          `SELECT
            COALESCE(SUM(amount_in) - SUM(amount_out), 0) as balance
          FROM transactions
          WHERE fund_id = $1`,
          [fund.id]
        );

        const calculatedBalance = parseFloat(balanceResult.rows[0]?.balance || '0');

        return {
          ...fund,
          current_balance: calculatedBalance
        };
      })
    );

    // Calculate totals with actual balances
    const totals = {
      total_funds: fundsWithBalances.length,
      active_funds: fundsWithBalances.filter(f => f.is_active).length,
      total_balance: fundsWithBalances.reduce((sum, f) => sum + Number(f.current_balance || 0), 0),
      total_target: 0 // Remove target_amount as it doesn't exist
    };

    const response = NextResponse.json({
      success: true,
      data: fundsWithBalances,
      totals
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error fetching funds:", error);
    const response = NextResponse.json(
      { error: "Error fetching funds", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// POST /api/financial/funds - Create a new fund
async function handlePost(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const body: FundCreateInput = await req.json();

    // Validate required fields
    if (!body.name) {
      const response = NextResponse.json({ error: "Fund name is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    // Check for duplicate name
    const existing = await execute(
      `SELECT id FROM funds WHERE LOWER(name) = LOWER($1)`,
      [body.name]
    );

    if (existing.rows.length > 0) {
      const response = NextResponse.json({ error: "A fund with this name already exists" }, { status: 409 });
      setCORSHeaders(response);
      return response;
    }

    const result = await execute<Fund>(
      `INSERT INTO funds (
        name, description, type,
        current_balance,
        is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        body.name,
        body.description || "",
        body.type || "general",
        body.initial_balance || 0,
        body.is_active !== false,
        user.email
      ]
    );

    const response = NextResponse.json({
      success: true,
      data: result.rows[0],
      message: "Fund created successfully"
    }, { status: 201 });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error creating fund:", error);
    const response = NextResponse.json(
      { error: "Error creating fund", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// PUT /api/financial/funds?id=X - Update a fund
async function handlePut(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const fundId = searchParams.get("id");

    if (!fundId) {
      const response = NextResponse.json({ error: "Fund ID is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    const body: FundUpdateInput = await req.json();

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramCount = 0;

    if (body.name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(body.name);
    }

    if (body.description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(body.description);
    }

    if (body.type !== undefined) {
      paramCount++;
      updates.push(`type = $${paramCount}`);
      values.push(body.type);
    }

    if (body.current_balance !== undefined) {
      paramCount++;
      updates.push(`current_balance = $${paramCount}`);
      values.push(body.current_balance);
    }

    if (body.is_active !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      values.push(body.is_active);
    }

    if (updates.length === 0) {
      const response = NextResponse.json({ error: "No fields to update" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    paramCount++;
    values.push(fundId);

    const result = await execute<Fund>(
      `UPDATE funds SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      const response = NextResponse.json({ error: "Fund not found" }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      data: result.rows[0],
      message: "Fund updated successfully"
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error updating fund:", error);
    const response = NextResponse.json(
      { error: "Error updating fund", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// DELETE /api/financial/funds?id=X - Delete a fund (soft delete)
async function handleDelete(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const fundId = searchParams.get("id");

    if (!fundId) {
      const response = NextResponse.json({ error: "Fund ID is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    // Check if fund has transactions
    const transactions = await execute<{ count: string }>(
      `SELECT COUNT(*) as count FROM transactions WHERE fund_id = $1`,
      [fundId]
    );

    if (parseInt(transactions.rows[0].count) > 0) {
      // Soft delete - just deactivate
      await execute(
        `UPDATE funds SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [fundId]
      );

      const response = NextResponse.json({
        success: true,
        message: "Fund deactivated (has transactions)"
      });
      setCORSHeaders(response);
      return response;
    } else {
      // Hard delete - no transactions
      await execute(`DELETE FROM funds WHERE id = $1`, [fundId]);

      const response = NextResponse.json({
        success: true,
        message: "Fund deleted permanently"
      });
      setCORSHeaders(response);
      return response;
    }
  } catch (error) {
    console.error("Error deleting fund:", error);
    const response = NextResponse.json(
      { error: "Error deleting fund", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
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