/**
 * NextAuth v5 (Auth.js) Configuration
 *
 * Phase 4.1b - NextAuth → Convex OIDC Bridge (2025-01-07)
 *
 * This replaces Supabase Auth with NextAuth + Google OAuth.
 * Provides ID tokens and refresh tokens for Convex authentication.
 *
 * SECURITY:
 * - Enforces @ipupy.org.py domain restriction
 * - Stores id_token + refresh_token in encrypted JWT session
 * - Validates domain before creating session (signIn callback)
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

// NextAuth logger interface
type LoggerInstance = {
  error: (code: string, metadata?: unknown) => void;
  warn: (code: string, metadata?: unknown) => void;
  debug: (code: string, metadata?: unknown) => void;
};

// Extend NextAuth types to include our custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    } & DefaultSession["user"];
    // Google OIDC tokens for Convex
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

// Allowed email domain (from original Supabase config)
const ALLOWED_DOMAIN = "@ipupy.org.py";

const SENSITIVE_KEYS = new Set([
  "clientSecret",
  "client_secret",
  "secret",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
]);

function redactSensitive(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  const clone: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      clone[key] = "[REDACTED]";
      continue;
    }

    if (typeof nestedValue === "object" && nestedValue !== null) {
      clone[key] = redactSensitive(nestedValue);
      continue;
    }

    clone[key] = nestedValue;
  }
  return clone;
}

function sanitizeMetadata(metadata: unknown): unknown {
  return redactSensitive(metadata);
}

const nextAuthLogger: Partial<LoggerInstance> = {
  debug(code: string, metadata?: unknown) {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    const safeMetadata = sanitizeMetadata(metadata);
    console.warn(`[NextAuth][debug][${code}]`, safeMetadata);
  },
  warn(code: string, metadata?: unknown) {
    const safeMetadata = sanitizeMetadata(metadata);
    console.warn(`[NextAuth][warn][${code}]`, safeMetadata);
  },
  error(code: string, metadata?: unknown) {
    const safeMetadata = sanitizeMetadata(metadata);
    console.error(`[NextAuth][error][${code}]`, safeMetadata);
  },
};

/**
 * Validate email domain
 */
function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN);
}

/**
 * Refresh Google access token using refresh token
 *
 * Google's token endpoint returns a new id_token when refreshing.
 * This is critical for Convex - we need fresh ID tokens, not access tokens.
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env['GOOGLE_CLIENT_ID'] ?? "",
        client_secret: process.env['GOOGLE_CLIENT_SECRET'] ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) {
      console.error("[NextAuth] Token refresh failed:", refreshed);
      throw new Error("Token refresh failed");
    }

    return {
      ...token,
      idToken: refreshed.id_token, // New ID token from Google
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      // Keep existing refresh token (Google doesn't issue new ones on refresh)
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("[NextAuth] Error refreshing token:", error);

    // Return token with error flag - this will force re-login
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

// Validate required environment variables
const googleClientId = process.env['GOOGLE_CLIENT_ID'];
const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];

if (!googleClientId || !googleClientSecret) {
  throw new Error(
    'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variable'
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          // Request offline access to get refresh token
          access_type: "offline",
          prompt: "consent",
          // Request ID token (standard OIDC scope)
          scope: "openid email profile",
          // For Google Workspace: include hd claim
          hd: "ipupy.org.py",
        },
      },
    }),
  ],

  // Use JWT for serverless compatibility (no database needed)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    /**
     * signIn callback - Validate domain before allowing sign in
     *
     * This is the SECURITY GATE - reject unauthorized domains here.
     */
    async signIn({ account: _account, profile }) {
      if (!profile?.email) {
        console.warn("[NextAuth] Sign in blocked: no email in profile");
        return false;
      }

      // Check domain restriction
      if (!isAllowedEmail(profile.email)) {
        console.warn(
          `[NextAuth] Sign in blocked: unauthorized domain ${profile.email}`
        );
        return false;
      }

      // For Google Workspace accounts, verify hd claim
      const hd = (profile as { hd?: string }).hd;
      if (hd && hd !== "ipupy.org.py") {
        console.warn(
          `[NextAuth] Sign in blocked: hd claim mismatch (${hd} !== ipupy.org.py)`
        );
        return false;
      }

      return true;
    },

    /**
     * jwt callback - Attach Google tokens to JWT
     *
     * This runs on every request. We store the Google ID token here
     * so we can pass it to Convex for authentication.
     */
    async jwt({ token, account, user }) {
      // Initial sign in - store tokens from OAuth response
      if (account?.id_token) {
        // NextAuth provides `user` during the initial sign-in, but keep a defensive
        // guard in case future changes ever omit it.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!user) {
          return token;
        }
        return {
          ...token,
          id: user.id,
          idToken: account.id_token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        } as JWT;
      }

      // Return previous token if it hasn't expired
      const expiresAt = typeof token.expiresAt === "number" ? token.expiresAt : null;
      if (expiresAt !== null && Date.now() < expiresAt) {
        return token;
      }

      // Token expired - refresh it
      console.warn("[NextAuth] Token expired, refreshing...");
      return await refreshAccessToken(token);
    },

    /**
     * session callback - Expose tokens to client
     *
     * The session object is available client-side via useSession().
     * We expose the ID token here so our Convex auth hook can use it.
     */
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
        },
        idToken: token.idToken,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      };
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  // Type assertion needed because NextAuth's logger types are inconsistent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: nextAuthLogger as any,

  // Enable debug in development (sanitized via custom logger)
  debug: process.env.NODE_ENV === "development",
});
