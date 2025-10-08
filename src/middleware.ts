import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Allow public routes without auth check
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    applyBuildIdCookie(request, response);
    return response;
  }

  const secret = process.env['NEXTAUTH_SECRET'];
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }

  const token = await getToken({ req: request, secret });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      const jsonResponse = NextResponse.json(
        { error: "Autenticación requerida" },
        { status: 401 }
      );
      applyBuildIdCookie(request, jsonResponse);
      return jsonResponse;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyBuildIdCookie(request, redirectResponse);
    return redirectResponse;
  }

  const response = NextResponse.next();
  applyBuildIdCookie(request, response);
  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*$).*)",
  ],
};
