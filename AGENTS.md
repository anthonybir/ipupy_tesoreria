# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` hosts the Next.js App Router; route groups such as `admin/`, `funds/`, `reports/`, and `transactions/` map to feature verticals with server actions and RLS-aware loaders.
- `src/components/`, `src/hooks/`, and `src/lib/` provide shared UI, reusable React logic, and Supabase adapters (DB pool, auth context, env validation, rate limiting).
- `src/styles/` and `src/types/` centralize Tailwind tokens and TypeScript contracts; import via the `@/*` alias defined in `tsconfig.json`.
- `public/` contains exported assets (favicons, brand images) served at build time, while `.next/` is disposable output.
- `migrations/` stores ordered SQL files (`NNN_description.sql`) applied to Supabase; keep new migrations additive and documented in `docs/MIGRATION_HISTORY.md`.
- `scripts/` houses Node utilities (`migrate.js`, `check-migrations.js`, `validate-env.js`, postinstall fixes) and `tests/` provides integration smoke scripts; review their headers before running against production data.
- `docs/` is the source of truth for architecture, configuration, and rollout playbooks—update the relevant guide when contracts change.

## Build, Test, and Validation Commands
- `npm install`: install workspace dependencies (Node 20+).
- `npm run dev` / `npm run dev:turbo`: start the App Router dev server (Turbopack optional for large refactors).
- `npm run build` followed by `npm run start`: create and serve an optimized production build locally.
- `npm run lint`: Next.js lint pass (uses `eslint.config.mjs`).
- `npm run lint:strict`: flat ESLint with `--max-warnings 0`; the standard for PRs/CI.
- `npm run typecheck`: `tsc --noEmit` against the strict config (expect failures until backlog is cleared).
- `npm run typecheck:watch`: same as above in watch mode for iterative fixes.
- `npm run validate`: runs `typecheck` and then `lint:strict`; preferred pre-commit check.
- `node scripts/validate-env.js`: confirm required Supabase credentials and JWT secrets.
- `node run-migration.js` or `node scripts/migrate.js`: execute pending SQL migrations once `.env.local` points to the target database.

## TypeScript & ESLint Enforcement
- `tsconfig.json` has `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, and other safety rails—handle nullish/optional data explicitly.
- Only use the `@/*` alias for internal imports; keep shared types in `src/types/` (see `src/types/utils.ts` for branded IDs, guards, and helpers).
- ESLint extends `next/core-web-vitals` and `next/typescript`, then enforces:
  - `@typescript-eslint/no-explicit-any`: error; use `unknown` plus validators.
  - `@typescript-eslint/no-non-null-assertion`: error; prefer guards or `??` fallbacks.
  - `@typescript-eslint/explicit-module-boundary-types`: warn; exported functions need explicit return types.
  - `@typescript-eslint/consistent-type-imports`: error; prefer `import type { Foo } from ...`.
  - `@typescript-eslint/no-unused-vars`: error; prefix intentional discards with `_`.
  - `react-hooks/exhaustive-deps`: warn; reconcile dependency arrays deliberately.
  - `no-console`: warn; only `console.warn` / `console.error` allowed.
  - `eqeqeq`, `no-var`, `prefer-const`: error.
- `@typescript-eslint/no-floating-promises` is disabled only for TanStack Query mutations; still await other promises or handle errors explicitly.
- Read `docs/TYPE_SAFETY_GUIDE.md` before adding new API routes or DB loaders; keep patterns consistent with the documented examples.

## Pre-Commit & CI Automation
- `.husky/pre-commit` calls `lint-staged`:
  - Staged `*.ts`/`*.tsx` files run `eslint --fix` followed by `tsc --noEmit` on the staged set.
  - Commits with remaining lint or type errors are blocked; use `npm run validate` before `git commit` to avoid hook failures.
- GitHub Actions (`.github/workflows/typecheck.yml`) runs `npm run validate` on every push—treat local validation as mandatory.
- Do not bypass hooks (`--no-verify`) unless leadership approves a production hotfix; document any bypass in the PR description.

## Testing Guidelines
- Treat a clean `npm run lint:strict` and `npm run typecheck` as the baseline before opening a PR; note any outstanding violations explicitly.
- With Supabase credentials loaded, run smoke scripts like `node tests/integration/test-connection.js`, `node test-auth.js`, or other `tests/` utilities to verify DB connectivity, auth, and data integrity.
- Manual QA remains critical: start the dev server, authenticate via Google, validate dashboard summaries, church detail flows, and Excel export/import paths.
- Log every manual scenario in the PR description; reviewers rely on this checklist because there is no automated UI coverage yet.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) with focused scopes; include migration IDs or script names when relevant.
- PRs must summarize intent, list manual test evidence (commands, screenshots, or curl output), and call out database, auth, or configuration impacts.
- Update the matching document in `docs/` when you alter contracts (API payloads, schema, RBAC) and link it in the PR notes; reference the type safety guides when changing TypeScript utilities.
- Request reviews from both frontend and data maintainers when changes touch `src/lib/db.ts`, Supabase migrations, or shared UI contracts.

## Security & Configuration Tips
- Never commit `.env*`, Supabase service keys, or real database exports; rely on `.env.example` for placeholders and keep sanitized fixtures in `legacy_data/`.
- JWT secrets must be ≥32 characters; rotate `SUPABASE_SERVICE_KEY` and related credentials before deploying to Vercel.
- Prefer `validate-env.js` and `docs/SECURITY.md` when introducing new settings, and document any required secrets in the PR rollout checklist.
