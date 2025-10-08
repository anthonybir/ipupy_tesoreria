/**
 * Convex Auth Hook - NextAuth Bridge
 *
 * Phase 4.1b - NextAuth → Convex OIDC Bridge (2025-01-07)
 *
 * This hook implements the Convex `useAuth` interface using NextAuth as the auth provider.
 * It's used by ConvexProviderWithAuth to authenticate Convex queries/mutations.
 *
 * Flow:
 * 1. Convex client needs auth token
 * 2. Calls fetchAccessToken() from this hook
 * 3. We call /api/openid/token to get NextAuth session's ID token
 * 4. Return token to Convex
 * 5. Convex validates token against Google JWKS
 * 6. ctx.auth.getUserIdentity() now works in Convex functions
 *
 * CRITICAL:
 * - Must return Google ID token, not access token
 * - Token must match Convex auth.config.ts (iss + aud)
 * - Handles token refresh automatically
 */

"use client";

import { useSession } from "next-auth/react";
import { useCallback } from "react";

/**
 * useAuthFromNextAuth - Bridge NextAuth to Convex
 *
 * This implements the Convex useAuth interface required by ConvexProviderWithAuth.
 *
 * Convex expects:
 * - isLoading: boolean
 * - isAuthenticated: boolean
 * - fetchAccessToken: (args: { forceRefreshToken?: boolean }) => Promise<string | null>
 *
 * @returns Auth state and token fetcher for Convex
 */
type UseAuthResult = {
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchAccessToken: (options?: { forceRefreshToken?: boolean }) => Promise<string | null>;
};

export function useAuthFromNextAuth(): UseAuthResult {
  const { data: session, status } = useSession();

  /**
   * Fetch Google ID token for Convex
   *
   * This is called by Convex whenever it needs to authenticate a request.
   * We fetch the token from our /api/openid/token endpoint, which gets it
   * from the NextAuth session.
   *
   * @param forceRefreshToken - If true, force token refresh (call /api/openid/refresh)
   */
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}): Promise<string | null> => {
      try {
        // If no session, return null immediately
        if (!session) {
          return null;
        }

        // Choose endpoint based on refresh request
        const endpoint = forceRefreshToken
          ? "/api/openid/refresh"
          : "/api/openid/token";

        const method = forceRefreshToken ? "POST" : "GET";

        const response = await fetch(endpoint, {
          method,
          credentials: "include", // Include cookies for NextAuth session
        });

        if (!response.ok) {
          console.error(
            `[Convex Auth] Failed to fetch token from ${endpoint}:`,
            response.status
          );
          return null;
        }

        const data = await response.json();

        if (!data.token) {
          console.error("[Convex Auth] No token in response from", endpoint);
          return null;
        }

        // Return Google ID token for Convex validation
        return data.token;
      } catch (error) {
        console.error("[Convex Auth] Error fetching token:", error);
        return null;
      }
    },
    [session]
  );

  return {
    // Loading state from NextAuth
    isLoading: status === "loading",

    // Authenticated if we have a session with an ID token
    isAuthenticated: !!(session?.idToken),

    // Token fetcher for Convex
    fetchAccessToken,
  };
}
