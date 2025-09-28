import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type AuthContext = {
  userId: string;  // Now UUID instead of number
  email: string;
  role: string;
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
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getAuthContext = async (_request?: NextRequest): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
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
    role: profile.role || 'viewer',
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
 * Check if fund director has access to specific fund
 */
export const hasFundAccess = (context: AuthContext, fundId: number): boolean => {
  if (context.role === 'admin' || context.role === 'treasurer') return true;
  if (context.role === 'fund_director') {
    return context.assignedFunds?.includes(fundId) ?? false;
  }
  return true;
};

/**
 * Check if fund director has access to specific church
 */
export const hasChurchAccess = (context: AuthContext, churchId: number): boolean => {
  if (context.role === 'admin' || context.role === 'treasurer') return true;
  if (context.role === 'fund_director') {
    return context.assignedChurches?.includes(churchId) ?? false;
  }
  return true;
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
  // Tier 1: Unrestricted cross-church access
  if (['admin', 'district_supervisor'].includes(context.role)) {
    return true;
  }

  // Tier 2: Fund directors check explicit assignments
  if (context.role === 'fund_director') {
    return context.assignedChurches?.includes(churchId) ?? false;
  }

  // Tier 3: Church-scoped roles (own church only)
  if (['pastor', 'treasurer', 'secretary'].includes(context.role)) {
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