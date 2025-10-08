/**
 * Authentication Utilities for Convex
 * 
 * Provides helpers for authentication and user identity management.
 * Currently uses Supabase Auth (will migrate to Clerk in Phase 6).
 */

import { type QueryCtx, type MutationCtx } from "../_generated/server";

/**
 * Role hierarchy levels (from src/lib/authz.ts)
 * Used for permission checks
 */
export const ROLE_LEVELS = {
  secretary: 1,
  church_manager: 2,
  treasurer: 3,
  pastor: 4,
  fund_director: 5,
  admin: 6,
} as const;

export type UserRole = keyof typeof ROLE_LEVELS;

/**
 * Auth context extracted from user identity
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  churchId?: string | undefined;
  fundId?: string | undefined; // For fund_director role
}

/**
 * Get authenticated user identity from Convex context
 *
 * @throws Error if user is not authenticated
 */
export async function getUserIdentity(
  ctx: QueryCtx | MutationCtx
): Promise<{
  subject: string;
  email?: string | undefined;
  name?: string | undefined;
  [key: string]: unknown;
}> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("No autenticado");
  }

  return identity;
}

/**
 * Get auth context from user identity
 * Extracts role, church_id, and other metadata
 * 
 * For now, this reads from the profiles table (Supabase data).
 * In Phase 6, this will be replaced with Clerk metadata.
 */
export async function getAuthContext(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext> {
  const identity = await getUserIdentity(ctx);
  
  // Look up user profile in database
  const profile = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field("email"), identity.email))
    .first();
  
  if (!profile) {
    throw new Error("Usuario no encontrado en el sistema");
  }
  
  if (!profile.active) {
    throw new Error("Usuario inactivo");
  }
  
  return {
    userId: profile.user_id,
    email: profile.email,
    role: profile.role as UserRole,
    churchId: profile.church_id,
    fundId: profile.fund_id,
  };
}

/**
 * Check if user is authenticated (without throwing)
 */
export async function isAuthenticated(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  return identity !== null;
}

/**
 * Get optional auth context (returns null if not authenticated)
 */
export async function getOptionalAuthContext(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext | null> {
  try {
    return await getAuthContext(ctx);
  } catch {
    return null;
  }
}
