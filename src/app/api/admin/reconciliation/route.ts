import { NextRequest, NextResponse } from 'next/server';

import { generateReconciliation } from '@/lib/db-admin';
import { requireAdmin } from '@/lib/auth-supabase';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const fundIdParam = searchParams.get('fund_id');
    const fundId = fundIdParam ? Number(fundIdParam) : undefined;

    const data = await generateReconciliation(auth, fundId);
    const summary = {
      totalFunds: data.length,
      balanced: data.filter(item => item['status'] === 'balanced').length,
      discrepancies: data.filter(item => item['status'] !== 'balanced'),
      totalDifference: data.reduce((sum, item) => sum + Number(item['difference'] || 0), 0)
    };

    return NextResponse.json({ success: true, data, summary });
  } catch (error) {
    console.error('Error generating reconciliation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate reconciliation report' },
      { status: 500 }
    );
  }
}
