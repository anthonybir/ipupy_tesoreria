import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext } from '@/lib/db';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

/**
 * GET /api/admin/pastors/access
 * Get all pastors with their platform access status
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Only admin can view pastor access
    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const accessStatus = searchParams.get('status'); // 'active', 'no_access', 'revoked'
    const churchId = searchParams.get('church_id');

    let query = `
      SELECT
        pastor_id,
        church_id,
        church_name,
        city,
        pastor_name,
        preferred_name,
        pastor_email,
        pastor_phone,
        pastor_whatsapp,
        pastoral_role,
        ordination_level,
        pastor_status,
        profile_id,
        platform_email,
        platform_role,
        platform_active,
        last_seen_at,
        role_assigned_by,
        role_assigned_at,
        access_status
      FROM pastor_user_access
      WHERE 1=1
    `;

    const params: Array<string> = [];

    if (accessStatus) {
      params.push(accessStatus);
      query += ` AND access_status = $${params.length}`;
    }

    if (churchId) {
      params.push(churchId);
      query += ` AND church_id = $${params.length}`;
    }

    query += ' ORDER BY church_name, pastor_name';

    const result = await executeWithContext(auth, query, params);
    const rows = result.rows as Array<{ access_status: string }>;

    const response = NextResponse.json({
      success: true,
      data: result.rows,
      summary: {
        total: rows.length,
        with_access: rows.filter((r) => r.access_status === 'active').length,
        no_access: rows.filter((r) => r.access_status === 'no_access').length,
        revoked: rows.filter((r) => r.access_status === 'revoked').length
      }
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching pastor access:', error);
    const response = NextResponse.json(
      { error: 'Error fetching pastor access' },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  setCORSHeaders(response);
  return response;
}
