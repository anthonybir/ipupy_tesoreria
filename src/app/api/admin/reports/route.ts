import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';
import {
  mapReportDocumentToRaw,
  type ConvexReportDocument,
} from '@/lib/convex-adapters';
import { normalizeReportRecord } from '@/types/api';
import { getChurchConvexId } from '@/lib/convex-id-mapping';

/**
 * Admin Reports API - Migrated to Convex
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 *
 * Admin view of all reports (delegates to main reports API)
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);

    // Parse filters (same as main reports route)
    const church_id = searchParams.get('church_id');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const estado = searchParams.get('estado');

    const args: {
      churchId?: Id<'churches'>;
      year?: number;
      month?: number;
    } = {};

    if (church_id) {
      const numericId = Number.parseInt(church_id, 10);
      if (Number.isNaN(numericId)) {
        throw new ValidationError('church_id inválido');
      }
      const convexChurchId = await getChurchConvexId(client, numericId);
      if (!convexChurchId) {
        throw new ValidationError(`Iglesia ${numericId} no encontrada`);
      }
      args.churchId = convexChurchId;
    }
    if (year) {
      const parsedYear = Number.parseInt(year, 10);
      if (Number.isNaN(parsedYear)) {
        throw new ValidationError('year inválido');
      }
      args.year = parsedYear;
    }
    if (month) {
      const parsedMonth = Number.parseInt(month, 10);
      if (Number.isNaN(parsedMonth)) {
        throw new ValidationError('month inválido');
      }
      args.month = parsedMonth;
    }

    const result = await client.query(api.reports.list, args);
    const reports = (result as ConvexReportDocument[])
      .map((report) => normalizeReportRecord(mapReportDocumentToRaw(report)))
      .filter((report) =>
        estado ? report.status.toLowerCase() === estado.toLowerCase() : true
      );

    return NextResponse.json(
      {
        success: true,
        data: reports,
      } satisfies ApiResponse<typeof reports>,
    );
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/admin/reports');
  }
}
