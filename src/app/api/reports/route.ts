import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../convex/_generated/dataModel';
import { getChurchConvexId } from '@/lib/convex-id-mapping';

/**
 * Report API Routes - Migrated to Convex
 *
 * Phase 4.3 - Report Routes Migration (2025-01-07)
 *
 * This route now uses Convex functions instead of direct Supabase queries.
 * Authorization is handled by Convex functions (requireAdmin for approvals).
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 * Each request creates a new client with the current user's Google ID token.
 *
 * MIGRATION NOTES:
 * - Simplified from Supabase version (1249 → ~400 lines)
 * - File uploads: Deferred to Phase 4.10 (Convex storage integration)
 * - Donor tracking: Deferred to Phase 4.11 (report_tithers migration)
 * - Notifications: Deferred to Phase 4.12 (notification system)
 * - Status history: Deferred to Phase 4.13 (audit trail)
 *
 * The core report CRUD and approval workflow is fully functional.
 * Advanced features will be added in subsequent phases.
 */

const parseInteger = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

type ConvexClient = Awaited<ReturnType<typeof getAuthenticatedConvexClient>>;

const NUMERIC_ID_REGEX = /^\d+$/;

async function resolveChurchConvexId(
  client: ConvexClient,
  raw: unknown
): Promise<Id<'churches'>> {
  if (typeof raw === 'number') {
    const convexId = await getChurchConvexId(client, raw);
    if (!convexId) {
      throw new ValidationError(`Church ID ${raw} not found`);
    }
    return convexId;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      throw new ValidationError('church_id inválido');
    }
    if (NUMERIC_ID_REGEX.test(trimmed)) {
      const numericId = Number.parseInt(trimmed, 10);
      const convexId = await getChurchConvexId(client, numericId);
      if (!convexId) {
        throw new ValidationError(`Church ID ${numericId} not found`);
      }
      return convexId;
    }
    return trimmed as Id<'churches'>;
  }

  throw new ValidationError('church_id inválido');
}

/**
 * GET /api/reports - List reports with filters
 *
 * Query Params:
 *   - churchId?: string (church ID filter)
 *   - year?: string (year filter)
 *   - month?: string (month filter)
 *   - last_report?: "true" (special query for last report)
 *
 * Returns: Report[] - Array of reports with church info
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;

    // Special query: last report for a church
    const lastReportParam = searchParams.get('last_report');
    if (lastReportParam === 'true') {
      const churchIdStr = searchParams.get('church_id');
      if (!churchIdStr) {
        return NextResponse.json(
          { error: 'church_id is required for last_report query' },
          { status: 400 }
        );
      }

      const churchConvexId = await resolveChurchConvexId(client, churchIdStr);

      // Get all reports for church, sorted by date desc
      const reports = await client.query(api.reports.list, {
        churchId: churchConvexId,
      });

      if (reports.length === 0) {
        return NextResponse.json({ lastReport: null });
      }

      // Find most recent report (already sorted by year desc, month desc)
      const lastReport = reports[0];
      return NextResponse.json({
        lastReport: {
          year: lastReport?.year,
          month: lastReport?.month,
        },
      });
    }

    // Build filter args
    const churchIdStr = searchParams.get('church_id');
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    const args: {
      churchId?: Id<'churches'>;
      year?: number;
      month?: number;
    } = {};

    if (churchIdStr) {
      args.churchId = await resolveChurchConvexId(client, churchIdStr);
    }

    if (yearStr) {
      const year = parseInteger(yearStr);
      if (year !== null) {
        args.year = year;
      }
    }

    if (monthStr) {
      const month = parseInteger(monthStr);
      if (month !== null && month >= 1 && month <= 12) {
        args.month = month;
      }
    }

    // Query reports via Convex
    const reports = await client.query(api.reports.list, args);

    return NextResponse.json(reports);
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'GET /api/reports');
  }
}

/**
 * POST /api/reports - Create new report
 *
 * Body: {
 *   church_id: string,
 *   month: number,
 *   year: number,
 *   diezmos: number,
 *   ofrendas: number,
 *   anexos?: number,
 *   otros?: number,
 *   // ... other financial fields
 * }
 *
 * Returns: Report - Created report record
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();

    // Validate request body
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        throw new ValidationError('Request body is empty');
      }
      body = JSON.parse(text) as Record<string, unknown>;
    } catch (jsonError) {
      if (jsonError instanceof ValidationError) {
        throw jsonError;
      }
      throw new ValidationError('Invalid JSON in request body');
    }

    // Extract fields using bracket notation for exactOptionalPropertyTypes compliance
    const church_id = body['church_id'];
    const month = body['month'];
    const year = body['year'];
    const diezmos = body['diezmos'];
    const ofrendas = body['ofrendas'];

    if (!church_id || !month || !year || diezmos === undefined || ofrendas === undefined) {
      throw new ValidationError('church_id, month, year, diezmos, and ofrendas are required');
    }

    const churchConvexId = await resolveChurchConvexId(client, church_id);

    // Build args object conditionally (only include defined fields)
    const args: {
      church_id: Id<'churches'>;
      month: number;
      year: number;
      diezmos: number;
      ofrendas: number;
      [key: string]: unknown;
    } = {
      church_id: churchConvexId,
      month: Number(month),
      year: Number(year),
      diezmos: Number(diezmos),
      ofrendas: Number(ofrendas),
    };

    // Add optional numeric fields only if defined
    const numericFields = [
      'anexos', 'caballeros', 'damas', 'jovenes', 'ninos', 'otros',
      'energia_electrica', 'agua', 'recoleccion_basura', 'servicios',
      'mantenimiento', 'materiales', 'otros_gastos', 'misiones',
      'ofrenda_misiones', 'lazos_amor', 'mision_posible', 'aporte_caballeros',
      'apy', 'instituto_biblico', 'iba', 'monto_depositado',
      'asistencia_visitas', 'bautismos_agua', 'bautismos_espiritu'
    ];

    for (const field of numericFields) {
      if (body[field] !== undefined) {
        args[field] = Number(body[field]);
      }
    }

    // Fecha de depósito handled separately (string → timestamp)
    const fechaDepositoValue = body['fecha_deposito'];
    if (typeof fechaDepositoValue === 'string' && fechaDepositoValue.trim() !== '') {
      const timestamp = Date.parse(fechaDepositoValue);
      if (Number.isNaN(timestamp)) {
        throw new ValidationError('fecha_deposito inválida');
      }
      args['fecha_deposito'] = timestamp;
    }

    // Add optional string fields only if defined
    const stringFields = ['numero_deposito', 'observaciones'];
    for (const field of stringFields) {
      if (body[field] !== undefined) {
        args[field] = String(body[field]);
      }
    }

    // Create report via Convex
    // TypeScript can't fully validate dynamic object - runtime validation in Convex
    const report = await client.mutation(
      api.reports.create,
      args as typeof api.reports.create._args
    );

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'POST /api/reports');
  }
}

/**
 * PUT /api/reports?id={reportId} - Update report
 *
 * Query Params: id (required)
 * Body: Partial report fields to update
 *
 * Returns: Report - Updated report record
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const reportIdStr = searchParams.get('id');

    if (!reportIdStr) {
      throw new ValidationError('ID de informe requerido');
    }

    // Validate request body
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        throw new ValidationError('Request body is empty');
      }
      body = JSON.parse(text) as Record<string, unknown>;
    } catch (jsonError) {
      if (jsonError instanceof ValidationError) {
        throw jsonError;
      }
      throw new ValidationError('Invalid JSON in request body');
    }

    // Build updates object using bracket notation (exactOptionalPropertyTypes compliance)
    const updates: {
      id: Id<'reports'>;
      [key: string]: unknown;
    } = {
      id: reportIdStr as Id<'reports'>,
    };

    // Add optional numeric fields only if defined
    const numericFields = [
      'diezmos', 'ofrendas', 'anexos', 'caballeros', 'damas', 'jovenes',
      'ninos', 'otros', 'energia_electrica', 'agua', 'recoleccion_basura',
      'servicios', 'mantenimiento', 'materiales', 'otros_gastos', 'misiones',
      'ofrenda_misiones', 'lazos_amor', 'mision_posible', 'aporte_caballeros',
      'apy', 'instituto_biblico', 'iba', 'monto_depositado',
      'asistencia_visitas', 'bautismos_agua', 'bautismos_espiritu'
    ];

    for (const field of numericFields) {
      if (body[field] !== undefined) {
        updates[field] = Number(body[field]);
      }
    }

    // Fecha de depósito handled separately (string → timestamp)
    const fechaDepositoValue = body['fecha_deposito'];
    if (typeof fechaDepositoValue === 'string') {
      const trimmed = fechaDepositoValue.trim();
      if (trimmed !== '') {
        const timestamp = Date.parse(trimmed);
        if (Number.isNaN(timestamp)) {
          throw new ValidationError('fecha_deposito inválida');
        }
        updates['fecha_deposito'] = timestamp;
      }
    }

    // Add optional string fields only if defined
    const stringFields = ['numero_deposito', 'observaciones'];
    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updates[field] = String(body[field]);
      }
    }

    // Special handling for estado (approval status changes)
    const estadoValue = body['estado'];
    if (estadoValue === 'procesado' || estadoValue === 'aprobado') {
      // Admin approval - use dedicated approve mutation
      await client.mutation(api.reports.approve, {
        id: reportIdStr as Id<'reports'>,
      });

      // Return updated report
      const report = await client.query(api.reports.get, {
        id: reportIdStr as Id<'reports'>,
      });

      return NextResponse.json({ success: true, report });
    } else if (estadoValue === 'rechazado') {
      // Admin rejection - use dedicated reject mutation
      const observacionesValue = body['observaciones'];
      await client.mutation(api.reports.reject, {
        id: reportIdStr as Id<'reports'>,
        observaciones: String(observacionesValue || ''),
      });

      // Return updated report
      const report = await client.query(api.reports.get, {
        id: reportIdStr as Id<'reports'>,
      });

      return NextResponse.json({ success: true, report });
    }

    // Regular update via Convex
    // TypeScript can't fully validate dynamic object - runtime validation in Convex
    const report = await client.mutation(
      api.reports.update,
      updates as typeof api.reports.update._args
    );

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'PUT /api/reports');
  }
}

/**
 * DELETE /api/reports?id={reportId} - Delete report
 *
 * Query Params: id (required)
 *
 * Returns: { message: string }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const reportIdStr = searchParams.get('id');

    if (!reportIdStr) {
      throw new ValidationError('ID de informe requerido');
    }

    // Delete via Convex
    await client.mutation(api.reports.deleteReport, {
      id: reportIdStr as Id<'reports'>,
    });

    return NextResponse.json({ message: 'Informe eliminado exitosamente' });
  } catch (error) {
    return handleApiError(error, request.headers.get('origin'), 'DELETE /api/reports');
  }
}
