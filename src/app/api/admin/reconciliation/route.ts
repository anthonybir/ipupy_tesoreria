import { type NextRequest, NextResponse } from 'next/server';

/**
 * Admin Reconciliation API - Deferred (Non-Critical)
 *
 * Phase 4.10 - Remaining Admin Routes (2025-01-07)
 *
 * STATUS: Temporarily unavailable - requires complex data analysis functions in Convex
 * This feature performs bank reconciliation analysis across funds and will be
 * implemented in a future phase.
 */

export async function GET(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: 'Reconciliation feature temporarily unavailable - being migrated to Convex',
      message: 'Esta funcionalidad será habilitada en la próxima actualización',
    },
    { status: 503 }
  );
}
