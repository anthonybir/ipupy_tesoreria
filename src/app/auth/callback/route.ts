import { type NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED: Legacy Supabase auth callback route
 *
 * This route is kept for backward compatibility during the Convex migration.
 * New authentication flows use NextAuth v5 via /api/auth/callback/google
 *
 * TODO: Remove this file once Supabase migration is 100% complete
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/';

  // Redirect to login page - NextAuth will handle authentication
  const loginUrl = new URL('/login', url.origin);
  loginUrl.searchParams.set('from', next);

  return NextResponse.redirect(loginUrl);
}