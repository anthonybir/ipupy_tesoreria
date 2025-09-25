import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';

// Admin endpoint for full transaction management
export async function GET(request: NextRequest) {
  try {
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

    // Get transactions with fund and church details
    params.push(limit, offset);
    const result = await execute(`
      SELECT
        t.*,
        f.name as fund_name,
        c.name as church_name,
        (SUM(t.amount_in - t.amount_out) OVER (ORDER BY t.date, t.id)) as running_balance
      FROM transactions t
      LEFT JOIN funds f ON t.fund_id = f.id
      LEFT JOIN churches c ON t.church_id = c.id
      ${whereClause}
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `, params);

    // Get total count for pagination
    const countResult = await execute(`
      SELECT COUNT(*) as total
      FROM transactions t
      ${whereClause}
    `, params.slice(0, -2));

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
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
export async function POST(request: NextRequest) {
  try {
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

    // Begin transaction for atomicity
    await execute('BEGIN');

    try {
      // Insert transaction
      const result = await execute(`
        INSERT INTO transactions (
          fund_id, concept, provider, document_number,
          amount_in, amount_out, date, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'treasurer', NOW()
        ) RETURNING *
      `, [
        fund_id,
        concept,
        provider ?? null,
        document_number ?? null,
        amount_in,
        amount_out,
        date
      ]);

      // Update fund balance
      await execute(`
        UPDATE funds
        SET current_balance = current_balance + $1 - $2,
            updated_at = NOW()
        WHERE id = $3
      `, [amount_in, amount_out, fund_id]);

      await execute('COMMIT');

      return NextResponse.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      await execute('ROLLBACK');
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
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transaction_id = searchParams.get('id');

    if (!transaction_id) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    await execute('BEGIN');

    try {
      // Get transaction details
      const txn = await execute(`
        SELECT * FROM transactions WHERE id = $1
      `, [transaction_id]);

      if (txn.rowCount === 0) {
        await execute('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      const transaction = txn.rows[0];

      // Delete transaction
      await execute(`
        DELETE FROM transactions WHERE id = $1
      `, [transaction_id]);

      // Adjust fund balance
      await execute(`
        UPDATE funds
        SET current_balance = current_balance - $1 + $2,
            updated_at = NOW()
        WHERE id = $3
      `, [transaction.amount_in, transaction.amount_out, transaction.fund_id]);

      await execute('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Transaction deleted successfully'
      });
    } catch (error) {
      await execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}