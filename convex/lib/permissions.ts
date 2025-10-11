/**
 * Permission & Authorization Utilities
 *
 * Role-based access control helpers for Convex functions.
 * Based on the 6-role system from src/lib/authz.ts
 */

import { type AuthContext, ROLE_LEVELS, type UserRole } from "./auth";
import { type Id } from "../_generated/dataModel";
import { AuthorizationError } from "./errors";

/**
 * Check if user has a specific role
 */
export function hasRole(auth: AuthContext, role: UserRole): boolean {
  return auth.role === role;
}

/**
 * Check if user has minimum role level (role or higher)
 */
export function hasMinRole(auth: AuthContext, minRole: UserRole): boolean {
  return ROLE_LEVELS[auth.role] >= ROLE_LEVELS[minRole];
}

/**
 * Check if user is admin
 */
export function isAdmin(auth: AuthContext): boolean {
  return auth.role === "admin";
}

/**
 * Check if user is pastor (can approve reports)
 */
export function isPastor(auth: AuthContext): boolean {
  return hasMinRole(auth, "pastor");
}

/**
 * Check if user is treasurer (can create/edit reports)
 */
export function isTreasurer(auth: AuthContext): boolean {
  return hasMinRole(auth, "treasurer");
}

/**
 * Check if user belongs to a specific church
 */
export function belongsToChurch(
  auth: AuthContext,
  churchId: Id<"churches">
): boolean {
  if (isAdmin(auth)) return true; // Admins can access all churches
  return auth.churchId === churchId;
}

/**
 * Ensure user is authenticated (throws if not)
 */
export function requireAuth(auth: AuthContext | null): asserts auth is AuthContext {
  if (!auth) {
    throw new AuthorizationError("No autenticado");
  }
}

/**
 * Ensure user is admin (throws if not)
 */
export function requireAdmin(auth: AuthContext): void {
  if (!isAdmin(auth)) {
    throw new AuthorizationError("Se requiere rol de administrador");
  }
}

/**
 * Ensure user has minimum role level (throws if not)
 */
export function requireMinRole(auth: AuthContext, minRole: UserRole): void {
  if (!hasMinRole(auth, minRole)) {
    throw new AuthorizationError(`Se requiere rol ${minRole} o superior`);
  }
}

/**
 * Ensure user belongs to church (throws if not)
 */
export function requireChurch(
  auth: AuthContext,
  churchId: Id<"churches">
): void {
  if (!belongsToChurch(auth, churchId)) {
    throw new AuthorizationError("No pertenece a esta iglesia");
  }
}

/**
 * Ensure user can modify church data
 * (must be treasurer+ of that church OR admin)
 */
export function requireChurchModify(
  auth: AuthContext,
  churchId: Id<"churches">
): void {
  if (isAdmin(auth)) return; // Admins can modify all

  if (!belongsToChurch(auth, churchId)) {
    throw new AuthorizationError("No pertenece a esta iglesia");
  }

  if (!hasMinRole(auth, "treasurer")) {
    throw new AuthorizationError("Se requiere rol de tesorero o superior");
  }
}

/**
 * Ensure user can approve reports
 * (admin or national treasurer)
 */
export function requireReportApproval(
  auth: AuthContext,
  _churchId: Id<"churches">
): void {
  if (isAdmin(auth) || isTreasurer(auth)) {
    return;
  }

  throw new AuthorizationError(
    "Se requiere rol de tesorero nacional o administrador"
  );
}

/**
 * Get accessible church IDs for user
 * - Admin: all churches
 * - Others: only their assigned church
 */
export function getAccessibleChurchIds(auth: AuthContext): Id<"churches">[] | "all" {
  if (isAdmin(auth)) {
    return "all";
  }
  
  if (auth.churchId) {
    return [auth.churchId as Id<"churches">];
  }
  
  return [];
}

/**
 * Filter query results to only accessible churches
 * Helper for church-scoped queries
 */
export function filterByChurchAccess<T extends { church_id?: Id<"churches"> }>(
  auth: AuthContext,
  items: T[]
): T[] {
  if (isAdmin(auth)) {
    return items; // Admin sees all
  }

  if (!auth.churchId) {
    return []; // No church assigned
  }

  return items.filter((item) => item.church_id === auth.churchId);
}

/**
 * Ensure user is fund director (throws if not)
 */
export function requireFundDirector(auth: AuthContext): void {
  if (!hasMinRole(auth, "fund_director")) {
    throw new AuthorizationError("Se requiere rol de director de fondo o superior");
  }
}
