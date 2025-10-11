/**
 * Authentication Utilities for Convex
 * 
 * Provides helpers for authentication and user identity management.
 * Currently uses Supabase Auth (will migrate to Clerk in Phase 6).
 */

import { type QueryCtx, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";

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
  userId: Id<"users">;
  email: string;
  role: UserRole;
  churchId?: Id<"churches"> | undefined;
  fundId?: Id<"funds"> | undefined; // For fund_director role
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

function extractConvexUserId(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) {
    throw new Error("Identidad de usuario inválida");
  }
  const [userId] = trimmed.split("|");
  if (!userId) {
    throw new Error("Identidad de usuario inválida");
  }
  return userId;
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

  const normalizedEmail = identity.email?.trim().toLowerCase() ?? null;

  // Resolve Convex Auth user record via subject or email
  let userId: Id<"users"> | null = null;
  let userDoc = null;

  if (typeof identity.subject === "string") {
    try {
      const normalizedSubject = extractConvexUserId(identity.subject);
      const normalizedId = await ctx.db.normalizeId("users", normalizedSubject);
      if (normalizedId) {
        userId = normalizedId;
        userDoc = await ctx.db.get(normalizedId);
      }
    } catch {
      // ignore and fall back to email lookup
    }
  }

  if (!userDoc && normalizedEmail) {
    userDoc = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (userDoc) {
      userId = userDoc._id;
    }
  }

  if (!userDoc || !userId) {
    throw new Error("Usuario de Convex Auth no encontrado");
  }

  // Locate matching profile; prefer user_id index but fall back to email
  let profile = null;

  if (userId) {
    const lookupUserId = userId as Id<"users">;
    profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", lookupUserId))
      .first();
  }

  if (!profile && normalizedEmail) {
    profile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
  }

  if (!profile) {
    throw new Error("Usuario no encontrado en el sistema");
  }

  if (!profile.active) {
    throw new Error("Usuario inactivo");
  }

  if (!userId) {
    if (typeof profile.user_id === "string") {
      const normalized = await ctx.db.normalizeId("users", profile.user_id);
      if (normalized) {
        userId = normalized;
      }
    } else if (profile.user_id) {
      userId = profile.user_id;
    }
  }

  if (!userId) {
    throw new Error("No se pudo resolver el identificador del usuario");
  }

  return {
    userId,
    email: profile.email,
    role: profile.role as UserRole,
    churchId: profile.church_id ?? undefined,
    fundId: profile.fund_id ?? undefined,
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
