import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting user:', error);
    return null;
  }

  return user;
}

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Get profile data from profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      role,
      church_id,
      full_name,
      phone,
      is_active,
      churches (
        id,
        name
      )
    `)
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error getting user profile:', profileError);
    // Create a basic profile if it doesn't exist
    return {
      ...user,
      role: 'viewer',
      churchId: null,
      churchName: null,
      isAuthenticated: true
    };
  }

  // Combine auth user with profile data
  return {
    ...user,
    role: profile?.role || 'viewer',
    churchId: profile?.church_id,
    churchName: profile?.churches?.name,
    fullName: profile?.full_name,
    phone: profile?.phone,
    isAuthenticated: true,
    isActive: profile?.is_active ?? true
  };
}