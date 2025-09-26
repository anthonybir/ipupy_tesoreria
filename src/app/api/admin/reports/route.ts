import { NextRequest, NextResponse } from 'next/server';

import { executeWithContext } from '@/lib/db';
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
  const incomes = {
    diezmos: toNumber(row.diezmos),
    ofrendas: toNumber(row.ofrendas),
    anexos: toNumber(row.anexos),
    misiones: toNumber(row.misiones),
    lazosAmor: toNumber(row.lazos_amor),
    misionPosible: toNumber(row.mision_posible),
    caballeros: toNumber(row.caballeros ?? row.aporte_caballeros),
    damas: toNumber(row.damas),
    apy: toNumber(row.apy),
    iba: toNumber(row.iba ?? row.instituto_biblico),
    jovenes: toNumber(row.jovenes),
    ninos: toNumber(row.ninos),
    otros: toNumber(row.otros)
  };

  const expenses = {
    energiaElectrica: toNumber(row.energia_electrica),
    agua: toNumber(row.agua),
    recoleccionBasura: toNumber(row.recoleccion_basura),
    servicios: toNumber(row.servicios),
    mantenimiento: toNumber(row.mantenimiento),
    materiales: toNumber(row.materiales),
    otrosGastos: toNumber(row.otros_gastos),
    honorariosPastoral: toNumber(row.honorarios_pastoral)
  };

  const totals = {
    totalEntradas: toNumber(row.total_entradas) || Object.values(incomes).reduce((sum, val) => sum + val, 0),
    fondoNacional: toNumber(row.fondo_nacional) || toNumber(row.diezmo_nacional_calculado),
    totalDesignado: toNumber(row.total_designado),
    totalOperativo: toNumber(row.total_operativo),
    totalSalidas: toNumber(row.total_salidas_calculadas) || toNumber(row.total_salidas),
    saldoCalculado: toNumber(row.saldo_calculado),
    saldoFinMes: toNumber(row.saldo_fin_mes)
  };

  return {
    id: row.id,
    churchId: row.church_id,
    churchName: row.church_name,
    month: row.month,
    year: row.year,
    status: (row.estado as string) || 'desconocido',
    transactionsCreated: Boolean(row.transactions_created),
    transactionsCreatedAt: row.transactions_created_at,
    processedBy: row.processed_by,
    processedAt: row.processed_at,
    submittedAt: row.submitted_at,
    submissionType: row.submission_type,
    observations: row.observaciones,
    incomes,
    expenses,
    totals,
    raw: row
  };
};

export async function GET(request: NextRequest) {
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

export async function PATCH(request: NextRequest) {
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

    return NextResponse.json({
      success: true,
      data: mapReportRow(result.rows[0])
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update report' },
      { status: 500 }
    );
  }
}
