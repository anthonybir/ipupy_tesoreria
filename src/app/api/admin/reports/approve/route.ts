import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';

/**
 * Admin Report Approval API - Migrated to Convex
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await req.json();

    const { report_id } = body as { report_id?: string };

    if (!report_id) {
      throw new ValidationError('report_id es requerido');
    }

    const report = await client.mutation(api.reports.approve, {
      id: report_id as Id<'reports'>,
    });

    // ApiResponse envelope with message
    type Report = typeof report;
    const response: ApiResponse<Report> & { message: string } = {
      success: true,
      data: report,
      message: 'Informe aprobado exitosamente',
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/admin/reports/approve');
  }
}
