import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Define public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/auth/callback",
  "/api/auth/callback",
];

const copyAuthCookies = (source: NextResponse, target: NextResponse) => {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Update user session and get user
  const { response, user, session } = await updateSession(request);

  const userEmail = user?.email ?? "none";
  console.log(
    "[Middleware] Path:",
    pathname,
    "User:",
    userEmail,
    "Session expires:",
    session?.expires_at ?? "unknown",
  );

  // Allow public routes without auth check
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return response;
  }

  // Check if user is authenticated using the actual user object
  if (!user) {
    if (pathname.startsWith("/api/")) {
      const unauthorized = NextResponse.json(
        { error: "Autenticación requerida" },
        { status: 401 },
      );
      copyAuthCookies(response, unauthorized);
      return unauthorized;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);
    copyAuthCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*$).*)",
  ],
};
