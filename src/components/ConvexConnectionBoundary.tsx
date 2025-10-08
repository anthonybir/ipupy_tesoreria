'use client';

import type { JSX, ReactNode } from 'react';
import { useConvexConnectionState } from 'convex/react';

const bannerStyles =
  'fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-amber-500/90 px-4 py-2 text-sm font-medium text-white shadow-lg';

const indicatorStyles = 'mr-2 inline-block h-2 w-2 rounded-full bg-white/80 align-middle';

/**
 * Displays a subtle banner whenever the Convex websocket is disconnected.
 *
 * The banner helps surface auth/network issues during development without
 * interrupting normal rendering. It only appears after at least one
 * successful connection has been established.
 */
export function ConvexConnectionBoundary({ children }: { children: ReactNode }): JSX.Element {
  const state = useConvexConnectionState();

  const showBanner = state.hasEverConnected && !state.isWebSocketConnected;

  return (
    <>
      {children}
      {showBanner ? (
        <div className={bannerStyles}>
          <span className={indicatorStyles} aria-hidden />
          Reconectando con el servidor de Convex…
        </div>
      ) : null}
    </>
  );
}
