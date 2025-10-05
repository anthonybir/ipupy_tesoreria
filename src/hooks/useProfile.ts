import { useEffect, useState } from 'react';
import { useAuth } from '@/components/Auth/SupabaseAuthProvider';
import { createClient } from '@/lib/supabase/client';
import type { ProfileRole } from '@/lib/authz';

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  church_id: number | null;
  phone: string | null;
  avatar_url: string | null;
  permissions: Record<string, boolean | string | number> | null;
  preferred_language: string | null;
  is_active: boolean;
  assigned_funds?: number[];
  assigned_churches?: number[];
};

type UseProfileResult = {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  isAdmin: boolean;
  isNationalTreasurer: boolean;
  isTreasurer: boolean;
  isFundDirector: boolean;
  isReadOnly: boolean;
};

export function useProfile(): UseProfileResult {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const supabase = createClient();

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        let assignedFunds: number[] = [];
        let assignedChurches: number[] = [];

        if (profileData.role === 'fund_director') {
          const { data: assignments } = await supabase
            .from('fund_director_assignments')
            .select('fund_id, church_id')
            .eq('profile_id', user.id);

          if (assignments) {
            assignedFunds = assignments
              .filter(a => a.fund_id !== null)
              .map(a => a.fund_id as number);
            assignedChurches = assignments
              .filter(a => a.church_id !== null)
              .map(a => a.church_id as number);
          }
        }

        setProfile({
          ...profileData,
          assigned_funds: assignedFunds,
          assigned_churches: assignedChurches,
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, authLoading]);

  const isAdmin = profile?.role === 'admin';
  const isNationalTreasurer = profile?.role === 'national_treasurer';
  const isTreasurer = profile?.role === 'treasurer';
  const isFundDirector = profile?.role === 'fund_director';
  const isReadOnly = !profile?.role || profile.role === 'church_manager' || profile.role === 'secretary';

  return {
    profile,
    loading,
    error,
    isAdmin,
    isNationalTreasurer,
    isTreasurer,
    isFundDirector,
    isReadOnly,
  };
}