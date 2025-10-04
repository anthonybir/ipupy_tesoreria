import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from '@/lib/env-validation';
import type { ProfileRow } from '@/types/database';

type ServerUserProfile = Omit<User, 'phone'> & {
  phone: string | null;
  role: string;
  churchId: number | null;
  churchName: string | null;
  fullName: string | null;
  isAuthenticated: true;
  isActive: boolean;
};

const buildDefaultProfile = (baseUser: User): ServerUserProfile => {
  const metadata = baseUser.user_metadata as Record<string, unknown>;
  const metadataFullName = metadata['full_name'];
  const fullName = typeof metadataFullName === 'string' ? metadataFullName : null;

  return {
    ...baseUser,
    role: 'viewer',
    churchId: null,
    churchName: null,
    fullName,
    phone: baseUser.phone ?? null,
    isAuthenticated: true,
    isActive: true,
  };
};

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll(): ReturnType<typeof cookieStore.getAll> {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>): void {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Next.js supports the object form:
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Server] Error getting user:', error);
    return null;
  }

  return user;
}

export async function getUserProfile(): Promise<ServerUserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[Server] Error getting user for profile:', authError);
    return null;
  }

  type ProfileRecord = Pick<ProfileRow, 'id' | 'email' | 'role' | 'church_id' | 'full_name' | 'is_active'>;

  const {
    data: profileData,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      role,
      church_id,
      full_name,
      is_active
    `
    )
    .eq('id', user.id)
    .maybeSingle<ProfileRecord>();

  if (profileError) {
    console.error('[Server] Error getting user profile:', profileError);
    return buildDefaultProfile(user);
  }

  if (!profileData) {
    return buildDefaultProfile(user);
  }

  const profile: ProfileRecord = profileData;

  let churchName: string | null = null;
  if (profile.church_id) {
    type ChurchNameRecord = { name: string | null };
    const { data: church } = await supabase
      .from('churches')
      .select('name')
      .eq('id', profile.church_id)
      .maybeSingle<ChurchNameRecord>();
    churchName = church?.name ?? null;
  }

  const fullName = profile.full_name ?? null;

  return {
    ...user,
    role: profile.role,
    churchId: profile.church_id ?? null,
    churchName,
    fullName,
    phone: null,
    isAuthenticated: true,
    isActive: profile.is_active,
  };
}