/**
 * OpenID Refresh Endpoint for Convex
 *
 * Phase 4.1b - NextAuth → Convex OIDC Bridge (2025-01-07)
 *
 * This endpoint is called by Convex client when it needs to force a token refresh.
 * In practice, NextAuth handles refresh automatically in the jwt() callback,
 * so this endpoint mainly serves as a "get fresh token" call.
 *
 * Flow:
 * 1. Convex client calls this with forceRefreshToken=true
 * 2. We trigger NextAuth session refresh
 * 3. NextAuth's jwt() callback detects expired token and refreshes via Google
 * 4. Return the new ID token
 *
 * IMPORTANT:
 * NextAuth v5 doesn't expose a direct "refresh session" API.
 * We rely on the automatic refresh in the jwt() callback.
 * This endpoint just re-fetches the session, which will have the refreshed token.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  try {
    // Get current session - if token expired, NextAuth will refresh it automatically
    const session = await auth();

    if (!session?.idToken) {
      return NextResponse.json(
        { error: "No autenticado o token inválido" },
        { status: 401 }
      );
    }

    // Check if refresh failed (error flag from jwt callback)
    const tokenHasError = (session as { error?: string }).error;
    if (tokenHasError) {
      return NextResponse.json(
        { error: "Token refresh falló - requiere re-autenticación" },
        { status: 401 }
      );
    }

    // Return the (potentially refreshed) ID token
    return NextResponse.json({
      token: session.idToken,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("[OpenID Refresh] Error:", error);
    return NextResponse.json(
      { error: "Error al refrescar token" },
      { status: 500 }
    );
  }
}
