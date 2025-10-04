# Testing Strategy - IPU PY Tesorería

## Overview

IPU PY Tesorería currently uses **manual testing** with strict pre-commit validation. This document outlines current testing practices and future automation plans.

## Current Testing Approach

### Pre-Commit Validation (Automated)

Every commit is validated by Husky pre-commit hooks:

```bash
# .husky/pre-commit
npm run typecheck  # TypeScript compilation (tsc --noEmit)
npm run lint:strict  # ESLint with --max-warnings 0
```

**Blocked commits if:**
- ❌ TypeScript compilation errors exist
- ❌ ESLint warnings exist (zero tolerance)
- ❌ `any` type used without `// TODO(type-cleanup)` comment
- ❌ Missing return types on exported functions

### Manual Testing Checklist

Before submitting any PR, developers must test:

#### 1. Authentication & Authorization

- [ ] **Google OAuth Login**
  - Domain restriction: Only `@ipupy.org.py` emails allowed
  - Redirects to dashboard after successful login
  - Error shown for non-authorized domains

- [ ] **Magic Link Login**
  - Email sent to valid address
  - Link expires after use
  - Redirects to dashboard

- [ ] **Session Management**
  - Session persists across page reloads
  - Logout clears session completely
  - Protected routes redirect to login when not authenticated

- [ ] **Role-Based Access Control (RBAC)**
  - Admin: Full platform access
  - District Supervisor: Multi-church oversight
  - Pastor: Church management
  - Treasurer: Financial operations
  - Secretary: Data entry
  - Member: Read-only access

#### 2. Row Level Security (RLS)

- [ ] **Church Data Isolation**
  - Users only see data from their assigned church
  - Admin can view all churches
  - District supervisors see assigned churches only

- [ ] **Fund Access Control**
  - Fund directors limited to assigned funds
  - Treasurers access all church funds
  - Cross-church fund access denied

- [ ] **Context Validation**
  ```typescript
  // Test that executeWithContext() sets proper session variables
  // Verify app.current_user_id, app.current_user_role, app.current_user_church_id
  ```

- [ ] **Unauthenticated Access**
  - Unauthenticated queries return empty results
  - No 'viewer' fallback role (security fix)
  - API routes return 401 for missing auth

#### 3. Financial Operations

- [ ] **Monthly Reports**
  - Create report with valid data
  - 10% fondo_nacional auto-calculated correctly
  - Bank deposit tracking works
  - Receipt upload/download functional
  - Approval workflow (draft → submitted → approved)

- [ ] **Fund Events**
  - Create event budget with line items
  - Submit for approval (treasurer role)
  - Track actual income/expenses post-event
  - Variance analysis (budget vs actuals) accurate
  - Ledger transactions created on approval

- [ ] **Transactions**
  - Record income transactions
  - Record expense transactions
  - Fund balance updates correctly
  - Transaction history displays accurately

- [ ] **Excel Import/Export**
  - Export reports to XLSX format
  - Import transactions from Excel
  - Data integrity maintained

#### 4. Admin Features

- [ ] **User Management**
  - Create new users
  - Assign roles correctly
  - Deactivate users (soft delete)
  - Role changes apply immediately

- [ ] **System Configuration**
  - Update configuration by section
  - Changes persist across sessions
  - Configuration audit trail logged

- [ ] **Report Approval**
  - Admin can approve/reject reports
  - Comments saved with approval status
  - Email notifications sent (if configured)

#### 5. Data Integrity

- [ ] **Provider Registry**
  - RUC validation (11 digits, numeric)
  - Automatic deduplication by RUC
  - Cross-church provider linking

- [ ] **Audit Trail**
  - User actions logged in `user_activity`
  - Timestamps accurate
  - User context captured correctly

- [ ] **Database Constraints**
  - Foreign key relationships enforced
  - NOT NULL constraints respected
  - CHECK constraints validated

#### 6. Performance & UX

- [ ] **Page Load Times**
  - Initial page load < 2 seconds
  - Subsequent navigation < 500ms
  - Data tables load incrementally

- [ ] **Error Handling**
  - User-friendly error messages (Spanish)
  - Network errors handled gracefully
  - Form validation shows clear feedback

- [ ] **Responsive Design**
  - Mobile layout functional (≥ 375px)
  - Tablet layout optimized (≥ 768px)
  - Desktop layout full-featured (≥ 1024px)

#### 7. Browser Compatibility

- [ ] **Chrome** (latest 2 versions)
- [ ] **Firefox** (latest 2 versions)
- [ ] **Safari** (latest 2 versions)
- [ ] **Edge** (latest 2 versions)

#### 8. Security Testing

See [SECURITY_TESTING.md](SECURITY_TESTING.md) for detailed security test scenarios.

- [ ] **SQL Injection Prevention**
  - All queries use parameterized statements
  - No string concatenation in SQL

- [ ] **XSS Prevention**
  - User input sanitized
  - React escapes output by default

- [ ] **CSRF Protection**
  - Supabase auth tokens validated
  - API routes check authentication

## Testing Workflow

### Development Testing

1. **Local Development**
   ```bash
   npm run dev  # Start development server
   # Manual testing in browser
   # Check console for errors
   ```

2. **Type Safety Validation**
   ```bash
   npm run typecheck        # Check TypeScript
   npm run typecheck:watch  # Watch mode
   ```

3. **Code Quality**
   ```bash
   npm run lint          # ESLint check
   npm run lint:strict   # Zero warnings enforcement
   ```

4. **Build Validation**
   ```bash
   npm run build  # Production build test
   ```

### Pre-Deployment Testing

Before pushing to production:

1. ✅ All manual checklist items tested
2. ✅ `npm run build` succeeds
3. ✅ `npm run lint:strict` passes
4. ✅ Database migrations applied in staging
5. ✅ Environment variables configured
6. ✅ Vercel preview deployment tested

### Post-Deployment Verification

After production deployment:

1. ✅ Smoke test critical paths (login, dashboard, reports)
2. ✅ Check Vercel logs for errors
3. ✅ Monitor Supabase query performance
4. ✅ Verify email notifications (if configured)

## Future Automated Testing (Planned)

### Unit Testing (Phase 1)

**Framework**: Jest + React Testing Library

```typescript
// Example: src/lib/utils/currency.test.ts
import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('formats Paraguayan Guaraní correctly', () => {
    expect(formatCurrency(1000000)).toBe('₲ 1.000.000');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-500000)).toBe('₲ -500.000');
  });
});
```

**Target Coverage**:
- Utility functions: 90%
- Business logic: 80%
- Component logic: 70%

### Integration Testing (Phase 2)

**Framework**: Playwright

```typescript
// Example: tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('Google OAuth login flow', async ({ page }) => {
  await page.goto('/login');
  await page.click('button:has-text("Iniciar sesión con Google")');

  // Mock Google OAuth response
  await page.route('**/auth/callback*', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ access_token: 'mock_token' })
    });
  });

  await expect(page).toHaveURL('/dashboard');
});
```

**Test Scenarios**:
- Authentication flows
- RBAC permissions
- Critical user journeys
- Error handling

### RLS Policy Testing (Phase 3)

**Framework**: Custom test utilities with `executeWithContext()`

```typescript
// Example: tests/rls/church-isolation.test.ts
import { executeWithContext } from '@/lib/db';

test('Member cannot access other church reports', async () => {
  const memberAuth = { userId: 'xxx', role: 'member', churchId: 1 };

  const result = await executeWithContext(memberAuth, async (client) => {
    return await client.query(
      'SELECT * FROM monthly_reports WHERE church_id = $1',
      [2] // Trying to access church 2 data
    );
  });

  expect(result.rows).toHaveLength(0); // RLS should block
});
```

**Test Coverage**:
- All RLS policies in `migrations/010_implement_rls.sql`
- Cross-church data isolation
- Role-based access patterns

### Performance Testing (Phase 4)

**Framework**: k6 or Artillery

```javascript
// Example: performance/load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 50, // 50 virtual users
  duration: '1m',
};

export default function () {
  let res = http.get('https://ipupytesoreria.vercel.app/api/dashboard');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**Metrics**:
- API response times (p95 < 500ms)
- Database query performance
- Page load times (LCP < 2s)

## Test Data Management

### Development Data

- Use Supabase local development with seed data
- Mock users for each role type
- Sample financial data for testing

### Staging Data

- Anonymized production data
- Separate Supabase project
- Reset weekly

### Production Data

- **NEVER use production data for testing**
- Backups managed separately (see [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md))

## Continuous Integration

See [CI_CD.md](CI_CD.md) for GitHub Actions configuration.

**Current CI Checks**:
- TypeScript compilation (`tsc --noEmit`)
- ESLint validation (`--max-warnings 0`)
- Build success (`npm run build`)

**Planned CI Checks**:
- Unit test suite (Jest)
- Integration tests (Playwright)
- RLS policy tests
- Performance benchmarks

## Test Environments

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| **Local** | http://localhost:3000 | Supabase local | Development |
| **Preview** | `*.vercel.app` | Supabase staging | PR previews |
| **Production** | https://ipupytesoreria.vercel.app | Supabase production | Live system |

## Debugging Failed Tests

### TypeScript Errors

```bash
# Check specific file
npx tsc --noEmit src/app/api/example/route.ts

# Show detailed errors
npx tsc --noEmit --extendedDiagnostics
```

### ESLint Warnings

```bash
# Check specific file
npx eslint src/app/api/example/route.ts

# Auto-fix safe issues
npx eslint --fix src/app/api/example/route.ts
```

### RLS Policy Failures

1. Check session context is set:
   ```typescript
   // Add debug logging
   const context = await getDatabaseContext(client);
   console.log('RLS Context:', context);
   ```

2. Verify RLS policy in Supabase dashboard
3. Test query with `executeWithContext()` wrapper

### Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

## Test Coverage Targets (Future)

- **Unit Tests**: 80% code coverage
- **Integration Tests**: All critical user flows
- **RLS Tests**: 100% policy coverage
- **E2E Tests**: Top 10 user journeys

## Resources

- [TypeScript Testing Guide](https://www.typescriptlang.org/docs/handbook/testing.html)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/database/testing)

---

**Last Updated**: October 2025
