import type { AuthContext } from '@/lib/auth-context';

// Role system aligned with actual database constraint (profiles_role_check)
// Database has: admin, treasurer, pastor, church_manager, secretary, fund_director
const ADMIN_ROLES = new Set(['admin']);
const PROFILE_ROLE_ORDER = [
  'admin',
  'fund_director',
  'pastor',
  'treasurer',
  'church_manager',
  'secretary'
] as const;

/**
 * Branded type for profile roles
 * Provides compile-time safety and autocomplete for role strings
 */
export type ProfileRole = typeof PROFILE_ROLE_ORDER[number];

type MaybeRole = string | null | undefined;

type MaybeAuth = Pick<AuthContext, 'role'> | null | undefined;

export const hasAdminPrivileges = (role: MaybeRole): boolean => {
  if (!role) {
    return false;
  }
  return ADMIN_ROLES.has(role);
};

export const requireAdminPrivileges = (auth: MaybeAuth): asserts auth is AuthContext & { role: string } => {
  if (!auth || !hasAdminPrivileges(auth.role)) {
    throw new Error('Unauthorized');
  }
};

export const adminRoles = (): string[] => Array.from(ADMIN_ROLES);

export const profileRoles = (): readonly string[] => PROFILE_ROLE_ORDER;

export const isValidProfileRole = (role: MaybeRole): role is typeof PROFILE_ROLE_ORDER[number] => {
  if (!role) {
    return false;
  }
  return PROFILE_ROLE_ORDER.includes(role as typeof PROFILE_ROLE_ORDER[number]);
};
