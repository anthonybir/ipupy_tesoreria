import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/server';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

interface AssignmentInput {
  profile_id: string;
  fund_id?: number | null;
  church_id?: number | null;
  notes?: string;
}

// GET /api/admin/fund-directors - Get all fund director assignments
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const profile_id = searchParams.get('profile_id');
    const fund_id = searchParams.get('fund_id');
    const church_id = searchParams.get('church_id');

    const supabase = await createClient();
    let query = supabase
      .from('fund_director_assignments')
      .select(`
        *,
        profiles:profile_id (
          id,
          email,
          full_name,
          phone
        ),
        funds:fund_id (
          id,
          name,
          type
        ),
        churches:church_id (
          id,
          name,
          city
        )
      `);

    if (profile_id) {
      query = query.eq('profile_id', profile_id);
    }

    if (fund_id) {
      query = query.eq('fund_id', fund_id);
    }

    if (church_id) {
      query = query.eq('church_id', church_id);
    }

    const { data: assignments, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const response = NextResponse.json({
      success: true,
      data: assignments || []
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error fetching fund director assignments:', error);
    const response = NextResponse.json(
      {
        error: 'Error fetching assignments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// POST /api/admin/fund-directors - Create assignment
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const body: AssignmentInput = await req.json();

    if (!body.profile_id) {
      const response = NextResponse.json({ error: 'profile_id is required' }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    if (!body.fund_id && !body.church_id) {
      const response = NextResponse.json(
        { error: 'At least one of fund_id or church_id must be provided' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    const supabase = await createClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', body.profile_id)
      .single();

    if (profileError || !profile) {
      const response = NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      setCORSHeaders(response);
      return response;
    }

    if (profile.role !== 'fund_director') {
      const response = NextResponse.json(
        { error: 'User must have fund_director role' },
        { status: 400 }
      );
      setCORSHeaders(response);
      return response;
    }

    let existingQuery = supabase
      .from('fund_director_assignments')
      .select('id')
      .eq('profile_id', body.profile_id);

    if (body.fund_id !== undefined && body.fund_id !== null) {
      existingQuery = existingQuery.eq('fund_id', body.fund_id);
    } else {
      existingQuery = existingQuery.is('fund_id', null);
    }

    if (body.church_id !== undefined && body.church_id !== null) {
      existingQuery = existingQuery.eq('church_id', body.church_id);
    } else {
      existingQuery = existingQuery.is('church_id', null);
    }

    const { data: existing, error: checkError } = await existingQuery;

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      const response = NextResponse.json(
        { error: 'Assignment already exists' },
        { status: 409 }
      );
      setCORSHeaders(response);
      return response;
    }

    const { data: assignment, error: insertError } = await supabase
      .from('fund_director_assignments')
      .insert({
        profile_id: body.profile_id,
        fund_id: body.fund_id || null,
        church_id: body.church_id || null,
        notes: body.notes || null,
        created_by: auth.userId
      })
      .select(`
        *,
        profiles:profile_id (
          id,
          email,
          full_name
        ),
        funds:fund_id (
          id,
          name
        ),
        churches:church_id (
          id,
          name
        )
      `)
      .single();

    if (insertError) throw insertError;

    const response = NextResponse.json({
      success: true,
      data: assignment,
      message: 'Assignment created successfully'
    }, { status: 201 });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error creating assignment:', error);
    const response = NextResponse.json(
      {
        error: 'Error creating assignment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

// DELETE /api/admin/fund-directors?id=X - Delete assignment
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (!auth || auth.role !== 'admin') {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
      const response = NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
      setCORSHeaders(response);
      return response;
    }

    const supabase = await createClient();

    const { error: deleteError } = await supabase
      .from('fund_director_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) throw deleteError;

    const response = NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully'
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error deleting assignment:', error);
    const response = NextResponse.json(
      {
        error: 'Error deleting assignment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    setCORSHeaders(response);
    return response;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  setCORSHeaders(response);
  return response;
}