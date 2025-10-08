'use client';

import { type ReactNode, useState, useEffect, type JSX } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ConvexProviderWithAuth } from 'convex/react';
import { useAuthFromNextAuth } from '@/hooks/useAuthFromNextAuth';
import { logger } from '@/lib/logger';
import { convexClient } from '@/lib/convex-client';
import { ConvexConnectionBoundary } from '@/components/ConvexConnectionBoundary';

const DEFAULT_STALE_TIME = 60 * 1000;
const DEFAULT_GC_TIME = 15 * 60 * 1000;

/**
 * Convex Provider with NextAuth Integration
 *
 * This wraps ConvexProviderWithAuth and provides the useAuth hook
 * that bridges NextAuth → Convex authentication.
 */
function ConvexAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convexClient} useAuth={useAuthFromNextAuth}>
      <ConvexConnectionBoundary>{children}</ConvexConnectionBoundary>
    </ConvexProviderWithAuth>
  );
}

export function Providers({ children }: { children: ReactNode }): JSX.Element {
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
      logger.info('[Cache] Build version changed, cleaning up...');

      // Clear service worker if present (defensive - we don't use PWA)
      if ('serviceWorker' in navigator) {
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
        logger.info('[Cache] Reloading to fetch fresh assets...');
        window.location.reload();
      }
    } else if (cookieBuild && !storedBuild) {
      // First visit - just set the ID without reload
      localStorage.setItem('app_build_id', cookieBuild);
    }
  }, []);

  return (
    <SessionProvider>
      <ConvexAuthProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ConvexAuthProvider>
    </SessionProvider>
  );
}
