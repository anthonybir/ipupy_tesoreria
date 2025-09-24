import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Define public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/auth/callback",
  "/api/auth/callback",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log("[Middleware] Processing path:", pathname);

  // Update user session and get user
  const { response, user } = await updateSession(request);

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