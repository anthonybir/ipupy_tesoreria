# Workflow Test Scaffolding

**Status**: SCAFFOLD ONLY - Jest not yet configured
**Created**: 2025-10-05
**Audit Task**: MEDIUM #14

## Overview

This directory contains **scaffolded integration tests** for critical business workflows:

### Workflow Tests (`tests/workflows/`)
1. **report-submission.test.ts** (189 lines) - Monthly report lifecycle
2. **event-approval.test.ts** (243 lines) - Fund event approval workflow
3. **fund-transactions.test.ts** (500 lines) - Fund transfers and transactions

### Security Tests (`tests/security/`)
4. **error-handling.test.ts** (317 lines) - Error handling and security validation (MEDIUM #18)

## Current State

These files are **SCAFFOLDS** - they document the testing approach and expected behavior but are NOT currently executable because:

1. **Jest not configured** - No test framework setup in package.json
2. **Type mismatches** - Test code uses draft interfaces that need alignment with actual types
3. **Missing dependencies** - `@jest/globals` and `@types/jest` not installed

## Purpose

These scaffolds serve as:

- **Documentation** of expected workflow behavior
- **Blueprint** for future test implementation
- **Validation** of all CRITICAL/HIGH audit fixes
- **Reference** for business logic enforcement

## Coverage Documented

### Report Submission (report-submission.test.ts)
- ✅ GENERATED columns (CRITICAL #3, MEDIUM #13)
- ✅ Bank deposit validation (CRITICAL #2)
- ✅ RLS immutability (HIGH #5)
- ✅ Race condition prevention (HIGH #7)
- ✅ Cross-church authorization

### Event Approval (event-approval.test.ts)
- ✅ Authorization (CRITICAL #1 - treasurer cannot approve)
- ✅ Negative balance prevention (CRITICAL #4)
- ✅ Transaction creation (migration 029)
- ✅ fund_movements_enhanced audit trail
- ✅ Budget vs actuals variance

### Fund Transactions (fund-transactions.test.ts)
- ✅ transferFunds() helper (MEDIUM #11)
- ✅ CHECK constraint (MEDIUM #12)
- ✅ FOR UPDATE locking
- ✅ Concurrent transfers
- ✅ InsufficientFundsError
- ✅ Balance integrity

## To Make Executable

1. **Install Jest**:
   ```bash
   npm install --save-dev jest @jest/globals @types/jest ts-jest
   ```

2. **Configure Jest** (jest.config.js):
   ```js
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     moduleNameMapper: {
       '^@/(.*)$': '<rootDir>/src/$1'
     }
   };
   ```

3. **Fix Type Issues**:
   - Replace `church_id` with `churchId` (AuthContext)
   - Replace `sourceTransactionId/destinationTransactionId` with `transferOutId/transferInId` (TransferFundsResult)
   - Add Jest test failure helper or replace `fail()` with `expect(true).toBe(false)`

4. **Add Test Script** (package.json):
   ```json
   "scripts": {
     "test": "jest",
     "test:watch": "jest --watch"
   }
   ```

5. **Setup Test Database**:
   - Create test Supabase project
   - Run all migrations
   - Configure test environment variables

## Next Steps

After completing remaining MEDIUM tasks (#15-18), revisit test implementation as part of continuous improvement.

For now, these scaffolds document **what should be tested** for each workflow, validating that all critical business rules are understood and documented.
