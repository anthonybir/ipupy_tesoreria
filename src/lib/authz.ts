import type { AuthContext } from '@/lib/auth-context';

/**
 * Role system aligned with database constraint (profiles_role_check)
 *
 * @see migrations/023_simplify_roles.sql - Initial role simplification
 * @see migrations/026_fund_director_events.sql - Added fund_director role
 * @see migrations/037_fix_role_inconsistencies.sql - Fixed permissions & hierarchy
 * @see docs/ROLES_AND_PERMISSIONS.md - Complete role documentation
 *
 * Database constraint allows: admin, treasurer, pastor, church_manager, secretary, fund_director
 */
const ADMIN_ROLES = new Set(['admin']);

/**
 * Profile roles in hierarchical order (high to low privilege)
 *
 * Hierarchy levels (see get_role_level() in database):
 * - admin (6): Full system control
 * - fund_director (5): Fund-specific management
 * - pastor (4): Church leadership
 * - treasurer (3): Financial operations
 * - church_manager (2): Church administration
 * - secretary (1): Administrative support
 */
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

/**
 * Spanish labels for profile roles (for UI display)
 */
const ROLE_LABELS: Record<ProfileRole, string> = {
  admin: 'Administrador',
  fund_director: 'Director de Fondos',
  pastor: 'Pastor',
  treasurer: 'Tesorero',
  church_manager: 'Gerente de Iglesia',
  secretary: 'Secretario'
};

/**
 * Get Spanish label for a role
 */
export const getRoleLabel = (role: ProfileRole): string => {
  return ROLE_LABELS[role];
};

/**
 * Get all roles with their Spanish labels
 */
export const getRolesWithLabels = (): Array<{ value: ProfileRole; label: string }> => {
  return PROFILE_ROLE_ORDER.map((role) => ({
    value: role,
    label: ROLE_LABELS[role]
  }));
};

export const isValidProfileRole = (role: MaybeRole): role is typeof PROFILE_ROLE_ORDER[number] => {
  if (!role) {
    return false;
  }
  return PROFILE_ROLE_ORDER.includes(role as typeof PROFILE_ROLE_ORDER[number]);
};
