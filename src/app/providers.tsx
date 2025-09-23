'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseAuthProvider } from '@/components/Auth/SupabaseAuthProvider';

const DEFAULT_STALE_TIME = 60 * 1000;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  }));

  return (
    <SupabaseAuthProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SupabaseAuthProvider>
  );
}
