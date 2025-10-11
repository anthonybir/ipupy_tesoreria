'use client';

import { useMemo } from 'react';
import { useAuth, type AuthUser } from '@/components/Auth/AuthProvider';

export type UserProfile = AuthUser & {
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

const mapAuthUserToProfile = (user: AuthUser): UserProfile => ({
  ...user,
  assigned_funds: [],
  assigned_churches: [],
});

export function useProfile(): UseProfileResult {
  const { user, loading } = useAuth();

  const profile = useMemo(() => {
    if (!user) {
      return null;
    }
    return mapAuthUserToProfile(user);
  }, [user]);

  const role = profile?.role;
  const isAdmin = role === 'admin';
  const isNationalTreasurer = role === 'treasurer';
  const isTreasurer = role === 'treasurer';
  const isFundDirector = role === 'fund_director';
  const isReadOnly = !role || role === 'church_manager' || role === 'secretary';

  return {
    profile,
    loading,
    error: null,
    isAdmin,
    isNationalTreasurer,
    isTreasurer,
    isFundDirector,
    isReadOnly,
  };
}
