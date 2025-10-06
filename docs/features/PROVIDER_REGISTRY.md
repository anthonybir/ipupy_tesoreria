# Provider Registry Feature Guide

**Document Version**: 1.0.0
**Last Updated**: 2025-10-06
**Target Audience**: Treasurers, Administrators, Church Managers

---

## Table of Contents

- [Overview](#overview)
- [Feature Purpose](#feature-purpose)
- [Why Centralized Providers](#why-centralized-providers)
- [User Roles and Permissions](#user-roles-and-permissions)
- [Provider Fields](#provider-fields)
- [RUC Validation and Deduplication](#ruc-validation-and-deduplication)
- [Special Utility Providers](#special-utility-providers)
- [Provider Categories](#provider-categories)
- [Adding a New Provider](#adding-a-new-provider)
- [Editing and Deactivating Providers](#editing-and-deactivating-providers)
- [Provider Search and Autocomplete](#provider-search-and-autocomplete)
- [Migration from Church-Specific Providers](#migration-from-church-specific-providers)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)
- [Technical Reference](#technical-reference)
- [See Also](#see-also)

---

## Overview

The **Provider Registry** (Registro de Proveedores) is a centralized database of vendors, suppliers, and service providers used across all churches and funds in the IPU Paraguay treasury system. Introduced in **migration 027**, this feature eliminates duplicate provider entries and ensures consistent RUC tracking.

### Key Capabilities

- 🏢 Centralized provider database (shared across all churches)
- 🔢 RUC uniqueness enforcement (no duplicates)
- 🔍 Fast provider search and autocomplete
- ⚡ Special utility providers (ANDE, ESSAP) with non-standard IDs
- 📂 Provider categorization (utilities, honoraria, supplies, etc.)
- ✅ Active/inactive provider management
- 🔒 Role-based access control

### Architecture

```
┌──────────────────┐
│    providers     │ ◄───── Centralized registry (ONE source of truth)
└──────────────────┘
         │
         │ Foreign Key References
         │
    ┌────┴────┬─────────────┬──────────────────┐
    ▼         ▼             ▼                  ▼
transactions  expense_  church_          (future tables)
              records   transactions
```

**Before Migration 027**: Each table had `provider` (text field) → duplicates, typos, inconsistency

**After Migration 027**: Each table has `provider_id` (FK to providers) → single source, consistency

---

## Feature Purpose

### Why Provider Registry Exists

1. **Eliminate Duplicates**: Prevent "ANDE", "A.N.D.E.", "Administración Nacional de Electricidad" all being separate entries
2. **RUC Tracking**: Ensure each provider's RUC (tax ID) is tracked consistently
3. **Compliance**: Meet Paraguayan tax authority requirements for vendor records
4. **Reporting**: Generate accurate vendor spending reports across all churches
5. **Efficiency**: Autocomplete reduces data entry errors and time

### Business Requirements

**Paraguayan Tax Law** requires:
- All payments >₱500,000 must have vendor RUC documented
- Invoices must reference valid RUC
- Annual tax reports must list vendor payments by RUC

**IPU Treasury Needs**:
- Track vendor spending across 22 churches
- Generate consolidated vendor reports
- Prevent duplicate payments to same vendor
- Maintain vendor contact information

---

## Why Centralized Providers

### The Problem (Before Migration 027)

**Scenario**: 22 churches each enter "ANDE" differently

```
Church 1: ANDE
Church 2: A.N.D.E.
Church 3: Ande
Church 4: Administración Nacional de Electricidad
Church 5: ANDE - Asunción
...
```

**Result**:
- 22+ duplicate entries for same provider
- Impossible to generate consolidated ANDE spending report
- RUC not tracked consistently
- Typos and variations proliferate

### The Solution (After Migration 027)

**Centralized Provider**:
```
ID: 1
RUC: NIS-VARIABLE
Name: ANDE
Razon Social: Administración Nacional de Electricidad
Category: servicios_publicos
```

**Result**:
- ✅ Single entry for ANDE
- ✅ All churches reference provider_id=1
- ✅ Consolidated reports: "Total ANDE: ₱250,000,000"
- ✅ RUC/NIS tracked correctly
- ✅ No duplicates possible (RUC unique constraint)

### Benefits for Churches

**For Pastors/Church Managers**:
- Faster data entry (autocomplete)
- No need to remember vendor RUC
- Consistent vendor names

**For Treasurers**:
- Accurate consolidated reports
- Easy vendor payment tracking
- Simplified tax compliance

**For Administrators**:
- Single source of vendor information
- Easy vendor management
- Clean audit trail

---

## User Roles and Permissions

### Role-Based Access Matrix

| Role | View Providers | Create Provider | Edit Provider | Delete Provider |
|------|----------------|-----------------|---------------|-----------------|
| **admin** | ✅ All | ✅ | ✅ | ✅ (soft delete) |
| **treasurer** | ✅ All | ✅ | ✅ | ✅ (soft delete) |
| **fund_director** | ✅ Assigned funds | ✅ For assigned funds | ❌ | ❌ |
| **pastor** | ✅ All | ✅ | ❌ | ❌ |
| **church_manager** | ✅ All | ✅ | ❌ | ❌ |
| **secretary** | ✅ All | ✅ | ❌ | ❌ |

**Key Points**:
- **View**: All transaction creators can view providers (need for dropdown/autocomplete)
- **Create**: All transaction creators can add new providers (prevents workflow blocks)
- **Edit/Delete**: Only admin/treasurer can modify (prevents data corruption)

### RLS Policy Summary

```sql
-- Read access: All transaction creators
CREATE POLICY "Transaction creators can view providers"
ON providers FOR SELECT
USING (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Write access: All transaction creators can add providers
CREATE POLICY "Transaction creators can create providers"
ON providers FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Update/Delete: Only admin/treasurer
CREATE POLICY "Only admin/treasurer can update providers"
ON providers FOR UPDATE
USING (app_current_user_role() IN ('admin', 'treasurer'));
```

---

## Provider Fields

### Complete Field Reference

```typescript
interface Provider {
  id: number;                        // Auto-generated primary key
  ruc: string;                       // RUC, NIS, ISSAN, or CI (UNIQUE)
  nombre: string;                    // Provider name
  tipo_identificacion: 'RUC' | 'NIS' | 'ISSAN' | 'CI'; // ID type
  razon_social: string | null;       // Legal business name
  direccion: string | null;          // Address
  telefono: string | null;           // Phone number
  email: string | null;              // Email address
  categoria: ProviderCategory | null; // Category (see below)
  notas: string | null;              // Notes
  es_activo: boolean;                // Active status (default: true)
  es_especial: boolean;              // Special utility provider (default: false)
  created_at: timestamp;             // Auto-generated
  updated_at: timestamp;             // Auto-updated
  created_by: UUID | null;           // User who created
}
```

### Field Descriptions

#### ruc (REQUIRED)

**Description**: Primary identifier for the provider. Can be RUC, NIS, ISSAN, or CI depending on provider type.

**Validation**:
- Required, not null
- Must be unique (database constraint)
- No specific format validation (Paraguay RUC format varies)

**Examples**:
```
Standard RUC: "80012345-6"
NIS (ANDE): "NIS-VARIABLE" (special)
ISSAN (ESSAP): "ISSAN-VARIABLE" (special)
CI (Individual): "1234567"
```

#### nombre (REQUIRED)

**Description**: Provider display name (what users see in dropdowns).

**Validation**:
- Required, not null
- No length limit
- Case-sensitive

**Examples**:
```
"ANDE"
"ESSAP"
"Hotel Casino Acaray"
"Imprenta San Pablo"
"Pastor Juan Ramírez"
```

#### tipo_identificacion (REQUIRED)

**Description**: Type of identification number.

**Options**:
- `RUC`: Standard tax ID for businesses
- `NIS`: ANDE electricity meter number (special utility)
- `ISSAN`: ESSAP water service number (special utility)
- `CI`: Cédula de identidad (individual, no RUC)

**Usage**:
```
Businesses → RUC
ANDE → NIS
ESSAP → ISSAN
Individuals → CI
```

#### razon_social (OPTIONAL)

**Description**: Legal business name (if different from `nombre`).

**Examples**:
```
nombre: "ANDE"
razon_social: "Administración Nacional de Electricidad"

nombre: "Imprenta SP"
razon_social: "Imprenta San Pablo S.A."
```

#### categoria (OPTIONAL)

**Description**: Provider category for filtering and reporting.

**Options**: See [Provider Categories](#provider-categories)

#### es_especial (BOOLEAN)

**Description**: Marks special utility providers (ANDE, ESSAP) with non-standard identification.

**Default**: `false`

**Usage**: Only ANDE and ESSAP have `es_especial = true`

#### es_activo (BOOLEAN)

**Description**: Active status. Inactive providers don't appear in autocomplete.

**Default**: `true`

**Usage**: Soft delete by setting `es_activo = false`

---

## RUC Validation and Deduplication

### RUC Uniqueness Enforcement

**Database Constraint** (migration 027):
```sql
CONSTRAINT providers_ruc_unique UNIQUE (ruc)
```

**What This Means**:
- Cannot insert two providers with same RUC
- Database-level enforcement (cannot be bypassed)
- Prevents duplicates automatically

### Deduplication on Create

**Scenario**: User tries to add provider with existing RUC

```typescript
POST /api/providers
{
  "ruc": "80012345-6",
  "nombre": "Ferretería Nueva",
  ...
}

// Database responds: ERROR: duplicate key violates unique constraint "providers_ruc_unique"

API response: 409 Conflict
{
  "error": "Ya existe un proveedor con este RUC"
}
```

**Solution**: Frontend should check for existing RUC before submitting:

```typescript
// Check if RUC exists
GET /api/providers/check-ruc?ruc=80012345-6

Response:
{
  exists: true,
  provider: {
    id: 123,
    ruc: "80012345-6",
    nombre: "Ferretería San Juan"
  }
}

// Show user: "This RUC already exists as 'Ferretería San Juan'. Use existing?"
```

### RUC Search Function

**Database helper** (migration 027):
```sql
SELECT * FROM find_provider_by_ruc('80012345-6');
```

Returns existing provider or null.

---

## Special Utility Providers

### Why Special Providers Exist

**Problem**: ANDE and ESSAP don't use RUC system
- **ANDE**: Uses NIS (meter number) - varies per church
- **ESSAP**: Uses ISSAN (service number) - varies per church

**Traditional Approach**: Each church creates separate ANDE/ESSAP entry with their meter/service number
- ❌ 22 duplicate ANDE entries (one per church)
- ❌ Cannot consolidate utility spending across churches

**Centralized Approach**: One ANDE, one ESSAP with placeholder RUC
- ✅ Single centralized entry
- ✅ Consolidated utility reports
- ⚠️ RUC field contains placeholder ("NIS-VARIABLE", "ISSAN-VARIABLE")

### Pre-Seeded Special Providers

**Migration 027 creates**:

#### ANDE (Electric Power)

```typescript
{
  id: 1,
  ruc: "NIS-VARIABLE",
  nombre: "ANDE",
  tipo_identificacion: "NIS",
  razon_social: "Administración Nacional de Electricidad",
  categoria: "servicios_publicos",
  es_especial: true,
  es_activo: true,
  notas: "Proveedor especial de energía eléctrica. El RUC es el NIS del medidor."
}
```

#### ESSAP (Water)

```typescript
{
  id: 2,
  ruc: "ISSAN-VARIABLE",
  nombre: "ESSAP",
  tipo_identificacion: "ISSAN",
  razon_social: "Empresa de Servicios Sanitarios del Paraguay S.A.",
  categoria: "servicios_publicos",
  es_especial: true,
  es_activo: true,
  notas: "Proveedor especial de agua potable. El RUC es el ISSAN del servicio."
}
```

### Using Special Providers

**When creating utility transaction**:

1. Select provider: "ANDE"
2. System uses `provider_id = 1`
3. In transaction notes, record actual NIS: "NIS 123456"
4. Transaction links to centralized ANDE provider

**Example Transaction**:
```typescript
{
  provider_id: 1,  // ANDE
  concept: "Energía Eléctrica - Enero 2025",
  notes: "NIS 123456 - Iglesia Asunción Central",
  amount_out: 450000
}
```

**Benefits**:
- Consolidated report: "Total ANDE: ₱12,000,000"
- Actual meter numbers preserved in transaction notes
- No duplicate ANDE entries

---

## Provider Categories

Seven standardized categories for filtering and reporting:

### 1. servicios_publicos (Public Utilities)

**Description**: Utility services (electricity, water, trash, etc.)

**Providers**:
- ANDE (electricity)
- ESSAP (water)
- Municipal trash collection
- Internet/phone providers

**Reporting**: Track utility spending across churches

---

### 2. honorarios (Honoraria)

**Description**: Professional fees, speaker payments, pastoral compensation

**Providers**:
- Pastors (individuals with CI)
- Guest speakers
- Consultants
- Musicians/worship leaders

**Reporting**: Track honoraria payments for tax compliance

---

### 3. suministros (Supplies)

**Description**: Materials, supplies, office goods

**Providers**:
- Office supply stores
- Printing shops
- Cleaning supply vendors
- Stationery stores

**Reporting**: Track supply spending

---

### 4. construccion (Construction)

**Description**: Construction, maintenance, repairs

**Providers**:
- Construction companies
- Plumbers
- Electricians
- Painters
- Hardware stores

**Reporting**: Track building/maintenance costs

---

### 5. otros (Other)

**Description**: Miscellaneous providers not fitting other categories

**Providers**:
- Insurance companies
- Legal services
- Transportation
- Special events

**Reporting**: Catch-all category

---

## Adding a New Provider

### Step-by-Step Process

#### 1. Check if Provider Exists

Before adding, search for existing provider:

```typescript
GET /api/providers/search?q=ferretería

Response:
{
  data: [
    {
      id: 45,
      ruc: "80012345-6",
      nombre: "Ferretería San Juan",
      ...
    }
  ]
}
```

If exists → Use existing provider
If not exists → Proceed to add

#### 2. Gather Provider Information

**Required**:
- RUC (or NIS/ISSAN/CI)
- Nombre (provider name)
- Tipo de Identificación (RUC/NIS/ISSAN/CI)

**Optional (but recommended)**:
- Razón Social (legal name)
- Dirección (address)
- Teléfono (phone)
- Email
- Categoría (category)

#### 3. Create Provider via API

```typescript
POST /api/providers
{
  "ruc": "80067890-1",
  "nombre": "Ferretería La Económica",
  "tipo_identificacion": "RUC",
  "razon_social": "Ferretería La Económica S.R.L.",
  "direccion": "Av. España 1234, Asunción",
  "telefono": "+595 21 555-1234",
  "email": "ventas@ferreteria-economica.com.py",
  "categoria": "suministros",
  "notas": "Descuento 10% para iglesias"
}

Response: 201 Created
{
  "data": {
    "id": 156,
    "ruc": "80067890-1",
    "nombre": "Ferretería La Económica",
    "es_activo": true,
    "es_especial": false,
    "created_at": "2025-10-06T15:30:00Z",
    "created_by": "uuid"
  }
}
```

#### 4. Verify Provider Creation

```typescript
GET /api/providers?es_activo=true

// Should include newly created provider in response
```

### Frontend Workflow

**Ideal UX**:

1. User enters RUC in transaction form
2. System auto-searches for existing provider
3. If found → Auto-fills provider name
4. If not found → Show "Add New Provider" modal
5. User completes provider form inline
6. Provider created → Auto-selected in transaction

**Example Flow**:
```
User enters RUC: "80067890-1"
→ API: GET /api/providers/check-ruc?ruc=80067890-1
→ Response: { exists: false }
→ Show modal: "This provider doesn't exist. Add now?"
→ User enters: Nombre, Categoría, etc.
→ API: POST /api/providers { ... }
→ Response: { id: 156, nombre: "..." }
→ Auto-select provider_id=156 in transaction form
```

---

## Editing and Deactivating Providers

### Editing Providers

**Who Can Edit**: admin, treasurer

**Editable Fields**:
- ❌ `ruc` (immutable - primary identifier)
- ❌ `id` (immutable - system generated)
- ✅ `nombre`
- ✅ `razon_social`
- ✅ `direccion`
- ✅ `telefono`
- ✅ `email`
- ✅ `categoria`
- ✅ `notas`
- ✅ `es_activo`

**Example Update**:
```typescript
PUT /api/providers
{
  "id": 156,
  "telefono": "+595 21 555-5678",  // Updated phone
  "email": "nuevo@ferreteria.com", // Updated email
  "notas": "Cambio de contacto"
}

Response: 200 OK
{
  "data": {
    "id": 156,
    "telefono": "+595 21 555-5678",
    "email": "nuevo@ferreteria.com",
    "updated_at": "2025-10-06T16:00:00Z"
  }
}
```

### Deactivating Providers (Soft Delete)

**Why Soft Delete**: Preserve audit trail and existing transaction references

**Process**:
```typescript
DELETE /api/providers?id=156

// Executes:
UPDATE providers SET es_activo = false, updated_at = NOW()
WHERE id = 156;

Response: 200 OK
{
  "success": true
}
```

**Effects**:
- Provider hidden from autocomplete
- Provider not in active provider lists
- Existing transactions still reference provider (foreign key intact)
- Can be reactivated by admin (set `es_activo = true`)

### Reactivating Providers

**Admin can reactivate**:
```typescript
PUT /api/providers
{
  "id": 156,
  "es_activo": true
}
```

---

## Provider Search and Autocomplete

### Search Functionality

**Database Function** (migration 027):
```sql
SELECT * FROM search_providers(
  p_query := 'ferretería',
  p_categoria := NULL,
  p_limit := 20
);
```

**Search Fields**:
- Provider name (`nombre`)
- RUC/NIS/ISSAN/CI
- Legal name (`razon_social`)

**Search Behavior**:
- Case-insensitive (`ILIKE`)
- Partial matching (`%ferretería%`)
- Special providers ranked first (`ORDER BY es_especial DESC`)

### API Search Endpoint

```typescript
GET /api/providers/search?q=ferretería&categoria=suministros&limit=20

Response:
{
  "data": [
    {
      "id": 156,
      "ruc": "80067890-1",
      "nombre": "Ferretería La Económica",
      "categoria": "suministros",
      "es_especial": false
    },
    {
      "id": 45,
      "ruc": "80012345-6",
      "nombre": "Ferretería San Juan",
      "categoria": "suministros",
      "es_especial": false
    }
  ]
}
```

### Autocomplete UX

**Frontend Implementation** (recommended):

```typescript
<Autocomplete
  onSearch={async (query) => {
    const response = await fetch(`/api/providers/search?q=${query}&limit=10`);
    return response.json();
  }}
  renderOption={(provider) => (
    <div>
      <strong>{provider.nombre}</strong>
      <span>{provider.ruc}</span>
    </div>
  )}
  onSelect={(provider) => setProviderId(provider.id)}
/>
```

**Features**:
- Debounced search (300ms)
- Minimum 2 characters
- Shows special providers first
- Highlights matching text
- Includes "Add New Provider" option if no results

---

## Migration from Church-Specific Providers

### Historical Context

**Before Migration 027**: Providers stored as text in multiple tables
- `transactions.provider` (TEXT)
- `expense_records.proveedor` (TEXT)
- `church_transactions.vendor_customer` (TEXT)

**Problems**:
- Duplicates: "ANDE", "ande", "A.N.D.E."
- Typos: "Feretería" instead of "Ferretería"
- No RUC tracking
- Impossible to consolidate reports

### Migration Process (Migration 027 + 028)

#### Phase 1: Create Centralized Table (Migration 027)

```sql
CREATE TABLE providers (...);
```

#### Phase 2: Extract Existing Providers (Migration 027)

```sql
-- Migrate from transactions
INSERT INTO providers (ruc, nombre, tipo_identificacion, categoria)
SELECT DISTINCT
  COALESCE(provider, 'UNKNOWN-' || gen_random_uuid()) AS ruc,
  COALESCE(provider, 'Proveedor sin nombre') AS nombre,
  'RUC' AS tipo_identificacion,
  'otros' AS categoria
FROM transactions
WHERE provider IS NOT NULL AND provider != ''
ON CONFLICT (ruc) DO NOTHING;
```

#### Phase 3: Backfill Foreign Keys (Migration 028)

```sql
-- Update transactions with provider_id
UPDATE transactions t
SET provider_id = p.id
FROM providers p
WHERE t.provider = p.nombre;
```

### Post-Migration Cleanup

**Legacy Fields Retained** (for reference):
- `transactions.provider` (TEXT) - kept but discouraged
- `expense_records.proveedor` (TEXT) - kept but discouraged

**Recommended Approach**:
- New transactions: Use `provider_id` exclusively
- Old transactions: Leave legacy `provider` field as-is
- Reporting: Join to `providers` table using `provider_id`

---

## Common Workflows

### Workflow 1: Adding Provider During Transaction Entry

**Scenario**: Pastor creating expense transaction, provider doesn't exist

**Steps**:
1. Pastor enters RUC: "80099999-9"
2. System searches: `GET /api/providers/check-ruc?ruc=80099999-9`
3. Not found → Show inline form
4. Pastor enters:
   - Nombre: "Librería Cristiana Maranatha"
   - Categoría: "suministros"
5. System creates: `POST /api/providers { ... }`
6. Provider created with ID 234
7. Transaction form auto-selects provider_id=234
8. Pastor completes transaction

---

### Workflow 2: Correcting Duplicate Provider

**Scenario**: Admin discovers duplicate entries for same vendor

**Example**:
```
Provider 45: RUC 80012345-6, Name "Ferretería San Juan"
Provider 156: RUC 80012345-7 (typo), Name "Ferretería San Juan"
```

**Steps**:
1. Admin identifies duplicate (RUC typo)
2. Admin updates all transactions using provider_id=156:
   ```sql
   UPDATE transactions
   SET provider_id = 45
   WHERE provider_id = 156;
   ```
3. Admin deactivates duplicate:
   ```typescript
   DELETE /api/providers?id=156
   ```
4. Future transactions use correct provider (ID 45)

---

### Workflow 3: Consolidating Utility Spending

**Scenario**: Treasurer needs total ANDE spending across all churches

**Steps**:
1. All churches use provider_id=1 (ANDE)
2. Treasurer runs report:
   ```typescript
   GET /api/transactions?provider_id=1

   Response:
   {
     data: [
       { church_id: 1, amount_out: 450000 },
       { church_id: 2, amount_out: 380000 },
       { church_id: 3, amount_out: 520000 },
       ...
     ],
     totals: {
       total_out: 12500000
     }
   }
   ```
3. Report: "Total ANDE spending: ₱12,500,000"

---

### Workflow 4: Tracking Honoraria Payments

**Scenario**: National treasurer needs pastor honoraria report for tax filing

**Steps**:
1. Filter providers by category:
   ```typescript
   GET /api/providers?categoria=honorarios

   Response: List of pastors and speakers
   ```
2. For each provider, get transactions:
   ```typescript
   GET /api/transactions?provider_id={id}
   ```
3. Generate report:
   ```
   Pastor Juan Ramírez (CI 1234567):
     - January 2025: ₱3,000,000
     - February 2025: ₱3,200,000
     Total 2025: ₱6,200,000
   ```
4. Export for tax authority

---

## Troubleshooting

### Problem 1: "Ya existe un proveedor con este RUC"

**Symptom**: Cannot create provider, duplicate error.

**Cause**: Provider with this RUC already exists.

**Solution**:
1. Search for existing provider:
   ```typescript
   GET /api/providers/check-ruc?ruc=80012345-6
   ```
2. If found, use existing provider
3. If RUC is genuinely different (typo in form):
   - Verify correct RUC
   - Try again with correct RUC

---

### Problem 2: Provider Not Appearing in Autocomplete

**Symptom**: Cannot find provider in dropdown.

**Cause**: Provider is inactive or search query doesn't match.

**Solutions**:

**Solution A**: Provider Deactivated
```typescript
// Check provider status
GET /api/providers?id=156

Response:
{
  "data": {
    "id": 156,
    "nombre": "Ferretería La Económica",
    "es_activo": false  // ← Inactive
  }
}

// Reactivate
PUT /api/providers
{
  "id": 156,
  "es_activo": true
}
```

**Solution B**: Search Query Mismatch
```
User searches: "fer"
Provider name: "Ferretería La Económica"

Autocomplete requires minimum 2 characters ✅
But search only matches providers with "fer" in name

Solution: Search more characters ("ferr") or search by RUC
```

---

### Problem 3: Special Providers Missing

**Symptom**: ANDE or ESSAP not in provider list.

**Cause**: Migration 027 not applied or special providers deleted.

**Solution**:
1. Check for special providers:
   ```sql
   SELECT * FROM providers WHERE es_especial = true;
   ```
2. If missing, re-seed:
   ```sql
   INSERT INTO providers (ruc, nombre, tipo_identificacion, razon_social, categoria, es_especial)
   VALUES
     ('NIS-VARIABLE', 'ANDE', 'NIS', 'Administración Nacional de Electricidad', 'servicios_publicos', true),
     ('ISSAN-VARIABLE', 'ESSAP', 'ISSAN', 'Empresa de Servicios Sanitarios del Paraguay S.A.', 'servicios_publicos', true)
   ON CONFLICT (ruc) DO NOTHING;
   ```

---

### Problem 4: Cannot Edit Provider

**Symptom**: Update API returns 403 Forbidden.

**Cause**: User role does not have edit permissions.

**Solution**:
- Only admin and treasurer can edit providers
- If pastor/secretary needs to update:
  1. Contact admin/treasurer
  2. Admin makes edit

**Rationale**: Prevents accidental data corruption. Providers are shared across all churches, so edits must be centrally controlled.

---

### Problem 5: Legacy Transactions with Text Provider

**Symptom**: Old transactions have `provider` (text) but no `provider_id`.

**Cause**: Transactions created before migration 027.

**Solution**: Backfill provider_id
```sql
-- Find matching provider by name
UPDATE transactions t
SET provider_id = p.id
FROM providers p
WHERE t.provider = p.nombre
AND t.provider_id IS NULL;
```

**Alternative**: Leave as-is. Legacy transactions can coexist with new system. Reports should check both fields:
```typescript
const providerName = transaction.provider_id
  ? providers.find(p => p.id === transaction.provider_id)?.nombre
  : transaction.provider;
```

---

## Technical Reference

### API Endpoints

#### GET /api/providers

List providers with filters.

**Query Parameters**:
- `categoria`: Filter by category
- `es_activo`: Filter by active status (true/false)
- `limit`: Pagination limit (default: 100)
- `offset`: Pagination offset (default: 0)

**Response**:
```typescript
{
  "data": [
    {
      "id": 1,
      "ruc": "NIS-VARIABLE",
      "nombre": "ANDE",
      "tipo_identificacion": "NIS",
      "razon_social": "Administración Nacional de Electricidad",
      "categoria": "servicios_publicos",
      "es_activo": true,
      "es_especial": true,
      "created_at": "2025-09-28T00:00:00Z"
    }
  ],
  "count": 156
}
```

---

#### POST /api/providers

Create new provider.

**Request Body**:
```typescript
{
  "ruc": "80067890-1",
  "nombre": "Ferretería La Económica",
  "tipo_identificacion": "RUC",
  "razon_social": "Ferretería La Económica S.R.L.",
  "direccion": "Av. España 1234, Asunción",
  "telefono": "+595 21 555-1234",
  "email": "ventas@ferreteria.com.py",
  "categoria": "suministros",
  "notas": "Descuento 10%"
}
```

**Response**: 201 Created
```typescript
{
  "data": {
    "id": 156,
    "ruc": "80067890-1",
    "nombre": "Ferretería La Económica",
    ...
  }
}
```

**Errors**:
- `400`: "RUC, nombre y tipo de identificación son requeridos"
- `409`: "Ya existe un proveedor con este RUC"

---

#### PUT /api/providers

Update existing provider.

**Request Body**:
```typescript
{
  "id": 156,
  "telefono": "+595 21 555-5678",
  "email": "nuevo@ferreteria.com"
}
```

**Response**: 200 OK

**Errors**:
- `400`: "ID de proveedor es requerido"
- `403`: Forbidden (only admin/treasurer)
- `404`: "Proveedor no encontrado"

---

#### DELETE /api/providers?id=X

Soft delete provider (set `es_activo = false`).

**Query Parameters**:
- `id` (required): Provider ID

**Response**: 200 OK
```typescript
{
  "success": true
}
```

**Errors**:
- `400`: "ID de proveedor es requerido"
- `403`: Forbidden (only admin/treasurer)
- `404`: "Proveedor no encontrado"

---

#### GET /api/providers/check-ruc?ruc=X

Check if provider with RUC exists.

**Query Parameters**:
- `ruc` (required): RUC to check

**Response**:
```typescript
{
  "exists": true,
  "provider": {
    "id": 45,
    "ruc": "80012345-6",
    "nombre": "Ferretería San Juan"
  }
}

// OR

{
  "exists": false,
  "provider": null
}
```

---

#### GET /api/providers/search?q=X

Search providers by name, RUC, or legal name.

**Query Parameters**:
- `q` (required): Search query (min 2 characters)
- `categoria` (optional): Filter by category
- `limit` (optional): Max results (default: 20)

**Response**:
```typescript
{
  "data": [
    {
      "id": 1,
      "ruc": "NIS-VARIABLE",
      "nombre": "ANDE",
      "tipo_identificacion": "NIS",
      "categoria": "servicios_publicos",
      "es_especial": true
    }
  ]
}
```

---

### Database Schema

```sql
CREATE TABLE providers (
  id BIGSERIAL PRIMARY KEY,
  ruc TEXT NOT NULL,
  nombre TEXT NOT NULL,
  tipo_identificacion TEXT NOT NULL CHECK (tipo_identificacion IN ('RUC', 'NIS', 'ISSAN', 'CI')),
  razon_social TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  categoria TEXT CHECK (categoria IN ('servicios_publicos', 'honorarios', 'suministros', 'construccion', 'otros')),
  notas TEXT,
  es_activo BOOLEAN DEFAULT TRUE,
  es_especial BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  CONSTRAINT providers_ruc_unique UNIQUE (ruc)
);

-- Indexes
CREATE UNIQUE INDEX idx_providers_ruc ON providers(ruc);
CREATE INDEX idx_providers_nombre ON providers USING GIN (to_tsvector('spanish', nombre));
CREATE INDEX idx_providers_categoria ON providers(categoria) WHERE categoria IS NOT NULL;
CREATE INDEX idx_providers_es_activo ON providers(es_activo) WHERE es_activo = TRUE;
CREATE INDEX idx_providers_es_especial ON providers(es_especial) WHERE es_especial = TRUE;
```

---

### Foreign Key References

**Tables that reference providers**:
```sql
ALTER TABLE transactions ADD COLUMN provider_id BIGINT REFERENCES providers(id);
ALTER TABLE expense_records ADD COLUMN provider_id BIGINT REFERENCES providers(id);
ALTER TABLE church_transactions ADD COLUMN provider_id BIGINT REFERENCES providers(id);
```

**Migration Strategy**:
- `provider_id` is NULLABLE (allows gradual migration)
- Legacy `provider` (TEXT) field retained
- New transactions should use `provider_id` exclusively

---

### RLS Policies

```sql
-- View: All transaction creators
CREATE POLICY "Transaction creators can view providers"
ON providers FOR SELECT
USING (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Create: All transaction creators
CREATE POLICY "Transaction creators can create providers"
ON providers FOR INSERT
WITH CHECK (
  app_current_user_role() IN ('admin', 'treasurer', 'pastor', 'fund_director', 'secretary')
);

-- Update: Only admin/treasurer
CREATE POLICY "Only admin/treasurer can update providers"
ON providers FOR UPDATE
USING (app_current_user_role() IN ('admin', 'treasurer'));

-- Delete: Only admin/treasurer (soft delete)
CREATE POLICY "Only admin/treasurer can delete providers"
ON providers FOR DELETE
USING (app_current_user_role() IN ('admin', 'treasurer'));
```

---

## See Also

### Related Documentation

- **[Monthly Reports Guide](./MONTHLY_REPORTS.md)**: How monthly reports use providers
- **[Fund Events Guide](./FUND_EVENTS.md)**: Event expenses with providers
- **[Transaction Ledger Guide](./TRANSACTION_LEDGER.md)**: How transactions link to providers
- **[Database Schema Reference](../database/SCHEMA_REFERENCE.md)**: Complete schema details
- **[RLS Policies Reference](../database/RLS_POLICIES.md)**: Row-level security details

### Migration History

- **Migration 027**: Initial provider registry creation
- **Migration 028**: Backfill provider_id from legacy text fields

### Related Files

**API Routes**:
- `/src/app/api/providers/route.ts` - Main providers API
- `/src/app/api/providers/search/route.ts` - Search endpoint
- `/src/app/api/providers/check-ruc/route.ts` - RUC validation

**Database Functions**:
- `find_provider_by_ruc(TEXT)` - Find by RUC
- `search_providers(TEXT, TEXT, INT)` - Search with filters

---

**Document End** | For questions or corrections, contact: `administracion@ipupy.org.py`
