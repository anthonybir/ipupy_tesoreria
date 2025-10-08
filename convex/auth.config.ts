/**
 * Convex Auth Configuration
 *
 * Phase 4.1b - NextAuth → Convex OIDC Bridge (2025-01-07)
 *
 * Configures Convex to accept Google OIDC (OpenID Connect) tokens.
 * These tokens are issued by Google's OAuth server and validated against
 * Google's public JWKS (JSON Web Key Set).
 *
 * CRITICAL CONFIGURATION:
 * - domain: Must match the `iss` (issuer) claim in Google ID tokens
 * - applicationID: Must match the `aud` (audience) claim in Google ID tokens
 *
 * Token Validation Flow:
 * 1. Client sends Google ID token to Convex via setAuth()
 * 2. Convex extracts `iss` and `aud` claims from token
 * 3. Convex matches against this config
 * 4. Convex fetches Google's JWKS from https://accounts.google.com/.well-known/openid-configuration
 * 5. Convex validates token signature using Google's public keys
 * 6. If valid, ctx.auth.getUserIdentity() returns the token payload
 *
 * Google OIDC Spec:
 * - Issuer: https://accounts.google.com
 * - Audience: Your Google OAuth Client ID
 * - JWK Discovery: https://www.googleapis.com/oauth2/v3/certs
 *
 * References:
 * - https://docs.convex.dev/auth/advanced/custom-auth
 * - https://developers.google.com/identity/openid-connect/openid-connect
 */

const googleAuthProviderConfig = {
  providers: [
    {
      // Google OIDC issuer (matches `iss` claim in ID tokens)
      domain: "https://accounts.google.com",

      // Google OAuth Client ID (matches `aud` claim in ID tokens)
      // CRITICAL: This must match GOOGLE_CLIENT_ID from .env (server-side variable)
      // Convex backend has access to server env vars via process.env
      applicationID: (() => {
        const clientId = process.env["GOOGLE_CLIENT_ID"];
        if (!clientId) {
          throw new Error(
            "GOOGLE_CLIENT_ID is not configured. Convex cannot validate Google ID tokens without it."
          );
        }
        return clientId;
      })(),
    },
  ],
};

export default googleAuthProviderConfig;
