import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/auth-context";
import { executeWithContext } from "@/lib/db";
import { setCORSHeaders } from "@/lib/cors";

interface Donor {
  id: number;
  church_id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  cedula?: string;
  type: "individual" | "family" | "business";
  active: boolean;
  created_at: string;
  updated_at?: string;
}

interface Contribution {
  id: number;
  donor_id: number;
  church_id: number;
  date: string;
  amount: number;
  type: "diezmo" | "ofrenda" | "especial" | "promesa";
  method: "efectivo" | "transferencia" | "cheque" | "otro";
  receipt_number?: string;
  notes?: string;
  created_at: string;
}

type DonorCreatePayload = {
  church_id: number;
  name: string;
  type: Donor["type"];
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  cedula?: string | null;
};

type ContributionCreatePayload = {
  donor_id: number;
  church_id: number;
  date: string;
  amount: number;
  type: Contribution["type"];
  method?: Contribution["method"];
  receipt_number?: string | null;
  notes?: string | null;
};

type DonorUpdatePayload = Partial<Omit<Donor, "id" | "created_at" | "updated_at" | "active" >> & { active?: boolean };

type ContributionUpdatePayload = Partial<Omit<Contribution, "id" | "created_at" | "donor_id" | "church_id" >>;

type DonorAction = "donor" | "contribution";

// GET /api/donors - Search and list donors
async function handleGet(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "list";
    const church_id = searchParams.get("church_id");
    const donor_id = searchParams.get("id");
    const search = searchParams.get("search");
    const type = searchParams.get("type");

    if (action === "search" && search) {
      return await searchDonors(auth, search, church_id);
    }

    if (action === "summary" && donor_id) {
      return await getDonorSummary(auth, donor_id);
    }

    if (action === "contributions" && donor_id) {
      return await getDonorContributions(auth, donor_id);
    }

    // Default: list donors
    return await listDonors(auth, church_id, type);
  } catch (error) {
    console.error("Error in donors GET:", error);
    const response = NextResponse.json(
      { error: "Error fetching donor data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// List donors with optional filters
async function listDonors(auth: AuthContext | null, church_id: string | null, type: string | null) {
  let query = `
    SELECT
      d.*,
      c.name as church_name,
      COUNT(DISTINCT con.id) as contribution_count,
      COALESCE(SUM(con.amount), 0) as total_contributions
    FROM donors d
    LEFT JOIN churches c ON d.church_id = c.id
    LEFT JOIN contributions con ON d.id = con.donor_id
    WHERE d.active = true
  `;
  const params: (string | number | boolean | null)[] = [];
  let paramCount = 0;

  if (church_id) {
    paramCount++;
    query += ` AND d.church_id = $${paramCount}`;
    params.push(church_id);
  }

  if (type) {
    paramCount++;
    query += ` AND d.type = $${paramCount}`;
    params.push(type);
  }

  query += ` GROUP BY d.id, c.name ORDER BY d.name ASC`;

  const result = await executeWithContext(auth, query, params);

  const response = NextResponse.json({
    success: true,
    data: result.rows,
    total: result.rows.length
  });

  setCORSHeaders(response);
  return response;
}

// Search donors by name, email, phone, or cedula
async function searchDonors(auth: AuthContext | null, searchTerm: string, church_id: string | null) {
  let query = `
    SELECT
      d.*,
      c.name as church_name,
      COUNT(DISTINCT con.id) as contribution_count,
      COALESCE(SUM(con.amount), 0) as total_contributions
    FROM donors d
    LEFT JOIN churches c ON d.church_id = c.id
    LEFT JOIN contributions con ON d.id = con.donor_id
    WHERE d.active = true
    AND (
      LOWER(d.name) LIKE LOWER($1)
      OR LOWER(d.email) LIKE LOWER($1)
      OR d.phone LIKE $1
      OR d.cedula LIKE $1
    )
  `;
  const params: (string | number)[] = [`%${searchTerm}%`];
  let paramCount = 1;

  if (church_id) {
    paramCount++;
    query += ` AND d.church_id = $${paramCount}`;
    params.push(church_id);
  }

  query += ` GROUP BY d.id, c.name ORDER BY d.name ASC LIMIT 20`;

  const result = await executeWithContext(auth, query, params);

  const response = NextResponse.json({
    success: true,
    data: result.rows,
    searchTerm
  });

  setCORSHeaders(response);
  return response;
}

// Get donor summary with contribution history
async function getDonorSummary(auth: AuthContext | null, donor_id: string) {
  // Get donor details
  const donorResult = await executeWithContext(auth, 
    `SELECT d.*, c.name as church_name
     FROM donors d
     LEFT JOIN churches c ON d.church_id = c.id
     WHERE d.id = $1`,
    [donor_id]
  );

  if (donorResult.rows.length === 0) {
    const response = NextResponse.json({ error: "Donor not found" }, { status: 404 });
    setCORSHeaders(response);
    return response;
  }

  const donor = donorResult.rows[0];

  // Get contribution summary by year
  const yearlyContributions = await executeWithContext(auth, 
    `SELECT
      EXTRACT(YEAR FROM date) as year,
      COUNT(*) as count,
      SUM(amount) as total,
      AVG(amount) as average
    FROM contributions
    WHERE donor_id = $1
    GROUP BY EXTRACT(YEAR FROM date)
    ORDER BY year DESC`,
    [donor_id]
  );

  // Get contribution summary by type
  const contributionsByType = await executeWithContext(auth, 
    `SELECT
      type,
      COUNT(*) as count,
      SUM(amount) as total
    FROM contributions
    WHERE donor_id = $1
    GROUP BY type
    ORDER BY total DESC`,
    [donor_id]
  );

  // Get recent contributions
  const recentContributions = await executeWithContext(auth, 
    `SELECT *
     FROM contributions
     WHERE donor_id = $1
     ORDER BY date DESC
     LIMIT 10`,
    [donor_id]
  );

  const response = NextResponse.json({
    success: true,
    donor,
    summary: {
      yearlyContributions: yearlyContributions.rows,
      contributionsByType: contributionsByType.rows,
      recentContributions: recentContributions.rows
    }
  });

  setCORSHeaders(response);
  return response;
}

// Get all contributions for a donor
async function getDonorContributions(auth: AuthContext | null, donor_id: string) {
  const result = await executeWithContext(auth, 
    `SELECT
      c.*,
      ch.name as church_name
    FROM contributions c
    LEFT JOIN churches ch ON c.church_id = ch.id
    WHERE c.donor_id = $1
    ORDER BY c.date DESC, c.created_at DESC`,
    [donor_id]
  );

  const response = NextResponse.json({
    success: true,
    data: result.rows
  });

  setCORSHeaders(response);
  return response;
}

// POST /api/donors - Create donor or contribution
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
    const action = (typeof body.type === "string" ? body.type : "donor") as DonorAction;

    if (action === "contribution") {
      return await createContribution(user, body as ContributionCreatePayload, user.email || "");
    }

    // Create donor
    return await createDonor(user, body as DonorCreatePayload, user.email || "");
  } catch (error) {
    console.error("Error in donors POST:", error);
    const response = NextResponse.json(
      { error: "Error creating donor record", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// Create new donor
async function createDonor(auth: AuthContext | null, data: DonorCreatePayload, userEmail: string) {
  const required: Array<keyof DonorCreatePayload> = ["church_id", "name", "type"];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      const response = NextResponse.json({ error: `${field as string} is required` }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }
  }

  // Check for duplicate cedula if provided
  if (data.cedula) {
    const existing = await executeWithContext(auth, 
      `SELECT id FROM donors WHERE cedula = $1 AND church_id = $2`,
      [data.cedula, data.church_id]
    );

    if (existing.rows.length > 0) {
      const response = NextResponse.json({ error: "A donor with this cedula already exists" }, { status: 409 });
      setCORSHeaders(response);
      return response;
    }
  }

  const result = await executeWithContext<Donor>(auth,
    `INSERT INTO donors (
      church_id, name, email, phone, address,
      cedula, type, active, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
    RETURNING *`,
    [
      data.church_id,
      data.name,
      data.email ?? null,
      data.phone ?? null,
      data.address ?? null,
      data.cedula ?? null,
      data.type ?? "individual",
      userEmail
    ]
  );

  const response = NextResponse.json({
    success: true,
    data: result.rows[0],
    message: "Donor created successfully"
  }, { status: 201 });

  setCORSHeaders(response);
  return response;
}

// Create contribution
async function createContribution(auth: AuthContext | null, data: ContributionCreatePayload, userEmail: string) {
  const required: Array<keyof ContributionCreatePayload> = [
    "donor_id",
    "church_id",
    "date",
    "amount",
    "type",
  ];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      const response = NextResponse.json({ error: `${field as string} is required` }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }
  }

  // Generate receipt number if not provided
  const receiptNumber = data.receipt_number ?? `REC-${data.church_id}-${Date.now().toString(36).toUpperCase()}`;

  const result = await executeWithContext<Contribution>(auth,
    `INSERT INTO contributions (
      donor_id, church_id, date, amount, type,
      method, receipt_number, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      data.donor_id,
      data.church_id,
      data.date,
      data.amount,
      data.type,
      data.method ?? "efectivo",
      receiptNumber,
      data.notes ?? null,
      userEmail
    ]
  );

  const response = NextResponse.json({
    success: true,
    data: result.rows[0],
    message: "Contribution recorded successfully",
    receiptNumber
  }, { status: 201 });

  setCORSHeaders(response);
  return response;
}

// PUT /api/donors - Update donor or contribution
async function handlePut(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const donor_id = searchParams.get("id");
    const contribution_id = searchParams.get("contribution_id");

    if (contribution_id) {
      const payload = (await req.json()) as ContributionUpdatePayload;
      return await updateContribution(user, contribution_id, payload);
    }

    if (!donor_id) {
      const response = NextResponse.json({ error: "Donor ID is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    const payload = (await req.json()) as DonorUpdatePayload;
    return await updateDonor(user, donor_id, payload);
  } catch (error) {
    console.error("Error in donors PUT:", error);
    const response = NextResponse.json(
      { error: "Error updating donor record", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// Update donor
async function updateDonor(auth: AuthContext | null, donor_id: string, data: DonorUpdatePayload) {
  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  let paramCount = 0;

  const updatableFields: Array<keyof DonorUpdatePayload> = [
    "name",
    "email",
    "phone",
    "address",
    "cedula",
    "type",
    "active",
  ];
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      paramCount++;
      updates.push(`${field as string} = $${paramCount}`);
      values.push(data[field] ?? null);
    }
  }

  if (updates.length === 0) {
    const response = NextResponse.json({ error: "No fields to update" }, { status: 400 });
    setCORSHeaders(response);
    return response;
  }

  paramCount++;
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(donor_id);

  const result = await executeWithContext(auth, 
    `UPDATE donors SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    const response = NextResponse.json({ error: "Donor not found" }, { status: 404 });
    setCORSHeaders(response);
    return response;
  }

  const response = NextResponse.json({
    success: true,
    data: result.rows[0],
    message: "Donor updated successfully"
  });

  setCORSHeaders(response);
  return response;
}

// Update contribution
async function updateContribution(auth: AuthContext | null, contribution_id: string, data: ContributionUpdatePayload) {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  let paramCount = 0;

  const updatableFields: Array<keyof ContributionUpdatePayload> = [
    "date",
    "amount",
    "type",
    "method",
    "receipt_number",
    "notes",
  ];
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      paramCount++;
      updates.push(`${field as string} = $${paramCount}`);
      values.push(data[field] ?? null);
    }
  }

  if (updates.length === 0) {
    const response = NextResponse.json({ error: "No fields to update" }, { status: 400 });
    setCORSHeaders(response);
    return response;
  }

  paramCount++;
  values.push(contribution_id);

  const result = await executeWithContext(auth, 
    `UPDATE contributions SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    const response = NextResponse.json({ error: "Contribution not found" }, { status: 404 });
    setCORSHeaders(response);
    return response;
  }

  const response = NextResponse.json({
    success: true,
    data: result.rows[0],
    message: "Contribution updated successfully"
  });

  setCORSHeaders(response);
  return response;
}

// DELETE /api/donors - Delete donor or contribution
async function handleDelete(req: NextRequest) {
  try {
    const user = await getAuthContext(req);
    if (!user) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const donor_id = searchParams.get("id");
    const contribution_id = searchParams.get("contribution_id");

    if (contribution_id) {
      await executeWithContext(user, `DELETE FROM contributions WHERE id = $1`, [contribution_id]);
      const response = NextResponse.json({ success: true, message: "Contribution deleted" });
      setCORSHeaders(response);
      return response;
    }

    if (!donor_id) {
      const response = NextResponse.json({ error: "ID is required" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    // Soft delete donor (mark as inactive)
    await executeWithContext(user, `UPDATE donors SET active = false WHERE id = $1`, [donor_id]);

    const response = NextResponse.json({ success: true, message: "Donor deactivated" });
    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error("Error in donors DELETE:", error);
    const response = NextResponse.json(
      { error: "Error deleting donor record", details: error instanceof Error ? error.message : "Unknown error" },
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