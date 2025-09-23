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

  return {
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
 * Check if user has admin role (including super_admin)
 */
export const requireAdmin = async (request?: NextRequest): Promise<AuthContext> => {
  const context = await requireAuth(request);
  if (!['admin', 'super_admin'].includes(context.role)) {
    throw new Error('Permisos de administrador requeridos');
  }
  return context;
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (context: AuthContext, permission: string): boolean => {
  // Super admins have all permissions
  if (context.role === 'super_admin') return true;

  // Check specific permission in permissions object
  return context.permissions?.[permission] === true;
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
  // Super admins and admins can access all churches
  if (['super_admin', 'admin', 'district_supervisor'].includes(context.role)) {
    return true;
  }

  // Church-specific roles can only access their assigned church
  if (['church_admin', 'treasurer', 'secretary'].includes(context.role) && context.churchId === churchId) {
    return true;
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