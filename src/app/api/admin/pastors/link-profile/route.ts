import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext } from '@/lib/db';
import { firstOrNull, expectOne } from '@/lib/db-helpers';
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

/**
 * POST /api/admin/pastors/link-profile
 * Links a pastor to a user profile for platform access, or creates a new profile
 *
 * Body:
 * - pastor_id: number (required)
 * - profile_id?: string (optional, link to existing profile)
 * - create_profile?: { email: string, password: string, role: string } (optional, create new)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthContext(req);

    // Only admin can link pastor profiles
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const body = await req.json();
    const { pastor_id, profile_id, create_profile } = body;

    if (!pastor_id) {
      const response = NextResponse.json(
        { error: 'pastor_id is required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Validate that either profile_id or create_profile is provided
    if (!profile_id && !create_profile) {
      const response = NextResponse.json(
        { error: 'Either profile_id or create_profile must be provided' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Check if pastor exists and is active
    const pastorResult = await executeWithContext(auth, `
      SELECT id, full_name, email, church_id, profile_id
      FROM pastors
      WHERE id = $1
    `, [pastor_id]);

    if (pastorResult.rows.length === 0) {
      const response = NextResponse.json(
        { error: 'Pastor not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const pastor = firstOrNull(pastorResult.rows);
    if (!pastor) {
      const response = NextResponse.json(
        { error: 'Pastor not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Check if pastor already has a profile linked
    if (pastor['profile_id']) {
      const response = NextResponse.json(
        { error: 'Pastor already has a profile linked. Unlink first to change.' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    let finalProfileId: string;

    // OPTION 1: Link to existing profile
    if (profile_id) {
      // Verify profile exists and is not already linked
      const profileCheck = await executeWithContext(auth, `
        SELECT id, email, role
        FROM profiles
        WHERE id = $1
      `, [profile_id]);

      if (profileCheck.rows.length === 0) {
        const response = NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        );
        setCORSHeaders(response);
        return response;
      }

      // Check if profile is already linked to another pastor
      const existingLink = await executeWithContext(auth, `
        SELECT id, full_name
        FROM pastors
        WHERE profile_id = $1 AND id != $2
      `, [profile_id, pastor_id]);

      const existingRow = firstOrNull(existingLink.rows);
      if (existingRow) {
        const response = NextResponse.json(
          { error: `Profile already linked to pastor: ${existingRow['full_name'] || 'Unknown'}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      finalProfileId = profile_id;
    }
    // OPTION 2: Create new profile and link
    else if (create_profile) {
      const { email, password, role } = create_profile;

      if (!email || !role) {
        const response = NextResponse.json(
          { error: 'Email and role are required to create profile' },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      // Validate role
      const validRoles = ['admin', 'national_treasurer', 'fund_director', 'pastor', 'treasurer', 'church_manager', 'secretary'];
      if (!validRoles.includes(role)) {
        const response = NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        );
        setCORSHeaders(response);
        return response;
      }

      // Create auth user in Supabase
      const supabase = getSupabaseAdminClient();
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: password || Math.random().toString(36).slice(-12), // Generate random password if not provided
        email_confirm: true,
        user_metadata: {
          full_name: pastor['full_name'],
          role,
          church_id: pastor['church_id']
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

      // Create profile
      await executeWithContext(auth, `
        INSERT INTO profiles (
          id, email, full_name, role, church_id,
          is_active, role_assigned_by, role_assigned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = $2,
          full_name = $3,
          role = $4,
          church_id = $5,
          updated_at = NOW()
      `, [
        authData.user.id,
        email,
        pastor['full_name'],
        role,
        pastor['church_id'],
        true,
        auth.userId
      ]);

      finalProfileId = authData.user.id;
    } else {
      const response = NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Link pastor to profile
    await executeWithContext(auth, `
      UPDATE pastors
      SET profile_id = $1, updated_at = NOW(), updated_by = $2
      WHERE id = $3
    `, [finalProfileId, auth.userId, pastor_id]);

    // Fetch linked result
    const result = await executeWithContext(auth, `
      SELECT
        p.id AS pastor_id,
        p.full_name AS pastor_name,
        p.church_id,
        c.name AS church_name,
        p.profile_id,
        prof.email AS platform_email,
        prof.role AS platform_role,
        prof.is_active AS platform_active
      FROM pastors p
      LEFT JOIN churches c ON c.id = p.church_id
      LEFT JOIN profiles prof ON prof.id = p.profile_id
      WHERE p.id = $1
    `, [pastor_id]);

    const response = NextResponse.json({
      success: true,
      message: create_profile
        ? 'Profile created and linked to pastor successfully'
        : 'Pastor linked to profile successfully',
      data: expectOne(result.rows)
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error linking pastor to profile:', error);
    const response = NextResponse.json(
      { error: 'Error linking pastor to profile' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

/**
 * DELETE /api/admin/pastors/link-profile
 * Unlinks a pastor from their user profile (revokes platform access)
 *
 * Query params:
 * - pastor_id: number (required)
 * - delete_profile: boolean (optional, also delete the profile)
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthContext(req);

    // Only admin can unlink pastor profiles
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const pastorId = searchParams.get('pastor_id');
    const deleteProfile = searchParams.get('delete_profile') === 'true';

    if (!pastorId) {
      const response = NextResponse.json(
        { error: 'pastor_id is required' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Get current linkage
    const pastorResult = await executeWithContext(auth, `
      SELECT id, full_name, profile_id
      FROM pastors
      WHERE id = $1
    `, [pastorId]);

    if (pastorResult.rows.length === 0) {
      const response = NextResponse.json(
        { error: 'Pastor not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    const pastor = firstOrNull(pastorResult.rows);
    if (!pastor) {
      const response = NextResponse.json(
        { error: 'Pastor not found' },
        { status: 404 }
      );
      setCORSHeaders(response);
      return response;
    }

    if (!pastor['profile_id']) {
      const response = NextResponse.json(
        { error: 'Pastor has no profile linked' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    // Unlink pastor from profile
    await executeWithContext(auth, `
      UPDATE pastors
      SET profile_id = NULL, updated_at = NOW(), updated_by = $1
      WHERE id = $2
    `, [auth.userId, pastorId]);

    // Optionally delete the profile
    if (deleteProfile) {
      // Delete from Supabase auth
      const supabase = getSupabaseAdminClient();
      await supabase.auth.admin.deleteUser(pastor['profile_id']);

      // Profile will be deleted via cascade
      await executeWithContext(auth, 'DELETE FROM profiles WHERE id = $1', [pastor['profile_id']]);
    }

    const response = NextResponse.json({
      success: true,
      message: deleteProfile
        ? 'Pastor unlinked and profile deleted successfully'
        : 'Pastor unlinked from profile successfully (profile preserved)'
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error unlinking pastor from profile:', error);
    const response = NextResponse.json(
      { error: 'Error unlinking pastor from profile' },
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
