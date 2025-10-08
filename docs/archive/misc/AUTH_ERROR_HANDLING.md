# Authentication Error Handling - NextAuth → Convex

**Status**: ✅ Current (Post-Convex Migration)  
**Last Updated**: 2025-01-08  
**Architecture**: NextAuth v5 + Google OAuth + Convex OIDC Bridge

---

## Overview

This document describes error handling patterns for the authentication layer in the IPU PY Tesorería system. The system uses **NextAuth v5** with Google OAuth for authentication, which bridges to Convex via OIDC tokens.

**Key Pattern**: All authentication errors throw `AuthenticationError` to ensure proper HTTP 401 status codes.

---

## Issue

`getAuthenticatedConvexClient()` was throwing plain `Error` objects when authentication failed, which caused `handleApiError()` to return **500** status instead of **401**.

## Root Cause

The error handler (`handleApiError`) checks for `instanceof AuthenticationError` to return 401:

```typescript
// src/lib/api-errors.ts
if (error instanceof AuthenticationError) {
  return NextResponse.json(
    { error: error.message, code: 'AUTHENTICATION_REQUIRED' },
    { status: 401, headers: buildCorsHeaders(origin) }
  );
}
```

But `getAuthenticatedConvexClient()` was throwing generic `Error`:

```typescript
// ❌ OLD CODE (WRONG)
if (!session) {
  throw new Error('No autenticado - se requiere sesión de NextAuth');
}
```

This caused the error to fall through to the generic 500 handler.

---

## Solution

Changed `getAuthenticatedConvexClient()` to throw `AuthenticationError`:

```typescript
// ✅ NEW CODE (CORRECT)
import { AuthenticationError } from '@/lib/api-errors';

export async function getAuthenticatedConvexClient(): Promise<ConvexHttpClient> {
  const session = await auth();

  if (!session) {
    throw new AuthenticationError('No autenticado - se requiere sesión de NextAuth');
  }

  const idToken = session.idToken;
  if (!idToken) {
    throw new AuthenticationError('Token de Google ID no disponible en la sesión de NextAuth');
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(idToken);
  return client;
}
```

---

## Complete Error Flow

### Unauthenticated Request

```
1. Client → GET /api/providers (no session)
   ↓
2. getAuthenticatedConvexClient()
   ↓
3. await auth() → null
   ↓
4. throw new AuthenticationError('No autenticado - se requiere sesión de NextAuth')
   ↓
5. catch (error) { return handleApiError(error, ...) }
   ↓
6. handleApiError checks instanceof AuthenticationError → true
   ↓
7. return NextResponse.json({ error: '...', code: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
```

**Result**: Client receives **401 Unauthorized** with proper error code.

### Missing ID Token (Session exists but no token)

```
1. Client → GET /api/providers (session exists, but no id_token)
   ↓
2. getAuthenticatedConvexClient()
   ↓
3. await auth() → { user: {...}, idToken: undefined }
   ↓
4. throw new AuthenticationError('Token de Google ID no disponible en la sesión de NextAuth')
   ↓
5. catch (error) { return handleApiError(error, ...) }
   ↓
6. handleApiError checks instanceof AuthenticationError → true
   ↓
7. return NextResponse.json({ error: '...', code: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
```

**Result**: Client receives **401 Unauthorized** with proper error code.

---

## Testing

### Test Case 1: No Session (Unauthenticated)

**Request**:
```bash
curl -X GET http://localhost:3000/api/providers
```

**Expected Response**:
```json
{
  "error": "No autenticado - se requiere sesión de NextAuth",
  "code": "AUTHENTICATION_REQUIRED"
}
```

**Status**: `401 Unauthorized`

### Test Case 2: Session Without ID Token

**Scenario**: NextAuth session exists but doesn't contain `idToken` (misconfigured)

**Expected Response**:
```json
{
  "error": "Token de Google ID no disponible en la sesión de NextAuth",
  "code": "AUTHENTICATION_REQUIRED"
}
```

**Status**: `401 Unauthorized`

### Test Case 3: Valid Session with ID Token

**Request**:
```bash
curl -X GET http://localhost:3000/api/providers \
  -H "Cookie: next-auth.session-token=..."
```

**Expected Response**:
```json
{
  "data": [...],
  "count": 10
}
```

**Status**: `200 OK`

---

## Error Response Formats

### Authentication Error (401)
```json
{
  "error": "No autenticado - se requiere sesión de NextAuth",
  "code": "AUTHENTICATION_REQUIRED"
}
```

### Authorization Error (403)
```json
{
  "error": "No tiene permisos para realizar esta operación",
  "code": "AUTHORIZATION_FAILED"
}
```

### Validation Error (400)
```json
{
  "error": "RUC, nombre y tipo de identificación son requeridos",
  "code": "VALIDATION_ERROR"
}
```

### Convex Auth Error (401 from Convex)

If Convex rejects the token (invalid signature, expired, wrong audience):

```json
{
  "error": "Token inválido o expirado",
  "code": "INVALID_TOKEN"
}
```

**Status**: `401 Unauthorized`

---

## Implementation Details

### Files Modified

1. **`src/lib/convex-server.ts`**
   - Added import: `import { AuthenticationError } from '@/lib/api-errors'`
   - Changed `throw new Error(...)` → `throw new AuthenticationError(...)`
   - Updated JSDoc: `@throws {AuthenticationError}`

2. **`docs/PHASE_4.1b_NEXTAUTH_OIDC_COMPLETE.md`**
   - Added bullet point about `AuthenticationError` in Server-Side Integration section

### Error Class Definition

```typescript
// src/lib/api-errors.ts
export class AuthenticationError extends Error {
  constructor(message = 'Autenticación requerida') {
    super(message);
    this.name = 'AuthenticationError';
  }
}
```

---

## Migration Notes

### Before (Phase 4.1a)

Routes using Supabase auth had proper error handling:

```typescript
const auth = await requireAuth(request);
// requireAuth throws proper errors that map to 401
```

### After (Phase 4.1b)

Routes using NextAuth + Convex now have equivalent handling:

```typescript
const client = await getAuthenticatedConvexClient();
// getAuthenticatedConvexClient throws AuthenticationError → 401
```

Both approaches now return **401** for unauthenticated requests.

---

## Related Files

- `src/lib/api-errors.ts` - Error classes and `handleApiError()`
- `src/lib/convex-server.ts` - `getAuthenticatedConvexClient()`
- `src/app/api/providers/route.ts` - Example usage in API route
- `src/app/api/providers/search/route.ts` - Example usage in API route
- `src/app/api/providers/check-ruc/route.ts` - Example usage in API route

---

## Status Codes Reference

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully (POST) |
| 400 | Bad Request | Validation error (`ValidationError`) |
| 401 | Unauthorized | Missing/invalid authentication (`AuthenticationError`) |
| 403 | Forbidden | Authenticated but lacks permissions (`AuthorizationError`) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry (unique constraint) |
| 500 | Internal Server Error | Unexpected error (database, etc.) |
| 504 | Gateway Timeout | Database connection timeout |

---

## Security Notes

1. **No Token Leakage**: Error messages don't expose token contents
2. **Generic Messages**: Production errors hide implementation details
3. **CORS Headers**: Error responses include proper CORS headers
4. **Audit Trail**: Errors logged server-side with context
5. **Rate Limiting**: 401 errors don't trigger rate limits (expected for public endpoints)

---

## Future Improvements

1. **Token Refresh Retry**: Automatically retry with refresh if token expired
2. **Custom Error Codes**: Add Convex-specific error codes (e.g., `CONVEX_TOKEN_INVALID`)
3. **Error Telemetry**: Track 401 error rates to detect auth issues
4. **Better Error Messages**: Differentiate between "no session" vs "expired session"

---

## Testing Checklist

- [x] Unauthenticated request returns 401
- [x] Missing ID token returns 401
- [x] Valid token allows request
- [x] Error response includes proper code
- [x] CORS headers present on errors
- [x] TypeScript compilation passes
- [ ] Integration test with actual NextAuth session
- [ ] E2E test in browser with DevTools network tab
- [ ] Production deployment verification

---

**Migration Complete**: All provider routes now return proper 401 status for unauthenticated requests.
