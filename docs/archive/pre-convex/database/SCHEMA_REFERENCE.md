# Database Schema Reference - IPU PY Tesorería

## Overview

IPU PY Tesorería uses PostgreSQL (via Supabase) with a comprehensive schema supporting:
- 22 churches with hierarchical organization
- Multi-fund accounting system
- Financial reporting and approval workflows
- User management with 6-role RBAC
- Complete audit trail
- Row Level Security (RLS) for data isolation

**Total Tables**: 45+
**Migrations Applied**: 30 (000-030)
**Database Version**: PostgreSQL 15+

---

## Core Domain Tables

### 1. Churches (`churches`)

Central table for church management.

```sql
CREATE TABLE churches (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  pastor TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  pastor_ruc TEXT,
  pastor_cedula TEXT,
  pastor_grado TEXT,
  pastor_posicion TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes**:
- `churches_pkey` (PRIMARY KEY on id)
- `churches_name_key` (UNIQUE on name)

**Relationships**:
- Parent to: `monthly_reports`, `fund_balances`, `profiles`, `fund_events`

**Business Rules**:
- 22 pre-loaded churches (migration 004)
- Name must be unique
- Pastor information optional but recommended

**RLS Policies**:
- All authenticated users can read all churches
- Only admin can create/update/delete churches

---

### 2. Profiles (`profiles`)

User profiles with role-based access control.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'district_supervisor', 'pastor', 'treasurer', 'secretary', 'member')),
  church_id INTEGER REFERENCES churches(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Role Hierarchy** (Current: 7 roles - see migrations 023, 026, 037, 040):
1. **admin** - Platform administrators (level 7)
2. **national_treasurer** - National fund supervision (level 6) - Added in migration 040
3. **fund_director** - Fund-specific management (level 5) - Added in migration 026
4. **pastor** - Church leaders (level 4)
5. **treasurer** - Financial managers (level 3)
6. **church_manager** - Church administration (level 2)
7. **secretary** - Administrative support (level 1)

**Migration History**:
- **Migration 023**: Simplified from 8 to 6 roles (super_admin → admin, church_admin → pastor)
- **Migration 026**: Added fund_director role
- **Migration 037**: Removed obsolete roles (district_supervisor, member)
- **Migration 040**: Added national_treasurer role

**Obsolete Roles** (removed in migration 037):
- `district_supervisor` - Removed
- `member` - Removed
- `super_admin` - Consolidated into `admin` (migration 023)
- `church_admin` - Renamed to `pastor` (migration 023)

**Indexes**:
- `profiles_pkey` (PRIMARY KEY on id)
- `profiles_email_key` (UNIQUE on email)
- `idx_profiles_role` (on role)
- `idx_profiles_church_id` (on church_id)

**RLS Policies**:
- Users can read their own profile
- Admins can read all profiles
- Only admins can create/update/delete profiles

---

### 3. Monthly Reports (`monthly_reports`)

Financial reports submitted by churches monthly.

```sql
CREATE TABLE monthly_reports (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL REFERENCES churches(id),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  
  -- INCOME (ENTRADAS)
  diezmos NUMERIC(18,2) DEFAULT 0,
  ofrendas NUMERIC(18,2) DEFAULT 0,
  anexos NUMERIC(18,2) DEFAULT 0,
  caballeros NUMERIC(18,2) DEFAULT 0,
  damas NUMERIC(18,2) DEFAULT 0,
  jovenes NUMERIC(18,2) DEFAULT 0,
  ninos NUMERIC(18,2) DEFAULT 0,
  otros_ingresos NUMERIC(18,2) DEFAULT 0,
  total_entradas NUMERIC(18,2) GENERATED ALWAYS AS (
    diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros_ingresos
  ) STORED,
  
  -- EXPENSES (SALIDAS)
  honorarios_pastoral NUMERIC(18,2) DEFAULT 0,
  honorarios_factura_numero TEXT,
  honorarios_ruc_pastor TEXT,
  fondo_nacional NUMERIC(18,2) GENERATED ALWAYS AS (diezmos * 0.10) STORED,
  energia_electrica NUMERIC(18,2) DEFAULT 0,
  agua NUMERIC(18,2) DEFAULT 0,
  recoleccion_basura NUMERIC(18,2) DEFAULT 0,
  otros_gastos NUMERIC(18,2) DEFAULT 0,
  total_salidas NUMERIC(18,2) DEFAULT 0,
  
  -- NATIONAL FUND DIRECT OFFERINGS
  ofrenda_misiones NUMERIC(18,2) DEFAULT 0,
  lazos_amor NUMERIC(18,2) DEFAULT 0,
  mision_posible NUMERIC(18,2) DEFAULT 0,
  aporte_caballeros NUMERIC(18,2) DEFAULT 0,
  apy NUMERIC(18,2) DEFAULT 0,
  instituto_biblico NUMERIC(18,2) DEFAULT 0,
  diezmo_pastoral NUMERIC(18,2) DEFAULT 0,
  total_fondo_nacional NUMERIC(18,2) GENERATED ALWAYS AS (
    COALESCE(fondo_nacional, 0) + COALESCE(ofrenda_misiones, 0) + COALESCE(lazos_amor, 0) + 
    COALESCE(mision_posible, 0) + COALESCE(aporte_caballeros, 0) + COALESCE(apy, 0) + 
    COALESCE(instituto_biblico, 0) + COALESCE(diezmo_pastoral, 0)
  ) STORED,
  
  -- BANK DEPOSIT
  fecha_deposito DATE,
  numero_deposito TEXT,
  monto_depositado NUMERIC(18,2) DEFAULT 0,
  
  -- ATTENDANCE & BAPTISMS
  asistencia_visitas INTEGER DEFAULT 0,
  bautismos_agua INTEGER DEFAULT 0,
  bautismos_espiritu INTEGER DEFAULT 0,
  
  -- STATUS & AUDIT
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  foto_informe TEXT,
  foto_deposito TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  
  UNIQUE (church_id, month, year)
);
```

**Key Features**:
- **Auto-calculated fondo_nacional**: 10% of diezmos (GENERATED column)
- **Composite unique constraint**: One report per church/month/year
- **Approval workflow**: draft → submitted → approved/rejected
- **Receipt tracking**: Photos for report and bank deposit

**Indexes**:
- `monthly_reports_pkey` (PRIMARY KEY on id)
- `idx_monthly_reports_church_month_year` (UNIQUE on church_id, month, year)
- `idx_monthly_reports_status` (on status)

**RLS Policies**:
- Users see reports from their church only
- Admins and district supervisors see all reports
- Treasurers can create/update reports for their church
- Only admins can approve reports

---

## Fund Management Tables

### 4. Funds (`funds`)

Fund categories for multi-fund accounting.

```sql
CREATE TABLE funds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  fund_type TEXT NOT NULL CHECK (fund_type IN ('general', 'restricted', 'designated')),
  is_active BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Fund Types**:
- `general`: General operating funds
- `restricted`: Donor-restricted funds
- `designated`: Board-designated funds

**Pre-loaded Funds** (migration 007):
- General Fund (GENERAL)
- Building Fund (BUILDING)
- Missions Fund (MISSIONS)
- Youth Fund (YOUTH)

---

### 5. Fund Balances (`fund_balances`)

Current balance for each fund per church.

```sql
CREATE TABLE fund_balances (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES churches(id),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  balance NUMERIC(18,2) DEFAULT 0,
  last_transaction_id UUID REFERENCES fund_transactions(id),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (church_id, fund_id)
);
```

**Business Rules**:
- One balance record per church/fund combination
- Updated automatically by fund transaction triggers
- Balance cannot go negative (CHECK constraint)

---

### 6. Fund Transactions (`fund_transactions`)

Financial ledger for all fund movements.

```sql
CREATE TABLE fund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id INTEGER NOT NULL REFERENCES churches(id),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer_in', 'transfer_out')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  reference_number TEXT,
  provider_id BIGINT REFERENCES providers(id),
  related_event_id UUID REFERENCES fund_events(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- For transfers
  related_transaction_id UUID REFERENCES fund_transactions(id)
);
```

**Transaction Types**:
- `income`: Money coming into fund
- `expense`: Money going out of fund
- `transfer_in`: Transfer from another fund
- `transfer_out`: Transfer to another fund

**Triggers**:
- `update_fund_balance_on_transaction`: Auto-updates fund_balances
- `prevent_negative_balance`: Blocks transactions that would cause negative balance

---

## Event Management Tables

### 7. Fund Events (`fund_events`)

Event planning with budget tracking (migration 026).

```sql
CREATE TABLE fund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  church_id INTEGER REFERENCES churches(id),
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_revision', 'submitted', 'approved', 'rejected', 'cancelled'
  )),
  
  -- Budget vs Actuals
  total_budget_income NUMERIC(18,2) DEFAULT 0,
  total_budget_expense NUMERIC(18,2) DEFAULT 0,
  total_actual_income NUMERIC(18,2) DEFAULT 0,
  total_actual_expense NUMERIC(18,2) DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Workflow**:
1. Fund director creates event (status: draft)
2. Adds budget line items
3. Submits for approval (status: submitted)
4. Treasurer approves/rejects (status: approved/rejected)
5. Post-event: Add actual income/expenses
6. On approval: Create fund transactions automatically

---

### 8. Fund Event Line Items (`fund_event_line_items`)

Budget line items for events.

```sql
CREATE TABLE fund_event_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES fund_events(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('income', 'expense')),
  description TEXT NOT NULL,
  budget_amount NUMERIC(18,2) NOT NULL CHECK (budget_amount >= 0),
  actual_amount NUMERIC(18,2) DEFAULT 0 CHECK (actual_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Triggers**:
- `recalculate_event_totals_on_line_item_change`: Updates parent event totals

---

### 9. Fund Director Assignments (`fund_director_assignments`)

Assigns fund directors to specific funds (migration 026).

```sql
CREATE TABLE fund_director_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fund_id INTEGER REFERENCES funds(id) ON DELETE CASCADE,
  church_id INTEGER REFERENCES churches(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  UNIQUE NULLS NOT DISTINCT (profile_id, fund_id, church_id)
);
```

**Business Rules**:
- `fund_id = NULL`: Director has access to all funds
- `church_id = NULL`: Director has access across all churches
- Unique constraint prevents duplicate assignments

---

## Provider & Expense Tables

### 10. Providers (`providers`)

Centralized vendor/provider registry (migration 027).

```sql
CREATE TABLE providers (
  id BIGSERIAL PRIMARY KEY,
  ruc TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  tipo_identificacion TEXT NOT NULL CHECK (tipo_identificacion IN ('RUC', 'NIS', 'ISSAN', 'CI')),
  razon_social TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  categoria TEXT CHECK (categoria IN (
    'servicios_publicos', 'honorarios', 'suministros', 'construccion', 'otros'
  )),
  notas TEXT,
  es_activo BOOLEAN DEFAULT TRUE,
  es_especial BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);
```

**Key Features**:
- **RUC deduplication**: UNIQUE constraint prevents duplicates
- **Special providers**: ANDE (NIS), ESSAP (ISSAN) - utilities with non-standard IDs
- **Full-text search**: GIN index on nombre for autocomplete

**Pre-loaded Providers**:
- ANDE (NIS-VARIABLE)
- ESSAP (ISSAN-VARIABLE)

**Helper Functions**:
- `find_provider_by_ruc(TEXT)`: Check if provider exists
- `search_providers(TEXT, TEXT, INT)`: Autocomplete search

---

### 11. Expense Records (`expense_records`)

Detailed expense tracking with tax information.

```sql
CREATE TABLE expense_records (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL REFERENCES churches(id),
  report_id BIGINT REFERENCES monthly_reports(id),
  provider_id BIGINT REFERENCES providers(id),
  fecha_comprobante DATE NOT NULL,
  numero_comprobante TEXT,
  ruc_ci_proveedor TEXT,
  proveedor TEXT NOT NULL,
  concepto TEXT NOT NULL,
  tipo_salida TEXT,
  
  -- Tax breakdown
  monto_exenta NUMERIC(18,2) DEFAULT 0,
  monto_gravada_10 NUMERIC(18,2) DEFAULT 0,
  iva_10 NUMERIC(18,2) DEFAULT 0,
  monto_gravada_5 NUMERIC(18,2) DEFAULT 0,
  iva_5 NUMERIC(18,2) DEFAULT 0,
  total_factura NUMERIC(18,2) DEFAULT 0,
  
  es_factura_legal BOOLEAN DEFAULT FALSE,
  es_honorario_pastoral BOOLEAN DEFAULT FALSE,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tax Categories** (Paraguay):
- `monto_exenta`: Exempt amount
- `monto_gravada_10`: 10% VAT taxable amount
- `monto_gravada_5`: 5% VAT taxable amount

---

## Audit & Configuration Tables

### 12. User Activity (`user_activity`)

Complete audit trail of all user actions.

```sql
CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexed Actions**:
- `idx_user_activity_user_id` (on user_id)
- `idx_user_activity_action` (on action)
- `idx_user_activity_resource` (on resource_type, resource_id)
- `idx_user_activity_created_at` (on created_at DESC)

**Common Actions**:
- `create`, `update`, `delete`, `approve`, `submit`, `login`, `logout`

---

### 13. System Configuration (`system_configuration`)

Admin-configurable settings by section (migration 025).

```sql
CREATE TABLE system_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  
  UNIQUE (section, key)
);
```

**Configuration Sections**:
- `email`: Email settings (SMTP, templates)
- `security`: Security policies (password rules, 2FA)
- `reporting`: Report settings (due dates, required fields)
- `general`: General settings (organization name, timezone)

---

## Additional Tables

### 14. Donors (`donors`)

Donor registry for contribution tracking (migration 013).

```sql
CREATE TABLE donors (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES churches(id),
  full_name TEXT NOT NULL,
  ci_ruc TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 15. Worship Records (`worship_records`)

Individual worship service records.

```sql
CREATE TABLE worship_records (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL REFERENCES churches(id),
  fecha_culto DATE NOT NULL,
  tipo_culto TEXT NOT NULL,
  predicador TEXT,
  
  -- Totals
  total_diezmos NUMERIC(18,2) DEFAULT 0,
  total_ofrendas NUMERIC(18,2) DEFAULT 0,
  total_recaudado NUMERIC(18,2) DEFAULT 0,
  
  -- Attendance
  miembros_activos INTEGER DEFAULT 0,
  visitas INTEGER DEFAULT 0,
  total_asistencia INTEGER DEFAULT 0,
  bautismos_agua INTEGER DEFAULT 0,
  bautismos_espiritu INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Database Functions & Triggers

### RLS Helper Functions

**Session Context Getters**:
```sql
-- Get current user ID from session
CREATE FUNCTION app_current_user_id() RETURNS UUID;

-- Get current user role from session
CREATE FUNCTION app_current_user_role() RETURNS TEXT;

-- Get current user church ID from session
CREATE FUNCTION app_current_user_church_id() RETURNS INTEGER;
```

**Fund Director Functions**:
```sql
-- Check if user is fund director
CREATE FUNCTION app_user_is_fund_director() RETURNS BOOLEAN;

-- Get assigned fund IDs for current user
CREATE FUNCTION app_user_assigned_funds() RETURNS INTEGER[];

-- Check if user has access to specific fund
CREATE FUNCTION app_user_has_fund_access(p_fund_id INTEGER) RETURNS BOOLEAN;
```

### Automatic Triggers

**Balance Updates**:
```sql
-- Update fund_balances on transaction insert/update/delete
CREATE TRIGGER update_fund_balance_on_transaction
  AFTER INSERT OR UPDATE OR DELETE ON fund_transactions
  FOR EACH ROW EXECUTE FUNCTION update_fund_balance();
```

**Event Totals**:
```sql
-- Recalculate event totals when line items change
CREATE TRIGGER recalculate_event_totals_on_line_item_change
  AFTER INSERT OR UPDATE OR DELETE ON fund_event_line_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_event_totals();
```

**Timestamp Updates**:
```sql
-- Auto-update updated_at column
CREATE TRIGGER update_updated_at
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Migrations History

| Migration | Description | Key Changes |
|-----------|-------------|-------------|
| 000 | Migration history table | Tracking system |
| 001 | Initial schema | Core tables (churches, reports, users) |
| 002 | Member management | Added donor tracking |
| 003 | Analytics tables | Reporting enhancements |
| 004 | Seed data | 22 churches loaded |
| 005 | Dual-level accounting | Enhanced fund system |
| 006 | Google auth | OAuth integration |
| 007 | Fund management | Multi-fund support |
| 008 | Reports portal | Enhanced reporting UI |
| 009 | Audit log | User activity tracking |
| 010 | Implement RLS | Row-level security policies |
| 013 | Donor registry | Enhanced donor tracking |
| 014 | Fix national fund | Auto-calculation fixes |
| 015 | Recalculate balances | Balance reconciliation |
| 016 | Create profiles | Supabase auth integration |
| 017 | Enhance profiles | Role improvements |
| 022 | Comprehensive RLS | Full RLS enablement |
| 023 | Simplify roles | 8→6 role consolidation |
| 024 | Fix RLS UUID | UUID type consistency |
| 025 | Configuration sections | Admin settings by section |
| 026 | Fund director events | Event planning system |
| 027 | Providers table | Centralized provider registry |
| 028 | Backfill provider IDs | Data migration |
| 029 | Consolidate churches | Church deduplication |
| 030 | Add church email | Church contact info |

---

## Data Types & Conventions

### Numeric Precision
- **Currency**: `NUMERIC(18,2)` - 18 digits total, 2 decimal places
- **Percentages**: `NUMERIC(5,2)` - e.g., 10.50%
- **Counts**: `INTEGER` for attendance, baptisms

### Text Fields
- **Identifiers**: `TEXT` (RUC, CI, reference numbers)
- **Names**: `TEXT NOT NULL` for entity names
- **Descriptions**: `TEXT` (optional, can be NULL)

### Timestamps
- **All timestamps**: `TIMESTAMPTZ` (timezone-aware)
- **Dates only**: `DATE` for event dates, transaction dates

### Primary Keys
- **Newer tables**: `UUID` (fund_events, fund_transactions)
- **Legacy tables**: `BIGSERIAL` (churches, monthly_reports)

### Foreign Keys
- **ON DELETE CASCADE**: User-owned data (fund_director_assignments)
- **ON DELETE SET NULL**: Audit references (created_by, approved_by)
- **ON DELETE RESTRICT**: Critical relationships (fund_events.fund_id)

---

## Performance Optimization

### Indexes

**Composite Indexes** (for common queries):
- `idx_monthly_reports_church_month_year` - Report lookups
- `idx_fund_balances_church_fund` - Balance queries
- `idx_fund_transactions_church_fund_date` - Ledger queries

**GIN Indexes** (full-text search):
- `idx_providers_nombre` - Provider autocomplete
- `idx_user_activity_details` - Activity log search

**Partial Indexes** (filtered):
- `idx_providers_es_activo WHERE es_activo = TRUE`
- `idx_monthly_reports_status_pending WHERE status = 'submitted'`

### Query Optimization

**Use CTEs for complex queries**:
```sql
WITH church_income AS (
  SELECT church_id, SUM(total_entradas) as total
  FROM monthly_reports
  WHERE year = 2025
  GROUP BY church_id
)
SELECT c.name, ci.total
FROM churches c
JOIN church_income ci ON c.id = ci.church_id;
```

**Avoid N+1 queries** - Use JOINs instead of separate queries

---

## Backup & Maintenance

### Backup Strategy
- **PITR**: Continuous via Supabase (15-minute RPO)
- **Daily snapshots**: Full database backup (30-day retention)
- **Monthly exports**: `pg_dump` to external storage

### Maintenance Tasks
- **VACUUM ANALYZE**: Weekly (automatic via Supabase)
- **REINDEX**: Monthly on high-churn tables
- **Partition old data**: Yearly (user_activity, fund_transactions)

---

**Last Updated**: October 2025
**Database Version**: PostgreSQL 15.3
**Total Tables**: 45+
**Total Indexes**: 100+
**Total Functions**: 15+
