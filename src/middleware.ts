import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Build ID for cache busting (Vercel sets VERCEL_GIT_COMMIT_SHA)
const BUILD_ID = process.env['VERCEL_GIT_COMMIT_SHA'] ||
                 process.env['NEXT_PUBLIC_BUILD_ID'] ||
                 'dev';

// Define public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/auth/callback",
  "/api/auth/callback",
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Update user session and get user
  const { response, user } = await updateSession(request);

  // Set build version cookie for client-side cache invalidation
  const currentBuildId = request.cookies.get("app_build_id")?.value;
  if (currentBuildId !== BUILD_ID) {
    response.cookies.set("app_build_id", BUILD_ID, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });
    // Signal to client that build changed
    response.headers.set("x-app-build-changed", "1");
  }

  const userEmail = user?.email ?? "none";
  console.log("[Middleware] Path:", pathname, "User:", userEmail);

  // Allow public routes without auth check
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    console.log("[Middleware] Public route - allowing access");
    return response;
  }

  // Check if user is authenticated
  if (!user) {
    console.log("[Middleware] No user - redirecting to login");

    if (pathname.startsWith("/api/")) {
      // For API routes, return 401
      return NextResponse.json(
        { error: "Autenticación requerida" },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  console.log("[Middleware] User authenticated - allowing access");
  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*$).*)",
  ],
};