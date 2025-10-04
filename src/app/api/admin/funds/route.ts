import { type NextRequest, NextResponse } from 'next/server';
import { fetchFundBalances, addExternalTransaction } from '@/lib/db-admin';
import { executeWithContext } from '@/lib/db';
import { expectOne } from '@/lib/db-helpers';
import { requireAdmin } from '@/lib/auth-supabase';

// Admin-only fund management using direct pool access
// GET: Fetch all funds with full ledger calculations
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const type = searchParams.get('type');

    const funds = await fetchFundBalances(auth, {
      includeInactive,
      type: type || null
    });

    // Return funds with both stored and calculated balances
    return NextResponse.json({
      success: true,
      data: funds,
      summary: {
        total_funds: funds.length,
        total_balance: funds.reduce((sum, fund) =>
          sum + parseFloat(fund.calculated_balance), 0
        )
      }
    });
  } catch (error) {
    console.error('Error fetching fund balances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fund balances' },
      { status: 500 }
    );
  }
}

// POST: Create external transaction (treasurer manual entry)
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);
    const data = await request.json();
    const {
      fund_id,
      concept,
      amount_in = 0,
      amount_out = 0,
      date,
      provider,
      document_number
    } = data;

    // Validate required fields
    if (!fund_id || !concept || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const txn = await addExternalTransaction(auth, {
      fund_id,
      concept,
      amount_in,
      amount_out,
      date,
      provider,
      document_number
    });

    return NextResponse.json({
      success: true,
      data: txn
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// PUT: Update fund settings or perform adjustments
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);
    const data = await request.json();
    const { fund_id, action } = data;

    if (action === 'reconcile') {
      // Recalculate balance from transaction history
      const result = await executeWithContext(auth, `
        UPDATE funds f
        SET current_balance = COALESCE((
          SELECT SUM(t.amount_in - t.amount_out)
          FROM transactions t
          WHERE t.fund_id = f.id
        ), 0),
        updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [fund_id]);

      return NextResponse.json({
        success: true,
        data: expectOne(result.rows),
        message: 'Fund balance reconciled'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating fund:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update fund' },
      { status: 500 }
    );
  }
}