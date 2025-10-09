import { type NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedConvexClient } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';
import { handleApiError, ValidationError } from '@/lib/api-errors';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { ApiResponse } from '@/types/utils';

/**
 * Admin User Management API Routes - Migrated to Convex
 *
 * Phase 4.7 - Admin Routes Migration (2025-01-07)
 *
 * This route now uses Convex functions instead of direct Supabase queries.
 * Authorization is handled by Convex functions (requireAdmin).
 *
 * IMPORTANT: Uses authenticated Convex client with Google ID token from NextAuth.
 * Each request creates a new client with the current user's Google ID token.
 *
 * NOTE: Supabase Auth sync removed - Convex uses NextAuth for authentication
 */

const ALLOWED_EMAIL_DOMAINS = ['ipupy.org.py'];

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new ValidationError('Email must be a string');
  }
  const trimmed = value.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    throw new ValidationError('Email is not valid');
  }

  // Enforce organizational domain restriction
  const domain = trimmed.split('@')[1];
  if (!domain || !ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    throw new ValidationError(`Email must be from @${ALLOWED_EMAIL_DOMAINS.join(' or @')} domain`);
  }

  return trimmed;
};

// GET /api/admin/users - Get all users
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const church_id = searchParams.get('church_id');
    const role = searchParams.get('role');
    const active = searchParams.get('active');

    // Build query args
    const queryArgs: {
      church_id?: Id<'churches'>;
      role?: string;
      active?: boolean;
    } = {};

    if (church_id) queryArgs.church_id = church_id as Id<'churches'>;
    if (role) queryArgs.role = role;
    if (active !== null) queryArgs.active = active === 'true';

    // Call Convex query - returns { data, total }
    const result = await client.query(api.admin.getUsers, queryArgs);

    // ApiResponse envelope
    type User = typeof result.data[number];
    const response: ApiResponse<User[]> = {
      success: true,
      data: result.data,
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'GET /api/admin/users');
  }
}

// POST /api/admin/users - Create user profile
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await req.json();

    const { email, full_name, role, church_id, fund_id } = body as Record<string, unknown>;

    // Validate required fields
    if (!email) {
      throw new ValidationError('Email es requerido');
    }
    if (!role || typeof role !== 'string') {
      throw new ValidationError('Rol es requerido');
    }

    // Normalize and validate email
    const normalizedEmail = normalizeEmail(email);

    // Build mutation args
    const args: {
      email: string;
      role: string;
      full_name?: string;
      church_id?: Id<'churches'>;
      fund_id?: Id<'funds'>;
    } = {
      email: normalizedEmail,
      role,
    };

    // Optional fields
    if (full_name && typeof full_name === 'string') {
      args.full_name = full_name.trim();
    }
    if (typeof church_id === 'string') {
      args.church_id = church_id as Id<'churches'>;
    }
    if (typeof fund_id === 'string') {
      args.fund_id = fund_id as Id<'funds'>;
    }

    // Create via Convex (includes role validation and duplicate check)
    const result = await client.mutation(api.admin.createUser, args);

    // ApiResponse envelope with message
    type User = typeof result.user;
    const response: ApiResponse<User> & { message: string } = {
      success: true,
      data: result.user,
      message: result.message,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'POST /api/admin/users');
  }
}

// PUT /api/admin/users - Update user role
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const body = await req.json();

    const { user_id, role, church_id, fund_id } = body as Record<string, unknown>;

    if (!user_id || typeof user_id !== 'string') {
      throw new ValidationError('User ID es requerido');
    }

    if (typeof role !== 'string' || role.trim().length === 0) {
      throw new ValidationError('Rol es requerido');
    }

    const payload: {
      user_id: string;
      role: string;
      church_id?: Id<'churches'>;
      fund_id?: Id<'funds'>;
    } = {
      user_id,
      role,
    };

    if (typeof church_id === 'string') {
      payload.church_id = church_id as Id<'churches'>;
    }
    if (typeof fund_id === 'string') {
      payload.fund_id = fund_id as Id<'funds'>;
    }

    const user = await client.mutation(api.admin.updateUserRole, payload);

    // ApiResponse envelope with message
    type User = typeof user;
    const response: ApiResponse<User> & { message: string } = {
      success: true,
      data: user,
      message: 'Usuario actualizado exitosamente',
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'PUT /api/admin/users');
  }
}

// DELETE /api/admin/users - Deactivate user
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const client = await getAuthenticatedConvexClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      throw new ValidationError('User ID es requerido');
    }

    // Deactivate via Convex (soft delete only - no hard delete in Convex migration)
    const result = await client.mutation(api.admin.deactivateUser, {
      user_id: userId,
    });

    // ApiResponse envelope with message at top level (backward compatibility)
    const response: ApiResponse<Record<string, never>> & { message: string } = {
      success: true,
      data: {},
      message: result.message,
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, req.headers.get('origin'), 'DELETE /api/admin/users');
  }
}
