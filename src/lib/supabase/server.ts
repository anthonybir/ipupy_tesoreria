import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  // Get the access token from cookies if it exists
  const accessToken = cookieStore.get('sb-access-token')?.value;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`
        } : undefined
      }
    }
  );

  return supabase;
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
    .select('*, churches(id, name)')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error getting user profile:', profileError);
    return null;
  }

  // Combine auth user with profile data
  return {
    ...user,
    role: profile?.role || 'viewer',
    churchId: profile?.church_id,
    churchName: profile?.churches?.name,
    isAuthenticated: profile?.is_authenticated || false
  };
}