# Pre-Commit Hooks Guide

## Overview

This repository uses **Husky** and **lint-staged** to enforce code quality and type safety **before commits are created**.

## What Runs on Commit

When you run `git commit`, the following checks run automatically:

### 1. ESLint Auto-Fix (on staged files only)
```bash
eslint <staged-files> --fix --max-warnings 0
```
- Auto-fixes formatting issues
- Enforces zero warnings
- **Blocks commit** if unfixable warnings exist

### 2. TypeScript Type Check (entire project)
```bash
tsc --noEmit
```
- Checks all TypeScript files for type errors
- **Blocks commit** if any type errors exist
- Runs on entire project (not just staged files)

## Example Workflow

```bash
# 1. Make changes to files
vim src/components/Example.tsx

# 2. Stage changes
git add src/components/Example.tsx

# 3. Attempt commit
git commit -m "feat: add example component"

# Pre-commit hook runs automatically:
# ✅ ESLint fixes and validates staged files
# ✅ TypeScript checks entire project
# ✅ Commit succeeds if all checks pass

# If checks fail:
# ❌ Commit is blocked
# ❌ Error messages show what needs fixing
# ❌ Files remain staged but uncommitted
```

## Common Scenarios

### Scenario 1: ESLint Warnings

```bash
$ git commit -m "feat: add feature"

⚠ Running lint-staged...
❯ *.{ts,tsx}
  ✖ eslint --fix --max-warnings 0
    Error: 2 warnings found

src/components/Example.tsx
  12:7  warning  Missing return type  @typescript-eslint/explicit-module-boundary-types
  25:3  warning  Unused variable 'x'  @typescript-eslint/no-unused-vars

✖ lint-staged failed
```

**Fix:** Address the ESLint warnings, then commit again.

### Scenario 2: TypeScript Errors

```bash
$ git commit -m "feat: add feature"

⚠ Running lint-staged...
❯ *.{ts,tsx}
  ✅ eslint --fix --max-warnings 0
  ✖ tsc --noEmit

src/types/example.ts:15:12
  error TS2322: Type 'string' is not assignable to type 'number'

✖ lint-staged failed
```

**Fix:** Resolve the TypeScript error, then commit again.

### Scenario 3: All Checks Pass

```bash
$ git commit -m "feat: add feature"

✔ Running lint-staged...
✔ Running TypeScript type check...

[main abc1234] feat: add feature
 1 file changed, 10 insertions(+)
```

**Success!** Commit is created.

## Bypassing Hooks (NOT RECOMMENDED)

In emergency situations only:

```bash
git commit --no-verify -m "emergency fix"
```

⚠️ **WARNING:** This bypasses all checks and may introduce bugs. Use sparingly.

## Disabling Hooks Temporarily

If you need to disable hooks for development:

```bash
# Temporarily disable
export HUSKY=0

# Re-enable (close terminal or unset)
unset HUSKY
```

## Troubleshooting

### "command not found: husky"

**Solution:** Reinstall dependencies
```bash
npm install
```

### "lint-staged: command not found"

**Solution:** Reinstall dev dependencies
```bash
npm install -D lint-staged
```

### Hook doesn't run

**Solution:** Ensure hook is executable
```bash
chmod +x .husky/pre-commit
```

### Hook runs but doesn't validate

**Solution:** Check lint-staged.config.js exists
```bash
cat lint-staged.config.js
```

## Manual Validation

You can run the same checks manually:

```bash
# Check TypeScript
npm run typecheck

# Check ESLint (strict)
npm run lint:strict

# Run both
npm run validate
```

## Configuration Files

- `.husky/pre-commit` - Hook script
- `lint-staged.config.js` - What runs on staged files
- `package.json` - Scripts configuration

## More Information

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/lint-staged/lint-staged)
- [Project Type Safety Guide](../docs/TYPE_SAFETY_GUIDE.md)
