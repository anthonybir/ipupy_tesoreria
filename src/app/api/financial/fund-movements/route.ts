import { type NextRequest, NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/auth-context";
import { executeWithContext } from "@/lib/db";
import { firstOrNull, firstOrDefault, expectOne } from "@/lib/db-helpers";
import { setCORSHeaders } from "@/lib/cors";
import { createTransaction as createLedgerTransaction } from "@/app/api/reports/route-helpers";

interface FundMovement {
  id: number;
  report_id: number;
  church_id: number;
  fund_category_id: number;
  monto: number;
  tipo_movimiento: "entrada" | "salida";
  concepto: string;
  fecha_movimiento: string;
  created_at: string;
}

interface FundMovementInput {
  report_id: number;
  church_id: number;
  fund_category_id: number;
  monto: number;
  tipo_movimiento?: "entrada" | "salida";
  concepto?: string;
}

// GET /api/financial/fund-movements - Get fund movements
async function handleGet(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const { searchParams } = new URL(req.url);

    const report_id = searchParams.get("report_id");
    const church_id = searchParams.get("church_id");
    const fund_category_id = searchParams.get("fund_category_id");
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
      filters.push(`t.report_id = $${filterValues.length}`);
    }

    if (church_id) {
      filterValues.push(church_id);
      filters.push(`t.church_id = $${filterValues.length}`);
    }

    if (fund_category_id) {
      filterValues.push(fund_category_id);
      filters.push(`t.fund_id = $${filterValues.length}`);
    }

    if (month && year) {
      filterValues.push(year);
      filters.push(`EXTRACT(YEAR FROM t.date) = $${filterValues.length}`);
      filterValues.push(month);
      filters.push(`EXTRACT(MONTH FROM t.date) = $${filterValues.length}`);
    } else if (year) {
      filterValues.push(year);
      filters.push(`EXTRACT(YEAR FROM t.date) = $${filterValues.length}`);
    }

    const whereClause = filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";

    // Query transactions table instead of empty fund_movements
    const listQuery = `
      SELECT
        t.id,
        t.date as fecha_movimiento,
        t.church_id,
        c.name as church_name,
        t.fund_id as fund_category_id,
        f.name as fund_name,
        t.concept as concepto,
        CASE
          WHEN t.amount_in > 0 THEN t.amount_in
          ELSE -t.amount_out
        END as monto,
        CASE
          WHEN t.amount_in > 0 THEN 'ingreso'
          ELSE 'egreso'
        END as tipo_movimiento,
        t.report_id,
        r.month as report_month,
        r.year as report_year,
        t.created_at,
        t.created_by
      FROM transactions t
      LEFT JOIN churches c ON t.church_id = c.id
      LEFT JOIN funds f ON t.fund_id = f.id
      LEFT JOIN reports r ON t.report_id = r.id
      WHERE 1=1
    `;

    // Update the final query with where clause
    const finalQuery = listQuery + whereClause + `
      ORDER BY t.created_at DESC
      LIMIT $${filterValues.length + 1}
      OFFSET $${filterValues.length + 2}
    `;

    const result = await executeWithContext(auth, finalQuery, [...filterValues, limitNumber, offsetNumber]);

    const totalsQuery = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN amount_in > 0 THEN amount_in ELSE -amount_out END), 0) as total_amount
      FROM transactions t
      LEFT JOIN reports r ON t.report_id = r.id
      WHERE 1=1 ${whereClause}
    `;

    const totals = await executeWithContext<{ total_count: string; total_amount: string }>(auth, totalsQuery, filterValues);
    const totalsRow = firstOrDefault(totals.rows, { total_count: '0', total_amount: '0' });

    const limitValue = Number.parseInt(limit, 10);
    const offsetValue = Number.parseInt(offset, 10);
    const totalCount = Number.parseInt(totalsRow.total_count ?? '0', 10);
    const totalAmount = Number.parseFloat(totalsRow.total_amount ?? '0');

    const response = NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: limitValue,
        offset: offsetValue,
        total: totalCount
      },
      totals: {
        count: totalCount,
        total_amount: totalAmount
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
      return processReportMovements(user, reportId, user.email || "");
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

        if (!movement.report_id || !movement.church_id || !movement.fund_category_id || !movement.monto) {
          errors.push({
            movement,
            error: "Missing required fields"
          });
          continue;
        }

        const rawAmount = Number(movement.monto);
        if (!Number.isFinite(rawAmount) || rawAmount === 0) {
          errors.push({ movement, error: "Movement amount must be a non-zero number" });
          continue;
        }

        const absAmount = Math.abs(rawAmount);
        const inferredType = rawAmount >= 0 ? 'entrada' : 'salida';
        const tipoMovimiento = movement.tipo_movimiento ?? inferredType;

        if (!['entrada', 'salida'].includes(tipoMovimiento)) {
          errors.push({ movement, error: "tipo_movimiento must be 'entrada' or 'salida'" });
          continue;
        }

        const movementResult = await executeWithContext<FundMovement>(user,
          `INSERT INTO fund_movements (
            report_id, church_id, fund_category_id,
            monto, tipo_movimiento, concepto, fecha_movimiento
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
          RETURNING *`,
          [
            movement.report_id,
            movement.church_id,
            movement.fund_category_id,
            absAmount,
            tipoMovimiento,
            movement.concepto ?? ""
          ]
        );

        const insertedMovement = expectOne(movementResult.rows);
        if (!insertedMovement) {
          errors.push({ movement, error: 'Failed to create movement record' });
          continue;
        }

        await createLedgerTransaction({
          date: new Date().toISOString().slice(0, 10),
          fund_id: movement.fund_category_id,
          church_id: movement.church_id,
          report_id: movement.report_id,
          concept: movement.concepto ?? "Movimiento de fondo",
          amount_in: tipoMovimiento === 'salida' ? 0 : absAmount,
          amount_out: tipoMovimiento === 'salida' ? absAmount : 0,
          created_by: user.email ?? 'system'
        }, user);

        results.push(insertedMovement);
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
async function processReportMovements(auth: AuthContext | null, reportId: number, userEmail: string) {
  try {
    // Get report details
    const reportResult = await executeWithContext<{
      id: number;
      church_id: number;
      church_name: string;
      month: number;
      year: number;
      diezmos: string;
      ofrendas: string;
      fondo_nacional: string;
      fecha_deposito?: string | null;
    }>(auth,
      `SELECT r.*, c.name as church_name
       FROM reports r
       JOIN churches c ON r.church_id = c.id
       WHERE r.id = $1`,
      [reportId]
    );

    const report = firstOrNull(reportResult.rows);
    if (!report) {
      const response = NextResponse.json({ error: "Report not found" }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }
    const movementDate = report.fecha_deposito
      ? new Date(report.fecha_deposito).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Check if movements already processed
    const existing = await executeWithContext<{ count: string }>(auth,
      `SELECT COUNT(*) as count FROM fund_movements WHERE report_id = $1`,
      [reportId]
    );

    const existingRow = firstOrNull(existing.rows);
    const processedCount = existingRow ? Number.parseInt(existingRow.count, 10) : 0;

    if (processedCount > 0) {
      const response = NextResponse.json({
        error: "Fund movements already processed for this report"
      }, { status: 409 });
      setCORSHeaders(response);
      return response;
    }

    const movements = [];

    // Get or create funds for automatic movements
    const funds = await executeWithContext<{ id: number; name: string }>(auth,
      `SELECT id, name FROM funds WHERE name IN ('Fondo Nacional', 'Diezmos', 'Ofrendas')`
    );

    const fundMap: Record<string, number> = {};
    for (const fund of funds.rows) {
      fundMap[fund.name] = fund.id;
    }

    // Create missing funds if needed (using correct schema)
    if (!fundMap["Fondo Nacional"]) {
      const result = await executeWithContext<{ id: number }>(auth,
        `INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
         VALUES ('Fondo Nacional', 'nacional', 'Fondo nacional IPU Paraguay', 0, true, $1)
         RETURNING id`,
        [userEmail]
      );
      const inserted = expectOne(result.rows);
      if (!inserted) {
        throw new Error('Failed to ensure Fondo Nacional fund');
      }
      fundMap["Fondo Nacional"] = inserted.id;
    }

    if (!fundMap["Diezmos"]) {
      const result = await executeWithContext<{ id: number }>(auth,
        `INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
         VALUES ('Diezmos', 'nacional', 'Fondo de diezmos', 0, true, $1)
         RETURNING id`,
        [userEmail]
      );
      const inserted = expectOne(result.rows);
      if (!inserted) {
        throw new Error('Failed to ensure Diezmos fund');
      }
      fundMap["Diezmos"] = inserted.id;
    }

    if (!fundMap["Ofrendas"]) {
      const result = await executeWithContext<{ id: number }>(auth,
        `INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
         VALUES ('Ofrendas', 'nacional', 'Fondo de ofrendas', 0, true, $1)
         RETURNING id`,
        [userEmail]
      );
      const inserted = expectOne(result.rows);
      if (!inserted) {
        throw new Error('Failed to ensure Ofrendas fund');
      }
      fundMap["Ofrendas"] = inserted.id;
    }

    const ensureFundId = (name: 'Fondo Nacional' | 'Diezmos' | 'Ofrendas') => {
      const id = fundMap[name];
      if (typeof id !== 'number') {
        throw new Error(`Fund ${name} is unavailable`);
      }
      return id;
    };

    // Process diezmos
    if (report.diezmos && parseFloat(report.diezmos) > 0) {
      const amount = parseFloat(report.diezmos);
      const diezmosFundId = ensureFundId('Diezmos');
      const diezmoMovement = await executeWithContext(auth,
        `INSERT INTO fund_movements (
          report_id, church_id, fund_category_id, monto, tipo_movimiento, concepto, fecha_movimiento
        ) VALUES ($1, $2, $3, $4, 'entrada', $5, CURRENT_DATE)
        RETURNING *`,
        [
          reportId,
          report.church_id,
          diezmosFundId,
          amount,
          `Diezmos - ${report.church_name} (${report.month}/${report.year})`
        ]
      );

      await createLedgerTransaction({
        date: movementDate,
        fund_id: diezmosFundId,
        church_id: report.church_id,
        report_id: reportId,
        concept: `Diezmos - ${report.church_name}`,
        amount_in: amount,
        amount_out: 0,
        created_by: userEmail ?? 'system'
      }, auth);

      const created = expectOne(diezmoMovement.rows);
      if (created) {
        movements.push(created);
      }
    }

    // Process ofrendas
    if (report.ofrendas && parseFloat(report.ofrendas) > 0) {
      const amount = parseFloat(report.ofrendas);
      const ofrendasFundId = ensureFundId('Ofrendas');
      const ofrendaMovement = await executeWithContext(auth,
        `INSERT INTO fund_movements (
          report_id, church_id, fund_category_id, monto, tipo_movimiento, concepto, fecha_movimiento
        ) VALUES ($1, $2, $3, $4, 'entrada', $5, CURRENT_DATE)
        RETURNING *`,
        [
          reportId,
          report.church_id,
          ofrendasFundId,
          amount,
          `Ofrendas - ${report.church_name} (${report.month}/${report.year})`
        ]
      );

      await createLedgerTransaction({
        date: movementDate,
        fund_id: ofrendasFundId,
        church_id: report.church_id,
        report_id: reportId,
        concept: `Ofrendas - ${report.church_name}`,
        amount_in: amount,
        amount_out: 0,
        created_by: userEmail ?? 'system'
      }, auth);

      const created = expectOne(ofrendaMovement.rows);
      if (created) {
        movements.push(created);
      }
    }

    // Process fondo nacional (10% of total)
    if (report.fondo_nacional && parseFloat(report.fondo_nacional) > 0) {
      const amount = parseFloat(report.fondo_nacional);
      const fondoNacionalFundId = ensureFundId('Fondo Nacional');
      const fondoMovement = await executeWithContext(auth,
        `INSERT INTO fund_movements (
          report_id, church_id, fund_category_id, monto, tipo_movimiento, concepto, fecha_movimiento
        ) VALUES ($1, $2, $3, $4, 'entrada', $5, CURRENT_DATE)
        RETURNING *`,
        [
          reportId,
          report.church_id,
          fondoNacionalFundId,
          amount,
          `Fondo Nacional 10% - ${report.church_name} (${report.month}/${report.year})`
        ]
      );

      await createLedgerTransaction({
        date: movementDate,
        fund_id: fondoNacionalFundId,
        church_id: report.church_id,
        report_id: reportId,
        concept: `Fondo Nacional 10% - ${report.church_name}`,
        amount_in: amount,
        amount_out: 0,
        created_by: userEmail ?? 'system'
      }, auth);

      const created = expectOne(fondoMovement.rows);
      if (created) {
        movements.push(created);
      }
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
    const movement = await executeWithContext<FundMovement>(user, 
      `SELECT * FROM fund_movements WHERE id = $1`,
      [movementId]
    );

    const mov = firstOrNull(movement.rows);
    if (!mov) {
      const response = NextResponse.json({ error: "Fund movement not found" }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    // Delete the movement
    await executeWithContext(user, `DELETE FROM fund_movements WHERE id = $1`, [movementId]);

    // Reverse the fund balance (using fund_category_id)
    await executeWithContext(user, 
      `UPDATE funds SET current_balance = current_balance - $1 WHERE id = $2`,
      [mov.monto, mov.fund_category_id]
    );

    // Delete related transaction if exists
    await executeWithContext(user, 
      `DELETE FROM transactions WHERE report_id = $1 AND fund_id = $2 AND amount_in = $3`,
      [mov.report_id, mov.fund_category_id, mov.monto]
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