import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRole } from '@/lib/authz';

export type AuthContext = {
  userId?: string | undefined;  // Changed to string (UUID) from number
  email?: string | undefined;
  role?: ProfileRole | undefined;
  churchId?: number | null | undefined;
  fullName?: string | undefined;
  phone?: string | undefined;
  permissions?: Record<string, boolean | string | number> | undefined;
};


/**
 * Get authentication context from Supabase Auth only
 * No more legacy JWT token support - all auth goes through Supabase
 *
 * @param _request - Request parameter kept for backward compatibility, not used
 */
export const getAuthContext = async (_request?: NextRequest): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('[AUTH_CONTEXT] Supabase auth.getUser() failed:', {
      error: error.message,
      status: error.status,
      name: error.name
    });
    return null;
  }

  if (!user) {
    console.warn('[AUTH_CONTEXT] No authenticated user found in session');
    return null;
  }

  // Get enhanced profile data from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      role,
      church_id,
      full_name,
      phone,
      permissions
    `)
    .eq('id', user.id)
    .single();

  if (profile) {
    // Update last seen timestamp (if we add this function later)
    // await supabase.rpc('update_last_seen');

    return {
      userId: profile.id,
      email: profile.email,
      role: profile.role || 'secretary', // Default to lowest privilege role
      churchId: profile.church_id || null,
      fullName: profile.full_name || undefined,
      phone: profile.phone || undefined,
      permissions: profile.permissions || {}
    };
  }

  // Fallback if no profile exists yet (shouldn't happen with trigger)
  console.error('[AUTH_CONTEXT] No profile found for authenticated user:', {
    userId: user.id,
    email: user.email
  });
  return {
    userId: user.id,
    email: user.email || undefined,
    role: 'secretary', // Default to lowest privilege role
    churchId: null
  };
};

export const requireAuth = async (request: NextRequest): Promise<AuthContext> => {
  const context = await getAuthContext(request);
  if (!context) {
    throw new Error('Autenticación requerida');
  }
  return context;
};
