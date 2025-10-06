import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRole } from '@/lib/authz';

export type AuthContext = {
  userId: string;  // Now UUID instead of number
  email: string;
  role: ProfileRole;
  churchId?: number | null;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  permissions?: Record<string, boolean | string | number>;
  preferredLanguage?: string;
  isProfileComplete?: boolean;
  assignedFunds?: number[];
  assignedChurches?: number[];
};

/**
 * Get authentication context from Supabase Auth
 * This replaces the legacy JWT-based auth
 *
 * SECURITY: Enforces @ipupy.org.py domain restriction
 *
 * @param _request - Request parameter kept for backward compatibility, not used
 */
export const getAuthContext = async (_request?: NextRequest): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // SECURITY: Enforce allowed email domain
  const allowedDomain = '@ipupy.org.py';
  const userEmail = user.email?.toLowerCase() || '';

  if (!userEmail.endsWith(allowedDomain)) {
    console.warn(
      `[Auth Security] Rejected login from unauthorized domain: ${user.email}`,
      { userId: user.id, domain: userEmail.split('@')[1] }
    );

    // Invalidate the session immediately
    await supabase.auth.signOut();

    return null;
  }

  // Get profile data from profiles table with all new fields
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      role,
      church_id,
      phone,
      avatar_url,
      permissions,
      preferred_language,
      profile_completed_at
    `)
    .eq('id', user.id)
    .single();

  if (!profile) {
    // User exists in auth but no profile yet (shouldn't happen with trigger)
    console.error(`No profile found for authenticated user ${user.id}`);
    return null;
  }

  // Update last seen timestamp
  await supabase.rpc('update_last_seen');

  const authContext: AuthContext = {
    userId: profile.id,
    email: profile.email,
    role: profile.role || 'secretary', // Default to 'secretary' (lowest privilege role)
    churchId: profile.church_id,
    fullName: profile.full_name || undefined,
    phone: profile.phone || undefined,
    avatarUrl: profile.avatar_url || undefined,
    permissions: profile.permissions || {},
    preferredLanguage: profile.preferred_language || 'es',
    isProfileComplete: !!(profile.full_name && profile.phone)
  };

  // Fetch fund director assignments if applicable
  if (profile.role === 'fund_director') {
    const { data: assignments } = await supabase
      .from('fund_director_assignments')
      .select('fund_id, church_id')
      .eq('profile_id', user.id);

    if (assignments) {
      authContext.assignedFunds = assignments
        .filter(a => a.fund_id !== null)
        .map(a => a.fund_id as number);
      authContext.assignedChurches = assignments
        .filter(a => a.church_id !== null)
        .map(a => a.church_id as number);
    }
  }

  return authContext;
};

/**
 * Require authentication for a request
 * Throws an error if not authenticated
 */
export const requireAuth = async (request?: NextRequest): Promise<AuthContext> => {
  const context = await getAuthContext(request);
  if (!context) {
    throw new Error('Autenticación requerida');
  }
  return context;
};

/**
 * Check if user has admin role
 */
export const requireAdmin = async (request?: NextRequest): Promise<AuthContext> => {
  const context = await requireAuth(request);
  if (context.role !== 'admin') {
    throw new Error('Permisos de administrador requeridos');
  }
  return context;
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (context: AuthContext, permission: string): boolean => {
  // Admins have all permissions
  if (context.role === 'admin') return true;

  // Check specific permission in permissions object
  return context.permissions?.[permission] === true;
};

/**
 * Check if user is a fund director
 */
export const isFundDirector = (context: AuthContext): boolean => {
  return context.role === 'fund_director';
};

/**
 * Check if user has access to specific fund
 */
export const hasFundAccess = (context: AuthContext, fundId: number): boolean => {
  // National-level roles have access to all funds
  if (context.role === 'admin' || context.role === 'national_treasurer') return true;

  // Fund directors only have access to assigned funds
  if (context.role === 'fund_director') {
    return context.assignedFunds?.includes(fundId) ?? false;
  }

  // Church-level roles (treasurer, pastor, church_manager, secretary) have NO fund access
  // Funds are NATIONAL scope only
  return false;
};

/**
 * Check if user has access to specific church
 */
export const hasChurchAccess = (context: AuthContext, churchId: number): boolean => {
  // National-level roles have access to all churches
  if (context.role === 'admin' || context.role === 'national_treasurer') return true;

  // Fund directors only have access to assigned churches
  if (context.role === 'fund_director') {
    return context.assignedChurches?.includes(churchId) ?? false;
  }

  // Church-level roles (pastor, treasurer, church_manager, secretary) only access their own church
  if (['pastor', 'treasurer', 'church_manager', 'secretary'].includes(context.role)) {
    return context.churchId === churchId;
  }

  return false;
};

/**
 * Check if user is the system owner
 */
export const isSystemOwner = (email: string): boolean =>
  email.toLowerCase() === 'administracion@ipupy.org.py';

/**
 * Check if user can access a specific church
 */
export const canAccessChurch = (context: AuthContext, churchId: number): boolean => {
  // Tier 1: Unrestricted cross-church access (national-level roles)
  if (['admin', 'national_treasurer'].includes(context.role)) {
    return true;
  }

  // Tier 2: Fund directors check explicit assignments
  if (context.role === 'fund_director') {
    return context.assignedChurches?.includes(churchId) ?? false;
  }

  // Tier 3: Church-scoped roles (own church only)
  if (['pastor', 'church_manager', 'treasurer', 'secretary'].includes(context.role)) {
    return context.churchId === churchId;
  }

  return false;
};

/**
 * Log user activity
 */
export const logActivity = async (
  action: string,
  details?: Record<string, boolean | string | number>,
  request?: NextRequest
): Promise<void> => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from('user_activity').insert({
      user_id: user.id,
      action,
      details,
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent')
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};