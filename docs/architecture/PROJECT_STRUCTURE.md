# IPU PY Tesorería - Project Structure

## Overview

This document describes the organized file structure of the IPU PY Treasury Management System after the comprehensive reorganization.

## Directory Structure

```
├── AGENTS.md                    # AI agents configuration (kept in root)
├── CLAUDE.md                   # Claude Code instructions
├── README.md                   # Project documentation
├── LICENSE                     # Project license
├── package.json               # Node.js dependencies and scripts
├── vercel.json               # Vercel deployment configuration
├── .env.local                # Environment variables (local)
├── .gitignore                # Git ignore rules
│
├── src/                      # Source code
│   ├── server.js            # Main Express server
│   ├── api/                 # API endpoints
│   │   ├── auth.js          # Authentication
│   │   ├── churches.js      # Church management
│   │   ├── dashboard.js     # Dashboard data
│   │   ├── reports.js       # Financial reports
│   │   └── ...              # Other API endpoints
│   └── lib/                 # Shared libraries
│       ├── db.js            # Database connection and utilities
│       ├── cors.js          # CORS configuration
│       └── db-supabase.js   # Supabase-specific database functions
│
├── tests/                    # Test files
│   ├── api/                 # API endpoint tests
│   │   └── db-test.js       # Database connection test API
│   ├── integration/         # Integration tests
│   │   ├── test-connection.js   # Database connection test
│   │   ├── test-db.js           # Database functionality test
│   │   └── verify-excel-comparison.js  # Excel import/export verification
│   └── utilities/           # Test utilities
│       └── debug-query.js   # Database query debugging
│
├── scripts/                 # Utility scripts
│   ├── utilities/          # General utility scripts
│   │   ├── add-balances-simple.js    # Balance initialization
│   │   ├── add-initial-balances.js   # Initial balance setup
│   │   └── validate.js               # System validation
│   ├── health-check.js     # System health verification
│   ├── setup-admin.js      # Admin user setup
│   └── ...                 # Other management scripts
│
├── config/                  # Configuration files
│   ├── eslint.config.js    # ESLint configuration
│   ├── jsconfig.json       # JavaScript project configuration
│   ├── vercel.json         # Vercel deployment config (copy)
│   └── .mcp.json           # MCP server configuration
│
├── docs/                    # Documentation
│   ├── architecture/       # Technical documentation
│   │   ├── PROJECT_STRUCTURE.md           # This file
│   │   └── DUAL_LEVEL_ACCOUNTING_IMPLEMENTATION.md  # Accounting system docs
│   ├── deployment/         # Deployment guides
│   │   ├── DEPLOYMENT.md   # Main deployment guide
│   │   └── DEPLOYMENT_SUMMARY.md  # Deployment summary
│   └── planning/           # Project planning
│       ├── CLEANUP_PLAN.md    # Cleanup documentation
│       └── CODEX_CONFIG_STATUS.md  # Configuration status
│
├── data/                    # Data files
│   ├── databases/          # Database files
│   │   └── ipupy_treasurer.db  # SQLite database (moved from root)
│   └── legacy_data/        # Legacy data files
│
├── public/                  # Static web assets
│   ├── index.html          # Main dashboard
│   ├── app.html            # Web application
│   ├── church-accounting.html  # Church accounting interface
│   ├── css/                # Stylesheets
│   ├── js/                 # JavaScript files
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
│
├── migrations/             # Database migrations
│   ├── 000_migration_history.sql      # Migration tracking
│   ├── 001_initial_schema.sql         # Initial database schema
│   ├── 002_member_management.sql      # Member management features
│   ├── 003_analytics_tables.sql       # Analytics functionality
│   ├── 004_seed_data.sql              # Initial data
│   └── 005_dual_level_accounting_enhancement.sql  # Accounting enhancements
│
└── archive/                # Archived files
    └── legacy-versions/    # Previous versions
```

## Key Changes Made

### 1. **Source Code Organization**
- Moved `server.js` to `src/server.js`
- Moved `api/` directory to `src/api/`
- Moved `lib/` directory to `src/lib/`

### 2. **Test Organization**
- Created `tests/` directory with subdirectories:
  - `tests/api/` for API endpoint tests
  - `tests/integration/` for integration tests
  - `tests/utilities/` for test utilities

### 3. **Script Organization**
- Created `scripts/utilities/` for utility scripts
- Kept existing scripts in main `scripts/` directory

### 4. **Documentation Organization**
- Created `docs/` with categorized subdirectories:
  - `docs/architecture/` for technical documentation
  - `docs/deployment/` for deployment guides
  - `docs/planning/` for project planning documents

### 5. **Configuration Organization**
- Moved configuration files to `config/` directory
- Kept `vercel.json` copy in root (required by Vercel)

### 6. **Data Organization**
- Created `data/databases/` for database files
- Moved SQLite database from root to organized location

## Updated Scripts

The `package.json` has been updated with new script paths:

```json
{
  "scripts": {
    "dev": "node src/server.js",
    "start": "node src/server.js",
    "test:connection": "node tests/integration/test-connection.js",
    "test:db": "node tests/integration/test-db.js",
    "validate": "node scripts/utilities/validate.js",
    "lint": "eslint . --ext .js --config config/eslint.config.js"
  }
}
```

## Benefits of This Organization

1. **Clear Separation of Concerns**: Source code, tests, documentation, and configuration are clearly separated
2. **Professional Structure**: Follows industry best practices for Node.js projects
3. **Easier Navigation**: Developers can quickly find what they need
4. **Better Maintainability**: Organized structure makes the project easier to maintain
5. **Scalability**: Structure can easily accommodate new features and components

## Special Files

- **AGENTS.md**: Kept in root as requested for AI agent configuration
- **vercel.json**: Maintained in both `config/` and root (Vercel requirement)
- **package.json**: Updated with new script paths
- **.gitignore**: Updated to reflect new structure

This organization transforms the previously cluttered codebase into a professional, maintainable project structure.