/**
 * Server-side Convex client for API routes
 *
 * Phase 4.1b - NextAuth → Convex OIDC Bridge (2025-01-07)
 *
 * This wrapper provides an authenticated Convex client that can be used in Next.js API routes
 * and server components. It handles Google ID token management via NextAuth for each request.
 *
 * CRITICAL: This creates per-request clients with the user's Google ID token.
 * Convex validates these tokens against Google's JWKS (configured in convex/auth.config.ts).
 *
 * Usage:
 * ```typescript
 * import { getAuthenticatedConvexClient } from '@/lib/convex-server';
 * import { api } from '../../convex/_generated/api';
 *
 * const client = await getAuthenticatedConvexClient();
 * const churches = await client.query(api.churches.list);
 * ```
 */

import { ConvexHttpClient } from 'convex/browser';
import { auth } from '@/lib/auth';
import { AuthenticationError } from '@/lib/api-errors';

// Get deployment URL from environment
const deploymentUrl = process.env['NEXT_PUBLIC_CONVEX_URL'];

if (!deploymentUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_CONVEX_URL environment variable. ' +
    'Please set it in .env.local to your Convex deployment URL.'
  );
}

// Type assertion - we've checked it's not undefined above
const CONVEX_URL: string = deploymentUrl;

/**
 * Create an authenticated Convex client for the current request
 *
 * This function:
 * 1. Gets the current NextAuth session (which contains Google ID token)
 * 2. Creates a new Convex HTTP client
 * 3. Sets the Google ID token for Convex authentication
 *
 * Flow:
 * - NextAuth session contains Google ID token (from OAuth)
 * - We pass this token to Convex via setAuth()
 * - Convex validates token against Google's JWKS
 * - ctx.auth.getUserIdentity() returns the token payload
 *
 * IMPORTANT: This creates a per-request client to avoid auth leakage between requests.
 * Do not cache or reuse this client across requests.
 *
 * @throws {AuthenticationError} if user is not authenticated or token is missing
 */
export async function getAuthenticatedConvexClient(): Promise<ConvexHttpClient> {
  // Get NextAuth session
  const session = await auth();

  if (!session) {
    throw new AuthenticationError('No autenticado - se requiere sesión de NextAuth');
  }

  // Extract Google ID token from session
  const idToken = session.idToken;
  if (!idToken) {
    throw new AuthenticationError('Token de Google ID no disponible en la sesión de NextAuth');
  }

  // Create a new client for this request
  const client = new ConvexHttpClient(CONVEX_URL);

  // Set the Google ID token for Convex authentication
  // Convex will validate this against Google's OIDC JWKS
  client.setAuth(idToken);

  return client;
}

/**
 * @deprecated Use getAuthenticatedConvexClient() instead
 *
 * This unauthenticated client will cause 401 errors when calling Convex functions
 * that use ctx.auth.getUserIdentity(). It's kept for backward compatibility only.
 */
export const convexClient = new ConvexHttpClient(CONVEX_URL);

/**
 * Type-safe wrapper for Convex queries
 *
 * Provides better error handling and TypeScript inference for query results.
 */
export async function queryConvex<T>(
  query: (...args: unknown[]) => Promise<T>,
  ...args: unknown[]
): Promise<T> {
  try {
    return await query(...args);
  } catch (error) {
    console.error('[Convex Query Error]', error);
    throw error;
  }
}

/**
 * Type-safe wrapper for Convex mutations
 *
 * Provides better error handling and TypeScript inference for mutation results.
 */
export async function mutateConvex<T>(
  mutation: (...args: unknown[]) => Promise<T>,
  ...args: unknown[]
): Promise<T> {
  try {
    return await mutation(...args);
  } catch (error) {
    console.error('[Convex Mutation Error]', error);
    throw error;
  }
}
