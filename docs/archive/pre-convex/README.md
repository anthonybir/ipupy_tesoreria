# Pre-Convex Architecture Documentation (Archive)

**Archive Date**: October 2025  
**Status**: Historical Reference Only  
**Architecture**: PostgreSQL + Supabase (Deprecated)

---

## Overview

This directory contains documentation from the **PostgreSQL + Supabase era** of IPU PY Tesorería, before the migration to **Convex** (completed in October 2025).

**⚠️ WARNING**: The information in these files is **OBSOLETE** and does not reflect the current system architecture. They are preserved for historical reference only.

---

## Current Architecture (October 2025+)

The system now uses:
- **Backend**: Convex (TypeScript-first serverless backend)
- **Database**: Convex Document Database (not PostgreSQL)
- **Authentication**: NextAuth v5 + Google OAuth + OIDC Bridge (not Supabase Auth)
- **Authorization**: Code-based role checking in Convex functions (not RLS)
- **Real-time**: Convex reactive subscriptions (not Supabase Realtime)

**Current Documentation**: See `/docs/ARCHITECTURE.md` and `/docs/CONVEX_SCHEMA.md`

---

## Archived Files

### Database Documentation

#### `database/RLS_POLICIES.md` (696 lines)
**Original Purpose**: Documented PostgreSQL Row Level Security (RLS) policies  
**Why Archived**: Convex uses code-based authorization, not database-level RLS  
**Replacement**: See `/docs/SECURITY.md` for current authorization patterns

**Key Obsolete Concepts**:
- PostgreSQL session variables (`app.current_user_id`, etc.)
- RLS policy definitions (`CREATE POLICY ...`)
- `executeWithContext()` wrapper for session context
- Database-level security enforcement

#### `database/SCHEMA_REFERENCE.md` (752 lines)
**Original Purpose**: Complete PostgreSQL schema documentation with SQL DDL  
**Why Archived**: Convex uses TypeScript schema definitions, not SQL  
**Replacement**: See `/docs/CONVEX_SCHEMA.md` for current schema

**Key Obsolete Concepts**:
- SQL `CREATE TABLE` statements
- PostgreSQL data types (`BIGSERIAL`, `TIMESTAMPTZ`, etc.)
- Foreign key constraints
- SQL indexes and triggers
- 45+ PostgreSQL tables

### API Documentation

#### `api/ENDPOINTS.md` (282 lines)
**Original Purpose**: REST API documentation with Supabase Auth patterns  
**Why Archived**: API routes now call Convex functions; auth uses NextAuth  
**Replacement**: See `/docs/API_REFERENCE.md` for current API patterns

**Key Obsolete Concepts**:
- `getAuthContext()` from Supabase
- `executeWithContext()` for RLS
- Supabase JWT tokens
- Direct SQL queries in API routes
- Magic Link authentication

---

## Migration Timeline

### Phase 1-3: Foundation (Sept-Oct 2025)
- Convex backend setup
- Schema migration (PostgreSQL → Convex)
- Data migration with ID preservation (`supabase_id` fields)

### Phase 4: Authentication (Oct 2025)
- NextAuth v5 implementation
- Google OAuth integration
- OIDC bridge for Convex
- Removal of Supabase Auth

### Phase 5: API Migration (Oct 2025)
- REST API routes converted to Convex wrappers
- Code-based authorization implementation
- Removal of RLS dependencies

### Phase 6: Cleanup (Oct 2025)
- Documentation rewrite
- Archive creation (this directory)
- Final Supabase removal

**Migration Documentation**: See `/docs/CONVEX_MIGRATION_PLAN.md`

---

## Why These Files Were Archived

### 1. Architectural Mismatch
PostgreSQL and Convex have fundamentally different data models:
- **PostgreSQL**: Relational tables with SQL schemas
- **Convex**: Document collections with TypeScript schemas

### 2. Security Model Change
- **PostgreSQL RLS**: Database-level policies with session variables
- **Convex**: Code-based authorization in each function

### 3. Authentication Change
- **Supabase Auth**: Magic Links + Google OAuth with JWT tokens
- **NextAuth v5**: Google OAuth only with OIDC bridge

### 4. API Pattern Change
- **Before**: Direct SQL queries with RLS context
- **After**: Convex function calls with code-based auth

---

## Using This Archive

### For Historical Research
These files document the original system design and can help understand:
- Why certain design decisions were made
- How data was structured in PostgreSQL
- What security policies existed
- Migration context and rationale

### For Migration Reference
If migrating another system from Supabase to Convex:
- Compare RLS policies to code-based authorization patterns
- See how SQL schemas map to TypeScript definitions
- Understand authentication migration challenges

### ⚠️ Do NOT Use For
- Current development (use `/docs/` instead)
- Production troubleshooting (architecture has changed)
- New feature implementation (patterns are obsolete)
- Security audits (policies no longer apply)

---

## Current Documentation Structure

```
docs/
├── ARCHITECTURE.md          # Current Convex architecture
├── CONVEX_SCHEMA.md         # TypeScript schema definitions
├── SECURITY.md              # Code-based authorization
├── API_REFERENCE.md         # Convex API patterns
├── DEVELOPER_GUIDE.md       # Development with Convex
├── ENVIRONMENT_VARIABLES.md # Convex configuration
└── database/
    └── README.md            # Convex database overview
```

---

## Questions?

**For current architecture**: See `/docs/ARCHITECTURE.md`  
**For migration history**: See `/docs/CONVEX_MIGRATION_PLAN.md`  
**For schema reference**: See `/docs/CONVEX_SCHEMA.md`  
**For security patterns**: See `/docs/SECURITY.md`

**Technical Support**: `administracion@ipupy.org.py`

