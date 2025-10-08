# Security Review Report – Supabase ➜ Convex Migration

**Review Completed**: January 8, 2025  
**Annotated**: October 8, 2025  
**Reviewer**: Claude Security Analysis  
**Maintainer Addendum**: Anthony Bir (2025-10-08)

## Summary
A follow-up review of the Supabase-to-Convex migration confirmed that all previously flagged vulnerabilities were false positives. Each disposition below now cites the corresponding code paths so future auditors can re-verify the controls without re-running the entire investigation. No exploitable issues were identified.

## Finding Disposition Details

### Google Client Secret Exposure (Initial: HIGH) — False Positive
- `GOOGLE_CLIENT_SECRET` is referenced exclusively inside the server-only NextAuth handler when exchanging refresh tokens (`src/lib/auth.ts:136-190`). No client bundle imports the secret (`rg "GOOGLE_CLIENT_SECRET" src` returns only this file).
- Convex relies on the public client identifier during OIDC validation, not the secret (`convex/auth.config.ts:32-49`).
- Environment variables remain in server scopes only (`.env.local`, Vercel env dashboard) and are validated during startup (`src/lib/auth.ts:175-183`).

### Active Status Check Bypass (Initial: HIGH) — False Positive
- Every Convex function calls `getAuthContext()` before executing business logic, which loads the latest profile and blocks inactive users (`convex/lib/auth.ts:58-84`).
- Example: fund event mutations retrieve auth and immediately enforce role/state checks (`convex/fundEvents.ts:343-411`). Similar patterns exist in `convex/transactions.ts:75-110` and all admin/funds modules.

### Domain Restriction Bypass (Initial: MEDIUM) — False Positive
- The `signIn` callback rejects any email outside `@ipupy.org.py` and verifies the Google hosted domain (`src/lib/auth.ts:216-236`).
- Session objects do not persist if the domain check fails; the handler simply returns `false`, preventing cookies from being issued (`src/lib/auth.ts:210-240`).

### Token Refresh Race Condition (Initial: MEDIUM) — False Positive
- Token refresh happens through a single server-side helper that returns a new ID token atomically and records the `expiresAt` timestamp (`src/lib/auth.ts:124-171`).
- NextAuth caches sessions as JWTs with `strategy: "jwt"` and rotates tokens whenever `expiresAt` is stale, preventing overlapping refresh calls (`src/lib/auth.ts:205-271`).

### Fund Event Authorization Bypass (Initial: MEDIUM) — False Positive
- Treasurer access is intentionally national in scope per RBAC design (see `docs/SECURITY.md`, role notes under "Treasurer role"), so cross-church visibility is expected.
- Mutation guards enforce minimum role levels before approving or rejecting events (`convex/fundEvents.ts:433-510`) using the shared helper that throws when the user lacks the required tier (`convex/lib/permissions.ts:78-112`).

## Threat Model Clarification
- **External attackers**: Cannot sign in without an `@ipupy.org.py` Google account; even if they acquired the public client ID, the secret never leaves server-side code, so OAuth exchange is protected.
- **Compromised internal account**: An attacker who already controls an admin or treasurer account inherently holds the documented level of access. Domain restriction and active status checks limit lateral movement, and all privileged Convex paths revalidate active status on every request.
- **Token replay/DoS**: Concurrent refresh attempts resolve to cached JWT sessions; failed refreshes set an error flag that forces re-authentication rather than granting extended access.

## Review Artifacts
- Audit notebook: `docs/archive/audits/SECURITY_AUDIT_2025-09-28.md`
- Migration deep dives: `docs/archive/convex-migration/` (phase 4.1b entries)

## Follow-Up Actions
See `docs/SECURITY.md` (“Hardening Backlog”) for the ticketized recommendations captured on October 8, 2025.
