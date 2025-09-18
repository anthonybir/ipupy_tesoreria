# ABSD Quick Reference Card
## One Page to Rule Them All

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Anthony Bir System Designs (ABSD) Studio
    "Enterprise power, neighborhood price, family care"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🎯 The 10 Principles (Memory Aid: CONVERSATE)

**C**onversational Architecture - Code tells stories  
**O**ptimistic Defense - Expect success, prepare for chaos  
**N**ormalized (but not crazy) - Practical database design  
**V**isible Complexity - Show work when it matters  
**E**volution Ready - Progressive disclosure of features  
**R**espectful Rebellion - Challenge bad enterprise patterns  
**S**ecurity First - RLS, audit, encrypt  
**A**ccessibility Always - The abuela test  
**T**ypography Hierarchy - If they can't read it, it doesn't exist  
**E**xport Everything - Users own their data  

## 🎨 Visual Identity

### Color Codes (Copy & Paste)
```css
/* Primary Palette */
--absd-authority: #002556;    /* Navy - Trust */
--absd-prosperity: #FFC93B;   /* Gold - Growth */
--absd-wisdom: #6E6A7A;       /* Slate - Balance */

/* Semantic Colors */
--absd-success: #059669;      /* Green */
--absd-warning: #F59E0B;      /* Amber */
--absd-error: #EF4444;        /* Red */
--absd-info: #0EA5E9;         /* Blue */

/* Backgrounds */
--absd-surface: #FFFFFF;      /* White */
--absd-muted: #F9FAFB;        /* Gray 50 */
--absd-subtle: #F3F4F6;       /* Gray 100 */
```

### Typography Scale
```css
Font Stack: 'Inter', system-ui, -apple-system, sans-serif
Headings: 'Plus Jakarta Sans', sans-serif

/* Sizes */
Hero: clamp(2.5rem, 5vw, 4rem)
Title: clamp(1.75rem, 3vw, 2.5rem)  
Heading: clamp(1.25rem, 2vw, 1.75rem)
Body: clamp(0.875rem, 1vw, 1rem)
Small: clamp(0.75rem, 0.875vw, 0.875rem)
```

### Component Classes
```css
/* Buttons */
.absd-btn-primary    /* Navy bg, white text */
.absd-btn-secondary  /* Gold bg, navy text */
.absd-btn-outline    /* Border only */
.absd-btn-ghost      /* No border, hover bg */
.absd-btn-danger     /* Red bg for destructive */

/* Cards */
.absd-card-flat      /* No shadow */
.absd-card-raised    /* Subtle shadow */
.absd-card-floating  /* Prominent shadow */

/* States */
.absd-loading        /* Pulse animation */
.absd-skeleton       /* Shimmer effect */
.absd-disabled       /* Opacity 50% */
```

## 🏗️ Project Structure

```
project-root/
├── app/
│   ├── (public)/         # Unprotected routes
│   ├── (protected)/      # Auth required
│   └── api/              # API routes
├── components/
│   ├── ui/absd/         # ABSD components
│   └── features/        # Business logic
├── lib/
│   ├── api/            # Service layer
│   ├── db/             # Database utilities
│   └── utils/          # Helpers
├── supabase/
│   └── migrations/     # SQL files
└── docs/               # Documentation
```

## 💻 Essential Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run lint            # Check code quality
npm run type-check:fast # Quick TS check

# Database
npm run types:generate  # Update types from Supabase
npm run migrate:up      # Apply migrations
npm run migrate:down    # Rollback

# Testing
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run test:coverage  # Coverage report

# Deployment
git push main          # Auto-deploy to Vercel
npm run deploy:preview # Preview deployment
```

## 🔧 Tech Stack

```yaml
Core:
  - Next.js 15+ (App Router)
  - TypeScript 5 (strict mode)
  - Supabase (PostgreSQL + Auth)
  - Tailwind CSS

UI:
  - Radix UI (accessibility)
  - Lucide React (icons)
  - CVA (variants)

Forms:
  - React Hook Form
  - Zod (validation)

Data:
  - TanStack Query (cache)
  - TanStack Virtual (lists)

Export:
  - jsPDF (PDF generation)
  - ExcelJS (spreadsheets)
```

## 📊 Database Patterns

```sql
-- Every table needs
CREATE TABLE things (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Soft delete
  created_by UUID REFERENCES auth.users,
  organization_id UUID REFERENCES organizations
);

-- Always add
ALTER TABLE things ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON things(organization_id);
CREATE INDEX ON things(created_at);
CREATE TRIGGER audit_things AFTER INSERT OR UPDATE OR DELETE...
```

## 🔒 Security Checklist

```markdown
Before every deployment:
□ RLS enabled on all tables
□ API rate limiting active
□ CORS configured properly
□ Environment variables set
□ Audit logging working
□ Backups configured
□ Error tracking enabled
□ SSL certificates valid
```

## 📈 Performance Targets

```yaml
Metrics:
  First Paint: < 1.2s
  Interactive: < 2.5s
  API Response: < 200ms
  Database Query: < 100ms

Limits:
  Table Rows: 50 (then virtualize)
  Dropdown Items: 100 (then search)
  Export Rows: 10,000 (then batch)
  File Upload: 10MB (then chunk)
```

## 🌍 Localization

```typescript
// Always support
const locales = {
  'es-PY': 'Español (Paraguay)',
  'en-US': 'English (US)',
  'gn-PY': 'Guaraní',  // Optional
};

// Format examples
currency: 'PYG' // ₲ 1.500.000
date: 'dd/MM/yyyy'
phone: '+595 XXX XXX XXX'
```

## 📱 Responsive Breakpoints

```css
/* ABSD Standard Breakpoints */
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Wide desktop */
2xl: 1536px /* Ultra-wide */

/* Mobile-first approach */
@apply sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
```

## 🚀 Deployment Checklist

```yaml
Week 1:
  □ Database schema
  □ Authentication
  □ Basic CRUD
  □ Initial demo

Week 2-3:
  □ Core features
  □ Data import
  □ User training
  □ Bug fixes

Week 4:
  □ Production deploy
  □ Monitoring setup
  □ Documentation
  □ Support handoff
```

## 💰 Pricing Model

```yaml
Discovery: Free (2 meetings max)
Prototype: $500-1500 (Working demo)
MVP: $3000-8000 (Production ready)
Monthly: $200-500 (Support & updates)
Features: Quoted separately
```

## 📞 Support Channels

```yaml
Primary: WhatsApp Business
Backup: Email
Emergency: Phone
Documentation: Loom videos
Updates: GitHub releases
Status: status.projectname.com
```

## 🎓 Training Materials

```yaml
For Developers:
  - Architecture guide
  - API documentation
  - Database schema

For Users:
  - 2-min feature videos
  - PDF quick guides
  - WhatsApp tips

For Owners:
  - Monthly reports
  - ROI metrics
  - Growth recommendations
```

## 🔑 Environment Variables

```bash
# Required (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_GOOGLE_ANALYTICS=
NEXT_PUBLIC_SENTRY_DSN=
```

## 📝 Git Commit Format

```bash
feat: Add payment processing
fix: Resolve login issue
chore: Update dependencies
docs: Add API guide
style: Format code
refactor: Simplify auth flow
test: Add unit tests
perf: Optimize queries
```

## 🎯 Success Metrics

```yaml
Technical:
  - 99.9% uptime
  - < 3s page loads
  - 0 critical bugs
  - 70% test coverage

Business:
  - 50% less manual work
  - 90% user satisfaction
  - ROI within 6 months
  - 5+ referrals yearly
```

## 🏆 The ABSD Promise

```
We build systems that:
✓ Work on bad internet
✓ Make sense to non-techies
✓ Save more than they cost
✓ Get better with age
✓ Make users smile
```

---

## Contact & Credits

**Anthony Bir System Designs Studio**  
📍 Asunción, Paraguay  
🌐 github.com/anthonybir  
📧 [your-email]  
📱 WhatsApp: [your-number]  

*"Paraguayan pragmatism meets Silicon Valley standards"*

---

### Quick Copy Commands

```bash
# New ABSD project
npx create-absd-app my-project

# Clone component library
git clone https://github.com/absd/components

# Install ABSD tools
npm install -g @absd/cli
```

### Emergency Fixes

```sql
-- Fix RLS recursion
DROP POLICY IF EXISTS bad_policy ON table_name;

-- Reset sequences
ALTER SEQUENCE table_id_seq RESTART WITH 1;

-- Clear audit logs (careful!)
TRUNCATE audit.change_log;
```

### Performance Queries

```sql
-- Find slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes ORDER BY idx_scan;

-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;
```

---

**Print this page and keep it handy!**

*Version 1.0 - Updated: 2024*
