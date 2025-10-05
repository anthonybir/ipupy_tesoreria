import { randomUUID } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext, type AuthContext } from '@/lib/auth-context';
import { executeWithContext } from '@/lib/db';
import { setCORSHeaders } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/env-validation';
import { hasAdminPrivileges, isValidProfileRole, profileRoles } from '@/lib/authz';
import { withRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function getSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_KEY is required for admin operations');
  }
  return createClient(url, serviceRoleKey);
}

async function getAuthorizedContext(req: NextRequest): Promise<AuthContext> {
  const auth = await getAuthContext(req);
  if (!auth || !hasAdminPrivileges(auth.role)) {
    throw new Error('Unauthorized');
  }
  return auth;
}

const ALLOWED_EMAIL_DOMAINS = ['ipupy.org.py'];

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('Email must be a string');
  }
  const trimmed = value.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    throw new Error('Email is not valid');
  }

  // Enforce organizational domain restriction
  const domain = trimmed.split('@')[1];
  if (!domain || !ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    throw new Error(`Email must be from @${ALLOWED_EMAIL_DOMAINS.join(' or @')} domain`);
  }

  return trimmed;
};

const parseChurchId = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error('Iglesia inválida');
  }
  return parsed;
};

const validateChurchExists = async (
  auth: AuthContext,
  churchId: number
): Promise<boolean> => {
  const result = await executeWithContext(auth, `
    SELECT id FROM churches
    WHERE id = $1 AND active = true
    LIMIT 1
  `, [churchId]);
  return (result.rowCount ?? 0) > 0;
};

const normalizePermissionsPayload = (permissions: unknown): string => {
  if (permissions === undefined || permissions === null || permissions === '') {
    return '{}';
  }

  if (typeof permissions === 'string') {
    const trimmed = permissions.trim();
    if (!trimmed) {
      return '{}';
    }
    JSON.parse(trimmed);
    return trimmed;
  }

  if (typeof permissions === 'object') {
    return JSON.stringify(permissions);
  }

  throw new Error('Permissions must be a JSON object');
};

// GET /api/admin/users - Get all users
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting - prevent account enumeration
    const rateLimit = await withRateLimit(req, 'user_management');
    if (rateLimit) return rateLimit;

    let auth: AuthContext;
    try {
      auth = await getAuthorizedContext(req);
    } catch {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get('church_id');
    const role = searchParams.get('role');
    const active = searchParams.get('active');

    let query = `
      SELECT
        p.id,
        p.email,
        p.full_name,
        p.phone,
        p.role,
        p.church_id,
        p.is_active,
        p.last_seen_at,
        p.created_at,
        p.permissions,
        c.name as church_name,
        c.city as church_city,
        pastor.id as linked_pastor_id,
        pastor.full_name as linked_pastor_name,
        pastor.role_title as linked_pastor_role
      FROM profiles p
      LEFT JOIN churches c ON p.church_id = c.id
      LEFT JOIN pastors pastor ON pastor.profile_id = p.id
      WHERE 1=1
    `;
    const params: Array<string | boolean> = [];

    if (churchId) {
      params.push(churchId);
      query += ` AND p.church_id = $${params.length}`;
    }

    if (role) {
      params.push(role);
      query += ` AND p.role = $${params.length}`;
    }

    if (active !== null) {
      params.push(active === 'true');
      query += ` AND p.is_active = $${params.length}`;
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await executeWithContext(auth, query, params);

    const response = NextResponse.json({
      success: true,
      data: result.rows
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching users:', error);
    const response = NextResponse.json(
      { error: 'Error fetching users' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

/**
 * POST /api/admin/users - Create user profile
 *
 * Implements admin provisioning where admin creates users
 * who then authenticate via Google OAuth.
 *
 * **Workflow**:
 * 1. Admin creates profile with email + role + is_active=true
 * 2. Profile UUID pre-generated for matching with Supabase Auth
 * 3. User receives notification to sign in with Google Workspace
 * 4. On first Google login, Supabase trigger links auth.users to profile
 *
 * **Security**:
 * - Email must be @ipupy.org.py domain
 * - No password set (Google OAuth only)
 * - Profile is active immediately upon creation
 * - Rate limited to 20 operations/minute
 *
 * @see docs/database/BUSINESS_LOGIC.md#user-management
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting - prevent abuse
    const rateLimit = await withRateLimit(req, 'user_management');
    if (rateLimit) return rateLimit;

    let auth: AuthContext;
    try {
      auth = await getAuthorizedContext(req);
    } catch {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    const { email, full_name, role, church_id, phone, permissions } = (body ?? {}) as Record<string, unknown>;

    if (!role || typeof role !== 'string' || !isValidProfileRole(role)) {
      const response = NextResponse.json(
        { error: `Rol inválido. Utilice uno de: ${profileRoles().join(', ')}` },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    let normalizedEmail: string;
    let permissionsJson: string;
    let churchId: number | null;
    try {
      normalizedEmail = normalizeEmail(email);
      permissionsJson = normalizePermissionsPayload(permissions);
      churchId = parseChurchId(church_id);
    } catch (validationError) {
      const response = NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : 'Datos inválidos' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Validate church exists if specified
    if (churchId !== null) {
      const churchExists = await validateChurchExists(auth, churchId);
      if (!churchExists) {
        const response = NextResponse.json(
          { error: 'Iglesia no encontrada o inactiva' },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }
    }

    const fullName = typeof full_name === 'string' ? full_name.trim() || null : null;
    const phoneNumber = typeof phone === 'string' ? phone.trim() || null : null;

    const existing = await executeWithContext(auth, `
      SELECT id, is_active
      FROM profiles
      WHERE lower(email) = lower($1)
      LIMIT 1
    `, [normalizedEmail]);

    let profileId: string = randomUUID();
    let reusedPlaceholder = false;

    // Reuse inactive profiles from previous failed registrations
    // Prevents UUID conflicts and reduces orphaned records
    if (existing.rowCount && existing.rows[0]) {
      const existingProfile = existing.rows[0] as { id: string; is_active: boolean | null };
      if (existingProfile.is_active) {
        const response = NextResponse.json(
          { error: 'Ya existe un usuario activo con este email' },
          { status: 409 }
        );
        setCORSHeaders(response);
        return response;
      }

      profileId = existingProfile.id;
      reusedPlaceholder = true;

      await executeWithContext(auth, `
        UPDATE profiles SET
          email = $2,
          full_name = $3,
          role = $4,
          church_id = $5,
          phone = $6,
          permissions = COALESCE($7::jsonb, '{}'::jsonb),
          is_active = true,
          role_assigned_by = $8,
          role_assigned_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [
        profileId,
        normalizedEmail,
        fullName,
        role,
        churchId,
        phoneNumber,
        permissionsJson,
        auth.userId
      ]);
    } else {
      await executeWithContext(auth, `
        INSERT INTO profiles (
          id,
          email,
          full_name,
          role,
          church_id,
          phone,
          permissions,
          is_active,
          role_assigned_by,
          role_assigned_at,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          COALESCE($7::jsonb, '{}'::jsonb),
          true,
          $8,
          NOW(),
          NOW(),
          NOW()
        )
      `, [
        profileId,
        normalizedEmail,
        fullName,
        role,
        churchId,
        phoneNumber,
        permissionsJson,
        auth.userId
      ]);
    }

    await executeWithContext(auth, `
      INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      auth.userId,
      'admin.user.create',
      JSON.stringify({
        created_profile_id: profileId,
        email: normalizedEmail,
        role,
        reused_placeholder: reusedPlaceholder
      }),
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      req.headers.get('user-agent') || 'unknown'
    ]);

    const response = NextResponse.json({
      success: true,
      data: {
        id: profileId,
        email: normalizedEmail,
        full_name: fullName,
        role,
        church_id: churchId,
        phone: phoneNumber,
        is_active: true
      },
      message: 'Usuario registrado. Solicite que inicie sesión con Google para activar el acceso.'
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error creating user:', error);
    const response = NextResponse.json(
      { error: 'Error creating user' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// PUT /api/admin/users - Update user
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting - prevent abuse
    const rateLimit = await withRateLimit(req, 'user_management');
    if (rateLimit) return rateLimit;

    let auth: AuthContext;
    try {
      auth = await getAuthorizedContext(req);
    } catch {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    const { id, email, full_name, role, church_id, phone, permissions, is_active } = (body ?? {}) as Record<string, unknown>;

    if (!id || typeof id !== 'string') {
      const response = NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    const existing = await executeWithContext(auth, `
      SELECT id
      FROM profiles
      WHERE id = $1
    `, [id]);

    if (!existing.rowCount) {
      const response = NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const changeSummary: Record<string, unknown> = {};
    const metadataUpdates: Record<string, unknown> = {};
    const supabasePayload: { email?: string; user_metadata?: Record<string, unknown> } = {};

    if (email !== undefined) {
      let normalizedEmail: string;
      try {
        normalizedEmail = normalizeEmail(email);
      } catch (validationError) {
        const response = NextResponse.json(
          { error: validationError instanceof Error ? validationError.message : 'Email inválido' },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }
      updates.push(`email = $${paramIndex}`);
      values.push(normalizedEmail);
      changeSummary['email'] = normalizedEmail;
      supabasePayload.email = normalizedEmail;
      paramIndex += 1;
    }

    if (full_name !== undefined) {
      const normalizedName = typeof full_name === 'string' ? full_name.trim() || null : null;
      updates.push(`full_name = $${paramIndex}`);
      values.push(normalizedName);
      changeSummary['full_name'] = normalizedName;
      metadataUpdates['full_name'] = normalizedName;
      paramIndex += 1;
    }

    if (role !== undefined) {
      if (typeof role !== 'string' || !isValidProfileRole(role)) {
        const response = NextResponse.json(
          { error: `Rol inválido. Utilice uno de: ${profileRoles().join(', ')}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      changeSummary['role'] = role;
      metadataUpdates['role'] = role;
      paramIndex += 1;

      updates.push('role_assigned_at = NOW()');
      updates.push(`role_assigned_by = $${paramIndex}`);
      values.push(auth.userId);
      paramIndex += 1;
      changeSummary['role_assigned_by'] = auth.userId;
    }

    if (church_id !== undefined) {
      let parsedChurchId: number | null;
      try {
        parsedChurchId = parseChurchId(church_id);
      } catch (validationError) {
        const response = NextResponse.json(
          { error: validationError instanceof Error ? validationError.message : 'Iglesia inválida' },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      // Validate church exists if specified
      if (parsedChurchId !== null) {
        const churchExists = await validateChurchExists(auth, parsedChurchId);
        if (!churchExists) {
          const response = NextResponse.json(
            { error: 'Iglesia no encontrada o inactiva' },
            { status: 400 }
          );
          setCORSHeaders(response);
          return response;
        }
      }

      updates.push(`church_id = $${paramIndex}`);
      values.push(parsedChurchId);
      changeSummary['church_id'] = parsedChurchId;
      metadataUpdates['church_id'] = parsedChurchId;
      paramIndex += 1;
    }

    if (phone !== undefined) {
      const normalizedPhone = typeof phone === 'string' ? phone.trim() || null : null;
      updates.push(`phone = $${paramIndex}`);
      values.push(normalizedPhone);
      changeSummary['phone'] = normalizedPhone;
      metadataUpdates['phone'] = normalizedPhone;
      paramIndex += 1;
    }

    if (permissions !== undefined) {
      let permissionsJson: string;
      try {
        permissionsJson = normalizePermissionsPayload(permissions);
      } catch (validationError) {
        const response = NextResponse.json(
          { error: validationError instanceof Error ? validationError.message : 'Permisos inválidos' },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }
      updates.push(`permissions = $${paramIndex}::jsonb`);
      values.push(permissionsJson);
      changeSummary['permissions'] = JSON.parse(permissionsJson);
      paramIndex += 1;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        const response = NextResponse.json(
          { error: 'El estado activo debe ser booleano' },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      changeSummary['is_active'] = is_active;
      paramIndex += 1;
    }

    if (!updates.length) {
      const response = NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    updates.push('updated_at = NOW()');

    await executeWithContext(auth, `
      UPDATE profiles SET
        ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, [...values, id]);

    if (Object.keys(metadataUpdates).length) {
      supabasePayload.user_metadata = metadataUpdates;
    }

    // Sync changes to Supabase Auth if email or metadata changed
    // Only attempt sync if the user has authenticated at least once
    if (supabasePayload.email || supabasePayload.user_metadata) {
      const supabase = getSupabaseAdminClient();

      // Check if auth record exists before attempting update
      const { data: authUser } = await supabase.auth.admin.getUserById(id);

      if (authUser.user) {
        // User exists in Supabase Auth - safe to update
        const { error: supabaseError } = await supabase.auth.admin.updateUserById(id, supabasePayload);

        if (supabaseError) {
          console.error('Error updating Supabase user metadata:', supabaseError.message);

          // Log sync failure to audit trail
          await executeWithContext(auth, `
            INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            auth.userId,
            'admin.user.update.supabase_sync_failed',
            JSON.stringify({
              updated_profile_id: id,
              error: supabaseError.message,
              attempted_changes: supabasePayload
            }),
            req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
            req.headers.get('user-agent') || 'unknown'
          ]);
        }
      } else {
        // User hasn't authenticated yet - profile is pending
        // Skip sync to avoid "user not found" errors in logs
        console.warn(`[Admin] Skipping Supabase Auth sync for pending profile: ${id}`);
      }
    }

    await executeWithContext(auth, `
      INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      auth.userId,
      'admin.user.update',
      JSON.stringify({ updated_profile_id: id, changes: changeSummary }),
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      req.headers.get('user-agent') || 'unknown'
    ]);

    const response = NextResponse.json({
      success: true,
      message: 'User updated successfully'
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error updating user:', error);
    const response = NextResponse.json(
      { error: 'Error updating user' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// DELETE /api/admin/users - Delete or deactivate user
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting - prevent abuse
    const rateLimit = await withRateLimit(req, 'user_management');
    if (rateLimit) return rateLimit;

    let auth: AuthContext;
    try {
      auth = await getAuthorizedContext(req);
    } catch {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!userId) {
      const response = NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (hardDelete) {
      // Delete from Supabase auth if it exists (user may not have logged in yet)
      const supabase = getSupabaseAdminClient();
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError && !deleteError.message.includes('User not found')) {
        console.error('Error deleting Supabase user:', deleteError.message);
      }

      // Profile will be deleted via cascade or trigger
      await executeWithContext(auth, 'DELETE FROM profiles WHERE id = $1', [userId]);

      // Log user deletion with security context
      await executeWithContext(auth, `
        INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        auth.userId,
        'admin.user.delete',
        JSON.stringify({ deleted_user_id: userId, hard_delete: true }),
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        req.headers.get('user-agent') || 'unknown'
      ]);

      const response = NextResponse.json({
        success: true,
        message: 'User deleted permanently'
      });

      setCORSHeaders(response);
      return response;
    } else {
      // Soft delete - just deactivate
      await executeWithContext(auth, `
        UPDATE profiles SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [userId]);

      // Log user deactivation with security context
      await executeWithContext(auth, `
        INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        auth.userId,
        'admin.user.deactivate',
        JSON.stringify({ deactivated_user_id: userId }),
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        req.headers.get('user-agent') || 'unknown'
      ]);

      const response = NextResponse.json({
        success: true,
        message: 'User deactivated successfully'
      });

      setCORSHeaders(response);
      return response;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    const response = NextResponse.json(
      { error: 'Error deleting user' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 });
  setCORSHeaders(response);
  return response;
}