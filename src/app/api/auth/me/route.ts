import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { setCORSHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

// GET /api/auth/me - Get current user info
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (!auth) {
      const response = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      setCORSHeaders(response);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      userId: auth.userId,
      email: auth.email,
      role: auth.role,
      churchId: auth.churchId,
    });

    setCORSHeaders(response);
    return response;
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
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