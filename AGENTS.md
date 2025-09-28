# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` hosts the Next.js App Router; route groups such as `admin/`, `funds/`, `reports/`, and `transactions/` map to feature verticals with server actions and RLS-aware loaders.
- `src/components/`, `src/hooks/`, and `src/lib/` provide shared UI, reusable React logic, and Supabase adapters (DB pool, auth context, env validation, rate limiting).
- `src/styles/` and `src/types/` centralize Tailwind tokens and TypeScript contracts; import via the `@/*` alias defined in `tsconfig.json`.
- `public/` contains exported assets (favicons, brand images) served at build time, while `.next/` is disposable output.
- `migrations/` stores ordered SQL files (`NNN_description.sql`) applied to Supabase; keep new migrations additive and documented in `docs/MIGRATION_HISTORY.md`.
- `scripts/` houses Node utilities (`migrate.js`, `check-migrations.js`, `validate-env.js`, data import fixes) and `tests/` provides integration smoke scripts; review their headers before running against production data.
- `docs/` is the source of truth for architecture, configuration, and rollout playbooks—update the relevant guide when contracts change.

## Build, Test, and Development Commands
- `npm install`: install workspace dependencies (Node 20+).
- `npm run dev` / `npm run dev:turbo`: start the App Router dev server (Turbopack optional for large refactors).
- `npm run build` followed by `npm run start`: create and serve an optimized production build locally.
- `npm run lint`: run Next.js/TypeScript ESLint rules; required before submitting a PR.
- `node scripts/validate-env.js`: confirm required Supabase credentials and JWT secrets.
- `node run-migration.js` or `node scripts/migrate.js`: execute pending SQL migrations once `.env.local` points to the target database.

## Coding Style & Naming Conventions
- TypeScript modules use named exports with 2-space indentation; React components and hooks follow `PascalCase` and `useCamelCase` naming.
- Server utilities in `src/lib/` stay camelCase; migration files and route segments use kebab-case (`providers-table`, `fund-director`).
- Tailwind utilities live in component files; keep shared tokens in `src/styles/variables.css` and prefer shadcn/ui primitives.
- Run `npm run lint` or the workspace formatter before committing—ESLint enforces Next core-web-vitals and TypeScript strictness.

## Testing Guidelines
- Linting is the enforced baseline; treat a clean `npm run lint` as mandatory CI parity.
- With Supabase credentials loaded, run smoke scripts like `node tests/integration/test-connection.js` or `node test-auth.js` to verify DB connectivity, auth, and data integrity.
- Manual QA remains critical: start the dev server, authenticate via Google, validate dashboard summaries, church detail flows, and Excel export/import paths.
- Log every manual scenario in the PR description; there is no automated coverage requirement yet, so reviewers rely on this checklist.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) with focused scopes; include migration IDs or script names when relevant.
- PRs must summarize intent, list manual test evidence (commands, screenshots, or curl output), and call out database, auth, or configuration impacts.
- Update the matching document in `docs/` when you alter contracts (API payloads, schema, RBAC) and link it in the PR notes.
- Request reviews from both frontend and data maintainers when changes touch `src/lib/db.ts`, Supabase migrations, or shared UI contracts.

## Security & Configuration Tips
- Never commit `.env*`, Supabase service keys, or real database exports; rely on `.env.example` for placeholders and keep sanitized fixtures in `legacy_data/`.
- JWT secrets must be ≥32 characters; rotate `SUPABASE_SERVICE_KEY` and related credentials before deploying to Vercel.
- Prefer `validate-env.js` and `docs/SECURITY.md` when introducing new settings, and document any required secrets in the PR rollout checklist.
