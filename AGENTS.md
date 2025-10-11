# Repository Guidelines

Use this guide as the fastest way to stay aligned with the project's expectations.

## Project Structure & Module Organization
- `src/app/` hosts the App Router; route groups like `funds/`, `admin/`, and `transactions/` bundle UI, server actions, and Supabase-aware loaders.
- Shared UI and logic live in `src/components/`, `src/hooks/`, and `src/lib/`; types and Tailwind tokens reside in `src/types/` and `src/styles/`.
- Persisted assets are under `public/`; build artifacts in `.next/` can be discarded.
- Database migrations live in `migrations/` (`NNN_description.sql`) with rollout notes mirrored in `docs/MIGRATION_HISTORY.md`.

## Build, Test, and Development Commands
- `npm run dev` / `npm run dev:turbo` — start the Next.js dev server (Turbopack for heavier refactors).
- `npm run build` followed by `npm run start` — produce and serve the optimized production build.
- `npm run lint` or `npm run lint:strict` — run ESLint; `lint:strict` blocks warnings for CI parity.
- `npm run typecheck` or `npm run validate` — `validate` runs typecheck then strict lint; treat it as the pre-commit default.
- `node scripts/validate-env.js` — confirm Supabase credentials before migrations; `node scripts/migrate.js` applies pending SQL.

## Coding Style & Naming Conventions
- TypeScript uses `strict: true`, `noUncheckedIndexedAccess`, and related safety flags; favor explicit null checks and branded types from `@/types`.
- Only import via the `@/*` alias; prefer `import type` for type-only usages.
- ESLint (flat config with `next/core-web-vitals`) forbids `any`, non-null assertions, unused vars, and non-`const` declarations; allow only `console.warn` / `console.error`.
- Follow existing component naming (`PascalCase` for components, `snake_case` for migrations) and keep comments purposeful and minimal.

## Testing Guidelines
- Ensure `npm run lint:strict` and `npm run typecheck` succeed locally; document any intentional exceptions.
- With Supabase env vars set, leverage smoke scripts in `tests/` (e.g., `node tests/integration/test-connection.js`) to verify DB connectivity.
- Log manual QA steps: start dev server, authenticate via Google, validate dashboards, and test Excel export/import flows.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`); reference migration IDs or scripts when relevant.
- PRs must summarize intent, list manual test evidence, and note DB/auth/config impacts; link updated docs in `docs/` when contracts change.
- Request both frontend and data maintainer reviews when touching shared DB adapters (`src/lib/db.ts`) or migrations.

## Security & Configuration Tips
- Never commit `.env*`, Supabase service keys, or raw database exports; rely on `./.env.example` for placeholders.
- Enforce JWT secrets ≥32 chars and rotate Supabase keys before deployments; capture rollout steps in `docs/SECURITY.md`.
- Run `node scripts/validate-env.js` after adding new settings and document any required secrets in PR checklists.
