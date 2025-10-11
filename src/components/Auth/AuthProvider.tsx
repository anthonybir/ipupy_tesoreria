'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useAuthActions, useAuthToken } from '@convex-dev/auth/react';

import { useConvexQueryState } from '@/hooks/useConvexQueryState';
import { useConvexMutation } from '@/hooks/useConvexMutation';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

type ProfileRole =
  | 'admin'
  | 'fund_director'
  | 'pastor'
  | 'treasurer'
  | 'church_manager'
  | 'secretary';

type CurrentProfile = {
  id: Id<"profiles">;
  userId: string;
  email: string;
  role: ProfileRole;
  fullName: string | null;
  active: boolean;
  church: {
    id: Id<"churches">;
    name: string | null;
    city: string | null;
  } | null;
  fundId: Id<"funds"> | null;
  userName: string | null;
  updatedAt: number;
};

type CurrentProfileResponse = CurrentProfile | null;

export type AuthUser = {
  profileId: string;
  userId: string | null;
  email: string;
  fullName: string | null;
  userName: string | null;
  role: ProfileRole;
  active: boolean;
  churchId: string | null;
  churchName: string | null;
  churchCity: string | null;
  fundId: string | null;
  updatedAt: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = (): AuthContextValue => useContext(AuthContext);

const mapProfile = (profile: CurrentProfile): AuthUser => ({
  profileId: profile.id,
  userId: profile.userId,
  email: profile.email,
  fullName: profile.fullName,
  userName: profile.userName,
  role: profile.role,
  active: profile.active,
  churchId: profile.church?.id ?? null,
  churchName: profile.church?.name ?? null,
  churchCity: profile.church?.city ?? null,
  fundId: profile.fundId,
  updatedAt: profile.updatedAt,
});

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const token = useAuthToken();
  const { signOut: convexSignOut } = useAuthActions();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [hasTriggeredEnsure, setHasTriggeredEnsure] = useState(false);

  const profileQuery = useConvexQueryState(
    api.auth.getCurrentProfile,
    [{}],
    (result: CurrentProfileResponse | null) => result,
    {
      enabled: token !== null,
    }
  );

  useEffect(() => {
    if (token === null) {
      setHasCheckedAuth(true);
    }
  }, [token]);

  useEffect(() => {
    if (token === null) {
      setHasTriggeredEnsure(false);
    }
  }, [token]);

  useEffect(() => {
    if (profileQuery.data !== undefined) {
      setHasCheckedAuth(true);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (profileQuery.error) {
      console.error('[Auth] Failed to load current profile', profileQuery.error);
    }
  }, [profileQuery.error]);

  const {
    mutateAsync: ensureProfile,
    isPending: isEnsuringProfile,
  } = useConvexMutation(api.auth.ensureProfile);

  useEffect(() => {
    if (
      token !== null &&
      profileQuery.data === null &&
      !profileQuery.isLoading &&
      !hasTriggeredEnsure &&
      !isEnsuringProfile
    ) {
      setHasTriggeredEnsure(true);
      ensureProfile({})
        .catch((error) => {
          console.error('[Auth] Failed to ensure profile for current user', error);
        });
    }
  }, [ensureProfile, hasTriggeredEnsure, isEnsuringProfile, profileQuery.data, profileQuery.isLoading, token]);

  const user = useMemo(() => {
    if (!profileQuery.data) {
      return null;
    }
    return mapProfile(profileQuery.data);
  }, [profileQuery.data]);

  const loading = token !== null ? profileQuery.isLoading && !profileQuery.data : !hasCheckedAuth;

  const handleSignOut = useCallback(async () => {
    await convexSignOut();
    window.location.href = '/login';
  }, [convexSignOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signOut: handleSignOut,
    }),
    [handleSignOut, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
