import type { AuthContext } from '@/lib/auth-context';

const hasFundAccess = (context: AuthContext, fundId: number): boolean => {
  return context.assignedFunds?.includes(fundId) ?? false;
};

/**
 * Authorization helpers for fund event operations
 *
 * Centralizes permission logic to prevent data leakage and ensure
 * national roles (admin, treasurer) have proper access.
 *
 * @see migrations/053_merge_national_treasurer_into_treasurer.sql - Merged national_treasurer → treasurer
 * @see migrations/051_restore_treasurer_national_access.sql - Restored treasurer national access
 */

/**
 * Check if user can view fund event data (events, budgets, actuals)
 *
 * Permission hierarchy:
 * - admin: All fund events (level 7)
 * - treasurer: All fund events (level 6) - NATIONAL role
 * - fund_director: Only assigned funds (level 5)
 * - pastor/church_manager/secretary: NO ACCESS to national fund events
 *
 * @param auth - Authenticated user context
 * @param fundId - Fund ID to check access for
 * @returns true if user can view fund event data
 */
export function canViewFundEvent(
  auth: AuthContext,
  fundId: number
): boolean {
  // National-level roles: unrestricted access to all funds
  if (auth.role === 'admin' || auth.role === 'treasurer') {
    return true;
  }

  // Fund directors: only assigned funds
  if (auth.role === 'fund_director') {
    return hasFundAccess(auth, fundId);
  }

  // Church-scoped roles (pastor, church_manager, secretary):
  // NO ACCESS to national fund events
  return false;
}

/**
 * Check if user can create or modify fund event data
 *
 * Permission hierarchy:
 * - admin: Can create/edit all fund events (level 7)
 * - treasurer: Can create/edit all fund events (level 6) - NATIONAL role
 * - fund_director: Can create/edit events for assigned funds (level 5)
 * - pastor/church_manager/secretary: NO ACCESS
 *
 * @param auth - Authenticated user context
 * @param fundId - Fund ID to check access for
 * @returns true if user can create or modify fund event data
 */
export function canMutateFundEvent(
  auth: AuthContext,
  fundId: number
): boolean {
  // Same logic as canViewFundEvent - creation/modification requires same scope
  return canViewFundEvent(auth, fundId);
}

/**
 * Check if user can approve fund events (change status to 'approved')
 *
 * Permission hierarchy:
 * - admin: Can approve all fund events (level 7)
 * - treasurer: Can approve all fund events (level 6) - NATIONAL role
 * - fund_director: CANNOT approve (can only submit for approval)
 * - pastor/church_manager/secretary: NO ACCESS
 *
 * Approval workflow:
 * 1. fund_director creates event (draft)
 * 2. fund_director submits event (submitted)
 * 3. treasurer approves event (approved) ← This permission
 * 4. System creates ledger transactions
 *
 * @param auth - Authenticated user context
 * @returns true if user can approve fund events
 */
export function canApproveFundEvent(auth: AuthContext): boolean {
  // Only national-level roles can approve fund events
  return auth.role === 'admin' || auth.role === 'treasurer';
}

/**
 * Check if user has any fund event access
 *
 * Used for navigation menu visibility and feature gating.
 *
 * @param auth - Authenticated user context
 * @returns true if user has any level of fund event access
 */
export function hasFundEventAccess(auth: AuthContext): boolean {
  return (
    auth.role === 'admin' ||
    auth.role === 'treasurer' ||
    auth.role === 'fund_director'
  );
}
