/**
 * OpenID Token Endpoint for Convex
 *
 * Phase 4.1b - NextAuth → Convex OIDC Bridge (2025-01-07)
 *
 * This endpoint is called by the Convex client (via useAuthFromNextAuth hook)
 * to fetch the current user's Google ID token.
 *
 * Flow:
 * 1. Convex client calls this endpoint
 * 2. We get the NextAuth session (which contains the Google ID token)
 * 3. Return the ID token to Convex
 * 4. Convex validates it against Google's JWKS
 *
 * SECURITY:
 * - Only returns token if valid NextAuth session exists
 * - Token is already validated by NextAuth (domain check, expiry)
 * - If token expired, NextAuth will have refreshed it automatically
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  try {
    // Get current session from NextAuth
    const session = await auth();

    if (!session?.idToken) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Return the Google ID token for Convex
    return NextResponse.json({
      token: session.idToken,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("[OpenID Token] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener token" },
      { status: 500 }
    );
  }
}
