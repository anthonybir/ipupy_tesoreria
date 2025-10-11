# WS-4 Phase 2 – Profiles ↔ Convex Auth Migration Plan

**Date:** October 11, 2025  
**Owners:** Anthony (primary), Claude (support)

## 1. Context

- Convex Auth (`authTables`) is now part of `convex/schema.ts`.  
- `profiles` currently stores the legacy `user_id` string (email) and drives all role-based logic.  
- The app is pre-production (no live users), so we can make breaking schema changes without data migration risk.

## 2. Goal

Align `profiles` with Convex Auth by replacing the legacy string identifier with a proper `Id<"users">`, eliminating historical baggage and simplifying future role logic.

## 3. Decision Summary

> **Adopt the clean-slate approach:** Remove the string-based `user_id`, require `profiles.user_id: v.id("users")`, and update backend/frontend code to rely exclusively on Convex Auth user IDs.  

Rationale:

- No production data → no migration complexity.  
- Avoids dual maintenance of legacy string identifiers.  
- Clarifies responsibility: Convex Auth manages authentication, `profiles` manages roles.

## 4. Execution Plan

### Phase 2 Tasks (T-422 → T-424)

1. **Schema Update (T-422)**
   - Change `profiles.user_id` to `v.id("users")` (required).
   - Drop the legacy string field (`user_id`/`auth_user_id`).
   - Regenerate types (`npx convex codegen`).

2. **Code Refactor**
   - Update `convex/admin.ts`, `convex/auth.ts`, and related hooks to read/write the new `Id<"users">`.
   - Rewrite `ensureProfile` to accept `{ userId, email, full_name }` once Convex Auth logins are active (Phase 4 dependency).
   - Remove references to the legacy identifier (`existingProfile.user_id` string checks).

3. **Deployment (T-424)**
   - Deploy schema to dev, verify via Convex dashboard.
   - Run smoke tests (`npm run typecheck`, `npm run lint`, targeted auth flows).

### Downstream Updates (Phases 3–4)

- Root layout/providers (Convex Auth React providers).  
- Middleware + login component swap.  
- Refactor Convex functions to rely on `ctx.auth.getUserId()` and join profiles by the new field.

## 5. Rollback

If issues arise after deployment:
- Revert schema to previous commit (`user_id: v.string()`), redeploy schema, and restore `ensureProfile` / admin code.
- Since no production data exists, rollback is limited to code/schema revert.

## 6. Open Questions

1. Do we need seed profiles/users for dev QA? (Recommended: create a script using Convex Auth `store` API.)  
2. Should we keep a short-term view that mirrors the old email-based filters for analytics? (Deferred; can record email in profile metadata if needed.)

## 7. Next Actions

- [ ] Implement schema change + code refactor (T-422).  
- [ ] Deploy and validate on dev (T-424).  
- [ ] Update documentation once the refactor ships (`docs/ROLE_SYSTEM_REFERENCE.md`, WS-4 notes).  
