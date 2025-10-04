import { type NextRequest, NextResponse } from 'next/server';

import { executeWithContext } from '@/lib/db';
import { firstOrNull } from '@/lib/db-helpers';
import { requireAdmin } from '@/lib/auth-supabase';

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapStatusFilter = (status: string | null) => {
  if (!status) return null;
  switch (status) {
    case 'pending':
      return { condition: 'r.transactions_created = FALSE', params: [] as unknown[] };
    case 'approved':
      return { condition: 'r.transactions_created = TRUE', params: [] as unknown[] };
    case 'rejected':
      return { condition: "r.estado IN ('rechazado', 'rechazado_admin')", params: [] as unknown[] };
    default:
      return { condition: 'r.estado = $PLACEHOLDER$', params: [status] as unknown[] };
  }
};

const buildWhereClause = (searchParams: URLSearchParams) => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const statusFilter = mapStatusFilter(searchParams.get('status'));
  if (statusFilter) {
    if (statusFilter.condition.includes('$PLACEHOLDER$')) {
      const placeholder = `$${params.length + 1}`;
      conditions.push(statusFilter.condition.replace('$PLACEHOLDER$', placeholder));
      params.push(...statusFilter.params);
    } else {
      conditions.push(statusFilter.condition);
      params.push(...statusFilter.params);
    }
  }

  const year = searchParams.get('year');
  if (year) {
    params.push(year);
    conditions.push(`r.year = $${params.length}`);
  }

  const month = searchParams.get('month');
  if (month) {
    params.push(month);
    conditions.push(`r.month = $${params.length}`);
  }

  const churchId = searchParams.get('church_id');
  if (churchId) {
    params.push(churchId);
    conditions.push(`r.church_id = $${params.length}`);
  }

  const startDate = searchParams.get('start');
  if (startDate) {
    params.push(startDate);
    conditions.push(`r.created_at >= $${params.length}`);
  }

  const endDate = searchParams.get('end');
  if (endDate) {
    params.push(endDate);
    conditions.push(`r.created_at <= $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
};

const mapReportRow = (row: Record<string, unknown>) => {
  const pick = <T = unknown>(key: string): T | undefined => row[key] as T | undefined;
  const numeric = (key: string, fallback?: string) => {
    const value = pick(key);
    if ((value === undefined || value === null) && fallback) {
      return toNumber(pick(fallback));
    }
    return toNumber(value);
  };

  const incomes = {
    diezmos: numeric('diezmos'),
    ofrendas: numeric('ofrendas'),
    anexos: numeric('anexos'),
    misiones: numeric('misiones'),
    lazosAmor: numeric('lazos_amor'),
    misionPosible: numeric('mision_posible'),
    caballeros: numeric('caballeros', 'aporte_caballeros'),
    damas: numeric('damas'),
    apy: numeric('apy'),
    iba: numeric('iba', 'instituto_biblico'),
    jovenes: numeric('jovenes'),
    ninos: numeric('ninos'),
    otros: numeric('otros')
  };

  const expenses = {
    energiaElectrica: numeric('energia_electrica'),
    agua: numeric('agua'),
    recoleccionBasura: numeric('recoleccion_basura'),
    servicios: numeric('servicios'),
    mantenimiento: numeric('mantenimiento'),
    materiales: numeric('materiales'),
    otrosGastos: numeric('otros_gastos'),
    honorariosPastoral: numeric('honorarios_pastoral')
  };

  const totals = {
    totalEntradas: numeric('total_entradas') || Object.values(incomes).reduce((sum, val) => sum + val, 0),
    fondoNacional: numeric('fondo_nacional') || numeric('diezmo_nacional_calculado'),
    totalDesignado: numeric('total_designado'),
    totalOperativo: numeric('total_operativo'),
    totalSalidas: numeric('total_salidas_calculadas') || numeric('total_salidas'),
    saldoCalculado: numeric('saldo_calculado'),
    saldoFinMes: numeric('saldo_fin_mes')
  };

  return {
    id: pick('id'),
    churchId: pick('church_id'),
    churchName: pick('church_name'),
    month: pick('month'),
    year: pick('year'),
    status: pick<string>('estado') ?? 'desconocido',
    transactionsCreated: Boolean(pick('transactions_created')),
    transactionsCreatedAt: pick('transactions_created_at'),
    processedBy: pick('processed_by'),
    processedAt: pick('processed_at'),
    submittedAt: pick('submitted_at'),
    submissionType: pick('submission_type'),
    observations: pick('observaciones'),
    incomes,
    expenses,
    totals,
    raw: row
  };
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const { whereClause, params } = buildWhereClause(searchParams);
    const limit = Number(searchParams.get('limit') ?? 200);

    params.push(limit);

    const result = await executeWithContext(
      auth,
      `
        SELECT
          r.*, c.name AS church_name
        FROM reports r
        LEFT JOIN churches c ON c.id = r.church_id
        ${whereClause}
        ORDER BY r.year DESC, r.month DESC, c.name ASC
        LIMIT $${params.length}
      `,
      params
    );

    const data = result.rows.map(mapReportRow);

    const summary = {
      total: data.length,
      pending: data.filter(item => !item.transactionsCreated).length,
      approved: data.filter(item => item.transactionsCreated).length,
      totalEntradas: data.reduce((sum, item) => sum + item.totals.totalEntradas, 0),
      totalDesignado: data.reduce((sum, item) => sum + item.totals.totalDesignado, 0),
      totalOperativo: data.reduce((sum, item) => sum + item.totals.totalOperativo, 0)
    };

    return NextResponse.json({ success: true, data, summary });
  } catch (error) {
    console.error('Error fetching admin reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(request);

    const body = await request.json();
    const { reportId, estado, observations, transactionsCreated } = body;
    const actorEmail = auth.email || auth.userId || 'system';

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'reportId is required' },
        { status: 400 }
      );
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [reportId];

    if (estado) {
      params.push(estado);
      updates.push(`estado = $${params.length}`);

      if (estado === 'pendiente_admin') {
        updates.push('processed_by = NULL');
        updates.push('processed_at = NULL');
      } else if (['rechazado_admin', 'aprobado_admin', 'procesado'].includes(estado)) {
        params.push(actorEmail);
        updates.push(`processed_by = $${params.length}`);
        updates.push('processed_at = NOW()');
      }
    }

    if (typeof observations === 'string') {
      params.push(observations);
      updates.push(`observaciones = $${params.length}`);
    }

    if (typeof transactionsCreated === 'boolean') {
      params.push(transactionsCreated);
      updates.push(`transactions_created = $${params.length}`);
      if (transactionsCreated) {
        updates.push('transactions_created_at = NOW()');
        params.push(actorEmail);
        updates.push(`transactions_created_by = $${params.length}`);
      } else {
        updates.push('transactions_created_at = NULL');
        updates.push('transactions_created_by = NULL');
      }
    }

    if (updates.length === 1) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const result = await executeWithContext(
      auth,
      `
        UPDATE reports
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING *
      `,
      params
    );

    const updatedRow = firstOrNull(result.rows);
    if (!updatedRow) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapReportRow(updatedRow)
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update report' },
      { status: 500 }
    );
  }
}
