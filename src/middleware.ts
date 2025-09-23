import { NextRequest, NextResponse } from "next/server";
import { setCORSHeaders } from "@/lib/cors";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    setCORSHeaders(response, origin);
    return response;
  }

  const response = NextResponse.next();
  setCORSHeaders(response, origin);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
