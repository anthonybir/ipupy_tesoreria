'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

type SupabaseAuthContextType = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(SupabaseAuthContext);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <SupabaseAuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}