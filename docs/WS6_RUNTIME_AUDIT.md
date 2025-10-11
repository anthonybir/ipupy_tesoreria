# WS-6 Runtime Audit — Postgres Helpers

**Date:** October 10, 2025

This audit inventories every remaining runtime call site that depends on `src/lib/db.ts`, `db-context.ts`, or other Supabase/Postgres utilities. Use this as the checklist for WS-6 Phase 1 (Runtime Ports).

## Files Importing `@/lib/db`

| Area | File | Notes |
| --- | --- | --- |
| Dashboard (landing) | `src/app/page.tsx` | Server component still calls `executeWithContext` for summary/pipeline/financial widgets. |
| Health endpoint | `src/app/api/health/route.ts` | Uses `createConnection`, `getPoolStats` to surface pool health. Decide whether to replace with Convex health check or drop endpoint. |
| Accounting API | `src/app/api/accounting/route.ts` | Heavy Postgres usage for reports + ledger joins. |
| Data export API | `src/app/api/data/route.ts` | Mixed queries for summary widgets. |
| Donors API | `src/app/api/donors/route.ts` | ✅ Migrated to Convex Oct 10, 2025 |
| Financial movements API | `src/app/api/financial/fund-movements/route.ts` | Complex transfer logic; still depends on Postgres RLS helpers. |
| Reports helpers | `src/app/api/reports/route-helpers.ts` | Shared helpers for `/api/reports`; still executed by route even after partial Convex migration. |
| Worship records API | `src/app/api/worship-records/route.ts` | Attendance endpoints (members, services) still call Postgres. |
| Fund transfers library | `src/lib/fund-transfers.ts` | Invoked by accounting routes; still wraps raw SQL transactions. |
| DB admin helpers | `src/lib/db-admin.ts` | Misc admin queries (church stats, pending approvals). |

## Files Importing `@/lib/db-context`

| Area | File | Notes |
| --- | --- | --- |
| Reports helpers | `src/app/api/reports/route-helpers.ts` | Calls `setDatabaseContext` before executing raw SQL. |
| Fund movements API | `src/app/api/financial/fund-movements/route.ts` | Same as above. |
| Worship records API | `src/app/api/worship-records/route.ts` | Context + transactions. |
| Fund transfers library | `src/lib/fund-transfers.ts` | Uses context inside transaction helper. |

## Other Supabase/Postgres Helpers in Use

| Helper | Referenced By | Notes |
| --- | --- | --- |
| `src/lib/db-helpers.ts` (`firstOrNull`, `expectOne`, etc.) | Same routes listed above | Remove once callers migrate. |
| `src/lib/db-church.ts` | Church dashboard components/hooks | ✅ Replaced by Convex admin hooks (Oct 2025). |
| `src/lib/db-admin.ts` | Admin dashboards | Provides Postgres-only aggregations. |

## Newly Migrated

- `/api/dashboard-init` → Convex (`api.admin.getDashboardStats`) — ✅ Oct 10, 2025
- `/api/people` → Convex (`api.admin.listMembers`, `createMember`, `updateMember`, `deleteMember`) — ✅ Oct 10, 2025

## Action Items

1. Prioritize migrating `src/app/page.tsx` dashboard loaders to Convex queries so the landing screen stops opening a Postgres pool.
2. Decide on approach for accounting/transactions APIs (Convex rewrite vs. archival-only). Document in WS-6 runtime plan before touching data mutations.
3. For each remaining API route, mirror the strategy used for `/api/dashboard-init` and `/api/people`: add Convex queries/mutations, then delete Postgres helpers.
4. Once callers are removed, delete `src/lib/db.ts`, `db-context.ts`, `db-helpers.ts`, and shared admin/fund transfer helpers.

Cross-reference this list with `docs/WS6_SUPABASE_DECOMMISSION_PLAN.md` (Phase 1) when scheduling the remaining migrations.
