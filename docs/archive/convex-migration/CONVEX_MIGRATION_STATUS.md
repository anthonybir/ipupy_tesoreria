# Convex Migration Status

**Last Updated**: 2025-10-08
**Current Phase**: 5.4 Wave B – Reports, Fund Events & Transactions (In Progress)

---

## 🔄 Phase 5 - Frontend Integration (Wave B)

**Date**: 2025-10-08  
**Status**: In progress — core hooks now backed by Convex

### Completed in this wave
- ✅ `useReport` detail hook now queries `api.reports.get` with Convex ID mapping.
- ✅ `useFundEvents`, `useFundEvent`, and supporting hooks use Convex queries/mutations with real-time updates.
- ✅ `useTransactions` powered by `api.transactions.list`, mapping Convex IDs back to Supabase contracts.

### Upcoming
- ⏳ Smoke-test fund event workflows (submit/approve/reject) end-to-end.
- ⏳ Remove remaining TanStack Query utilities once hooks are fully migrated.

---

## ✅ Phase 4.1a - Core Queries Migration (COMPLETE)

**Date**: 2025-01-06
**Status**: ✅ All core queries migrated to Convex

### Migrated Convex Functions
- ✅ `convex/churches.ts` - Church queries (list, get, search)
- ✅ `convex/reports.ts` - Monthly report queries (list, get, stats)
- ✅ `convex/providers.ts` - Provider queries (list, search, searchByRUC)

### Key Achievements
- Convex schema aligned with Supabase
- RLS-equivalent authorization via `requireMinRole()`
- All queries tested and functional

**Documentation**: See [CONVEX_MIGRATION_PLAN.md](CONVEX_MIGRATION_PLAN.md)

---

## ✅ Phase 4.1b - NextAuth → Convex OIDC Bridge (COMPLETE)

**Date**: 2025-01-07
**Status**: ✅ End-to-end authentication working

### What Was Built

#### 1. NextAuth v5 Configuration
- **File**: `src/lib/auth.ts` (221 lines)
- Google OAuth with offline access
- Domain validation (`@ipupy.org.py`)
- JWT session strategy (serverless)
- Automatic token refresh

#### 2. OpenID Bridge Endpoints
- **`/api/openid/token`** - ID token for client-side Convex
- **`/api/openid/refresh`** - Force token refresh

#### 3. Convex OIDC Setup
- **File**: `convex/auth.config.ts`
- Google OIDC provider configuration
- Token validation via Google JWKS

#### 4. Client-Side Integration
- **Hook**: `src/hooks/useAuthFromNextAuth.ts`
- **Provider**: `ConvexProviderWithAuth` in `src/app/providers.tsx`
- Bridges NextAuth session to Convex client

#### 5. Server-Side Integration
- **Function**: `getAuthenticatedConvexClient()` in `src/lib/convex-server.ts`
- Creates per-request Convex client
- Sets Google ID token via `client.setAuth(idToken)`
- **Throws `AuthenticationError`** for proper 401 responses

### Authentication Flow

**Client-Side**:
```
User → Google OAuth → NextAuth Session
  → useAuthFromNextAuth fetches ID token
  → ConvexProviderWithAuth.setAuth(token)
  → Convex validates via Google JWKS
  → ctx.auth.getUserIdentity() works
```

**Server-Side**:
```
API Route → getAuthenticatedConvexClient()
  → await auth() (NextAuth)
  → Extract session.idToken
  → new ConvexHttpClient()
  → client.setAuth(idToken)
  → Convex validates token
  → ctx.auth.getUserIdentity() works
```

### Migrated Routes (Phase 4.6)
- ✅ `src/app/api/providers/route.ts` (GET, POST, PUT, DELETE)
- ✅ `src/app/api/providers/search/route.ts` (GET)
- ✅ `src/app/api/providers/check-ruc/route.ts` (GET)

### Error Handling Fixed
- ✅ `getAuthenticatedConvexClient()` throws `AuthenticationError`
- ✅ Unauthenticated requests return **401** (not 500)
- ✅ Proper error codes via `handleApiError()`

**Documentation**:
- [PHASE_4.1b_NEXTAUTH_OIDC_COMPLETE.md](PHASE_4.1b_NEXTAUTH_OIDC_COMPLETE.md)
- [AUTH_ERROR_HANDLING.md](AUTH_ERROR_HANDLING.md)

---

## ⏳ Phase 4.2 - Church Routes Migration (PENDING)

**Estimated Time**: 1.5 hours
**Status**: Not started

### Routes to Migrate
- `src/app/api/churches/route.ts` (GET, POST, PUT, DELETE)
- `src/app/api/churches/[id]/route.ts` (if exists)

### Required Convex Functions
Most already exist in `convex/churches.ts`:
- ✅ `list` - List churches
- ✅ `get` - Get single church
- ⏳ `create` - Create church (needs implementation)
- ⏳ `update` - Update church (needs implementation)
- ⏳ `delete` - Delete church (needs implementation)

### Migration Steps
1. Read current Supabase route implementation
2. Implement missing Convex mutations (create, update, delete)
3. Update API routes to use `getAuthenticatedConvexClient()`
4. Remove Supabase dependencies
5. Test CRUD operations
6. Update documentation

---

## ⏳ Phase 4.3 - Report Routes Migration (PENDING)

**Estimated Time**: 3 hours
**Status**: Not started

### Routes to Migrate
- `src/app/api/reports/route.ts` (GET, POST, PUT, DELETE)
- Complex business logic (tithers, attachments, approval workflow)

### Required Convex Functions
Some exist, many need implementation:
- ✅ `list` - List reports
- ✅ `get` - Get single report
- ⏳ `create` - Create report with validation
- ⏳ `update` - Update report
- ⏳ `approve` - Approval workflow
- ⏳ `uploadAttachment` - File uploads (Phase 5)

---

## ⏳ Phase 4.4 - Transaction Routes (PENDING)

**Estimated Time**: 2 hours
**Status**: Not started

### Routes to Migrate
- `src/app/api/financial/transactions/route.ts`
- `src/app/api/financial/fund-movements/route.ts`

---

## ⏳ Phase 4.5 - Fund Routes (PENDING)

**Estimated Time**: 1 hour
**Status**: Not started

### Routes to Migrate
- `src/app/api/financial/funds/route.ts`

---

## ⏳ Phase 4.6 - Provider Routes (✅ COMPLETE)

**Date**: 2025-01-07
**Status**: ✅ All provider routes migrated

See Phase 4.1b above.

---

## ⏳ Phase 4.7 - Admin Routes (PENDING)

**Estimated Time**: 2 hours
**Status**: Not started

### Routes to Migrate
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/configuration/route.ts`
- `src/app/api/admin/reports/route.ts`
- `src/app/api/admin/funds/route.ts`
- `src/app/api/admin/fund-directors/route.ts`

---

## 🔮 Future Phases

### Phase 5 - File Storage Migration
- Migrate from Supabase Storage to Convex File Storage
- Update report attachment uploads
- Migrate existing files

### Phase 6 - Complete Supabase Removal
- Remove all Supabase dependencies
- Switch to Convex exclusively
- Clean up old migration code
- Update environment variables

---

## Environment Setup

### Required Variables (Phase 4.1b)

```bash
# Google OAuth (NextAuth)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# NextAuth
NEXTAUTH_SECRET=...  # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Convex
NEXT_PUBLIC_CONVEX_URL=https://....convex.cloud
```

### Legacy (Still Required)

```bash
# Supabase (for non-migrated routes)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
DATABASE_URL=...
```

---

## Testing Strategy

### Phase 4.1b Testing
- [x] Client-side auth (Google OAuth login)
- [x] Server-side auth (`getAuthenticatedConvexClient()`)
- [x] Provider CRUD operations
- [x] Error handling (401 for unauthenticated)
- [ ] End-to-end testing in production
- [ ] Token refresh testing (wait 1 hour)

### Phase 4.2+ Testing Plan
1. Unit test Convex functions (via `npx convex run`)
2. Integration test API routes (Postman/curl)
3. E2E test in browser (manual)
4. Production smoke test after deployment

---

## Migration Metrics

| Phase | Status | Files Changed | Lines Added | Lines Removed | Time Spent |
|-------|--------|---------------|-------------|---------------|------------|
| 4.1a | ✅ Complete | 3 | ~800 | 0 | 4h |
| 4.1b | ✅ Complete | 10 | ~600 | ~50 | 6h |
| 4.2 | ⏳ Pending | - | - | - | 1.5h (est) |
| 4.3 | ⏳ Pending | - | - | - | 3h (est) |
| 4.4 | ⏳ Pending | - | - | - | 2h (est) |
| 4.5 | ⏳ Pending | - | - | - | 1h (est) |
| 4.6 | ✅ Complete | 3 | ~150 | ~100 | (included in 4.1b) |
| 4.7 | ⏳ Pending | - | - | - | 2h (est) |

**Total Progress**: 2/8 phases complete (25%)
**Estimated Remaining**: ~9.5 hours

---

## Known Issues & Blockers

### TypeScript Errors (Pre-Existing)
- Convex functions have `exactOptionalPropertyTypes` errors
- Not blocking deployment
- Need to fix before Phase 6

### Production Deployment (Phase 4.1b)
- [ ] Configure Google OAuth redirect URI
- [ ] Set production `NEXTAUTH_URL`
- [ ] Test Convex authentication in Vercel
- [ ] Verify token refresh works

---

## Success Criteria (Phase 4 Complete)

- [ ] All API routes migrated to Convex
- [ ] Zero Supabase query dependencies in routes
- [ ] Auth system fully NextAuth-based
- [ ] All tests passing
- [ ] Production deployment successful
- [ ] Performance equivalent or better

---

## Next Steps (Immediate)

1. **Start Phase 4.2** - Church Routes Migration
   - Implement Convex mutations (create, update, delete)
   - Migrate `src/app/api/churches/route.ts`
   - Test CRUD operations

2. **Production Testing** (Phase 4.1b)
   - Deploy to Vercel with NextAuth
   - Test Google OAuth flow
   - Verify provider routes work

3. **Continue Documentation**
   - Document church route migration
   - Update architecture diagrams
   - Add testing guides

---

## Team Communication

**Status for Stakeholders**:
> "Phase 4.1b (Authentication Migration) is complete. All provider routes now use NextAuth + Google OAuth with Convex. Next up: migrating church management routes (Phase 4.2)."

**Technical Note**:
> "We've successfully replaced Supabase Auth with NextAuth v5 + Google OIDC. The system now uses pure OAuth 2.0 standard authentication with server-side token refresh. No vendor lock-in, better serverless compatibility."

---

## References

- [CONVEX_MIGRATION_PLAN.md](CONVEX_MIGRATION_PLAN.md) - Original plan
- [PHASE_4.1b_NEXTAUTH_OIDC_COMPLETE.md](PHASE_4.1b_NEXTAUTH_OIDC_COMPLETE.md) - Auth migration details
- [AUTH_ERROR_HANDLING.md](AUTH_ERROR_HANDLING.md) - Error flow documentation
- [Convex Docs](https://docs.convex.dev)
- [NextAuth v5 Docs](https://authjs.dev)
