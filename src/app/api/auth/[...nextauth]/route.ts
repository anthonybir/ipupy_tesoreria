/**
 * NextAuth v5 API Route Handler
 *
 * Phase 4.1b - NextAuth → Convex OIDC Bridge (2025-01-07)
 *
 * This is the standard Auth.js route handler for Next.js 15 App Router.
 * Handles all authentication flows: /api/auth/signin, /api/auth/callback, etc.
 *
 * Exports:
 * - GET: Handle OAuth callbacks, session checks, CSRF tokens
 * - POST: Handle sign in, sign out, callback verification
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
