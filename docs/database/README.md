# Database Documentation - IPU PY Tesorería

**Last Updated**: 2025-10-06
**Database**: PostgreSQL 15+ via Supabase
**Total Tables**: 48+
**Current Migration**: 054

---

## Overview

The IPUPY_Tesoreria database is a comprehensive financial management system designed for a multi-church organization with centralized treasury operations. It implements Row Level Security (RLS) for data isolation and supports complex financial workflows.

### Key Characteristics

- **Multi-tenant**: Supports 22 churches with isolated data
- **Dual-scope**: National-level funds + Church-level operations
- **ACID compliant**: Uses PostgreSQL transactions for data integrity
- **RLS enforced**: All queries execute with user context
- **Audit trail**: Complete history of all user actions

---

## Quick Navigation

### Core Documentation

1. **[SCHEMA_REFERENCE.md](./SCHEMA_REFERENCE.md)** - Complete table reference (48+ tables)
2. **[RLS_POLICIES.md](./RLS_POLICIES.md)** - Security policies and enforcement
3. **[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)** - Workflows and data relationships
4. **[INDEXES.md](./INDEXES.md)** - Performance indexes
5. **[MIGRATIONS.md](../migrations/README.md)** - Migration guide (link)

### By Topic

- **Church Management**: churches, pastors, church_accounts
- **Financial Reports**: reports (monthly_reports), report_status_history
- **Fund Management**: funds, fund_balances, fund_transactions, fund_events
- **User System**: profiles, role_permissions, user_activity
- **Providers**: providers (centralized registry)
- **Donors**: donors, member_contributions
- **Analytics**: analytics_*, custom_reports
- **Audit**: user_activity, fund_event_audit, report_status_history

---

## Database Architecture

### Conceptual Model

```
┌─────────────────────────────────────────────────────────────┐
│                     NATIONAL LEVEL                           │
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Profiles  │───→│     Funds    │←───│ Fund Events  │  │
│  │  (users)    │    │  (9 funds)   │    │  (budgets)   │  │
│  └─────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                   │          │
│         │                    ↓                   │          │
│         │            ┌───────────────┐           │          │
│         │            │ Fund Balances │           │          │
│         │            └───────────────┘           │          │
│         │                                        │          │
└─────────┼────────────────────────────────────────┼──────────┘
          │                                        │
┌─────────┼────────────────────────────────────────┼──────────┐
│         │             CHURCH LEVEL               │          │
│         ↓                                        ↓          │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Churches   │───→│   Reports    │    │ Transactions │  │
│  │ (22 total)  │    │  (monthly)   │    │   (ledger)   │  │
│  └─────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                              │
│         ↓                    ↓                              │
│  ┌─────────────┐    ┌──────────────┐                      │
│  │   Pastors   │    │   Providers  │                      │
│  │ (leadership)│    │  (vendors)   │                      │
│  └─────────────┘    └──────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                  ┌──────────────────────────┐
                  │     AUDIT & SYSTEM       │
                  │                          │
                  │  • user_activity         │
                  │  • system_configuration  │
                  │  • rate_limits           │
                  └──────────────────────────┘
```

### Table Categories

#### 1. Core Financial Tables (10 tables)
- **reports** - Monthly financial reports from churches
- **funds** - 9 national fund definitions
- **fund_balances** - Current balance per fund
- **fund_transactions** - Transaction ledger
- **fund_events** - Event budgeting and planning
- **fund_event_budget_items** - Line items for events
- **fund_event_actuals** - Actual income/expenses post-event
- **providers** - Centralized vendor registry
- **donors** - Donor information
- **transactions** - Church-level transaction history

#### 2. Church Management Tables (8 tables)
- **churches** - 22 IPU Paraguay churches
- **pastors** - Pastor information and assignments
- **church_accounts** - Bank accounts per church
- **church_account_balances** - Account balances
- **church_transactions** - Church financial transactions
- **church_events** - Church events and activities
- **church_budgets** - Budget planning
- **church_financial_goals** - Financial targets

#### 3. Member & Family Tables (7 tables)
- **members** - Church membership records
- **families** - Family groupings
- **member_attendance** - Worship attendance tracking
- **member_contributions** - Individual giving records
- **member_ministries** - Ministry assignments
- **worship_records** - Worship service details
- **worship_contributions** - Per-service contribution details

#### 4. User & Security Tables (6 tables)
- **profiles** - User profiles (linked to Supabase Auth)
- **role_permissions** - Permission matrix (5 roles x ~10 perms each)
- **user_activity** - Complete audit trail
- **system_configuration** - Admin-configurable settings
- **rate_limits** - API rate limiting
- **fund_director_assignments** - Fund access assignments

#### 5. Analytics & Reporting Tables (6 tables)
- **analytics_events** - Event tracking
- **analytics_kpis** - Key performance indicators
- **analytics_trends** - Trend analysis
- **analytics_insights** - AI-generated insights
- **analytics_benchmarks** - Performance benchmarks
- **custom_reports** - User-defined reports

#### 6. Supporting Tables (11 tables)
- **report_notifications** - Report submission notifications
- **report_status_history** - Report approval workflow history
- **report_tithers** - Tither tracking per report
- **fund_event_audit** - Event change audit trail
- **fund_movements** - Fund transfer tracking (legacy)
- **fund_movements_enhanced** - Enhanced fund movements
- **fund_categories** - Fund categorization
- **church_transaction_categories** - Transaction categories
- **expense_records** - Detailed expense tracking
- **event_registrations** - Event participation
- **ministries** - Ministry definitions

#### 7. System Tables (3 tables)
- **migration_history** - Applied migrations tracking
- **users** - Legacy user table (may be deprecated)
- **audit.log** - System-level audit log

---

## Database Schema Overview

### Total Tables: 48+

| Category | Count | Key Tables |
|----------|-------|------------|
| Financial | 10 | reports, funds, fund_balances, fund_transactions |
| Church Management | 8 | churches, pastors, church_accounts |
| Members | 7 | members, families, member_contributions |
| Security | 6 | profiles, role_permissions, user_activity |
| Analytics | 6 | analytics_events, analytics_kpis |
| Supporting | 11 | providers, donors, report_notifications |
| System | 3 | migration_history, system_configuration |

### Key Relationships

```
profiles (users)
  ├─→ churches (via church_id)
  ├─→ role_permissions (via role)
  └─→ user_activity (logs all actions)

churches
  ├─→ reports (monthly financial reports)
  ├─→ pastors (current pastor assignment)
  ├─→ church_accounts (bank accounts)
  └─→ members (church membership)

reports
  ├─→ churches (parent church)
  ├─→ profiles (created_by, approved_by)
  └─→ report_status_history (approval workflow)

funds
  ├─→ fund_balances (current balance per church)
  ├─→ fund_transactions (ledger entries)
  └─→ fund_events (event budgets)

fund_events
  ├─→ funds (target fund)
  ├─→ fund_event_budget_items (budget line items)
  ├─→ fund_event_actuals (post-event actuals)
  └─→ profiles (created_by, approved_by)

providers
  └─→ No foreign keys (centralized registry)
```

---

## Row Level Security (RLS)

**All tables with user data have RLS enabled**. Queries automatically filter based on:

### Session Context Variables

```sql
-- Set for every database query
SET LOCAL app.current_user_id = '<uuid>';
SET LOCAL app.current_user_role = 'treasurer';
SET LOCAL app.current_user_church_id = '<church_id>';
```

### RLS Helper Functions

```sql
-- Check if user can access specific fund
has_fund_access(fund_id) RETURNS BOOLEAN

-- Get user's church ID
app_current_user_church_id() RETURNS UUID

-- Get user's role
app_current_user_role() RETURNS TEXT

-- Get role permission level (1-7)
get_role_level(role TEXT) RETURNS INTEGER
```

### Role Hierarchy (5 Roles)

| Level | Role | Scope | Table Access |
|-------|------|-------|-------------|
| 7 | admin | ALL | Full access to all tables |
| 6 | treasurer | ALL (national) | All funds, all reports, all churches |
| 5 | fund_director | assigned_funds | Only assigned funds + events |
| 4 | pastor | own_church | Own church data only |
| 2 | church_manager | own_church | Own church (read-only) |
| 1 | secretary | own_church | Limited church data |

**Note**: Church-scoped roles (pastor, church_manager, secretary) removed in migration 053-054. Only admin and treasurer remain as active operational roles.

See **[RLS_POLICIES.md](./RLS_POLICIES.md)** for complete policy documentation.

---

## Data Integrity

### Constraints

1. **Unique Constraints**: Prevent duplicate records
   - `profiles(auth_user_id)` - One profile per Supabase user
   - `providers(ruc)` - One provider per RUC (tax ID)
   - `reports(church_id, month, year)` - One report per church per month
   - `fund_balances(fund_id, church_id)` - One balance per fund per church

2. **Foreign Key Constraints**: Maintain referential integrity
   - All tables reference `churches(id)` for church-scoped data
   - All tables reference `profiles(id)` for user tracking
   - `fund_transactions` → `funds(id)` for fund integrity

3. **Check Constraints**: Validate data values
   - `profiles.role` IN (5 valid roles)
   - `reports.month` BETWEEN 1 AND 12
   - `reports.year` >= 2024
   - Fund amounts >= 0 (non-negative)

4. **Not Null Constraints**: Required fields
   - All `created_at` timestamps
   - All foreign key references
   - Core business fields (name, amounts, dates)

---

## Performance Optimization

### Indexes (Migration 045)

```sql
-- Report lookups
CREATE INDEX idx_reports_church_year_month ON reports(church_id, year, month);
CREATE INDEX idx_reports_status ON reports(status);

-- Fund transactions
CREATE INDEX idx_fund_transactions_date ON fund_transactions(transaction_date);
CREATE INDEX idx_fund_transactions_fund ON fund_transactions(fund_id);

-- User activity audit
CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, created_at DESC);

-- Fund events
CREATE INDEX idx_fund_events_fund_date ON fund_events(fund_id, event_date);
CREATE INDEX idx_fund_events_status ON fund_events(status);
```

### Query Patterns

**Optimal patterns**:
```sql
-- ✅ Use indexed columns in WHERE
SELECT * FROM reports WHERE church_id = $1 AND year = $2 AND month = $3;

-- ✅ Use indexed columns for sorting
SELECT * FROM fund_transactions ORDER BY transaction_date DESC LIMIT 100;

-- ✅ Use covering indexes when possible
SELECT id, name, status FROM fund_events WHERE fund_id = $1;
```

**Anti-patterns**:
```sql
-- ❌ Function on indexed column
SELECT * FROM reports WHERE EXTRACT(YEAR FROM created_at) = 2024;

-- ❌ Non-selective query
SELECT * FROM user_activity; -- Returns thousands of rows

-- ❌ OR conditions (doesn't use index efficiently)
SELECT * FROM reports WHERE church_id = $1 OR status = 'approved';
```

See **[INDEXES.md](./INDEXES.md)** for complete index documentation.

---

## Migration System

### Current State

- **Total Migrations**: 54 (000-054)
- **Latest**: Migration 054 (Treasurer role consolidation data fix)
- **Pending**: None
- **Failed**: None

### Key Migrations

| Migration | Description | Impact |
|-----------|-------------|--------|
| 001 | Initial schema | Created core tables |
| 010 | Implement RLS | Added security policies |
| 023 | Simplify roles | 8 roles → 6 roles |
| 026 | Fund director events | Added event system |
| 027 | Provider registry | Centralized providers |
| 037 | Fix role inconsistencies | Cleaned up role system |
| 040 | National treasurer role | Added treasurer role |
| 042 | Generated columns | Auto-calculate report totals |
| 045 | Performance indexes | Optimized queries |
| 053-054 | Treasurer consolidation | 6 roles → 5 roles |

### Migration Process

```bash
# View migration status
npm run db:status

# Apply pending migrations
npm run db:migrate

# Rollback last migration (if needed)
npm run db:rollback
```

See **[../migrations/README.md](../migrations/README.md)** for detailed migration documentation.

---

## Common Query Patterns

### Get User Church Data

```sql
-- RLS automatically filters by church_id
SELECT * FROM reports
WHERE year = 2024 AND month = 10;
-- Returns only reports for user's church
```

### Get National Fund Summary

```sql
-- Admin/treasurer can see all funds
SELECT
  f.name,
  SUM(fb.balance) as total_balance,
  COUNT(DISTINCT fb.church_id) as church_count
FROM funds f
LEFT JOIN fund_balances fb ON f.id = fb.fund_id
GROUP BY f.id, f.name
ORDER BY f.name;
```

### Audit User Actions

```sql
-- Get recent user activity
SELECT
  ua.action,
  ua.details,
  ua.created_at,
  p.full_name
FROM user_activity ua
JOIN profiles p ON ua.user_id = p.id
WHERE ua.user_id = $1
ORDER BY ua.created_at DESC
LIMIT 50;
```

### Monthly Report with Calculations

```sql
-- Get report with auto-calculated totals (generated columns)
SELECT
  r.church_id,
  c.name as church_name,
  r.month,
  r.year,
  r.total_entradas,  -- Auto-calculated
  r.total_salidas,   -- Auto-calculated
  r.fondo_nacional,  -- 10% of (diezmos + ofrendas)
  r.status
FROM reports r
JOIN churches c ON r.church_id = c.id
WHERE r.year = 2024 AND r.month = 10
ORDER BY c.name;
```

---

## Backup & Recovery

### Backup Strategy

1. **Supabase Automatic Backups**:
   - Daily backups (last 7 days)
   - Point-in-time recovery (last 7 days)
   - Managed by Supabase

2. **Manual Exports**:
   ```bash
   # Export specific table
   pg_dump -h <host> -U <user> -t reports > reports_backup.sql

   # Export entire database
   pg_dump -h <host> -U <user> ipupy_db > full_backup.sql
   ```

3. **CSV Exports** (via application):
   - Admin panel → Export → Select tables
   - Automated monthly exports

### Recovery Procedures

See **[../deployment/DISASTER_RECOVERY.md](../deployment/DISASTER_RECOVERY.md)** for complete recovery procedures.

---

## Development Guidelines

### Working with the Database

1. **Always use RLS context**:
   ```typescript
   import { executeWithContext } from '@/lib/db-admin';

   const result = await executeWithContext(auth, async (client) => {
     return await client.query('SELECT * FROM reports WHERE ...');
   });
   ```

2. **Use transactions for multi-step operations**:
   ```typescript
   import { executeTransaction } from '@/lib/db-admin';

   await executeTransaction(auth, async (client) => {
     // Step 1: Insert report
     await client.query('INSERT INTO reports ...');

     // Step 2: Update fund balance
     await client.query('UPDATE fund_balances ...');

     // Step 3: Log activity
     await client.query('INSERT INTO user_activity ...');
   });
   ```

3. **Never bypass RLS**:
   ```sql
   -- ❌ NEVER DO THIS
   SELECT * FROM reports; -- Bypasses RLS, security risk

   -- ✅ Always set context first
   -- (handled automatically by executeWithContext)
   ```

4. **Test with different roles**:
   ```bash
   # Test as admin
   curl -H "Authorization: Bearer <admin_token>" /api/reports

   # Test as treasurer
   curl -H "Authorization: Bearer <treasurer_token>" /api/reports

   # Test as pastor
   curl -H "Authorization: Bearer <pastor_token>" /api/reports
   ```

### Creating Migrations

```bash
# 1. Create migration file
touch migrations/055_description.sql

# 2. Write migration SQL
-- Migration 055: Description
BEGIN;
  -- Your changes here
  ALTER TABLE ...;
COMMIT;

# 3. Test locally
psql -h localhost -U postgres -f migrations/055_description.sql

# 4. Apply to Supabase
npm run db:migrate

# 5. Verify
psql -h <supabase_host> -U postgres -c "SELECT * FROM migration_history ORDER BY id DESC LIMIT 1;"
```

See **[../migrations/README.md](../migrations/README.md)** for detailed guide.

---

## Troubleshooting

### Common Issues

#### 1. RLS Access Denied

**Error**: `new row violates row-level security policy`

**Cause**: Session context not set or incorrect role

**Fix**:
```typescript
// Ensure using executeWithContext
const result = await executeWithContext(auth, async (client) => {
  return await client.query('...');
});
```

#### 2. Foreign Key Constraint Violation

**Error**: `foreign key constraint "fk_name" fails`

**Cause**: Referenced record doesn't exist

**Fix**:
```sql
-- Check if parent record exists
SELECT id FROM churches WHERE id = <church_id>;

-- Insert parent record first, then child
```

#### 3. Unique Constraint Violation

**Error**: `duplicate key value violates unique constraint`

**Cause**: Attempting to insert duplicate record

**Fix**:
```sql
-- Use INSERT ... ON CONFLICT
INSERT INTO providers (ruc, name, ...)
VALUES (...)
ON CONFLICT (ruc) DO UPDATE SET ...;
```

#### 4. Performance Issues

**Symptom**: Slow queries (> 1 second)

**Diagnosis**:
```sql
-- Check query plan
EXPLAIN ANALYZE SELECT * FROM reports WHERE ...;

-- Look for "Seq Scan" (bad) vs "Index Scan" (good)
```

**Fix**: Add missing indexes (see [INDEXES.md](./INDEXES.md))

See **[../development/TROUBLESHOOTING.md](../development/TROUBLESHOOTING.md)** for more issues.

---

## External References

### Documentation Links

- **[Supabase Documentation](https://supabase.com/docs)**
- **[PostgreSQL Documentation](https://www.postgresql.org/docs/15/)**
- **[Row Level Security Guide](https://www.postgresql.org/docs/15/ddl-rowsecurity.html)**
- **[PostgreSQL Indexes](https://www.postgresql.org/docs/15/indexes.html)**

### Related Project Docs

- **[../migrations/README.md](../migrations/README.md)** - Migration system
- **[RLS_POLICIES.md](./RLS_POLICIES.md)** - Security policies
- **[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)** - Business workflows
- **[../../CLAUDE.md](../../CLAUDE.md)** - Development guide

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-06 | Initial database documentation created |

---

**Maintained By**: Technical Documentation Team
**Last Review**: 2025-10-06
**Next Review**: 2025-11-06
**Status**: ✅ Current
