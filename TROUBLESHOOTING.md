# 🔧 Troubleshooting Guide - IPU PY Tesorería

This document chronicles all issues encountered and their solutions during the development and deployment of the IPU PY Treasury system.

## 📋 Table of Contents
- [Vercel Deployment Issues](#vercel-deployment-issues)
- [Database Connection Problems](#database-connection-problems)
- [Authentication & OAuth Issues](#authentication--oauth-issues)
- [Build Pipeline Problems](#build-pipeline-problems)
- [Architecture Changes](#architecture-changes)

---

## 🚀 Vercel Deployment Issues

### Issue 1: Vercel Function Limit Exceeded
**Problem**: Vercel Hobby plan only allows 12 serverless functions, but our project had more endpoints.

**Symptoms**:
- Deployment failures with function count exceeded errors
- Some API endpoints returning 404 errors after deployment

**Solution**: API Endpoint Consolidation
```javascript
// Before: Multiple separate files
api/funds.js
api/transactions.js
api/church-transactions.js
api/import.js
api/export.js

// After: Consolidated into fewer files
api/financial.js     // Combined funds + transactions + church-transactions
api/data.js          // Combined import + export
```

**Files Modified**:
- Created `api/financial.js` to handle all financial operations
- Created `api/data.js` to handle import/export operations
- Updated frontend API calls to use new consolidated endpoints
- Updated `src/server.js` routing configuration

---

## 🗄️ Database Connection Problems

### Issue 2: Connection Pool Exhaustion
**Problem**: Database connections were not being properly managed, leading to pool exhaustion.

**Symptoms**:
- Multiple database pools being created simultaneously
- Connections remaining open without proper cleanup
- Inconsistent database connection behavior

**Root Cause**:
- `api/dashboard.js` and `api/fund-movements.js` were creating their own database pools instead of using the shared connection
- Poor pool singleton pattern implementation

**Solution**: Fixed Database Pool Management
```javascript
// Wrong approach (created separate pools)
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Correct approach (use shared pool)
const { execute } = require('../lib/db');
```

**Files Modified**:
- Fixed `api/dashboard.js` to use shared pool via `require('../lib/db')`
- Fixed `api/fund-movements.js` to use shared pool
- Ensured all API endpoints use centralized database connection

### Issue 3: Database Connection Timeouts
**Problem**: "Connection terminated due to connection timeout" errors in production and development.

**Symptoms**:
```
Error: Connection terminated due to connection timeout
    at /node_modules/pg-pool/index.js:45:11
Error: Connection terminated unexpectedly
```

**Root Cause**:
- Stale database connections in serverless environment
- No automatic pool recovery mechanism
- No retry logic for failed connections

**Solution**: Comprehensive Pool Recovery System

Implemented in `lib/db-supabase.js`:

#### 1. Pool Health Monitoring
```javascript
let pool;
let poolCreatedAt;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;
const POOL_MAX_AGE = 30 * 60 * 1000; // 30 minutes

const shouldRecreatePool = () => {
  if (!pool) return false;
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) return true;
  if (Date.now() - poolCreatedAt > POOL_MAX_AGE) return true;
  if (pool.totalCount === 0 && pool.idleCount === 0) return true;
  return false;
};
```

#### 2. Automatic Pool Recreation
```javascript
const destroyPool = async () => {
  if (pool) {
    try {
      console.log('Destroying pool...');
      await pool.end();
    } catch (err) {
      console.error('Error ending pool:', err);
    }
    pool = null;
    poolCreatedAt = null;
  }
};
```

#### 3. Enhanced Error Classification
```javascript
const isConnectionError = (error) => {
  const connectionErrors = [
    'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT',
    'Connection terminated', 'Client has encountered a connection error',
    'terminating connection due to administrator command',
    'SSL connection has been closed unexpectedly',
    'Connection terminated unexpectedly'
  ];
  return connectionErrors.some(msg =>
    error.message?.includes(msg) || error.code === msg
  );
};
```

#### 4. Retry Logic with Exponential Backoff
```javascript
const execute = async (statement, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Force pool recreation if needed
      if (shouldRecreatePool()) {
        await destroyPool();
      }

      // Add timeouts for both connection and queries
      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Pool connect timeout')), 8000)
        )
      ]);

      const result = await Promise.race([
        client.query(text, boundParams),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 30000)
        )
      ]);

      // Success - reset error count
      consecutiveErrors = 0;
      return result;

    } catch (error) {
      consecutiveErrors++;

      if (attempt === retries) {
        // Final attempt failed - force cleanup
        consecutiveErrors = MAX_CONSECUTIVE_ERRORS;
        await destroyPool();
        throw error;
      }

      // Retry with exponential backoff
      const delay = attempt * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      if (isConnectionError(error)) {
        await destroyPool();
      }
    }
  }
};
```

#### 5. Graceful Shutdown Handlers
```javascript
const handleShutdown = async (signal) => {
  console.log(`${signal} received, closing database pool...`);
  await destroyPool();
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
```

**Result**: Eliminated all connection timeout errors and provided robust database connectivity.

---

## 🔐 Authentication & OAuth Issues

### Issue 4: Google OAuth Timeout (10 seconds)
**Problem**: Google OAuth authentication was timing out after 10 seconds in Vercel serverless functions.

**Symptoms**:
- OAuth token verification succeeded
- User creation/update succeeded
- Response never sent to client
- Vercel function timeout after 10 seconds

**Root Cause**: Missing `return` statements before response calls in serverless functions.

**Solution**: Added `return` statements to all response handlers
```javascript
// Before (wrong)
res.json({ message: 'Success', token });

// After (correct)
return res.json({ message: 'Success', token });
```

**Files Modified**: `api/auth.js`
- Added `return` before all `res.json()` calls
- Added `return` before all `res.status().json()` calls
- Fixed all response handlers in handleLogin, handleRegister, handleVerify, handleInit, handleGoogleAuth

### Issue 5: Double Client Release Error
**Problem**: Pool error handler was trying to release clients that were already released.

**Symptoms**:
```
Error: Release called on client which has already been released to the pool.
```

**Solution**: Added safety check in pool error handler
```javascript
const handlePoolError = (err, client) => {
  console.error('Unexpected pool error:', err);
  consecutiveErrors++;

  // Release only if not already released
  if (client && !client._released) {
    try {
      client.release();
    } catch (releaseError) {
      console.warn('Client already released:', releaseError.message);
    }
  }
};
```

---

## 🔨 Build Pipeline Problems

### Issue 6: Validation Script Path Errors
**Problem**: Build validation script failed because it was looking for files in old locations.

**Symptoms**:
```
Error: ENOENT: no such file or directory, open '/vercel/path0/src/lib/db-supabase.js'
```

**Root Cause**: After cleaning up duplicate files, validation script still referenced old paths.

**Solution**: Updated validation script paths
```javascript
// Before (wrong paths)
const dbContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'lib', 'db.js'), 'utf8');
const dbSupabaseContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'lib', 'db-supabase.js'), 'utf8');

// After (correct paths)
const dbContent = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'db.js'), 'utf8');
const dbSupabaseContent = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'db-supabase.js'), 'utf8');
```

**Files Modified**: `scripts/utilities/validate.js`

---

## 🏗️ Architecture Changes

### Issue 7: Database Schema Mismatch
**Problem**: Dashboard queries were failing with "column 'tithes' does not exist".

**Symptoms**:
```
error: column "tithes" does not exist
```

**Root Cause**: SQL queries were using English column names, but database schema uses Spanish column names.

**Solution**: Updated column names in dashboard queries
```javascript
// Before (English column names)
COALESCE(SUM(tithes), 0) as total_tithes,
COALESCE(SUM(offerings), 0) as total_offerings,

// After (Spanish column names matching database schema)
COALESCE(SUM(diezmos), 0) as total_tithes,
COALESCE(SUM(ofrendas), 0) as total_offerings,
```

**Files Modified**: `api/dashboard.js`

### Issue 8: Duplicate Database Files
**Problem**: Multiple versions of database connection files caused confusion and import errors.

**Files Cleaned Up**:
- Removed duplicate `src/lib/db-supabase.js`
- Kept main `lib/db-supabase.js` with enhanced pool recovery
- Created backup `lib/db-supabase.js.backup`
- Updated all script imports to use correct paths

**Scripts Updated**:
- `scripts/import-reports-as-transactions.js`
- `scripts/initialize-church-accounts.js`
- `scripts/check-churches.js`

---

## 📊 Performance Improvements

### Enhanced Logging and Monitoring
Added comprehensive logging throughout the pool recovery system:

```javascript
console.log(`✅ Database query successful (attempt ${attempt})`);
console.error(`❌ Database error (attempt ${attempt}/${retries}):`, {
  message: error.message,
  code: error.code,
  consecutiveErrors
});
console.log(`🔄 Destroying pool before retry (connection/timeout error)`);
console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
console.error(`🚨 All ${retries} attempts failed, forcing pool cleanup`);
```

### Pool Statistics for Debugging
```javascript
const getPoolStats = () => ({
  total: pool?.totalCount || 0,
  idle: pool?.idleCount || 0,
  waiting: pool?.waitingCount || 0,
  age: poolCreatedAt ? Date.now() - poolCreatedAt : 0,
  errors: consecutiveErrors,
  exists: !!pool
});
```

---

## 📈 Success Metrics

### Before Fixes:
- ❌ Connection timeout errors every few requests
- ❌ OAuth timeouts after 10 seconds
- ❌ Build failures due to function limits
- ❌ Inconsistent database connectivity

### After Fixes:
- ✅ Zero connection timeout errors
- ✅ Fast OAuth responses (< 1 second)
- ✅ Successful Vercel deployments
- ✅ Robust database connectivity with automatic recovery
- ✅ Comprehensive error handling and retry logic
- ✅ Clear logging for debugging

---

## 🔄 Deployment Process

### Final Working Architecture:
1. **Database Layer**: `lib/db-supabase.js` with comprehensive pool recovery
2. **API Layer**: Consolidated endpoints with proper error handling
3. **Authentication**: Fixed OAuth with proper response handling
4. **Build Pipeline**: Validated file structure and dependencies
5. **Monitoring**: Enhanced logging and debugging capabilities

### Key Lessons Learned:
1. **Serverless functions require explicit `return` statements**
2. **Database pool management is critical in serverless environments**
3. **Retry logic with exponential backoff improves reliability**
4. **Centralized database connections prevent pool exhaustion**
5. **Comprehensive error classification enables better recovery**
6. **Validation scripts must be kept in sync with file structure changes**

---

## 🔧 Quick Reference

### Database Connection Issues:
```bash
# Check pool statistics
npm run check-db-stats

# Test database connectivity
npm run test-db

# View enhanced logs
npm run dev  # Look for ✅❌🔄⏳🚨 emoji indicators
```

### Authentication Issues:
```bash
# Test OAuth flow
curl -X POST http://localhost:3000/api/auth?action=google
```

### Build Issues:
```bash
# Run validation
npm run validate

# Check for missing files
npm run prebuild
```

This comprehensive troubleshooting guide should help prevent and resolve similar issues in the future.