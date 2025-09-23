import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/auth/callback',
  '/api/auth/callback'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Update user session and get user
  const { response, user } = await updateSession(request);

  // Log for debugging
  console.log('[Middleware] Path:', pathname, 'User:', user?.email || 'none');

  // Allow public routes without auth check
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return response;
  }

  // Check if user is authenticated using the actual user object
  if (!user && !publicRoutes.includes(pathname)) {
    // Redirect to login if not authenticated
    if (pathname.startsWith('/api/')) {
      // For API routes, return 401
      return NextResponse.json(
        { error: 'Autenticación requerida' },
        { status: 401 }
      );
    }

    // For pages, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*$).*)'
  ]
};