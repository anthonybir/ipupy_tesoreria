# Documentation Index - IPU PY Tesorería

## 📚 Complete Documentation Map

Welcome to the IPU PY Tesorería documentation. This index provides a complete navigation guide to all project documentation.

> 📌 **Maintainers**: see [`_meta/DOCUMENTATION_STRUCTURE.md`](./_meta/DOCUMENTATION_STRUCTURE.md) for the directory map and upkeep guidelines.

---

## 🚀 Getting Started

### Essential Reading (Start Here)

1. **[README.md](../README.md)** - Project overview, quick start guide
2. **[CLAUDE.md](../CLAUDE.md)** - Development guide for AI assistants
3. **[CONTRIBUTING.md](../CONTRIBUTING.md)** - How to contribute to the project
4. **[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)** - Community guidelines

---

## 🏗️ Architecture & Design

### Design Philosophy

- **[BIRHAUS Principles](../design_philosophy/BIRHAUS_PRINCIPLES.md)** - 10 core design principles
  - Form Serves Flow
  - Honest Data Presentation
  - One Clear Action
  - Progressive Disclosure
  - Undo Over Confirm
  - Accessibility = Dignity
  - Bilingual by Design
  - Performance is UX
  - Consistency via Tokens
  - Auditability & Transparency

- **[BIRHAUS React Patterns](../design_philosophy/BIRHAUS_REACT_PATTERNS.md)** - Practical Next.js/React implementations
  - Component patterns for each principle
  - Server/Client component strategies
  - TypeScript patterns
  - Testing patterns

### Database

- **[Schema Reference](./database/SCHEMA_REFERENCE.md)** - Complete database documentation
  - 45+ tables documented
  - Relationships & foreign keys
  - Indexes & performance
  - Data types & conventions
  - Migration history

- **[RLS Policies](./database/RLS_POLICIES.md)** - Row Level Security documentation
  - Session context system
  - RLS helper functions
  - Policy catalog (all tables)
  - Role permission matrix
  - Security best practices
  - Troubleshooting guide

- **[Business Logic](./database/BUSINESS_LOGIC.md)** - Workflows & data relationships
  - Monthly report submission
  - Fund event planning
  - Transaction ledger
  - Provider registry
  - User management
  - Data integrity rules

---

## 💻 Development

### Component Library

- **[Components Guide](./COMPONENTS.md)** - Complete component documentation
  - UI Foundation (shadcn/ui)
  - Shared components
  - Layout components
  - Feature components
  - Component patterns
  - Styling conventions
  - Testing strategies

### API Documentation

- **[API Reference](./API_REFERENCE.md)** - REST API endpoints *(to be enhanced)*
  - Authentication endpoints
  - Report endpoints
  - Fund endpoints
  - Church endpoints
  - Admin endpoints
  - Request/response examples

### Testing

- **[Testing Strategy](./TESTING.md)** - Comprehensive testing guide
  - Manual testing checklist
  - Authentication & authorization tests
  - RLS testing
  - Financial operations testing
  - Browser compatibility
  - Future automated testing plans

- **[Security Testing](./SECURITY_TESTING.md)** - Security test scenarios
  - Authentication & authorization tests
  - RLS bypass attempts
  - Input validation (SQL injection, XSS)
  - Session security
  - Data exposure tests
  - CSRF & CORS
  - Penetration testing checklist

---

## 🔒 Security

### Security Documentation

- **[Security Audit (Sept 28, 2025)](../SECURITY_AUDIT_2025-09-28.md)** - Latest security audit
- **[RLS Policies](./database/RLS_POLICIES.md)** - Database-level security
- **[Security Testing](./SECURITY_TESTING.md)** - Test scenarios & tools

### Security Fixes

- **RLS Fallback Vulnerability** (Oct 2025) - Fixed in `src/lib/db-context.ts`
  - Changed `app_current_user_role()` default from `'viewer'` to `''`
  - Prevents unauthenticated users from getting viewer-level access

---

## 🚢 Operations

### Deployment & CI/CD

- **[CI/CD Pipeline](./CI_CD.md)** - Continuous integration & deployment
  - Pre-commit hooks (Husky)
  - GitHub Actions (planned)
  - Vercel deployment
  - Environment variables
  - Rollback procedures

### Monitoring & Performance

- **[Performance Monitoring](./MONITORING.md)** - Performance guide
  - Core Web Vitals targets
  - Monitoring stack (Vercel, Supabase)
  - Optimization strategies
  - Database performance
  - Frontend optimization
  - Performance tools

- **[Performance Optimization (Sept 28, 2025)](../PERFORMANCE_OPTIMIZATION_2025-09-28.md)** - Optimization report

### Disaster Recovery

- **[Disaster Recovery Plan](./DISASTER_RECOVERY.md)** - Backup & recovery procedures
  - RTO/RPO targets
  - Backup strategy
  - Recovery scenarios
  - Escalation procedures
  - Communication plan
  - Testing & drills

---

## ♿ Accessibility

- **[Accessibility Restoration Plan](./future-improvements/ACCESSIBILITY_RESTORATION_PLAN.md)** - WCAG 2.1 AA compliance
  - Features removed (Sept 22, 2025)
  - Restoration strategy (3 phases)
  - Screen reader support
  - Keyboard navigation
  - Focus management
  - Testing plan
  - Implementation timeline

---

## 📖 Additional Documentation

### Migration Guides

- **[Migration Guide](../MIGRATION_GUIDE.md)** - Database migration procedures
  - Migration numbering system
  - How to create migrations
  - Testing migrations
  - Rollback procedures

### Type Safety

- **[Type Safety Guide](./development/TYPE_SAFETY_GUIDE.md)** - TypeScript strict mode patterns
  - Common type errors & fixes
  - Strict mode configuration
  - Type definitions
  - Best practices

### Historical Documents

- **[Security Audit (Sept 28, 2025)](../SECURITY_AUDIT_2025-09-28.md)**
- **[Performance Optimization (Sept 28, 2025)](../PERFORMANCE_OPTIMIZATION_2025-09-28.md)**
- **[Fix Logs (various)](../fix_*.md)** - Historical bug fix documentation

---

## 📁 Documentation by Audience

### For New Developers

**Start with:**
1. [README.md](../README.md) - Project overview
2. [CLAUDE.md](../CLAUDE.md) - Development setup
3. [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution workflow
4. [Components Guide](./COMPONENTS.md) - UI library
5. [Database Schema](./database/SCHEMA_REFERENCE.md) - Data model

### For Backend Developers

**Focus on:**
1. [Database Schema](./database/SCHEMA_REFERENCE.md)
2. [RLS Policies](./database/RLS_POLICIES.md)
3. [Business Logic](./database/BUSINESS_LOGIC.md)
4. [API Reference](./API_REFERENCE.md)
5. [Security Testing](./SECURITY_TESTING.md)

### For Frontend Developers

**Focus on:**
1. [Components Guide](./COMPONENTS.md)
2. [BIRHAUS React Patterns](../design_philosophy/BIRHAUS_REACT_PATTERNS.md)
3. [Accessibility Restoration](./future-improvements/ACCESSIBILITY_RESTORATION_PLAN.md)
4. [Performance Monitoring](./MONITORING.md)
5. [Testing Strategy](./TESTING.md)

### For DevOps/SRE

**Focus on:**
1. [CI/CD Pipeline](./CI_CD.md)
2. [Disaster Recovery](./DISASTER_RECOVERY.md)
3. [Performance Monitoring](./MONITORING.md)
4. [Security Testing](./SECURITY_TESTING.md)
5. [Migration Guide](../MIGRATION_GUIDE.md)

### For Security Auditors

**Focus on:**
1. [Security Audit Report](../SECURITY_AUDIT_2025-09-28.md)
2. [RLS Policies](./database/RLS_POLICIES.md)
3. [Security Testing](./SECURITY_TESTING.md)
4. [API Reference](./API_REFERENCE.md)
5. [Code of Conduct](../CODE_OF_CONDUCT.md)

### For Designers/UX

**Focus on:**
1. [BIRHAUS Principles](../design_philosophy/BIRHAUS_PRINCIPLES.md)
2. [BIRHAUS React Patterns](../design_philosophy/BIRHAUS_REACT_PATTERNS.md)
3. [Components Guide](./COMPONENTS.md)
4. [Accessibility Restoration](./future-improvements/ACCESSIBILITY_RESTORATION_PLAN.md)

---

## 🔍 Quick Reference

### Common Tasks

| Task | Documentation |
|------|---------------|
| **Setup dev environment** | [README.md](../README.md), [CLAUDE.md](../CLAUDE.md) |
| **Create database migration** | [Migration Guide](../MIGRATION_GUIDE.md) |
| **Add new component** | [Components Guide](./COMPONENTS.md) |
| **Implement RLS policy** | [RLS Policies](./database/RLS_POLICIES.md) |
| **Fix TypeScript errors** | [Type Safety Guide](./development/TYPE_SAFETY_GUIDE.md) |
| **Deploy to production** | [CI/CD Pipeline](./CI_CD.md) |
| **Investigate security issue** | [Security Testing](./SECURITY_TESTING.md) |
| **Optimize performance** | [Performance Monitoring](./MONITORING.md) |
| **Restore from backup** | [Disaster Recovery](./DISASTER_RECOVERY.md) |
| **Make UI accessible** | [Accessibility Restoration](./future-improvements/ACCESSIBILITY_RESTORATION_PLAN.md) |

### Key Principles

| Principle | Documentation |
|-----------|---------------|
| **Type Safety** | Strict TypeScript mode ([Type Safety Guide](./development/TYPE_SAFETY_GUIDE.md)) |
| **Security** | RLS enforcement ([RLS Policies](./database/RLS_POLICIES.md)) |
| **Performance** | < 2s page load ([Performance Monitoring](./MONITORING.md)) |
| **Accessibility** | WCAG 2.1 AA ([Accessibility Plan](./future-improvements/ACCESSIBILITY_RESTORATION_PLAN.md)) |
| **Design** | BIRHAUS principles ([Design Philosophy](../design_philosophy/BIRHAUS_PRINCIPLES.md)) |

---

## 📊 Documentation Statistics

**Total Documentation Files**: 30+
**Total Lines of Documentation**: ~15,000+
**Last Major Update**: October 2025

### Coverage by Category

| Category | Files | Status |
|----------|-------|--------|
| **Getting Started** | 4 | ✅ Complete |
| **Design Philosophy** | 2 | ✅ Complete |
| **Database** | 3 | ✅ Complete |
| **Development** | 3 | 🟡 API needs enhancement |
| **Security** | 3 | ✅ Complete |
| **Operations** | 4 | ✅ Complete |
| **Accessibility** | 1 | ✅ Complete |
| **Historical** | 10+ | ✅ Archived |

---

## 🔄 Documentation Maintenance

### Update Schedule

- **Weekly**: Fix logs, troubleshooting guides
- **Monthly**: API reference, component guide
- **Quarterly**: Security audit, performance review
- **Annually**: Architecture review, major updates

### Contributing to Documentation

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Documentation standards
- Markdown formatting
- Code example guidelines
- Review process

### Reporting Issues

Found an error or gap in documentation?
1. Check if it's already documented
2. Create GitHub issue with `documentation` label
3. Tag with specific area (database, security, etc.)
4. Provide specific page/section reference

---

## 📞 Support & Resources

### Internal Resources

- **Technical Lead**: Anthony Birhouse
- **Email**: administracion@ipupy.org.py
- **Repository**: [GitHub](https://github.com/ipupy/tesoreria) *(if applicable)*

### External Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TanStack Query](https://tanstack.com/query)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Documentation Version**: 2.0
**Last Updated**: October 2025
**Maintained by**: Development Team
