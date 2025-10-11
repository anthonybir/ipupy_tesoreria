/**
 * Server-side Convex client utilities for API routes and server components.
 *
 * This wrapper retrieves the Convex Auth access token tied to the current request
 * and provides an authenticated Convex HTTP client.
 *
 * CRITICAL: Each call creates a per-request client to avoid leaking authentication state.
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
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
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
 * 1. Retrieves the Convex Auth access token for the current request
 * 2. Creates a new Convex HTTP client
 * 3. Sets the token for Convex authentication
 *
 * IMPORTANT: This creates a per-request client to avoid auth leakage between requests.
 * Do not cache or reuse this client across requests.
 *
 * @throws {AuthenticationError} if user is not authenticated or token is missing
 */
export async function getAuthenticatedConvexClient(): Promise<ConvexHttpClient> {
  const token = await convexAuthNextjsToken();

  if (!token) {
    throw new AuthenticationError('No autenticado - se requiere sesión válida');
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(token);

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
