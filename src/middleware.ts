import { NextRequest, NextResponse } from "next/server";
import { setCORSHeaders } from "@/lib/cors";
import { createClient } from '@/lib/supabase/server';

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/auth/callback',
  '/api/auth/callback'
];

// Define public API routes
const publicApiRoutes = [
  '/api/auth'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS for API routes
  if (pathname.startsWith("/api")) {
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });
      setCORSHeaders(response, origin);
      return response;
    }
  }

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    if (pathname.startsWith("/api")) {
      const response = NextResponse.next();
      const origin = request.headers.get("origin");
      setCORSHeaders(response, origin);
      return response;
    }
    return NextResponse.next();
  }

  // Allow public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    const response = NextResponse.next();
    if (pathname.startsWith("/api")) {
      const origin = request.headers.get("origin");
      setCORSHeaders(response, origin);
    }
    return response;
  }

  // Check for authentication
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      // Redirect to login if not authenticated
      if (pathname.startsWith('/api/')) {
        // For API routes, return 401 with CORS headers
        const response = NextResponse.json(
          { error: 'Autenticación requerida' },
          { status: 401 }
        );
        const origin = request.headers.get("origin");
        setCORSHeaders(response, origin);
        return response;
      }

      // For pages, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // User is authenticated, proceed
    const response = NextResponse.next();

    // Add CORS headers for API routes
    if (pathname.startsWith("/api")) {
      const origin = request.headers.get("origin");
      setCORSHeaders(response, origin);
    }

    return response;
  } catch (error) {
    console.error('Error in middleware:', error);

    // On error, handle appropriately
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json(
        { error: 'Error de autenticación' },
        { status: 500 }
      );
      const origin = request.headers.get("origin");
      setCORSHeaders(response, origin);
      return response;
    }

    // For pages, redirect to login for safety
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|public/).*)'
  ]
};