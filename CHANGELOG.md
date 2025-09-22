# CHANGELOG

## [2.0.0] - 2025-09-21

### Major Release: Treasury Management System Overhaul

This release introduces comprehensive treasury management capabilities with proper fund allocation, donor tracking, and financial reporting aligned with IPU Paraguay's official processes.

---

## 🎯 Core Features Implemented

### 1. Three-Step Monthly Workflow System
Complete implementation of the treasurer's monthly workflow:
- **Step 1: Worship Records** - Record all church services with attendance and contributions
- **Step 2: Expense Records** - Track all church expenses and generate pastor invoices
- **Step 3: Monthly Summary** - Review, balance, and close the monthly period

### 2. Permanent Donor Registry System
- Centralized donor management per church
- Automatic donor creation and matching
- CI/RUC validation and duplicate prevention
- Donor autocomplete in contribution forms
- Historical donor tracking across months

### 3. National Fund Allocation System
Implemented correct fund distribution rules matching official IPU Paraguay forms:
- **10% to National Fund**: Tithes (Diezmos) and Regular Offerings (Ofrendas)
- **100% to National Fund**: Special Mission Funds
  - Misiones (Mission Offerings)
  - Lazos de Amor (Love Bonds)
  - Misión Posible (Mission Possible)
  - APY (Pentecostal Youth Association)
  - Instituto Bíblico (Bible Institute)
  - Diezmo Pastoral (Pastoral Tithe)
  - Caballeros (Men's Ministry - when designated for national)
- **100% Local**: Church-designated funds (Damas, Jóvenes, Niños, Anexos, Otros)

### 4. Individual Fund Transaction Generation
National treasury now receives detailed transactions per fund instead of aggregated amounts:
- Separate transactions for General Fund (10% allocations)
- Individual transactions for each special fund (APY, Misiones, etc.)
- Complete transaction history with church attribution
- Balance tracking per national fund

---

## 📁 New Files Added

### API Endpoints
- **`api/worship-records.js`** - Worship service and contribution management
- **`api/expense-records.js`** - Expense tracking and pastoral invoice generation
- **`api/monthly-ledger.js`** - Monthly financial calculations and closing
- **`api/donors.js`** - Donor registry management

### Database Migrations
- **`migrations/013_donor_registry_enhancement.sql`** - Donor system tables and functions
- **`migrations/014_fix_national_fund_allocation.sql`** - Corrected fund allocation rules

### Utility Scripts
- **`apply-migration.js`** - Database migration application script
- **`test-fund-allocation.js`** - Fund allocation verification tests
- **`test-fund-transactions.js`** - Transaction generation verification

---

## 🔧 Modified Files

### Frontend Updates
- **`public/index.html`**
  - Added three-step workflow UI with progress tracking
  - Implemented worship record modal with donor autocomplete
  - Added expense record modal with category selection
  - Enhanced monthly summary with fund distribution display
  - Added pastor invoice generation functionality
  - Implemented data validation and user feedback

### Server Configuration
- **`src/server.js`**
  - Registered new API routes for worship, expenses, and donors
  - Added route ordering for proper request handling
  - Enhanced error handling and logging

### Dashboard Enhancements
- **`api/dashboard.js`**
  - Updated to support new treasury workflow
  - Added monthly status tracking
  - Enhanced reporting capabilities

---

## 💾 Database Schema Changes

### New Tables
1. **`donors`** - Permanent donor registry
   - Links to churches
   - Stores donor information (name, CI/RUC, contact)
   - Tracks creation and updates

2. **`worship_records`** - Church service records
   - Attendance tracking
   - Service type and details
   - Links to contributions

3. **`worship_contributions`** - Individual contribution records
   - Links to donors
   - Fund bucket categorization
   - Amount tracking by type

4. **`expense_records`** - Church expense tracking
   - Category-based organization
   - Provider and invoice details
   - Pastoral salary identification

### New Functions
1. **`find_or_create_donor`** - Smart donor matching and creation
2. **`calculate_monthly_totals`** - Comprehensive monthly calculations with proper fund allocation

### Updated Tables
- **`transactions`** - Now tracks individual fund allocations
- **`funds`** - Properly configured with all IPU Paraguay funds

---

## 🔍 Key Business Logic Changes

### Fund Allocation Rules (CRITICAL)
Previous system allocated 10% of ALL income to national fund. New system correctly implements:

```javascript
// Before (INCORRECT):
National Fund = Total Income * 0.10

// After (CORRECT):
National Fund = (Tithes + Offerings) * 0.10 + Special_Funds * 1.00
Local Funds = (Tithes + Offerings) * 0.90 + Local_Designated_Funds
```

### Transaction Generation
```javascript
// Before: Single aggregated transaction
INSERT INTO transactions (fund: "Fondo Nacional", amount: 1,200,000)

// After: Individual fund transactions
INSERT INTO transactions (fund: "General", amount: 1,100,000)  // 10% of tithes/offerings
INSERT INTO transactions (fund: "Misiones", amount: 50,000)    // 100% of missions
INSERT INTO transactions (fund: "APY", amount: 50,000)         // 100% of APY
```

### Pastoral Salary Calculation
```javascript
// Automatic calculation
Pastoral Salary = Local Available Funds - Total Expenses

// Zero-balance enforcement
Month Balance = Local Funds - Expenses - Pastoral Salary = 0
```

---

## 📊 Data Flow

```
1. WORSHIP RECORDS
   ├── Record church services
   ├── Track attendance
   └── Register contributions → Links to DONORS
       ├── 10% funds (Diezmos, Ofrendas)
       ├── 100% national funds (Misiones, APY, etc.)
       └── Local funds (Damas, Jóvenes, etc.)

2. EXPENSE RECORDS
   ├── Record church expenses
   ├── Categorize spending
   └── Generate pastoral invoice

3. MONTHLY CLOSING
   ├── Calculate fund distributions
   ├── Generate individual fund transactions
   │   ├── General Fund (10% allocation)
   │   ├── Special Funds (100% allocation)
   │   └── Track in national treasury
   ├── Calculate pastoral salary
   └── Balance month (must equal zero)
```

---

## ✅ Testing & Validation

### Test Scripts Created
1. **`test-fund-allocation.js`** - Validates 10% vs 100% allocation logic
2. **`test-fund-transactions.js`** - Verifies individual transaction generation

### Validation Results
- ✅ 10% calculation for tithes/offerings: PASS
- ✅ 100% calculation for special funds: PASS
- ✅ Individual fund transactions: PASS
- ✅ Zero-balance monthly closing: PASS

---

## 🚀 Deployment Notes

### Required Environment Variables
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=production
```

### Migration Application
```bash
# Apply new migrations
node apply-migration.js
```

### Verification Steps
1. Run fund allocation tests: `node test-fund-allocation.js`
2. Verify transaction generation: `node test-fund-transactions.js`
3. Test three-step workflow in UI
4. Confirm donor autocomplete functionality

---

## 📝 API Documentation Updates

### New Endpoints

#### Worship Records
- `GET /api/worship-records` - List worship records for a month
- `POST /api/worship-records` - Create new worship record

#### Expense Records
- `GET /api/expense-records` - List expenses for a month
- `POST /api/expense-records` - Create new expense record

#### Donors
- `GET /api/donors` - Search/list donors for a church
- `POST /api/donors` - Create new donor (rarely used directly)

#### Monthly Ledger
- `GET /api/monthly-ledger` - Get comprehensive monthly calculations
- `POST /api/monthly-ledger/close` - Close monthly period

---

## 🔒 Security Considerations

- All endpoints require JWT authentication
- Church-level data isolation enforced
- Role-based access control (admin vs church users)
- SQL injection prevention via parameterized queries
- Input validation and sanitization

---

## 📈 Performance Improvements

- Indexed donor lookups for fast autocomplete
- Optimized fund calculation queries
- Efficient transaction batch generation
- Connection pooling for database operations

---

## 🐛 Bug Fixes

1. Fixed fund allocation percentages to match manual forms
2. Corrected pastoral salary calculation logic
3. Resolved donor duplicate issues
4. Fixed month closing validation
5. Corrected transaction attribution to specific funds

---

## 📚 Documentation Files to Update

The following documentation should be updated to reflect these changes:
- `README.md` - Add new features and setup instructions
- `docs/API_REFERENCE.md` - Document new endpoints
- `docs/architecture/DATABASE_SCHEMA.md` - Update with new tables
- `CLAUDE.md` - Update with new development context

---

## Next Steps

1. Update frontend to show individual fund transactions
2. Add reporting for national treasurer by fund
3. Implement fund balance tracking over time
4. Add audit trail for all financial operations
5. Create backup and restore procedures

---

*This release represents a major milestone in aligning the digital system with IPU Paraguay's official treasury management processes.*