import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { execute } from "@/lib/db";
import { setCORSHeaders } from "@/lib/cors";

interface FundMovement {
  id: number;
  report_id: number;
  church_id: number;
  fund_id: number;
  amount: number;
  type: "automatic" | "manual";
  description: string;
  created_at: string;
  created_by: string;
}

interface FundMovementInput {
  report_id: number;
  church_id: number;
  fund_id: number;
  amount: number;
  type?: "automatic" | "manual";
  description?: string;
}

// GET /api/financial/fund-movements - Get fund movements
async function handleGet(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const report_id = searchParams.get("report_id");
    const church_id = searchParams.get("church_id");
    const fund_id = searchParams.get("fund_id");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";

    const limitNumber = Number.isNaN(Number(limit)) ? 100 : parseInt(limit, 10);
    const offsetNumber = Number.isNaN(Number(offset)) ? 0 : parseInt(offset, 10);

    const filters: string[] = [];
    const filterValues: (string | number)[] = [];

    if (report_id) {
      filterValues.push(report_id);
      filters.push(`fm.report_id = $${filterValues.length}`);
    }

    if (church_id) {
      filterValues.push(church_id);
      filters.push(`fm.church_id = $${filterValues.length}`);
    }

    if (fund_id) {
      filterValues.push(fund_id);
      filters.push(`fm.fund_id = $${filterValues.length}`);
    }

    if (month && year) {
      filterValues.push(month);
      filters.push(`r.month = $${filterValues.length}`);
      filterValues.push(year);
      filters.push(`r.year = $${filterValues.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const listQuery = `
      SELECT
        fm.*,
        c.name as church_name,
        f.name as fund_name,
        r.month as report_month,
        r.year as report_year
      FROM fund_movements fm
      LEFT JOIN churches c ON fm.church_id = c.id
      LEFT JOIN funds f ON fm.fund_id = f.id
      LEFT JOIN reports r ON fm.report_id = r.id
      ${whereClause}
      ORDER BY fm.created_at DESC
      LIMIT $${filterValues.length + 1}
      OFFSET $${filterValues.length + 2}
    `;

    const result = await execute(listQuery, [...filterValues, limitNumber, offsetNumber]);

    const totalsQuery = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM fund_movements fm
      LEFT JOIN reports r ON fm.report_id = r.id
      ${whereClause}
    `;

    const totals = await execute<{ total_count: string; total_amount: string }>(totalsQuery, filterValues);

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
        total_amount: parseFloat(totals.rows[0].total_amount)
      }
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error fetching fund movements:", error);
    const response = NextResponse.json(
      { error: "Error fetching fund movements", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// POST /api/financial/fund-movements - Create fund movement(s)
async function handlePost(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const rawBody = await req.json();

    if (
      typeof rawBody === "object" &&
      rawBody !== null &&
      "action" in rawBody &&
      (rawBody as { action?: string }).action === "process_report"
    ) {
      const reportId = (rawBody as { report_id?: number }).report_id;
      if (!reportId) {
        const response = NextResponse.json({ error: "report_id is required for process_report" }, { status: 400 });
        setCORSHeaders(response);
        return response;
      }
      return processReportMovements(reportId, user.email || "");
    }

    const rawMovements = Array.isArray(rawBody) ? rawBody : [rawBody];
    const results: FundMovement[] = [];
    const errors: Array<{ movement: unknown; error: string }> = [];

    for (const movementRaw of rawMovements) {
      let movement: FundMovementInput | undefined;
      try {
        if (typeof movementRaw !== "object" || movementRaw === null) {
          errors.push({ movement: movementRaw, error: "Invalid movement payload" });
          continue;
        }

        movement = movementRaw as FundMovementInput;

        if (!movement.report_id || !movement.church_id || !movement.fund_id || !movement.amount) {
          errors.push({
            movement,
            error: "Missing required fields"
          });
          continue;
        }

        // Create fund movement record
        const result = await execute<FundMovement>(
          `INSERT INTO fund_movements (
            report_id, church_id, fund_id,
            amount, type, description, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            movement.report_id,
            movement.church_id,
            movement.fund_id,
            movement.amount,
            movement.type ?? "manual",
            movement.description ?? "",
            user.email || ""
          ]
        );

        // Create corresponding transaction
        await execute(
          `INSERT INTO transactions (
            date, fund_id, church_id, report_id,
            concept, amount_in, amount_out, created_by
          ) VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, 0, $6)`,
          [
            movement.fund_id,
            movement.church_id,
            movement.report_id,
            movement.description ?? "Movimiento de fondo",
            movement.amount,
            user.email || ""
          ]
        );

        // Update fund balance
        await execute(
          `UPDATE funds
           SET current_balance = current_balance + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [movement.amount, movement.fund_id]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({
          movement: movement || movementRaw,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    const response = NextResponse.json({
      success: errors.length === 0,
      created: results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${results.length} movement(s)${errors.length > 0 ? `, ${errors.length} failed` : ""}`
    }, { status: errors.length === 0 ? 201 : 207 });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error creating fund movements:", error);
    const response = NextResponse.json(
      { error: "Error creating fund movements", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// Process automatic fund movements when a report is submitted
async function processReportMovements(reportId: number, userEmail: string) {
  try {
    // Get report details
    const reportResult = await execute<{
      id: number;
      church_id: number;
      church_name: string;
      month: number;
      year: number;
      diezmos: string;
      ofrendas: string;
      fondo_nacional: string;
    }>(
      `SELECT r.*, c.name as church_name
       FROM reports r
       JOIN churches c ON r.church_id = c.id
       WHERE r.id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      const response = NextResponse.json({ error: "Report not found" }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    const report = reportResult.rows[0];

    // Check if movements already processed
    const existing = await execute<{ count: string }>(
      `SELECT COUNT(*) as count FROM fund_movements WHERE report_id = $1 AND type = 'automatic'`,
      [reportId]
    );

    if (parseInt(existing.rows[0].count) > 0) {
      const response = NextResponse.json({
        error: "Fund movements already processed for this report"
      }, { status: 409 });
      setCORSHeaders(response);
      return response;
    }

    const movements = [];

    // Get or create funds for automatic movements
    const funds = await execute<{ id: number; name: string }>(
      `SELECT id, name FROM funds WHERE name IN ('Fondo Nacional', 'Diezmos', 'Ofrendas')`
    );

    const fundMap: Record<string, number> = {};
    for (const fund of funds.rows) {
      fundMap[fund.name] = fund.id;
    }

    // Create missing funds if needed
    if (!fundMap["Fondo Nacional"]) {
      const result = await execute<{ id: number }>(
        `INSERT INTO funds (name, category, initial_balance, current_balance, active, created_by)
         VALUES ('Fondo Nacional', 'automatic', 0, 0, true, $1)
         RETURNING id`,
        [userEmail]
      );
      fundMap["Fondo Nacional"] = result.rows[0].id;
    }

    if (!fundMap["Diezmos"]) {
      const result = await execute<{ id: number }>(
        `INSERT INTO funds (name, category, initial_balance, current_balance, active, created_by)
         VALUES ('Diezmos', 'automatic', 0, 0, true, $1)
         RETURNING id`,
        [userEmail]
      );
      fundMap["Diezmos"] = result.rows[0].id;
    }

    if (!fundMap["Ofrendas"]) {
      const result = await execute<{ id: number }>(
        `INSERT INTO funds (name, category, initial_balance, current_balance, active, created_by)
         VALUES ('Ofrendas', 'automatic', 0, 0, true, $1)
         RETURNING id`,
        [userEmail]
      );
      fundMap["Ofrendas"] = result.rows[0].id;
    }

    // Process diezmos
    if (report.diezmos && parseFloat(report.diezmos) > 0) {
      const diezmoMovement = await execute(
        `INSERT INTO fund_movements (
          report_id, church_id, fund_id, amount, type, description, created_by
        ) VALUES ($1, $2, $3, $4, 'automatic', $5, $6)
        RETURNING *`,
        [
          reportId,
          report.church_id,
          fundMap["Diezmos"],
          report.diezmos,
          `Diezmos - ${report.church_name} (${report.month}/${report.year})`,
          userEmail
        ]
      );

      // Create transaction
      await execute(
        `INSERT INTO transactions (
          date, fund_id, church_id, report_id, concept, amount_in, amount_out, created_by
        ) VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, 0, $6)`,
        [
          fundMap["Diezmos"],
          report.church_id,
          reportId,
          `Diezmos - ${report.church_name}`,
          report.diezmos,
          userEmail
        ]
      );

      // Update fund balance
      await execute(
        `UPDATE funds SET current_balance = current_balance + $1 WHERE id = $2`,
        [report.diezmos, fundMap["Diezmos"]]
      );

      movements.push(diezmoMovement.rows[0]);
    }

    // Process ofrendas
    if (report.ofrendas && parseFloat(report.ofrendas) > 0) {
      const ofrendaMovement = await execute(
        `INSERT INTO fund_movements (
          report_id, church_id, fund_id, amount, type, description, created_by
        ) VALUES ($1, $2, $3, $4, 'automatic', $5, $6)
        RETURNING *`,
        [
          reportId,
          report.church_id,
          fundMap["Ofrendas"],
          report.ofrendas,
          `Ofrendas - ${report.church_name} (${report.month}/${report.year})`,
          userEmail
        ]
      );

      // Create transaction
      await execute(
        `INSERT INTO transactions (
          date, fund_id, church_id, report_id, concept, amount_in, amount_out, created_by
        ) VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, 0, $6)`,
        [
          fundMap["Ofrendas"],
          report.church_id,
          reportId,
          `Ofrendas - ${report.church_name}`,
          report.ofrendas,
          userEmail
        ]
      );

      // Update fund balance
      await execute(
        `UPDATE funds SET current_balance = current_balance + $1 WHERE id = $2`,
        [report.ofrendas, fundMap["Ofrendas"]]
      );

      movements.push(ofrendaMovement.rows[0]);
    }

    // Process fondo nacional (10% of total)
    if (report.fondo_nacional && parseFloat(report.fondo_nacional) > 0) {
      const fondoMovement = await execute(
        `INSERT INTO fund_movements (
          report_id, church_id, fund_id, amount, type, description, created_by
        ) VALUES ($1, $2, $3, $4, 'automatic', $5, $6)
        RETURNING *`,
        [
          reportId,
          report.church_id,
          fundMap["Fondo Nacional"],
          report.fondo_nacional,
          `Fondo Nacional 10% - ${report.church_name} (${report.month}/${report.year})`,
          userEmail
        ]
      );

      // Create transaction
      await execute(
        `INSERT INTO transactions (
          date, fund_id, church_id, report_id, concept, amount_in, amount_out, created_by
        ) VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, 0, $6)`,
        [
          fundMap["Fondo Nacional"],
          report.church_id,
          reportId,
          `Fondo Nacional 10% - ${report.church_name}`,
          report.fondo_nacional,
          userEmail
        ]
      );

      // Update fund balance
      await execute(
        `UPDATE funds SET current_balance = current_balance + $1 WHERE id = $2`,
        [report.fondo_nacional, fundMap["Fondo Nacional"]]
      );

      movements.push(fondoMovement.rows[0]);
    }

    const response = NextResponse.json({
      success: true,
      movements,
      message: `Processed ${movements.length} automatic fund movements for report ${reportId}`
    }, { status: 201 });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error processing report movements:", error);
    const response = NextResponse.json(
      { error: "Error processing fund movements", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// DELETE /api/financial/fund-movements?id=X - Reverse a fund movement
async function handleDelete(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const movementId = searchParams.get("id");

    if (!movementId) {
      const response = NextResponse.json({ error: "Movement ID is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    // Get movement details
    const movement = await execute(
      `SELECT * FROM fund_movements WHERE id = $1`,
      [movementId]
    );

    if (movement.rows.length === 0) {
      const response = NextResponse.json({ error: "Fund movement not found" }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    const mov = movement.rows[0];

    // Delete the movement
    await execute(`DELETE FROM fund_movements WHERE id = $1`, [movementId]);

    // Reverse the fund balance
    await execute(
      `UPDATE funds SET current_balance = current_balance - $1 WHERE id = $2`,
      [mov.amount, mov.fund_id]
    );

    // Delete related transaction if exists
    await execute(
      `DELETE FROM transactions WHERE report_id = $1 AND fund_id = $2 AND amount_in = $3`,
      [mov.report_id, mov.fund_id, mov.amount]
    );

    const response = NextResponse.json({
      success: true,
      message: "Fund movement reversed successfully"
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error reversing fund movement:", error);
    const response = NextResponse.json(
      { error: "Error reversing fund movement", details: error instanceof Error ? error.message : "Unknown error" },
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

export async function DELETE(req: NextRequest) {
  return handleDelete(req);
}