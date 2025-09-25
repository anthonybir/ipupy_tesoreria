import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-context';
import { processReportApproval } from '@/lib/db-admin';

const isAdminRole = (role?: string) => role === 'admin' || role === 'super_admin';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!isAdminRole(auth.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const reportId = Number(body.reportId);

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'reportId is required' },
        { status: 400 }
      );
    }

    const approvedBy = auth.email || auth.userId || 'system';
    const result = await processReportApproval(reportId, approvedBy);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error approving report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve report' },
      { status: 500 }
    );
  }
}
