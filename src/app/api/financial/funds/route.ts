import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/server";
import { setCORSHeaders } from "@/lib/cors";


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
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const type = searchParams.get("type");

    // Build query for funds
    let fundsQuery = supabase
      .from('funds')
      .select('*');

    if (!includeInactive) {
      fundsQuery = fundsQuery.eq('is_active', true);
    }

    if (type) {
      fundsQuery = fundsQuery.eq('type', type);
    }

    const { data: funds, error: fundsError } = await fundsQuery.order('is_active', { ascending: false }).order('name');

    if (fundsError) throw fundsError;

    // Get all transactions to calculate balances
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('fund_id, amount_in, amount_out');

    if (txError) throw txError;

    // Calculate balances for each fund
    const fundsWithBalances = (funds || []).map(fund => {
      const fundTransactions = transactions?.filter(t => t.fund_id === fund.id) || [];
      const balance = fundTransactions.reduce((sum, t) => {
        return sum + (Number(t.amount_in) || 0) - (Number(t.amount_out) || 0);
      }, 0);

      return {
        ...fund,
        current_balance: balance
      };
    });

    // Calculate totals
    const totals = {
      total_funds: fundsWithBalances.length,
      active_funds: fundsWithBalances.filter(f => f.is_active).length,
      total_balance: fundsWithBalances.reduce((sum, f) => sum + Number(f.current_balance || 0), 0),
      total_target: 0
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
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('funds')
      .select('id')
      .ilike('name', body.name);

    if (existing && existing.length > 0) {
      const response = NextResponse.json({ error: "A fund with this name already exists" }, { status: 409 });
      setCORSHeaders(response);
      return response;
    }

    const { data: newFund, error: insertError } = await supabase
      .from('funds')
      .insert({
        name: body.name,
        description: body.description || "",
        type: body.type || "general",
        current_balance: body.initial_balance || 0,
        is_active: body.is_active !== false,
        created_by: user.email
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const response = NextResponse.json({
      success: true,
      data: newFund,
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

    if (!body.name && !body.description && body.type === undefined &&
        body.current_balance === undefined && body.is_active === undefined) {
      const response = NextResponse.json({ error: "No fields to update" }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    // Build update object for Supabase
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.current_balance !== undefined) updateData.current_balance = body.current_balance;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const supabase = await createClient();
    const { data: updatedFund, error: updateError } = await supabase
      .from('funds')
      .update(updateData)
      .eq('id', fundId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        const response = NextResponse.json({ error: "Fund not found" }, { status: 404 });
        setCORSHeaders(response);
        return response;
      }
      throw updateError;
    }

    const response = NextResponse.json({
      success: true,
      data: updatedFund,
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

    const supabase = await createClient();

    // Check if fund has transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .eq('fund_id', fundId)
      .limit(1);

    if (txError) throw txError;

    if (transactions && transactions.length > 0) {
      // Soft delete - just deactivate
      const { error: updateError } = await supabase
        .from('funds')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', fundId);

      if (updateError) throw updateError;

      const response = NextResponse.json({
        success: true,
        message: "Fund deactivated (has transactions)"
      });
      setCORSHeaders(response);
      return response;
    } else {
      // Hard delete - no transactions
      const { error: deleteError } = await supabase
        .from('funds')
        .delete()
        .eq('id', fundId);

      if (deleteError) throw deleteError;

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