# Transaction Ledger Feature Guide

**Document Version**: 1.0.0
**Last Updated**: 2025-10-06
**Target Audience**: Treasurers, Administrators, Financial Managers

---

## Table of Contents

- [Overview](#overview)
- [Feature Purpose](#feature-purpose)
- [Multi-Fund Accounting System](#multi-fund-accounting-system)
- [User Roles and Permissions](#user-roles-and-permissions)
- [Transaction Types](#transaction-types)
- [Transaction Fields](#transaction-fields)
- [Church-Level vs National-Level Transactions](#church-level-vs-national-level-transactions)
- [Fund Balance Tracking](#fund-balance-tracking)
- [Creating Transactions](#creating-transactions)
- [Automatic Transaction Creation](#automatic-transaction-creation)
- [Transaction Categories](#transaction-categories)
- [Reconciliation with Monthly Reports](#reconciliation-with-monthly-reports)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)
- [Technical Reference](#technical-reference)
- [See Also](#see-also)

---

## Overview

The **Transaction Ledger** (Libro Mayor / Ledger) is the central financial accounting system that records all income and expenses across IPU Paraguay's **multi-fund structure**. Every financial movement—whether from monthly reports, fund events, or manual entries—is recorded as a transaction in the ledger.

### Key Capabilities

- 💰 Multi-fund accounting (10+ separate funds)
- 📊 Dual-entry accounting (income/expense)
- 🏦 Fund balance tracking
- 🔗 Links to monthly reports and fund events
- 👤 Provider tracking
- 📅 Date-based filtering and reporting
- 🔒 Role-based visibility (RLS enforced)
- 🔄 Automatic transaction generation

### Architecture

```
┌─────────────────┐
│  transactions   │ ◄──── Central ledger (all financial movements)
└─────────────────┘
      │
      ├── Fund 1: Fondo Nacional (General Fund)
      ├── Fund 2: Fondo Misiones (Missions Fund)
      ├── Fund 3: Lazos de Amor (Lazos de Amor Fund)
      ├── Fund 4: Misión Posible (Misión Posible Fund)
      ├── Fund 5: APY (APY Fund)
      ├── Fund 6: Instituto Bíblico (Bible Institute Fund)
      ├── Fund 7: Caballeros (Knights Fund)
      ├── Fund 8: Damas (Ladies Fund)
      ├── Fund 9: Jóvenes (Youth Fund)
      └── Fund 10: Niños (Children Fund)

Each transaction:
  - Belongs to ONE fund
  - Has amount_in (income) OR amount_out (expense)
  - May link to church (church_id)
  - May link to report (report_id)
  - May link to provider (provider_id)
```

---

## Feature Purpose

### Why Transaction Ledger Exists

1. **Centralized Accounting**: Single source of truth for all financial movements
2. **Fund Separation**: Track each fund independently (missions, youth, institutes, etc.)
3. **Balance Tracking**: Real-time fund balance calculation
4. **Audit Trail**: Complete record of who did what, when
5. **Reconciliation**: Match transactions to monthly reports and bank statements
6. **Compliance**: Meet accounting standards and regulatory requirements

### Business Requirements

**IPU Paraguay** operates with multiple designated funds:
- **National Fund (Fondo Nacional)**: 10% of church tithes + offerings
- **Missions Fund**: Direct missions offerings
- **Youth Fund**: Youth ministry activities
- **Bible Institute Fund**: Training and education
- **Other Designated Funds**: Lazos de Amor, APY, Knights, Ladies, Children

Each fund must be tracked separately with:
- Separate balance
- Separate income/expense tracking
- Separate reporting
- Separate approval workflows (for fund events)

---

## Multi-Fund Accounting System

### Fund Structure

The system maintains **separate funds** (not sub-accounts):

```typescript
interface Fund {
  id: number;                    // Unique fund ID
  name: string;                  // Fund name
  description: string;           // Fund purpose
  fund_type: 'national' | 'designated' | 'project';
  current_balance: number;       // Real-time balance (auto-calculated)
  is_active: boolean;            // Active status
  created_at: timestamp;         // Creation date
}
```

### Standard Funds

| Fund ID | Name | Type | Purpose |
|---------|------|------|---------|
| 1 | Fondo Nacional | national | General treasury (10% from churches) |
| 2 | Fondo Misiones | designated | Missions support |
| 3 | Lazos de Amor | designated | Women's ministry |
| 4 | Misión Posible | designated | Evangelism |
| 5 | APY | designated | Youth programs |
| 6 | Instituto Bíblico | designated | Bible institute |
| 7 | Caballeros | designated | Men's ministry |
| 8 | Damas | designated | Women's activities |
| 9 | Jóvenes | designated | Youth activities |
| 10 | Niños | designated | Children's ministry |

### Fund Balance Calculation

Each fund's balance is calculated from transactions:

```typescript
fund_balance = SUM(amount_in) - SUM(amount_out)

// Example:
Fund: Missions Fund (fund_id = 2)
Income transactions: ₱50,000,000
Expense transactions: ₱30,000,000
Current Balance: ₱20,000,000
```

**Important**: Balance is stored in `funds.current_balance` but recalculated on every transaction create/update/delete to ensure accuracy.

---

## User Roles and Permissions

### Role-Based Visibility Matrix

| Role | View Transactions | Create Transaction | Edit Transaction | Delete Transaction |
|------|-------------------|-------------------|------------------|-------------------|
| **admin** | All funds + churches | ✅ Any fund | ✅ Any | ✅ Any |
| **treasurer** | All funds (national-level) | ✅ Any fund | ✅ Any | ✅ Any |
| **fund_director** | Assigned funds only | ✅ Assigned funds | ✅ Own (before approval) | ✅ Own (before approval) |
| **pastor** | Own church only | ❌ No direct access | ❌ | ❌ |
| **church_manager** | Own church only | ❌ No direct access | ❌ | ❌ |
| **secretary** | Own church only | ❌ No direct access | ❌ | ❌ |

**Key Points**:
- **Pastors DO NOT create transactions directly** (transactions created automatically from monthly reports)
- **Fund directors** can create transactions for fund events
- **Treasurer** manages all funds (national-level role)
- **Admin** has full override access

### Transaction Visibility (RLS)

**National-level users (admin, treasurer)**:
```sql
-- See all transactions across all funds and churches
SELECT * FROM transactions;
```

**Fund directors**:
```sql
-- See only transactions for assigned funds
SELECT * FROM transactions
WHERE fund_id IN (SELECT fund_id FROM fund_director_assignments WHERE profile_id = current_user_id);
```

**Church-scoped users (pastor, church_manager, secretary)**:
```sql
-- See only transactions related to their church
SELECT * FROM transactions
WHERE church_id = current_user_church_id;
```

---

## Transaction Types

Transactions are categorized by their relationship to other entities:

### 1. Report-Generated Transactions

**Source**: Monthly reports (approved by admin)

**Characteristics**:
- `created_by = 'system'`
- `report_id IS NOT NULL`
- Auto-generated on report approval
- Immutable (deleted/recreated if report edited)

**Example**:
```typescript
{
  fund_id: 1,                           // National Fund
  church_id: 5,                         // Asunción Central
  report_id: 123,                       // From report
  concept: "Fondo Nacional Septiembre 2025",
  amount_in: 300000,
  amount_out: 0,
  date: "2025-09-15",
  created_by: "system"
}
```

---

### 2. Event-Generated Transactions

**Source**: Fund events (finalized by treasurer)

**Characteristics**:
- `created_by = 'system'`
- Linked to `fund_events` table
- Auto-generated on event finalization
- Separate transactions for income and expenses

**Example**:
```typescript
// Income transaction
{
  fund_id: 9,                           // Youth Fund
  church_id: null,                      // National event
  concept: "Evento: Youth Conference 2025 - Ingresos",
  amount_in: 6400000,
  amount_out: 0,
  date: "2025-12-15",
  created_by: "system"
}

// Expense transaction
{
  fund_id: 9,
  church_id: null,
  concept: "Evento: Youth Conference 2025 - Gastos",
  amount_in: 0,
  amount_out: 11900000,
  date: "2025-12-15",
  created_by: "system"
}
```

---

### 3. Manual Transactions

**Source**: Treasurer/admin manual entry

**Characteristics**:
- `created_by = user_email`
- `report_id IS NULL`
- User-entered concept and amounts
- Optional provider reference

**Use Cases**:
- Direct fund transfers
- Bank fees
- Interest income
- Corrections/adjustments
- Miscellaneous income/expenses

**Example**:
```typescript
{
  fund_id: 1,
  church_id: null,
  concept: "Intereses bancarios Enero 2025",
  amount_in: 150000,
  amount_out: 0,
  date: "2025-01-31",
  created_by: "treasurer@ipupy.org.py",
  provider_id: null
}
```

---

## Transaction Fields

### Complete Field Reference

```typescript
interface Transaction {
  id: number;                    // Auto-generated primary key
  date: Date;                    // Transaction date (NOT timestamp)
  fund_id: number;               // Fund reference (REQUIRED)
  church_id: number | null;      // Optional church reference
  report_id: number | null;      // Optional report reference
  concept: string;               // Transaction description
  provider: string | null;       // Legacy provider text field
  provider_id: number | null;    // Provider reference (preferred)
  document_number: string | null; // Invoice/receipt number
  amount_in: number;             // Income amount (default: 0)
  amount_out: number;            // Expense amount (default: 0)
  created_by: string;            // User email or 'system'
  created_at: timestamp;         // Auto-generated
  updated_at: timestamp | null;  // Auto-updated on changes
}
```

### Field Descriptions

#### date (REQUIRED)

**Description**: Date of the financial transaction (when it occurred, not when recorded).

**Type**: `DATE` (not timestamp)

**Usage**:
```typescript
date: "2025-09-15"  // September 15, 2025
```

**Business Rule**: Should match bank statement date or event date.

---

#### fund_id (REQUIRED)

**Description**: Which fund this transaction belongs to.

**Type**: `INTEGER` (foreign key to `funds` table)

**Validation**: Must reference existing fund.

**Examples**:
```typescript
fund_id: 1  // National Fund
fund_id: 2  // Missions Fund
fund_id: 9  // Youth Fund
```

---

#### church_id (OPTIONAL)

**Description**: Which church this transaction is related to (if applicable).

**Type**: `INTEGER | NULL` (foreign key to `churches` table)

**When NULL**: National-level transaction (not specific to one church)

**When NOT NULL**: Church-specific transaction

**Examples**:
```typescript
// Church-specific (from monthly report)
church_id: 5  // Asunción Central

// National (from fund event)
church_id: null
```

---

#### amount_in vs amount_out

**Description**: Dual-entry accounting - either income OR expense, not both.

**Type**: `NUMERIC(15,2)` (Paraguayan Guaraníes)

**Business Rule**: Only ONE should be non-zero

**Examples**:
```typescript
// Income transaction
amount_in: 300000,
amount_out: 0

// Expense transaction
amount_in: 0,
amount_out: 150000

// ❌ INVALID (both non-zero)
amount_in: 100000,
amount_out: 50000  // NOT ALLOWED
```

---

#### concept (REQUIRED)

**Description**: Human-readable description of transaction.

**Type**: `TEXT`

**Format Conventions**:
```typescript
// Monthly report transactions
"Fondo Nacional Septiembre 2025"
"Misiones Octubre 2025"

// Fund event transactions
"Evento: Youth Conference 2025 - Ingresos"
"Evento: Bible Institute Training - Gastos"

// Manual transactions
"Intereses bancarios Enero 2025"
"Transferencia entre fondos: Nacional → Misiones"
"Corrección contable: Duplicado eliminado"
```

---

#### created_by (REQUIRED)

**Description**: Who created this transaction.

**Type**: `TEXT`

**Values**:
- `"system"` - Auto-generated from report/event
- `"user@email.com"` - Manually created by user

**Usage**:
```typescript
// System-generated
created_by: "system"

// User-created
created_by: "treasurer@ipupy.org.py"
```

---

#### provider_id (OPTIONAL)

**Description**: Reference to centralized provider registry.

**Type**: `BIGINT | NULL` (foreign key to `providers` table)

**Recommended**: Use `provider_id` instead of legacy `provider` text field

**Example**:
```typescript
provider_id: 1  // ANDE (electricity)
provider_id: 45 // Ferretería San Juan
```

---

## Church-Level vs National-Level Transactions

### Church-Level Transactions

**Definition**: Transactions related to a specific church.

**Characteristics**:
- `church_id IS NOT NULL`
- Usually from monthly reports
- Visible to church roles (pastor, church_manager, secretary)
- Examples: Diezmos, ofrendas, designated funds from that church

**Example**:
```typescript
{
  fund_id: 1,                    // National Fund
  church_id: 5,                  // Asunción Central
  concept: "Fondo Nacional Septiembre 2025",
  amount_in: 300000,
  church_name: "Asunción Central" // Joined from churches table
}
```

**Reporting**:
```sql
-- Total contributions from Asunción Central to National Fund
SELECT SUM(amount_in)
FROM transactions
WHERE fund_id = 1 AND church_id = 5;
```

---

### National-Level Transactions

**Definition**: Transactions not related to a specific church.

**Characteristics**:
- `church_id IS NULL`
- Usually from fund events or manual entries
- Only visible to national roles (admin, treasurer, fund_director)
- Examples: National event expenses, bank fees, inter-fund transfers

**Example**:
```typescript
{
  fund_id: 9,                    // Youth Fund
  church_id: null,               // National transaction
  concept: "Evento: National Youth Conference - Gastos",
  amount_out: 11900000
}
```

**Reporting**:
```sql
-- Total national-level expenses for Youth Fund
SELECT SUM(amount_out)
FROM transactions
WHERE fund_id = 9 AND church_id IS NULL;
```

---

## Fund Balance Tracking

### Real-Time Balance Calculation

Each fund's balance is automatically maintained:

```sql
-- funds table
CREATE TABLE funds (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  current_balance NUMERIC(15,2) DEFAULT 0,  -- ← Auto-maintained
  ...
);
```

### Balance Update Triggers

**On Transaction INSERT**:
```sql
UPDATE funds
SET current_balance = current_balance + (new.amount_in - new.amount_out)
WHERE id = new.fund_id;
```

**On Transaction UPDATE**:
```sql
-- Calculate difference from old to new
old_balance_effect = old.amount_in - old.amount_out;
new_balance_effect = new.amount_in - new.amount_out;
difference = new_balance_effect - old_balance_effect;

UPDATE funds
SET current_balance = current_balance + difference
WHERE id = new.fund_id;
```

**On Transaction DELETE**:
```sql
UPDATE funds
SET current_balance = current_balance - (old.amount_in - old.amount_out)
WHERE id = old.fund_id;
```

### Balance Verification

**Periodically verify balance integrity**:
```sql
-- Recalculate balance from transactions
SELECT
  f.id,
  f.name,
  f.current_balance AS stored_balance,
  COALESCE(SUM(t.amount_in - t.amount_out), 0) AS calculated_balance,
  f.current_balance - COALESCE(SUM(t.amount_in - t.amount_out), 0) AS difference
FROM funds f
LEFT JOIN transactions t ON t.fund_id = f.id
GROUP BY f.id, f.name, f.current_balance
HAVING f.current_balance != COALESCE(SUM(t.amount_in - t.amount_out), 0);
```

If differences found → Rebuild balances:
```sql
UPDATE funds f
SET current_balance = COALESCE(
  (SELECT SUM(amount_in - amount_out) FROM transactions WHERE fund_id = f.id),
  0
);
```

---

## Creating Transactions

### Manual Transaction Creation

**Who Can Create**: admin, treasurer, fund_director (for assigned funds)

**API Endpoint**: `POST /api/financial/transactions`

**Request Body**:
```typescript
{
  "date": "2025-09-20",
  "fund_id": 1,
  "church_id": null,
  "concept": "Intereses bancarios Septiembre 2025",
  "provider_id": null,
  "document_number": null,
  "amount_in": 150000,
  "amount_out": 0
}
```

**Response**:
```typescript
{
  "success": true,
  "created": [
    {
      "id": 1234,
      "date": "2025-09-20",
      "fund_id": 1,
      "fund_name": "Fondo Nacional",
      "concept": "Intereses bancarios Septiembre 2025",
      "amount_in": 150000,
      "amount_out": 0,
      "created_by": "treasurer@ipupy.org.py",
      "created_at": "2025-09-20T14:30:00Z"
    }
  ]
}
```

### Bulk Transaction Creation

**Use Case**: Import multiple transactions from Excel/CSV

**API Endpoint**: `POST /api/financial/transactions` (array)

**Request Body**:
```typescript
[
  {
    "date": "2025-09-01",
    "fund_id": 1,
    "concept": "Diezmo Iglesia 1",
    "amount_in": 200000,
    "amount_out": 0
  },
  {
    "date": "2025-09-01",
    "fund_id": 1,
    "concept": "Diezmo Iglesia 2",
    "amount_in": 250000,
    "amount_out": 0
  },
  ...
]
```

**Response**:
```typescript
{
  "success": true,
  "created": [...],  // Successfully created transactions
  "errors": [...]    // Failed transactions with error messages
}
```

---

## Automatic Transaction Creation

### From Monthly Reports

**Trigger**: Admin approves monthly report (`estado = 'procesado'`)

**Function**: `createReportTransactions()` in `/src/app/api/reports/route-helpers.ts`

**Logic**:
```typescript
// For approved report:
//   church_id: 5
//   month: 9
//   year: 2025
//   fondo_nacional: ₱300,000
//   misiones: ₱100,000
//   lazos_amor: ₱50,000

// Transaction 1: National Fund
INSERT INTO transactions (
  fund_id: 1,
  church_id: 5,
  report_id: report.id,
  concept: "Fondo Nacional Septiembre 2025",
  amount_in: 300000,
  amount_out: 0,
  date: report.fecha_deposito,
  created_by: "system"
)

// Transaction 2: Missions Fund
INSERT INTO transactions (
  fund_id: 2,
  church_id: 5,
  report_id: report.id,
  concept: "Misiones Septiembre 2025",
  amount_in: 100000,
  amount_out: 0,
  date: report.fecha_deposito,
  created_by: "system"
)

// Transaction 3: Lazos de Amor
INSERT INTO transactions (
  fund_id: 3,
  church_id: 5,
  report_id: report.id,
  concept: "Lazos de Amor Septiembre 2025",
  amount_in: 50000,
  amount_out: 0,
  date: report.fecha_deposito,
  created_by: "system"
)

// ... (for each designated fund > 0)
```

**Result**: Up to 10 transactions created per report (1 for fondo_nacional + up to 9 for designated funds)

---

### From Fund Events

**Trigger**: Treasurer finalizes fund event

**Function**: `process_fund_event_approval()` in migration 026

**Logic**:
```typescript
// For finalized event:
//   event_id: uuid
//   fund_id: 9 (Youth Fund)
//   total_income: ₱6,400,000
//   total_expense: ₱11,900,000

// Transaction 1: Income
INSERT INTO transactions (
  fund_id: 9,
  church_id: event.church_id,
  concept: "Evento: Youth Conference 2025 - Ingresos",
  amount_in: 6400000,
  amount_out: 0,
  date: event.event_date,
  created_by: "system"
)

// Transaction 2: Expenses
INSERT INTO transactions (
  fund_id: 9,
  church_id: event.church_id,
  concept: "Evento: Youth Conference 2025 - Gastos",
  amount_in: 0,
  amount_out: 11900000,
  date: event.event_date,
  created_by: "system"
)
```

**Result**: 2 transactions created per event (1 income, 1 expense)

---

## Transaction Categories

While there's no explicit `category` field, transactions can be categorized by:

### 1. By Source

**Report-Generated**:
```sql
SELECT * FROM transactions
WHERE created_by = 'system' AND report_id IS NOT NULL;
```

**Event-Generated**:
```sql
SELECT * FROM transactions
WHERE created_by = 'system' AND concept LIKE 'Evento:%';
```

**Manual**:
```sql
SELECT * FROM transactions
WHERE created_by != 'system';
```

---

### 2. By Fund Type

**National Fund**:
```sql
SELECT * FROM transactions WHERE fund_id = 1;
```

**Designated Funds**:
```sql
SELECT * FROM transactions WHERE fund_id IN (2, 3, 4, 5, 6, 7, 8, 9, 10);
```

---

### 3. By Church

**Church-Specific**:
```sql
SELECT * FROM transactions
WHERE church_id IS NOT NULL
ORDER BY church_id, date DESC;
```

**National-Level**:
```sql
SELECT * FROM transactions
WHERE church_id IS NULL
ORDER BY date DESC;
```

---

### 4. By Time Period

**Monthly**:
```sql
SELECT * FROM transactions
WHERE EXTRACT(MONTH FROM date) = 9
  AND EXTRACT(YEAR FROM date) = 2025;
```

**Quarterly**:
```sql
SELECT * FROM transactions
WHERE date >= '2025-07-01' AND date < '2025-10-01';
```

**Annual**:
```sql
SELECT * FROM transactions
WHERE EXTRACT(YEAR FROM date) = 2025;
```

---

## Reconciliation with Monthly Reports

### Purpose

Ensure monthly report data matches ledger transactions:
1. Verify report amounts match transaction amounts
2. Detect missing transactions
3. Identify duplicate transactions

### Reconciliation Query

```sql
-- Compare report totals with transaction totals
SELECT
  r.id AS report_id,
  r.church_id,
  r.month,
  r.year,
  r.fondo_nacional AS report_fondo_nacional,
  COALESCE(SUM(t.amount_in) FILTER (WHERE t.fund_id = 1), 0) AS transaction_fondo_nacional,
  r.fondo_nacional - COALESCE(SUM(t.amount_in) FILTER (WHERE t.fund_id = 1), 0) AS difference
FROM reports r
LEFT JOIN transactions t ON t.report_id = r.id
WHERE r.estado = 'procesado'
GROUP BY r.id, r.church_id, r.month, r.year, r.fondo_nacional
HAVING r.fondo_nacional != COALESCE(SUM(t.amount_in) FILTER (WHERE t.fund_id = 1), 0);
```

**If differences found** → Investigate:
1. Check if transactions were created (`transactions_created` flag in reports)
2. Verify transaction amounts
3. Check for deleted/modified transactions
4. Re-approve report to recreate transactions if needed

---

## Common Workflows

### Workflow 1: Monthly Report Approval (Automatic Transaction Creation)

**Scenario**: Admin approves Asunción Central's September report

**Steps**:
1. Admin reviews report ID 123
2. Admin approves:
   ```typescript
   PUT /api/reports?id=123
   { "estado": "procesado" }
   ```
3. System validates deposit amount
4. System calls `createReportTransactions(report, totals, designated_funds, auth)`
5. System creates 10 transactions:
   - 1 for National Fund (₱300,000)
   - 1 for Missions (₱100,000)
   - 1 for Lazos de Amor (₱50,000)
   - 1 for APY (₱25,000)
   - ... (for each designated fund > 0)
6. System marks `transactions_created = true`
7. Fund balances auto-updated

---

### Workflow 2: Manual Bank Interest Entry

**Scenario**: Treasurer records bank interest income

**Steps**:
1. Treasurer navigates to "Transacciones Manuales"
2. Selects fund: "Fondo Nacional"
3. Enters:
   - Date: "2025-09-30"
   - Concept: "Intereses bancarios Septiembre 2025"
   - Amount In: ₱150,000
4. Submits:
   ```typescript
   POST /api/financial/transactions
   {
     "date": "2025-09-30",
     "fund_id": 1,
     "concept": "Intereses bancarios Septiembre 2025",
     "amount_in": 150000,
     "amount_out": 0
   }
   ```
5. System creates transaction
6. National Fund balance increases by ₱150,000

---

### Workflow 3: Inter-Fund Transfer

**Scenario**: Transfer funds from National Fund to Missions Fund

**Steps**:
1. Treasurer creates two transactions:

**Transaction 1** (Outgoing from National Fund):
```typescript
POST /api/financial/transactions
{
  "date": "2025-09-25",
  "fund_id": 1,
  "concept": "Transferencia a Fondo Misiones",
  "amount_in": 0,
  "amount_out": 5000000
}
```

**Transaction 2** (Incoming to Missions Fund):
```typescript
POST /api/financial/transactions
{
  "date": "2025-09-25",
  "fund_id": 2,
  "concept": "Transferencia desde Fondo Nacional",
  "amount_in": 5000000,
  "amount_out": 0
}
```

2. Result:
   - National Fund balance: -₱5,000,000
   - Missions Fund balance: +₱5,000,000
   - Zero net effect on total treasury

---

### Workflow 4: Transaction Correction (Delete & Recreate)

**Scenario**: Treasurer entered wrong amount, needs to correct

**Steps**:
1. Treasurer identifies incorrect transaction (ID 1234)
2. Treasurer deletes:
   ```typescript
   DELETE /api/financial/transactions?id=1234
   ```
3. System:
   - Deletes transaction
   - Reverses fund balance effect
4. Treasurer creates corrected transaction:
   ```typescript
   POST /api/financial/transactions
   {
     "date": "2025-09-20",
     "fund_id": 1,
     "concept": "Intereses bancarios (Corregido)",
     "amount_in": 180000,  // Corrected amount
     "amount_out": 0
   }
   ```
5. Fund balance now correct

---

### Workflow 5: Reconciling Report with Ledger

**Scenario**: Admin notices National Fund total doesn't match expected

**Steps**:
1. Admin runs reconciliation query (see [Reconciliation with Monthly Reports](#reconciliation-with-monthly-reports))
2. Query shows difference: ₱300,000 expected, ₱0 in ledger
3. Admin checks report:
   ```sql
   SELECT transactions_created, transactions_created_at
   FROM reports WHERE id = 123;
   ```
4. Result: `transactions_created = FALSE` (transaction creation failed)
5. Admin re-approves report:
   ```typescript
   PUT /api/reports?id=123
   { "estado": "procesado" }
   ```
6. System recreates transactions
7. Reconciliation passes

---

## Troubleshooting

### Problem 1: Fund Balance Incorrect

**Symptom**: `funds.current_balance` doesn't match calculated balance from transactions.

**Diagnosis**:
```sql
SELECT
  f.id,
  f.name,
  f.current_balance AS stored,
  COALESCE(SUM(t.amount_in - t.amount_out), 0) AS calculated,
  f.current_balance - COALESCE(SUM(t.amount_in - t.amount_out), 0) AS diff
FROM funds f
LEFT JOIN transactions t ON t.fund_id = f.id
GROUP BY f.id
HAVING f.current_balance != COALESCE(SUM(t.amount_in - t.amount_out), 0);
```

**Solution**: Rebuild balances
```sql
UPDATE funds f
SET current_balance = COALESCE(
  (SELECT SUM(amount_in - amount_out) FROM transactions WHERE fund_id = f.id),
  0
);
```

---

### Problem 2: Duplicate Transactions from Report

**Symptom**: Report approved twice, creating duplicate transactions.

**Cause**: Admin approved report, edited, re-approved without system deleting old transactions.

**Solution**:
1. Identify duplicate transactions:
   ```sql
   SELECT * FROM transactions
   WHERE report_id = 123
   ORDER BY created_at;
   ```
2. Delete older duplicates:
   ```sql
   DELETE FROM transactions
   WHERE report_id = 123
   AND created_at < (SELECT MAX(created_at) FROM transactions WHERE report_id = 123);
   ```
3. Verify only one set remains
4. Rebuild fund balance (see Problem 1)

---

### Problem 3: Transaction Visible to Wrong User

**Symptom**: Pastor sees transactions from other churches.

**Cause**: RLS policies not working correctly or session context not set.

**Diagnosis**:
```sql
-- Check current session context
SELECT
  current_setting('app.current_user_id', true),
  current_setting('app.current_user_role', true),
  current_setting('app.current_user_church_id', true);
```

**Solution**:
- Ensure `setDatabaseContext()` called before queries
- Verify RLS policies enabled:
  ```sql
  SELECT tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'transactions';
  ```

---

### Problem 4: Cannot Delete System-Generated Transaction

**Symptom**: DELETE returns success but transaction still exists.

**Cause**: System-generated transactions linked to reports should be deleted by re-approving report, not directly.

**Solution**:
- **For report transactions**: Edit and re-approve report (system deletes/recreates automatically)
- **For event transactions**: Contact admin to manually delete via SQL
- **For manual transactions**: Delete directly via API (no restrictions)

---

## Technical Reference

### API Endpoints

#### GET /api/financial/transactions

List transactions with filters.

**Query Parameters**:
- `fund_id`: Filter by fund
- `church_id`: Filter by church
- `date_from`: Filter by date range start
- `date_to`: Filter by date range end
- `month`: Filter by month (1-12)
- `year`: Filter by year
- `limit`: Pagination limit (default: 100)
- `offset`: Pagination offset (default: 0)

**Response**:
```typescript
{
  "success": true,
  "data": [
    {
      "id": 1234,
      "date": "2025-09-15",
      "fund_id": 1,
      "fund_name": "Fondo Nacional",
      "church_id": 5,
      "church_name": "Asunción Central",
      "concept": "Fondo Nacional Septiembre 2025",
      "amount_in": 300000,
      "amount_out": 0,
      "created_by": "system",
      "created_at": "2025-09-18T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1250
  },
  "totals": {
    "count": 1250,
    "total_in": 125000000,
    "total_out": 98000000,
    "balance": 27000000
  }
}
```

---

#### POST /api/financial/transactions

Create transaction(s).

**Request Body** (single):
```typescript
{
  "date": "2025-09-20",
  "fund_id": 1,
  "church_id": null,
  "concept": "Intereses bancarios Septiembre 2025",
  "provider_id": null,
  "document_number": null,
  "amount_in": 150000,
  "amount_out": 0
}
```

**Request Body** (bulk):
```typescript
[
  { "date": "2025-09-01", "fund_id": 1, ... },
  { "date": "2025-09-02", "fund_id": 2, ... }
]
```

**Response**: 201 Created
```typescript
{
  "success": true,
  "created": [...],
  "errors": []
}
```

---

#### PUT /api/financial/transactions?id=X

Update transaction.

**Query Parameters**:
- `id` (required): Transaction ID

**Request Body**:
```typescript
{
  "concept": "Intereses bancarios (Corregido)",
  "amount_in": 180000
}
```

**Response**: 200 OK

---

#### DELETE /api/financial/transactions?id=X

Delete transaction.

**Query Parameters**:
- `id` (required): Transaction ID

**Response**: 200 OK
```typescript
{
  "success": true,
  "message": "Transaction deleted successfully",
  "fundId": 1
}
```

---

### Database Schema

```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  church_id INTEGER REFERENCES churches(id),
  report_id INTEGER REFERENCES reports(id),
  concept TEXT NOT NULL,
  provider TEXT,                           -- Legacy text field
  provider_id BIGINT REFERENCES providers(id),
  document_number TEXT,
  amount_in NUMERIC(15,2) DEFAULT 0 NOT NULL CHECK (amount_in >= 0),
  amount_out NUMERIC(15,2) DEFAULT 0 NOT NULL CHECK (amount_out >= 0),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_transactions_fund_id ON transactions(fund_id);
CREATE INDEX idx_transactions_church_id ON transactions(church_id) WHERE church_id IS NOT NULL;
CREATE INDEX idx_transactions_report_id ON transactions(report_id) WHERE report_id IS NOT NULL;
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);
CREATE INDEX idx_transactions_provider_id ON transactions(provider_id) WHERE provider_id IS NOT NULL;
```

---

### RLS Policies

```sql
-- National roles: See all transactions
CREATE POLICY "National roles view all transactions"
ON transactions FOR SELECT
USING (
  app_current_user_role() IN ('admin', 'treasurer')
);

-- Fund directors: See assigned fund transactions
CREATE POLICY "Fund directors view assigned fund transactions"
ON transactions FOR SELECT
USING (
  app_current_user_role() = 'fund_director' AND
  fund_id IN (SELECT fund_id FROM fund_director_assignments WHERE profile_id = app_current_user_id())
);

-- Church roles: See own church transactions
CREATE POLICY "Church roles view own church transactions"
ON transactions FOR SELECT
USING (
  app_current_user_role() IN ('pastor', 'church_manager', 'secretary') AND
  church_id = app_current_user_church_id()
);

-- Admin/Treasurer: Full write access
CREATE POLICY "Admin/Treasurer full access"
ON transactions FOR ALL
USING (app_current_user_role() IN ('admin', 'treasurer'));
```

---

## See Also

### Related Documentation

- **[Monthly Reports Guide](./MONTHLY_REPORTS.md)**: How reports create transactions
- **[Fund Events Guide](./FUND_EVENTS.md)**: How events create transactions
- **[Provider Registry Guide](./PROVIDER_REGISTRY.md)**: Provider linkage
- **[Database Business Logic](../database/BUSINESS_LOGIC.md)**: Financial calculations
- **[RLS Policies Reference](../database/RLS_POLICIES.md)**: Row-level security

### Related Files

**API Routes**:
- `/src/app/api/financial/transactions/route.ts` - Main transactions API
- `/src/app/api/reports/route-helpers.ts` - Report transaction creation

**Database**:
- `/migrations/026_fund_director_events.sql` - Event transaction creation function

---

**Document End** | For questions or corrections, contact: `administracion@ipupy.org.py`
