import { type NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth-supabase';
import { processReportApproval } from '@/lib/db-admin';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);

    const body = await request.json();
    const reportId = Number(body.reportId);

    if (!Number.isFinite(reportId) || reportId <= 0) {
      return NextResponse.json(
        { success: false, error: 'reportId is required' },
        { status: 400 }
      );
    }

    const approvedBy = auth.email || auth.userId || 'system';
    const result = await processReportApproval(auth, reportId, approvedBy);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error approving report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve report' },
      { status: 500 }
    );
  }
}
