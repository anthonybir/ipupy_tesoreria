# Security Testing Guide - IPU PY Tesorería

## Overview

This guide provides security test scenarios, penetration testing procedures, and vulnerability assessment strategies for IPU PY Tesorería. As a financial system handling sensitive church data, security is paramount.

**Security Posture**: Defense in depth with RLS, authentication, audit logging, and input validation.

---

## Security Testing Checklist

### 1. Authentication & Authorization

#### Test: Unauthenticated Access
**Objective**: Verify all protected routes require authentication

**Steps**:
1. Clear browser cookies/session
2. Navigate to `/dashboard`
3. **Expected**: Redirect to `/login`
4. Try API endpoints without auth header
5. **Expected**: 401 Unauthorized

**Test Script**:
```bash
# Should return 401
curl https://ipupytesoreria.vercel.app/api/reports

# Should redirect to login
curl -I https://ipupytesoreria.vercel.app/dashboard
```

#### Test: Role-Based Access Control
**Objective**: Users can only access features for their role

**Test Matrix**:
| Role | Dashboard | Reports (View) | Reports (Create) | Churches (Manage) | Admin Panel |
|------|-----------|----------------|------------------|-------------------|-------------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| treasurer | ✅ | ✅ (own church) | ✅ (own church) | ❌ | ❌ |
| pastor | ✅ | ✅ (own church) | ✅ (own church) | ❌ | ❌ |
| secretary | ✅ | ✅ (own church) | ❌ | ❌ | ❌ |
| member | ✅ | ✅ (own church) | ❌ | ❌ | ❌ |

**Steps**:
1. Login as `member`
2. Try to access `/admin`
3. **Expected**: 403 Forbidden or redirect
4. Try POST to `/api/reports`
5. **Expected**: 403 Forbidden

#### Test: Google OAuth Domain Restriction
**Objective**: Only `@ipupy.org.py` emails can login

**Steps**:
1. Attempt Google login with personal Gmail
2. **Expected**: Error message "Email not authorized"
3. Login with `user@ipupy.org.py`
4. **Expected**: Successful login

---

### 2. Row Level Security (RLS)

#### Test: Church Data Isolation
**Objective**: Users cannot access other churches' data

**SQL Test**:
```sql
-- Set context as church 1 user
SET LOCAL app.current_user_id = '[user_uuid]';
SET LOCAL app.current_user_role = 'treasurer';
SET LOCAL app.current_user_church_id = 1;

-- Should return only church 1 reports
SELECT * FROM monthly_reports;

-- Should return 0 rows (church 2 data)
SELECT * FROM monthly_reports WHERE church_id = 2;
```

**API Test**:
```bash
# Login as church 1 treasurer
# Try to access church 2 reports
curl -H "Cookie: auth-token=..." \
  https://ipupytesoreria.vercel.app/api/reports?churchId=2

# Expected: Empty array or 403 Forbidden
```

#### Test: RLS Context Missing
**Objective**: Queries fail without RLS context set

**Steps**:
1. Create test query that bypasses `executeWithContext()`
2. Execute raw query without setting session variables
3. **Expected**: Empty result or RLS policy denial

**Code to Test**:
```typescript
// ❌ This should fail or return empty
import pool from '@/lib/pool';
const result = await pool.query('SELECT * FROM monthly_reports');
// RLS denies access - no context set
```

#### Test: Fund Director Restrictions
**Objective**: Fund directors only access assigned funds

**Steps**:
1. Login as fund director assigned to "Youth Fund"
2. Try to view "Building Fund" transactions
3. **Expected**: 403 Forbidden or empty results
4. View "Youth Fund" transactions
5. **Expected**: Success, shows transactions

---

### 3. Input Validation & Sanitization

#### Test: SQL Injection
**Objective**: Prevent SQL injection attacks

**Attack Vectors**:
```bash
# 1. Try injection in search parameter
curl "https://ipupytesoreria.vercel.app/api/reports?search='; DROP TABLE monthly_reports; --"

# 2. Try union-based injection
curl "https://ipupytesoreria.vercel.app/api/churches?id=1 UNION SELECT * FROM profiles--"

# 3. Try boolean-based injection
curl "https://ipupytesoreria.vercel.app/api/reports?churchId=1 OR 1=1"
```

**Expected**: All queries use parameterized statements, injection fails

**Code Verification**:
```typescript
// ✅ SAFE - Parameterized query
await client.query('SELECT * FROM monthly_reports WHERE id = $1', [reportId]);

// ❌ UNSAFE - String concatenation
await client.query(`SELECT * FROM monthly_reports WHERE id = ${reportId}`);
```

#### Test: XSS (Cross-Site Scripting)
**Objective**: User input doesn't execute as JavaScript

**Attack Vectors**:
```html
<!-- 1. Try script in report description -->
<script>alert('XSS')</script>

<!-- 2. Try event handler -->
<img src=x onerror="alert('XSS')">

<!-- 3. Try data URI -->
<a href="javascript:alert('XSS')">Click</a>
```

**Steps**:
1. Create report with XSS payload in description
2. View report details
3. **Expected**: Payload displayed as text, not executed (React auto-escapes)

#### Test: File Upload Validation
**Objective**: Only valid image files uploaded

**Attack Vectors**:
1. Upload PHP shell as `.jpg`
2. Upload malicious SVG with embedded script
3. Upload oversized file (>10MB)

**Expected**:
- File type validation on client and server
- MIME type checking
- File size limits enforced
- Files stored in Supabase Storage (isolated from app)

---

### 4. Session & Token Security

#### Test: Session Fixation
**Objective**: Session ID regenerated after login

**Steps**:
1. Get session ID before login
2. Login successfully
3. Compare session ID after login
4. **Expected**: Session ID changed (Supabase handles this)

#### Test: Session Timeout
**Objective**: Inactive sessions expire

**Steps**:
1. Login successfully
2. Wait for session timeout (default: 1 hour)
3. Try to access protected route
4. **Expected**: Redirect to login, session expired

#### Test: Concurrent Sessions
**Objective**: Multiple sessions handled correctly

**Steps**:
1. Login on Browser A
2. Login same user on Browser B
3. Logout on Browser A
4. Check Browser B still authenticated
5. **Expected**: Both sessions independent (Supabase allows multiple)

---

### 5. Data Exposure & Privacy

#### Test: Sensitive Data in Logs
**Objective**: Passwords/tokens not logged

**Steps**:
1. Check server logs after login
2. **Expected**: No passwords, service keys, or JWT tokens in logs
3. Check error logs
4. **Expected**: No sensitive data in stack traces

**Code Audit**:
```typescript
// ❌ BAD - Logs password
console.log('Login attempt:', { email, password });

// ✅ GOOD - Sanitized logging
console.log('Login attempt:', { email, timestamp: Date.now() });
```

#### Test: API Response Data Leakage
**Objective**: API returns only authorized data

**Steps**:
1. Login as member
2. Call `/api/profiles`
3. **Expected**: Returns own profile only, not all users
4. Check response for hidden fields
5. **Expected**: No internal IDs, service keys, or system data

#### Test: Error Messages
**Objective**: Error messages don't leak system info

**Attack Vectors**:
```bash
# Try to trigger database error
curl -X POST https://ipupytesoreria.vercel.app/api/reports \
  -d '{"churchId": "invalid"}'

# Expected: Generic error, not:
# "ERROR: invalid input syntax for type integer: 'invalid'"
```

**Good Error Response**:
```json
{
  "error": "Invalid request data",
  "message": "Please check your input and try again"
}
```

---

### 6. CSRF & CORS

#### Test: CORS Policy
**Objective**: Only approved origins can access API

**Steps**:
```bash
# From unauthorized origin
curl -H "Origin: https://evil.com" \
  https://ipupytesoreria.vercel.app/api/reports

# Expected: CORS error or missing Access-Control-Allow-Origin header
```

**Allowed Origins** (check `src/lib/cors.ts`):
- `https://ipupytesoreria.vercel.app`
- `http://localhost:3000` (development)

#### Test: CSRF Protection
**Objective**: Prevent cross-site request forgery

**Steps**:
1. Create malicious form on evil.com:
```html
<form action="https://ipupytesoreria.vercel.app/api/reports" method="POST">
  <input name="amount" value="1000000">
  <input type="submit">
</form>
```
2. Submit form
3. **Expected**: Request blocked (Supabase auth tokens validate origin)

---

### 7. Rate Limiting & DoS Protection

#### Test: API Rate Limiting
**Objective**: Prevent abuse via rate limiting

**Steps**:
```bash
# Send 20 requests in quick succession
for i in {1..20}; do
  curl https://ipupytesoreria.vercel.app/api/reports &
done

# Expected: After N requests, receive 429 Too Many Requests
```

**Check Implementation** (`src/lib/rate-limit.ts`):
- Limit: 10 requests per 10 seconds (or similar)
- Per IP address
- Returns 429 with Retry-After header

#### Test: Large Payload Attack
**Objective**: Reject oversized requests

**Steps**:
```bash
# Send 100MB payload
curl -X POST https://ipupytesoreria.vercel.app/api/reports \
  -d @large_file.json

# Expected: 413 Payload Too Large
```

---

### 8. Third-Party Dependencies

#### Test: Dependency Vulnerabilities
**Objective**: No known vulnerabilities in dependencies

**Steps**:
```bash
# Run npm audit
npm audit

# Check for high/critical vulnerabilities
npm audit --audit-level=high

# Expected: 0 high/critical vulnerabilities
```

**Automated Scanning**:
- Dependabot (GitHub) - Weekly scans
- Snyk (optional) - Continuous monitoring

#### Test: Outdated Dependencies
**Objective**: Keep dependencies up-to-date

```bash
# Check outdated packages
npm outdated

# Update to latest (carefully)
npm update
```

---

### 9. Audit Trail & Logging

#### Test: User Activity Logging
**Objective**: All critical actions logged

**Steps**:
1. Login as admin
2. Approve a report
3. Check `user_activity` table:
```sql
SELECT * FROM user_activity
WHERE user_id = '[admin_uuid]'
  AND action = 'approve'
  AND resource_type = 'monthly_report'
ORDER BY created_at DESC
LIMIT 1;
```
4. **Expected**: Log entry with full details (report ID, timestamp, IP)

#### Test: Immutable Audit Trail
**Objective**: Logs cannot be modified

**Steps**:
1. Try to UPDATE user_activity record
2. **Expected**: Permission denied (only INSERT allowed)
3. Try to DELETE user_activity record
4. **Expected**: Permission denied

---

### 10. Environment & Configuration

#### Test: Environment Variable Exposure
**Objective**: Secrets not exposed to client

**Steps**:
1. View page source in browser
2. Search for:
   - `SUPABASE_SERVICE_KEY`
   - `DATABASE_URL`
   - `GOOGLE_CLIENT_SECRET`
3. **Expected**: Not found (only `NEXT_PUBLIC_*` vars exposed)

**Code Verification**:
```typescript
// ✅ SAFE - Server-only
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

// ❌ UNSAFE - Exposed to client
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // This is OK
```

#### Test: Production Mode
**Objective**: App runs in production mode

**Steps**:
1. Check response headers:
```bash
curl -I https://ipupytesoreria.vercel.app

# Should include:
# X-Powered-By: Next.js (production build)
```
2. Verify no debug info in errors
3. **Expected**: Generic error messages, no stack traces

---

## Security Testing Tools

### 1. OWASP ZAP (Zed Attack Proxy)

**Setup**:
```bash
# Download from https://www.zaproxy.org/download/
# Run automated scan
zap-cli quick-scan https://ipupytesoreria.vercel.app

# Or use Docker
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://ipupytesoreria.vercel.app
```

### 2. Burp Suite (Manual Testing)

**Test Scenarios**:
1. Intercept requests
2. Modify parameters
3. Test authorization bypass
4. Replay attacks

### 3. SQLMap (SQL Injection)

```bash
# Test for SQL injection
sqlmap -u "https://ipupytesoreria.vercel.app/api/reports?id=1" \
  --cookie="auth-token=..." \
  --level=5 --risk=3

# Expected: No vulnerabilities found (parameterized queries)
```

### 4. npm audit (Dependency Scan)

```bash
# Scan for vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# Review unfixable issues
npm audit --json > audit-report.json
```

---

## Penetration Testing Checklist

### Pre-Test Setup
- [ ] Get written permission
- [ ] Test in staging, not production
- [ ] Notify team of testing window
- [ ] Backup database before testing

### Test Categories
- [ ] Authentication bypass attempts
- [ ] Authorization escalation
- [ ] SQL injection vectors
- [ ] XSS payloads
- [ ] CSRF attacks
- [ ] File upload vulnerabilities
- [ ] Session hijacking
- [ ] API abuse
- [ ] Rate limit bypass
- [ ] RLS policy bypass

### Post-Test
- [ ] Document all findings
- [ ] Assign severity (Critical, High, Medium, Low)
- [ ] Create remediation tickets
- [ ] Retest after fixes
- [ ] Update security documentation

---

## Vulnerability Severity Matrix

| Severity | Impact | Example | Response Time |
|----------|--------|---------|---------------|
| **Critical** | Complete system compromise | RLS bypass, SQL injection | < 4 hours |
| **High** | Significant data exposure | Auth bypass, XSS | < 24 hours |
| **Medium** | Limited data exposure | CORS misconfiguration | < 1 week |
| **Low** | Minimal impact | Verbose error messages | < 1 month |

---

## Security Incident Response

### 1. Detection
- Monitor logs for suspicious activity
- Set up alerts for repeated failed logins
- Track unusual API patterns

### 2. Containment
- Disable compromised accounts immediately
- Revoke exposed tokens/keys
- Block malicious IP addresses

### 3. Investigation
- Review user_activity logs
- Check Supabase auth logs
- Analyze server logs

### 4. Remediation
- Apply security patches
- Rotate credentials
- Update RLS policies if needed

### 5. Post-Incident
- Document incident
- Update security procedures
- Notify affected users (if required)

---

## Compliance Checklist

### Data Protection
- [ ] Passwords never stored in plain text (Supabase handles)
- [ ] Sensitive data encrypted at rest (Supabase default)
- [ ] TLS/SSL for all connections (Vercel/Supabase)
- [ ] Data retention policy documented
- [ ] GDPR/data deletion procedures in place

### Access Control
- [ ] Principle of least privilege enforced
- [ ] Role-based access control implemented
- [ ] Session timeout configured
- [ ] Multi-factor authentication available (optional)

### Audit & Logging
- [ ] All data modifications logged
- [ ] Logs immutable
- [ ] Log retention ≥ 1 year
- [ ] Access to logs restricted

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod#security)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [RLS Security Documentation](./database/RLS_POLICIES.md)
- [Security Audit Report](../SECURITY_AUDIT_2025-09-28.md)

---

**Last Updated**: October 2025
**Next Security Audit**: January 2026
**Responsible**: Development Team + Security Officer
