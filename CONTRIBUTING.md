# Contributing to IPU PY Tesorería

Thank you for your interest in contributing to IPU PY Tesorería! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Security](#security)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

- **Node.js**: >=20.0.0
- **npm**: Latest version
- **Supabase Account**: For database access
- **Git**: For version control

### Initial Setup

1. **Fork the repository**
   ```bash
   gh repo fork anthonybir/ipupy_tesoreria
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ipupy_tesoreria.git
   cd ipupy_tesoreria
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/fund-events-approval`)
- `fix/` - Bug fixes (e.g., `fix/rls-policy-church-isolation`)
- `docs/` - Documentation updates (e.g., `docs/api-reference-enhancement`)
- `refactor/` - Code refactoring (e.g., `refactor/database-helpers`)
- `test/` - Adding tests (e.g., `test/rls-policies`)

### Commit Message Format

Follow conventional commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(reports): add manual report creation for fund directors

fix(rls): correct church_id context setting for fund_director role

docs(database): add comprehensive schema reference with ER diagrams
```

### Pre-commit Hooks

The project uses **Husky** for pre-commit hooks that enforce:

1. **TypeScript Compilation**: `npx tsc --noEmit`
2. **ESLint Zero Warnings**: `npm run lint:strict`
3. **Type Safety**: Strict mode enforcement

**Important**: Your commit will be blocked if:
- TypeScript has compilation errors
- ESLint warnings exist
- Type safety violations detected

## Coding Standards

### TypeScript

**Strict Mode Required** - All TypeScript must pass strict mode:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

**Best Practices:**
- ✅ Always provide explicit types for function parameters and return values
- ✅ Use `type` for object shapes, `interface` for contracts
- ✅ Use optional chaining (`?.`) for nullable data from external sources
- ✅ Define proper types in `src/types/` for database models
- ❌ Never use `any` without explicit `// TODO(type-cleanup)` comment
- ❌ Never disable strict checks with `@ts-ignore` or `@ts-expect-error`

### React/Next.js

**Component Patterns:**
```typescript
// ✅ Preferred pattern
import type { FC } from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  loading,
  children
}) => {
  // Implementation
};
```

**Server Components (default):**
- Use server components by default
- Mark client components with `'use client'` directive
- Never import server-only code in client components

**Data Fetching:**
- Use `executeWithContext()` for all database queries (RLS enforcement)
- TanStack Query for client-side state management
- Server-side data fetching in Server Components

### Database Operations

**CRITICAL**: Always use RLS context:

```typescript
// ✅ CORRECT
import { executeWithContext } from '@/lib/db';

const result = await executeWithContext(auth, `
  SELECT * FROM monthly_reports WHERE church_id = $1
`, [churchId]);

// ❌ WRONG - Bypasses RLS
import pool from '@/lib/pool';
const result = await pool.query('SELECT * FROM monthly_reports');
```

**SQL Injection Prevention:**
- ✅ Always use parameterized queries (`$1`, `$2`, etc.)
- ❌ Never use string concatenation in SQL

### Styling

**Tailwind CSS 4 + Design Tokens:**
```tsx
// ✅ Use design tokens
<button className="bg-[var(--absd-authority)] text-white">
  Primary Button
</button>

// ✅ Use ABSD grid system
<div className="absd-grid">
  <div className="absd-span-standard">
    {/* Content */}
  </div>
</div>

// ⚠️ Avoid arbitrary values without tokens
<div className="bg-[#002556]"> {/* Use var(--absd-authority) instead */}
```

### Spanish-First Development

**UI Text**: All user-facing text must be in Spanish (Paraguay)
```typescript
// ✅ Correct
const errorMessage = "Error al guardar el informe";

// ❌ Wrong
const errorMessage = "Error saving report";
```

**Code Internals**: English for variable names, comments can be Spanish/English
```typescript
// ✅ Acceptable
const totalIngresos = calculateTotalIncome(report);

// ✅ Also acceptable
const totalIncome = calculateTotalIncome(report);
```

## Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test the following:

**Authentication:**
- [ ] Login with Google OAuth works
- [ ] Magic link login works
- [ ] Logout clears session
- [ ] Protected routes require authentication

**Authorization:**
- [ ] Admin can access admin routes
- [ ] Church users restricted to their church data
- [ ] Fund directors limited to assigned funds
- [ ] Role hierarchy enforced

**RLS Policies:**
- [ ] Unauthenticated users get no data
- [ ] Cross-church data isolation works
- [ ] Admin bypass functions correctly

### Automated Tests (Future)

When writing tests:
```typescript
// Use RLS-aware test utilities
import { executeWithContext } from '@/lib/db';

test('Member cannot access other church reports', async () => {
  const memberAuth = { userId: 'xxx', role: 'member', churchId: 1 };
  const result = await executeWithContext(memberAuth,
    'SELECT * FROM monthly_reports WHERE church_id = 2'
  );
  expect(result.rows).toHaveLength(0);
});
```

## Documentation

### When to Update Documentation

Update documentation when you:
- Add new API endpoints → Update `docs/API_REFERENCE.md`
- Change database schema → Update `docs/database/SCHEMA_REFERENCE.md`
- Modify RLS policies → Update `docs/database/RLS_POLICIES.md`
- Add new component → Update `docs/COMPONENTS.md`
- Change environment variables → Update `.env.example` and `docs/CONFIGURATION.md`

### Documentation Standards

- Use **Markdown** for all documentation
- Include **code examples** for technical documentation
- Add **Mermaid diagrams** for workflows and architecture
- Keep **CHANGELOG.md** updated for notable changes

## Pull Request Process

### Before Submitting

1. **Sync with main branch**
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-feature-branch
   git rebase main
   ```

2. **Run quality checks**
   ```bash
   npm run typecheck  # TypeScript compilation
   npm run lint:strict  # ESLint with zero warnings
   npm run build  # Production build test
   ```

3. **Test your changes**
   - Manual testing in development
   - Verify affected features still work
   - Check console for errors

### PR Checklist

- [ ] Branch is up to date with main
- [ ] All pre-commit hooks pass
- [ ] TypeScript has zero errors
- [ ] ESLint has zero warnings
- [ ] Changes are tested manually
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated (for notable changes)
- [ ] Commit messages follow conventional commits

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made
- List of specific changes
- Bullet points for clarity

## Testing
How was this tested?
- [ ] Manual testing in development
- [ ] Automated tests added/updated
- [ ] RLS policies verified

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
- [ ] I have tested RLS policies (if database changes)
```

### Review Process

1. **Automated Checks**: GitHub Actions runs TypeScript and ESLint checks
2. **Code Review**: At least one maintainer review required
3. **Security Review**: For changes to RLS policies, auth, or permissions
4. **Testing**: Reviewer verifies functionality
5. **Approval**: PR approved and merged by maintainer

## Security

### Reporting Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email: `administracion@ipupy.org.py`
2. Include: Detailed description, steps to reproduce, potential impact
3. Wait for acknowledgment before public disclosure

### Security Best Practices

When contributing, ensure:
- ✅ All database queries use `executeWithContext()` for RLS
- ✅ No sensitive data in logs or error messages
- ✅ Input validation on all API endpoints
- ✅ Parameterized SQL queries (no string concatenation)
- ✅ CORS properly configured (no wildcards)
- ✅ Environment variables properly secured
- ❌ Never commit `.env` files or secrets
- ❌ Never bypass RLS policies
- ❌ Never expose service role keys to client

## Questions?

- **Documentation**: Check [docs/](docs/) directory
- **Issues**: Search [existing issues](https://github.com/anthonybir/ipupy_tesoreria/issues)
- **Email**: administracion@ipupy.org.py

## License

By contributing to IPU PY Tesorería, you agree that your contributions will be licensed under the project's license.

---

Thank you for contributing to IPU PY Tesorería! 🙏
