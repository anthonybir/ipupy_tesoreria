# WS-6 – Supabase Decommission Plan

**Status:** In Progress (initiated October 10, 2025)

This plan tracks the migration work required to remove the legacy Supabase/Postgres stack and operate IPU PY Tesorería exclusively on Convex. Tasks are grouped by the seven phases defined in `docs/TASK_TRACKER.md`.

---

## Phase 1 – Runtime Ports

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| RT-101 | Migrate `/api/dashboard-init` to Convex | Codex | ✅ Completed Oct 10, 2025 | Replaced Postgres queries with `api.admin.getDashboardStats` |
| RT-102 | Convert `/api/people` REST endpoints to Convex queries/mutations | Codex | ✅ Completed Oct 10, 2025 | Uses `api.admin.listMembers` + mutations |
| RT-103 | Convert `/api/donors` REST endpoints to Convex queries/mutations | Codex | ✅ Completed Oct 10, 2025 | Added families/members/donors schema + Convex donor module |
| RT-104 | Convert `/api/worship-records` REST endpoints to Convex queries/mutations |  | ⏳ Pending | |
| RT-105 | Convert `/api/data` REST endpoints to Convex queries/mutations |  | ⏳ Pending | |
| RT-106 | Convert `/api/financial/fund-movements` REST endpoints to Convex queries/mutations |  | ⏳ Pending | |
| RT-107 | Decommission `src/lib/db.ts`, `db-context.ts`, `db-church.ts` |  | ⏳ Pending | Requires all dependent routes/hooks migrated |

## Phase 2 – Schema Parity

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| SP-201 | Remove hard `supabase_id` requirements from Convex schema |  | ⏳ Pending | Maintain numeric IDs as archival metadata only |
| SP-202 | Update `src/lib/convex-id-mapping.ts` to support Convex-first IDs |  | ⏳ Pending | |
| SP-203 | Refactor UI hooks/components to consume Convex IDs |  | ⏳ Pending | |

## Phase 3 – Auth & Authorization

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| AA-301 | Port fund/church access helpers from Postgres RLS into Convex utilities |  | ⏳ Pending | |
| AA-302 | Remove `setDatabaseContext` usages after Convex parity |  | ⏳ Pending | |
| AA-303 | Delete legacy SQL helper functions once unused |  | ⏳ Pending | |

## Phase 4 – Background Services

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| BG-401 | Finalize Convex cron handlers (`convex/cronHandlers.ts`) |  | ⏳ Pending | Ensure scheduled jobs run in production |
| BG-402 | Wire Convex audit logging (convex/lib/audit.ts) |  | ⏳ Pending | |
| BG-403 | Document production rollout for cron + rate limiter |  | ⏳ Pending | |

## Phase 5 – Documentation & Tooling

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| DT-501 | Update `.env.example` & docs to remove Supabase references |  | ⏳ Pending | |
| DT-502 | Document historical data export workflow (archive) |  | ⏳ Pending | |
| DT-503 | Remove/replace Supabase scripts under `scripts/` |  | ⏳ Pending | |

## Phase 6 – Testing & CI

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| QA-601 | Convert smoke tests to hit Convex endpoints only |  | ⏳ Pending | |
| QA-602 | Update GitHub Actions to drop Supabase prerequisites |  | ⏳ Pending | |
| QA-603 | Add regression coverage for dashboard + fund workflows |  | ⏳ Pending | |

## Phase 7 – Secrets & Cleanup

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| CL-701 | Remove Supabase credentials from Vercel/local envs |  | ⏳ Pending | |
| CL-702 | Uninstall `@supabase/*` and `pg` packages |  | ⏳ Pending | Blocked by RT-107 |
| CL-703 | Delete legacy Supabase files (`src/lib/supabase/`, `db.ts`, etc.) |  | ⏳ Pending | |

---

### Latest Session Notes (Oct 10, 2025)
- Migrated `/api/dashboard-init` to Convex, eliminating Postgres queries from the dashboard initialization route.
- Extended `api.admin.getDashboardStats` to provide metrics, church overview, fund summary, and trend data required by the legacy response shape.
- Updated `docs/SUPABASE_REMOVAL_BLOCKERS.md` and `docs/TASK_TRACKER.md` to reflect WS-6 progress.
