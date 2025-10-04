import { type NextRequest, NextResponse } from 'next/server';
import { executeWithContext, executeTransaction } from '@/lib/db';
import { firstOrDefault, expectOne } from '@/lib/db-helpers';
import { requireAdmin } from '@/lib/auth-supabase';
import { withRateLimit } from '@/lib/rate-limit';
import { createTransaction as createLedgerTransaction } from '@/app/api/reports/route-helpers';

// Admin endpoint for full transaction management
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Rate limiting check
    const rateLimitResponse = await withRateLimit(request, 'admin');
    if (rateLimitResponse) return rateLimitResponse;

    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const fund_id = searchParams.get('fund_id');
    const church_id = searchParams.get('church_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const typeFilter = searchParams.get('type');
    const limit = searchParams.get('limit') || '1000';
    const offset = searchParams.get('offset') || '0';

    // Build query with filters
    const conditions = [];
    const params = [];

    if (fund_id) {
      params.push(fund_id);
      conditions.push(`t.fund_id = $${params.length}`);
    }

    if (church_id) {
      params.push(church_id);
      conditions.push(`t.church_id = $${params.length}`);
    }

    if (start_date) {
      params.push(start_date);
      conditions.push(`t.date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`t.date <= $${params.length}`);
    }

    if (typeFilter) {
      if (typeFilter === 'automatic') {
        conditions.push("t.created_by IN ('system', 'legacy-import')");
      } else if (typeFilter === 'manual') {
        conditions.push("t.created_by NOT IN ('system', 'legacy-import', 'system-reconciliation')");
      } else if (typeFilter === 'reconciliation') {
        conditions.push("t.created_by = 'system-reconciliation'");
      } else {
        params.push(typeFilter);
        conditions.push(`t.created_by = $${params.length}`);
      }
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get transactions with fund, church, and provider details
    params.push(limit, offset);
    const result = await executeWithContext(auth, `
      SELECT
        t.*,
        f.name as fund_name,
        c.name as church_name,
        p.nombre as provider_name,
        p.ruc as provider_ruc,
        p.categoria as provider_categoria,
        (SUM(t.amount_in - t.amount_out) OVER (ORDER BY t.date, t.id)) as running_balance
      FROM transactions t
      LEFT JOIN funds f ON t.fund_id = f.id
      LEFT JOIN churches c ON t.church_id = c.id
      LEFT JOIN providers p ON t.provider_id = p.id
      ${whereClause}
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `, params);

    // Get total count for pagination
    const countResult = await executeWithContext(auth, `
      SELECT COUNT(*) as total
      FROM transactions t
      ${whereClause}
    `, params.slice(0, -2));

    const countRow = firstOrDefault(countResult.rows, { total: 0 });

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total: Number.parseInt(String(countRow['total'] ?? '0'), 10),
        limit: Number.parseInt(limit, 10),
        offset: Number.parseInt(offset, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST: Create external transaction
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

    try {
      const transaction = await createLedgerTransaction({
        fund_id,
        concept,
        provider: provider ?? null,
        provider_id: data.provider_id ?? null,
        document_number: document_number ?? null,
        amount_in,
        amount_out,
        date,
        created_by: 'treasurer'
      }, auth);

      return NextResponse.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error creating external transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// DELETE: Remove transaction (with balance adjustment)
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const transaction_id = searchParams.get('id');

    if (!transaction_id) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    let deletedFundId: number | null = null;

    await executeTransaction(auth, async (client) => {
      const txn = await client.query(
        `SELECT * FROM transactions WHERE id = $1`,
        [transaction_id]
      );

      const transaction = expectOne(txn.rows);
      deletedFundId = transaction.fund_id;

      await client.query(`DELETE FROM fund_movements_enhanced WHERE transaction_id = $1`, [transaction_id]);
      await client.query(`DELETE FROM transactions WHERE id = $1`, [transaction_id]);

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

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
      fundId: deletedFundId
    });
  } catch (error) {
    const isNotFound = error instanceof Error && error.message === 'Transaction not found';
    if (!isNotFound) {
      console.error('Error deleting transaction:', error);
    }
    return NextResponse.json(
      { success: false, error: isNotFound ? 'Transaction not found' : 'Failed to delete transaction' },
      { status: isNotFound ? 404 : 500 }
    );
  }
}