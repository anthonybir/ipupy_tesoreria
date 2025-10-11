import { type NextRequest, NextResponse } from 'next/server';
import type { Id } from '../../../../convex/_generated/dataModel';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../convex/_generated/api';
import { setCORSHeaders, handleCorsPreflight } from '@/lib/cors';
import { getChurchConvexId } from '@/lib/convex-id-mapping';
import { requireAuth } from '@/lib/auth-context';
import type { ApiResponse } from '@/types/utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type DonorType = 'individual' | 'family' | 'business';
type ContributionType = 'diezmo' | 'ofrenda' | 'especial' | 'promesa';
type ContributionMethod = 'efectivo' | 'transferencia' | 'cheque' | 'otro';

type ConvexDonor = {
  id: number | null;
  convex_id: string;
  church_id: number | null;
  church_convex_id: Id<'churches'>;
  church_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cedula: string | null;
  type: DonorType;
  active: boolean;
  contribution_count: number;
  total_contributions: number;
  created_at: string;
  updated_at: string;
};

type ConvexContribution = {
  id: number | null;
  convex_id: Id<'contributions'>;
  donor_id: number | null;
  donor_convex_id: Id<'donors'>;
  church_id: number | null;
  church_convex_id: Id<'churches'>;
  church_name: string | null;
  date: string;
  amount: number;
  type: ContributionType;
  method: ContributionMethod;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ConvexSummary = {
  donor: ConvexDonor;
  summary: {
    yearlyContributions: Array<{ year: number; count: number; total: number; average: number }>;
    contributionsByType: Array<{ type: ContributionType; count: number; total: number }>;
    recentContributions: ConvexContribution[];
  };
};

type DonorResponse = ReturnType<typeof toLegacyDonor>;

type DonorCreatePayload = {
  church_id: number;
  name: string;
  type: DonorType;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  cedula?: string | null;
};

type ContributionCreatePayload = {
  donor_id: number | string;
  church_id: number;
  date: string;
  amount: number;
  type: ContributionType;
  method?: ContributionMethod;
  receipt_number?: string | null;
  notes?: string | null;
};

type DonorUpdatePayload = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  cedula?: string | null;
  type?: DonorType;
  active?: boolean;
};

type ContributionUpdatePayload = {
  date?: string;
  amount?: number;
  type?: ContributionType;
  method?: ContributionMethod;
  receipt_number?: string | null;
  notes?: string | null;
};

type DonorAction = 'donor' | 'contribution';

type DonorQueryAction = 'list' | 'search' | 'summary' | 'contributions';

const corsJson = <T extends ApiResponse<unknown>>(
  payload: T,
  init?: ResponseInit,
): NextResponse => {
  const response = NextResponse.json(payload, init);
  setCORSHeaders(response);
  return response;
};

const corsError = (message: string, status: number, details?: unknown): NextResponse =>
  corsJson<ApiResponse<never>>(
    {
      success: false,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );

const toLegacyDonor = (donor: ConvexDonor) => ({
  id: donor.id ?? 0,
  convex_id: donor.convex_id,
  church_id: donor.church_id ?? null,
  church_convex_id: donor.church_convex_id,
  church_name: donor.church_name,
  name: donor.name,
  email: donor.email,
  phone: donor.phone,
  address: donor.address,
  cedula: donor.cedula,
  type: donor.type,
  active: donor.active,
  contribution_count: donor.contribution_count,
  total_contributions: donor.total_contributions,
  created_at: donor.created_at,
  updated_at: donor.updated_at,
});

const toLegacyContribution = (contribution: ConvexContribution) => ({
  id: contribution.id ?? 0,
  convex_id: contribution.convex_id,
  donor_id: contribution.donor_id ?? null,
  donor_convex_id: contribution.donor_convex_id,
  church_id: contribution.church_id ?? null,
  church_convex_id: contribution.church_convex_id,
  church_name: contribution.church_name,
  date: contribution.date,
  amount: contribution.amount,
  type: contribution.type,
  method: contribution.method,
  receipt_number: contribution.receipt_number,
  notes: contribution.notes,
  created_at: contribution.created_at,
  updated_at: contribution.updated_at,
});

const toLegacySummary = (summary: ConvexSummary) => ({
  success: true,
  data: toLegacyDonor(summary.donor),
  summary: {
    yearlyContributions: summary.summary.yearlyContributions.map((row) => ({
      year: row.year,
      count: row.count,
      total: row.total,
      average: row.average,
    })),
    contributionsByType: summary.summary.contributionsByType.map((row) => ({
      type: row.type,
      count: row.count,
      total: row.total,
    })),
    recentContributions: summary.summary.recentContributions.map(toLegacyContribution),
  },
});

const parseNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = parseNumber(value);
  if (parsed === null || parsed <= 0) return fallback;
  return Math.min(parsed, 500);
};

const parseOffset = (value: string | null): number => {
  const parsed = parseNumber(value);
  if (parsed === null || parsed < 0) return 0;
  return parsed;
};

const parseDateToMillis = (value: string | undefined | null): number => {
  if (!value) throw new Error('La fecha es obligatoria');
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error('Formato de fecha inválido');
  }
  return timestamp;
};

const resolveDonorConvexId = async (
  client: Awaited<ReturnType<typeof getAuthenticatedConvexClient>>,
  rawId: string | number | null,
): Promise<string> => {
  if (rawId === null || rawId === undefined || rawId === '') {
    throw new Error('ID de donante inválido');
  }

  const normalized = typeof rawId === 'string' ? rawId.trim() : String(rawId);
  const numeric = Number.parseInt(normalized, 10);
  if (!Number.isNaN(numeric) && normalized === String(numeric)) {
    const legacyMatch = await client.query(api.donors.findDonorByLegacyId, {
      supabase_id: numeric,
    });
    if (!legacyMatch) {
      throw new Error('Donante no encontrado');
    }
    return legacyMatch;
  }

  return normalized;
};

const resolveChurchConvexId = async (
  client: Awaited<ReturnType<typeof getAuthenticatedConvexClient>>,
  supabaseId: number | null,
): Promise<Id<'churches'> | undefined> => {
  if (supabaseId === null) {
    return undefined;
  }
  const convexId = await getChurchConvexId(client, supabaseId);
  if (!convexId) {
    throw new Error('La iglesia especificada no existe en Convex');
  }
  return convexId as Id<'churches'>;
};

const sanitizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseContributionMethod = (value: unknown): ContributionMethod | undefined => {
  if (typeof value !== 'string') return undefined;
  if ((['efectivo', 'transferencia', 'cheque', 'otro'] as const).includes(value as ContributionMethod)) {
    return value as ContributionMethod;
  }
  return undefined;
};

async function handleGet(req: NextRequest): Promise<NextResponse> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const client = await getAuthenticatedConvexClient();
  const { searchParams } = new URL(req.url);
  const action = (searchParams.get('action') ?? 'list') as DonorQueryAction;
  const churchIdParam = parseNumber(searchParams.get('church_id'));
  const typeParam = searchParams.get('type');

  try {
    switch (action) {
      case 'search': {
        const term = searchParams.get('search');
        if (!term) {
          return corsError('Parámetro "search" requerido', 400);
        }
        const churchConvex = await resolveChurchConvexId(client, churchIdParam);

        // Build search args with conditional spreads to satisfy exactOptionalPropertyTypes
        const searchArgs = {
          searchTerm: term,
          ...(churchConvex ? { churchId: churchConvex } : {}),
        };

        const results = await client.query(api.donors.search, searchArgs);
        return corsJson<ApiResponse<DonorResponse[]>>({
          success: true,
          data: results.map(toLegacyDonor),
        });
      }
      case 'summary': {
        const donorIdParam = searchParams.get('id');
        if (!donorIdParam) {
          return corsError('ID requerido', 400);
        }
        const donorConvexId = await resolveDonorConvexId(client, donorIdParam);
        const summary = await client.query(api.donors.getSummary, {
          donorId: donorConvexId as Id<'donors'>,
        });
        return corsJson(toLegacySummary(summary) as ApiResponse<DonorResponse> & { summary: typeof summary.summary });
      }
      case 'contributions': {
        const donorIdParam = searchParams.get('id');
        if (!donorIdParam) {
          return corsError('ID requerido', 400);
        }
        const donorConvexId = await resolveDonorConvexId(client, donorIdParam);
        const contributions = await client.query(api.donors.getContributions, {
          donorId: donorConvexId as Id<'donors'>,
        });
        return corsJson<ApiResponse<ReturnType<typeof toLegacyContribution>[]>>({
          success: true,
          data: contributions.map(toLegacyContribution),
        });
      }
      case 'list':
      default: {
        const limit = parseLimit(searchParams.get('limit'), 200);
        const offset = parseOffset(searchParams.get('offset'));
        const sortColumn = searchParams.get('sort') ?? 'apellido';
        const sortOrder = (searchParams.get('order') ?? 'ASC').toUpperCase() as 'ASC' | 'DESC';
        const activeFlagParam = searchParams.get('active');
        const activeFlag =
          activeFlagParam === null ? undefined : activeFlagParam === 'true' ? true : activeFlagParam === 'false' ? false : undefined;
        const typeFilter =
          typeParam && (['individual', 'family', 'business'] as const).includes(typeParam as DonorType)
            ? (typeParam as DonorType)
            : undefined;

        const churchConvex = await resolveChurchConvexId(client, churchIdParam);

        // Build list args with conditional spreads to satisfy exactOptionalPropertyTypes
        const listArgs = {
          limit,
          offset,
          sortColumn: sortColumn as 'apellido' | 'nombre' | 'created_at' | 'updated_at' | 'ci_ruc',
          sortOrder,
          ...(churchConvex ? { churchId: churchConvex } : {}),
          ...(activeFlag !== undefined ? { activeFlag } : {}),
          ...(typeFilter ? { type: typeFilter } : {}),
        };

        const result = await client.query(api.donors.list, listArgs);

        return corsJson<ApiResponse<DonorResponse[]> & { total: number }>({
          success: true,
          data: result.data.map(toLegacyDonor),
          total: result.total,
        });
      }
    }
  } catch (error) {
    console.error('Donors GET error:', error);
    return corsError(
      'Error fetching donor data',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

async function handlePost(req: NextRequest): Promise<NextResponse> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const auth = await requireAuth();
    const client = await getAuthenticatedConvexClient();

    const body = (await req.json()) as Record<string, unknown>;
    const action = (typeof body['type'] === 'string' ? body['type'] : 'donor') as DonorAction;

    if (action === 'contribution') {
      const payload = body as ContributionCreatePayload;
      const donorConvexId = await resolveDonorConvexId(client, payload.donor_id);
      const churchConvexId = await resolveChurchConvexId(client, payload.church_id ?? null);
      if (!churchConvexId) {
        return corsError('church_id es requerido', 400);
      }

      const receiptNumber = sanitizeString(payload.receipt_number);
      const notes = sanitizeString(payload.notes);
      const createdBy = auth.email;
      const method = parseContributionMethod(payload.method);

      // Build contribution args with conditional spreads to avoid type inference issues
      const contributionArgs = {
        donor_id: donorConvexId as Id<'donors'>,
        church_id: churchConvexId,
        date: parseDateToMillis(payload.date),
        amount: payload.amount,
        type: payload.type,
        ...(method ? { method } : {}),
        ...(receiptNumber ? { receipt_number: receiptNumber } : {}),
        ...(notes ? { notes } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
      };

      const contribution = await client.mutation(api.donors.createContribution, contributionArgs);

      return corsJson<ApiResponse<ReturnType<typeof toLegacyContribution>> & { receiptNumber: string }>(
        {
          success: true,
          data: toLegacyContribution(contribution),
          receiptNumber: contribution.receipt_number ?? '',
        },
        { status: 201 },
      );
    }

    const payload = body as DonorCreatePayload;
    const churchConvexId = await resolveChurchConvexId(client, payload.church_id ?? null);
    if (!churchConvexId) {
      return corsError('church_id es requerido', 400);
    }

    const email = sanitizeString(payload.email);
    const phone = sanitizeString(payload.phone);
    const address = sanitizeString(payload.address);
    const cedula = sanitizeString(payload.cedula);
    const createdBy = auth.email;

    // Build donor args with conditional spreads to avoid type inference issues
    const donorArgs = {
      church_id: churchConvexId,
      name: payload.name,
      type: payload.type,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
      ...(cedula ? { cedula } : {}),
      ...(createdBy ? { created_by: createdBy } : {}),
    };

    const donor = await client.mutation(api.donors.createDonor, donorArgs);

    return corsJson<ApiResponse<DonorResponse> & { message: string }>(
      {
        success: true,
        data: toLegacyDonor(donor),
        message: 'Donor created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Donors POST error:', error);
    return corsError(
      'Error creating donor record',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

async function handlePut(req: NextRequest): Promise<NextResponse> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    await requireAuth();
    const client = await getAuthenticatedConvexClient();

    const { searchParams } = new URL(req.url);
    const donorIdParam = searchParams.get('id');
    const contributionIdParam = searchParams.get('contribution_id');

    if (contributionIdParam) {
      const contributionId = await resolveDonorConvexId(client, contributionIdParam);
      const payload = (await req.json()) as ContributionUpdatePayload;

      const updates: ContributionUpdatePayload = { ...payload };
      const dateMillis = updates.date ? parseDateToMillis(updates.date) : undefined;
      const receiptNumber = sanitizeString(updates.receipt_number);
      const notes = sanitizeString(updates.notes);

      // Build update payload with conditional spreads to avoid type inference issues
      const updatePayload = {
        ...(dateMillis !== undefined ? { date: dateMillis } : {}),
        ...(updates.amount !== undefined ? { amount: updates.amount } : {}),
        ...(updates.type !== undefined ? { type: updates.type } : {}),
        ...(updates.method !== undefined ? { method: updates.method } : {}),
        ...(receiptNumber ? { receipt_number: receiptNumber } : {}),
        ...(notes ? { notes } : {}),
      };

      const contribution = await client.mutation(api.donors.updateContribution, {
        contribution_id: contributionId as Id<'contributions'>,
        payload: updatePayload,
      });

      return corsJson<ApiResponse<ReturnType<typeof toLegacyContribution>> & { message: string }>(
        {
          success: true,
          data: toLegacyContribution(contribution),
          message: 'Contribution updated successfully',
        },
      );
    }

    if (!donorIdParam) {
      return corsError('Donor ID is required', 400);
    }

    const donorId = await resolveDonorConvexId(client, donorIdParam);
    const payload = (await req.json()) as DonorUpdatePayload;

    const email = sanitizeString(payload.email);
    const phone = sanitizeString(payload.phone);
    const address = sanitizeString(payload.address);
    const cedula = sanitizeString(payload.cedula);

    // Build donor update payload with conditional spreads to avoid type inference issues
    const donorUpdatePayload = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
      ...(cedula ? { cedula } : {}),
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.active !== undefined ? { active: payload.active } : {}),
    };

    const donor = await client.mutation(api.donors.updateDonor, {
      donor_id: donorId as Id<'donors'>,
      payload: donorUpdatePayload,
    });

    return corsJson<ApiResponse<DonorResponse> & { message: string }>(
      {
        success: true,
        data: toLegacyDonor(donor),
        message: 'Donor updated successfully',
      },
    );
  } catch (error) {
    console.error('Donors PUT error:', error);
    return corsError(
      'Error updating donor record',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

async function handleDelete(req: NextRequest): Promise<NextResponse> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    await requireAuth();
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);
    const donorIdParam = searchParams.get('id');
    const contributionIdParam = searchParams.get('contribution_id');

    if (contributionIdParam) {
      const contributionId = await resolveDonorConvexId(client, contributionIdParam);
      await client.mutation(api.donors.deleteContribution, {
        contribution_id: contributionId as Id<'contributions'>,
      });
      return corsJson<ApiResponse<Record<string, never>> & { message: string }>({
        success: true,
        data: {},
        message: 'Contribution deleted',
      });
    }

    if (!donorIdParam) {
      return corsError('ID is required', 400);
    }

    const donorId = await resolveDonorConvexId(client, donorIdParam);
    await client.mutation(api.donors.deactivateDonor, {
      donor_id: donorId as Id<'donors'>,
    });

    return corsJson<ApiResponse<Record<string, never>> & { message: string }>({
      success: true,
      data: {},
      message: 'Donor deactivated',
    });
  } catch (error) {
    console.error('Donors DELETE error:', error);
    return corsError(
      'Error deleting donor record',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleGet(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePost(request);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return handlePut(request);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return handleDelete(request);
}
