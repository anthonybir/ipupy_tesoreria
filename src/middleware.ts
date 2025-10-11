import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// Build ID for cache busting (Vercel sets VERCEL_GIT_COMMIT_SHA)
const BUILD_ID = process.env['VERCEL_GIT_COMMIT_SHA'] ||
                 process.env['NEXT_PUBLIC_BUILD_ID'] ||
                 'dev';

// Define public routes that don't require authentication
const publicRoutePrefixes = [
  "/login",
  "/auth/callback",
  "/api/auth", // Allow Auth.js routes (includes /api/auth/*)
  "/api/openid/token",
  "/api/openid/refresh",
];

const isPublicRoute = (pathname: string): boolean =>
  publicRoutePrefixes.some((route) => pathname.startsWith(route));

const applyBuildIdCookie = (request: NextRequest, response: NextResponse) => {
  const currentBuildId = request.cookies.get("app_build_id")?.value;
  if (currentBuildId !== BUILD_ID) {
    response.cookies.set("app_build_id", BUILD_ID, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    response.headers.set("x-app-build-changed", "1");
  }
};

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    applyBuildIdCookie(request, response);
    return response;
  }

  const authenticated = await convexAuth.isAuthenticated();

  // Temporary debug logging
  console.log('[Middleware] Path:', pathname, 'Authenticated:', authenticated);

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      const jsonResponse = NextResponse.json(
        { error: "Autenticación requerida" },
        { status: 401 }
      );
      applyBuildIdCookie(request, jsonResponse);
      return jsonResponse;
    }

    console.log('[Middleware] Redirecting to login from:', pathname);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyBuildIdCookie(request, redirectResponse);
    return redirectResponse;
  }

  const response = NextResponse.next();
  applyBuildIdCookie(request, response);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*$).*)",
  ],
};
