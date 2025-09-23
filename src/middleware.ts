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

  // Update user session
  const response = await updateSession(request);

  // Allow public routes without auth check
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return response;
  }

  // For protected routes, check if user is authenticated
  // The updateSession function will have refreshed the session if needed
  // We can check for the presence of Supabase auth cookies
  const hasSession = request.cookies.has('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0] + '-auth-token');

  if (!hasSession && !publicRoutes.includes(pathname)) {
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