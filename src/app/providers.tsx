'use client';

import { type ReactNode, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseAuthProvider } from '@/components/Auth/SupabaseAuthProvider';

const DEFAULT_STALE_TIME = 60 * 1000;
const DEFAULT_GC_TIME = 15 * 60 * 1000;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
        retry: 1
      }
    }
  }));

  // Auto-cleanup stale caches on build version change
  useEffect(() => {
    const cookieBuild = document.cookie.match(/(?:^| )app_build_id=([^;]+)/)?.[1];
    const storedBuild = localStorage.getItem('app_build_id');

    if (cookieBuild && storedBuild !== cookieBuild) {
      console.log('[Cache] Build version changed, cleaning up...');

      // Clear service worker if present (defensive - we don't use PWA)
      if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
        void navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => void r.unregister());
        });
      }

      // Clear Cache Storage API
      if (typeof window !== 'undefined' && 'caches' in window) {
        void caches.keys().then(keys => {
          keys.forEach(key => void caches.delete(key));
        });
      }

      // Clear sessionStorage (non-auth data)
      sessionStorage.clear();

      // Update stored build ID BEFORE reload to prevent loop
      localStorage.setItem('app_build_id', cookieBuild);

      // Note: We preserve localStorage (auth tokens, user prefs)
      // Only reload if this is first detection (prevents reload loop)
      if (storedBuild !== null) {
        console.log('[Cache] Reloading to fetch fresh assets...');
        window.location.reload();
      }
    } else if (cookieBuild && !storedBuild) {
      // First visit - just set the ID without reload
      localStorage.setItem('app_build_id', cookieBuild);
    }
  }, []);

  return (
    <SupabaseAuthProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SupabaseAuthProvider>
  );
}
