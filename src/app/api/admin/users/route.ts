import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext } from '@/lib/db';
import { setCORSHeaders } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/env-validation';

export const runtime = 'nodejs';

function getSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_KEY is required for admin operations');
  }
  return createClient(url, serviceRoleKey);
}

// GET /api/admin/users - Get all users
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthContext(req);

    // Check if user is admin
    if (!auth || auth.role !== 'admin') {
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

// POST /api/admin/users - Create new user
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthContext(req);

    // Check if user is admin
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const body = await req.json();
    const { email, password, full_name, role, church_id, phone, permissions } = body;

    // Validate required fields
    if (!email || !role) {
      const response = NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Create auth user in Supabase
    const supabase = getSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        church_id
      }
    });

    if (authError) {
      const response = NextResponse.json(
        { error: `Error creating user: ${authError.message}` },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Create or update profile
    await executeWithContext(auth, `
      INSERT INTO profiles (
        id, email, full_name, role, church_id, phone, permissions,
        is_active, role_assigned_by, role_assigned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = $2,
        full_name = $3,
        role = $4,
        church_id = $5,
        phone = $6,
        permissions = $7,
        updated_at = NOW()
    `, [
      authData.user.id,
      email,
      full_name,
      role,
      church_id,
      phone,
      permissions ? JSON.stringify(permissions) : '{}',
      true,
      auth.userId
    ]);

    // Log user creation with security context
    await executeWithContext(auth, `
      INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      auth.userId,
      'admin.user.create',
      JSON.stringify({ created_user_id: authData.user.id, email, role }),
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      req.headers.get('user-agent') || 'unknown'
    ]);

    const response = NextResponse.json({
      success: true,
      data: {
        id: authData.user.id,
        email,
        full_name,
        role,
        church_id
      },
      message: 'User created successfully'
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
    const auth = await getAuthContext(req);

    // Check if user is admin
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const body = await req.json();
    const { id, email, full_name, role, church_id, phone, permissions, is_active } = body;

    if (!id) {
      const response = NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Update profile
    const updates: string[] = ['updated_at = NOW()'];
    const values: Array<string | number | boolean | null> = [];

    if (email !== undefined) {
      updates.push(`email = $${values.length + 1}`);
      values.push(email);
    }

    if (full_name !== undefined) {
      updates.push(`full_name = $${values.length + 1}`);
      values.push(full_name);
    }

    if (role !== undefined) {
      updates.push(`role = $${values.length + 1}`);
      values.push(role);
      updates.push('role_assigned_at = NOW()');
      updates.push(`role_assigned_by = '${auth.userId}'`);
    }

    if (church_id !== undefined) {
      updates.push(`church_id = $${values.length + 1}`);
      values.push(church_id);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${values.length + 1}`);
      values.push(phone);
    }

    if (permissions !== undefined) {
      updates.push(`permissions = $${values.length + 1}`);
      values.push(JSON.stringify(permissions));
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${values.length + 1}`);
      values.push(is_active);
    }

    if (values.length === 0) {
      const response = NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    await executeWithContext(auth, `
      UPDATE profiles SET
        ${updates.join(', ')}
      WHERE id = $${values.length + 1}
    `, [...values, id]);

    // Update Supabase auth metadata if email changed
    if (email) {
      const supabase = getSupabaseAdminClient();
      await supabase.auth.admin.updateUserById(id, {
        email,
        user_metadata: { full_name, role, church_id }
      });
    }

    // Log user update with security context
    await executeWithContext(auth, `
      INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      auth.userId,
      'admin.user.update',
      JSON.stringify({ updated_user_id: id, changes: body }),
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
    const auth = await getAuthContext(req);

    // Only admin can delete users
    if (!auth || auth.role !== 'admin') {
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
      // Delete from Supabase auth
      const supabase = getSupabaseAdminClient();
      await supabase.auth.admin.deleteUser(userId);

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