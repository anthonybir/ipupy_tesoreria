# 📚 Documentation Index - IPU PY Tesorería

**Consolidated Documentation Structure** (October 2025)

Welcome to the IPU PY Tesorería documentation. This index provides navigation to all essential project documentation.

> 📦 **Archive**: Historical documentation (audits, migrations, status reports) moved to [`archive/`](./archive/README.md)
> 🎯 **Focus**: 25 essential files for current development

---

## 🚀 Getting Started

### Essential Reading (Start Here)

1. **[README.md](./README.md)** - Project overview & quick start
2. **[QUICK_START.md](./QUICK_START.md)** - Setup guide for developers
3. **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Development patterns & best practices

---

## 🏗️ Core Documentation

### Architecture & System Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture
  - Next.js 15 + Convex + NextAuth v5
  - OIDC bridge integration
  - Real-time subscriptions
  - Deployment architecture

- **[CONVEX_SCHEMA.md](./CONVEX_SCHEMA.md)** - Database schema (TypeScript-first)
  - Document collections
  - Indexes & queries
  - Type safety patterns
  - Legacy ID compatibility

- **[database/README.md](./database/README.md)** - Database guide
  - Document database concepts
  - Query patterns
  - Authorization in code

- **[database/BUSINESS_LOGIC.md](./database/BUSINESS_LOGIC.md)** - Business rules
  - Monthly report workflows
  - Fund event planning
  - Transaction ledger
  - Provider registry

---

## 💻 Development

### Development Guides

- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Development patterns
  - TypeScript strict mode
  - Component patterns
  - API route patterns
  - Convex function patterns

- **[TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md)** - TypeScript patterns
  - Common type errors & fixes
  - Strict mode configuration
  - Type definitions
  - Best practices

- **[COMMON_TASKS.md](./COMMON_TASKS.md)** - How-to guides
  - Adding API routes
  - Creating Convex functions
  - Building UI components
  - Testing features

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues
  - Convex auth errors
  - TypeScript errors
  - Real-time subscription issues
  - Auth issues

### Component Library

- **[COMPONENTS.md](./COMPONENTS.md)** - UI component documentation
  - shadcn/ui components
  - Shared components
  - Feature components
  - Component patterns

### API & Testing

- **[API_REFERENCE.md](./API_REFERENCE.md)** - API documentation
  - Convex functions
  - REST API endpoints
  - Request/response examples

- **[TESTING.md](./TESTING.md)** - Testing guide
  - Manual testing checklist
  - Authorization testing
  - Financial operations testing
  - Browser compatibility

---

## 🔒 Security

- **[SECURITY.md](./SECURITY.md)** - Complete security architecture
  - NextAuth v5 + Google OAuth
  - OIDC bridge for Convex
  - Code-based authorization patterns
  - Role-based access control (6 roles)
  - Audit logging
  - Security best practices

---

## 🚢 Operations

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
  - Convex deployment
  - Vercel deployment
  - Environment variables
  - Rollback procedures

- **[CI_CD.md](./CI_CD.md)** - CI/CD pipeline
  - Pre-commit hooks (Husky)
  - GitHub Actions (planned)
  - Automated testing

- **[MONITORING.md](./MONITORING.md)** - Performance monitoring
  - Core Web Vitals targets
  - Monitoring stack (Vercel, Convex Dashboard)
  - Optimization strategies

- **[DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)** - Backup & recovery
  - RTO/RPO targets
  - Backup strategy
  - Recovery scenarios
  - Escalation procedures

---

## 🎯 Features

- **[features/FUND_EVENTS.md](./features/FUND_EVENTS.md)** - Event budgeting system
  - Budget planning with line items
  - Actual income/expense tracking
  - Treasurer approval workflow
  - Variance analysis

- **[features/MONTHLY_REPORTS.md](./features/MONTHLY_REPORTS.md)** - Financial reports
  - Monthly report submission
  - 10% national fund calculation
  - Bank deposit tracking
  - Report approval workflow

- **[features/TRANSACTION_LEDGER.md](./features/TRANSACTION_LEDGER.md)** - Transaction system
  - Multi-fund accounting
  - Transaction categories
  - Ledger queries
  - Balance tracking

- **[features/PROVIDER_REGISTRY.md](./features/PROVIDER_REGISTRY.md)** - Provider management
  - Centralized provider database
  - RUC validation
  - Automatic deduplication

---

## 📦 Configuration

- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** - Configuration reference
  - Required variables
  - Convex configuration
  - NextAuth configuration
  - Google OAuth setup

---

## 📚 Historical Documentation

### Archive

- **[archive/README.md](./archive/README.md)** - Historical documentation index
  - Audit reports (16 files)
  - Migration docs (14 files)
  - Project status reports (16 files)
  - Convex migration (3 files)
  - Planning docs (4 files)
  - Deployment verification (6 files)
  - Pre-Convex documentation

**Note**: All historical docs preserved in `/docs/archive/` for reference

---

## 📁 Quick Navigation by Role

### 👨‍💻 New Developers

**Start here:**
1. [README.md](./README.md) - Project overview
2. [QUICK_START.md](./QUICK_START.md) - Setup guide
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
4. [CONVEX_SCHEMA.md](./CONVEX_SCHEMA.md) - Data model
5. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Development patterns

### 🔧 Backend Developers

**Focus on:**
1. [CONVEX_SCHEMA.md](./CONVEX_SCHEMA.md) - Schema definitions
2. [SECURITY.md](./SECURITY.md) - Authorization patterns
3. [database/BUSINESS_LOGIC.md](./database/BUSINESS_LOGIC.md) - Workflows
4. [API_REFERENCE.md](./API_REFERENCE.md) - API patterns
5. [COMMON_TASKS.md](./COMMON_TASKS.md) - How-to guides

### 🎨 Frontend Developers

**Focus on:**
1. [COMPONENTS.md](./COMPONENTS.md) - UI components
2. [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md) - TypeScript patterns
3. [TESTING.md](./TESTING.md) - Testing guide
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

### 🚀 DevOps/SRE

**Focus on:**
1. [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
2. [CI_CD.md](./CI_CD.md) - CI/CD pipeline
3. [MONITORING.md](./MONITORING.md) - Performance monitoring
4. [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) - Backup & recovery
5. [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Configuration

### 🔒 Security Auditors

**Focus on:**
1. [SECURITY.md](./SECURITY.md) - Security architecture
2. [API_REFERENCE.md](./API_REFERENCE.md) - API security
3. [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Configuration security
4. [archive/audits/](./archive/audits/) - Historical audits

---

## 🔍 Quick Reference

### Common Tasks

| Task | Documentation |
|------|---------------|
| **Setup dev environment** | [QUICK_START.md](./QUICK_START.md) |
| **Understand architecture** | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Add new component** | [COMPONENTS.md](./COMPONENTS.md) |
| **Implement authorization** | [SECURITY.md](./SECURITY.md) |
| **Fix TypeScript errors** | [TYPE_SAFETY_GUIDE.md](./TYPE_SAFETY_GUIDE.md) |
| **Deploy to production** | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **Optimize performance** | [MONITORING.md](./MONITORING.md) |
| **Restore from backup** | [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) |
| **Troubleshoot issues** | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |

---

## 📊 Documentation Statistics

**Essential Files**: 25 files
**Archived Files**: ~76 files (preserved in `/docs/archive/`)
**Consolidation Date**: October 2025
**Reduction**: 79% fewer files to maintain (119 → 25)

### Current Structure

| Category | Files | Location |
|----------|-------|----------|
| **Core** | 7 | Root `/docs/` |
| **Getting Started** | 3 | Root `/docs/` |
| **Development** | 4 | Root `/docs/` |
| **Features** | 4 | `/docs/features/` |
| **Operations** | 4 | Root `/docs/` |
| **Database** | 2 | `/docs/database/` |
| **Archive** | 1 | `/docs/archive/` |

---

## 📞 Support

- **Email**: administracion@ipupy.org.py
- **Production**: https://ipupytesoreria.vercel.app

### External Resources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Convex Docs](https://docs.convex.dev)
- [NextAuth Docs](https://authjs.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

---

**Documentation Version**: 3.0 (Consolidated)
**Last Updated**: October 2025
**Maintained by**: IPU PY Development Team
