# Release Notes - Version 2.0.0

**Release Date**: September 21, 2025
**Type**: Major Release
**Status**: Ready for Production

---

## 🚀 Executive Summary

Version 2.0.0 represents a complete overhaul of the IPU Paraguay Treasury Management System, introducing a three-step monthly workflow that mirrors the official paper-based processes while adding digital efficiency and accuracy. This release corrects critical fund allocation calculations and introduces individual fund transaction tracking for complete transparency.

---

## 🎯 Key Features

### 1. Three-Step Monthly Workflow
Streamlined treasury management following the natural flow of church operations:

**Step 1: Worship Records**
- Record all church services with attendance metrics
- Track individual contributions with donor management
- Support for multiple fund types (tithes, offerings, missions, etc.)
- Anonymous offering tracking

**Step 2: Expense Records**
- Categorized expense tracking (utilities, maintenance, supplies)
- Automatic pastoral salary invoice generation
- Provider and invoice number tracking
- Expense validation and reporting

**Step 3: Monthly Summary & Closing**
- Automatic fund distribution calculations
- Zero-balance enforcement
- Individual fund transaction generation
- Monthly period closing with validation

### 2. Donor Registry System
- **Permanent donor records** per church
- **Smart matching** to prevent duplicates
- **CI/RUC validation** for Paraguay
- **Autocomplete search** in contribution forms
- **Historical tracking** across all months

### 3. Corrected Fund Allocation
Fixed critical calculation errors to match official IPU Paraguay rules:

| Fund Type | Previous (Wrong) | Now (Correct) | Destination |
|-----------|-----------------|---------------|-------------|
| Tithes (Diezmos) | 10% of total | 10% of amount | National Fund |
| Offerings (Ofrendas) | 10% of total | 10% of amount | National Fund |
| Missions (Misiones) | 10% of total | 100% of amount | National Fund |
| APY | 10% of total | 100% of amount | National Fund |
| Lazos de Amor | 10% of total | 100% of amount | National Fund |
| Local Funds | 90% of total | 100% of amount | Stays Local |

### 4. Individual Fund Transactions
National treasury now receives detailed, fund-specific transactions:
- Separate transaction for General Fund (10% allocations)
- Individual transactions for each special fund
- Complete audit trail with church attribution
- Real-time fund balance tracking

---

## 📊 Technical Improvements

### Database Enhancements
- New tables: `donors`, `worship_records`, `worship_contributions`, `expense_records`
- Enhanced function: `calculate_monthly_totals` with proper fund allocation
- New function: `find_or_create_donor` for smart donor management
- Migration system for safe database updates

### API Additions
- `/api/worship-records` - Worship service management
- `/api/expense-records` - Expense tracking
- `/api/donors` - Donor registry
- `/api/monthly-ledger` - Monthly calculations and closing

### Frontend Updates
- Three-step workflow UI with progress tracking
- Modal forms for data entry
- Real-time validation and feedback
- Responsive design for mobile treasurers

---

## 🔄 Migration Guide

### For Existing Systems

1. **Apply Database Migrations**
```bash
node apply-migration.js
```

2. **Verify Fund Allocations**
```bash
node test-fund-allocation.js
```

3. **Test Transaction Generation**
```bash
node test-fund-transactions.js
```

### Environment Variables
No new environment variables required. Existing configuration remains compatible.

---

## ⚠️ Breaking Changes

1. **Fund Allocation Logic**: Previous months may show different calculations. The new calculations are correct according to IPU Paraguay official rules.

2. **Transaction Structure**: Individual fund transactions replace single aggregated transactions. Historical data remains but new format applies going forward.

3. **Monthly Closing**: Enforces zero-balance requirement. Months must be properly balanced before closing.

---

## 🐛 Bug Fixes

- Fixed incorrect 10% allocation applied to all funds
- Corrected pastoral salary calculation
- Resolved donor duplicate creation issues
- Fixed month closing validation logic
- Corrected fund transaction attribution

---

## 📈 Performance Improvements

- Indexed donor searches for fast autocomplete
- Optimized monthly calculation queries
- Connection pooling for database operations
- Efficient batch transaction generation

---

## 🔒 Security Updates

- Enhanced JWT validation
- Church-level data isolation
- SQL injection prevention
- Input sanitization improvements

---

## 📝 Documentation Updates

- Complete API reference for new endpoints
- Updated database schema documentation
- New CHANGELOG.md with detailed changes
- Migration and testing guides

---

## 🧪 Testing

### Automated Tests
- Fund allocation verification
- Transaction generation validation
- API endpoint testing
- Database migration tests

### Manual Testing Checklist
- [ ] Create worship records with various fund types
- [ ] Add expenses in different categories
- [ ] Generate pastoral invoice
- [ ] Close monthly period
- [ ] Verify individual fund transactions
- [ ] Check donor autocomplete
- [ ] Test zero-balance enforcement

---

## 👥 Acknowledgments

This release was developed based on direct feedback from IPU Paraguay treasurers and aligned with official manual processes used by churches.

---

## 📞 Support

For questions or issues:
- GitHub Issues: [Report Issue](https://github.com/ipupy/treasury/issues)
- Email: administracion@ipupy.org.py
- Documentation: `/docs` folder

---

## 🚦 Deployment Status

- [x] Development Testing Complete
- [x] Database Migrations Ready
- [x] API Documentation Updated
- [x] Frontend Integration Complete
- [ ] Production Deployment
- [ ] User Training Materials

---

**Note**: This is a major release requiring careful review of fund allocations. Please verify calculations match your manual records before full adoption.