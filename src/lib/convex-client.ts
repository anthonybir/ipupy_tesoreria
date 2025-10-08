import { ConvexReactClient } from 'convex/react';

/**
 * Singleton Convex client used across the application.
 *
 * The ConvexReactClient manages a websocket connection to the backend and is
 * safe to share between providers/hooks. Keeping the instance in a dedicated
 * module avoids accidental re-instantiation during hot reloads.
 *
 * IMPORTANT: NEXT_PUBLIC_CONVEX_URL must be accessed inline for Next.js
 * static replacement to work correctly. Assigning it to a variable first
 * breaks the build-time replacement.
 */
export const convexClient = new ConvexReactClient(
  process.env['NEXT_PUBLIC_CONVEX_URL'] ?? (() => {
    throw new Error(
      'Missing NEXT_PUBLIC_CONVEX_URL environment variable. ' +
        'Set this value to your Convex deployment URL before running the app.'
    );
  })()
);
