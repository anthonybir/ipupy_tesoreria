# WS-2 Phase 6 – End-to-End Test Plan

**Last Updated:** October 10, 2025  
**Owners:** Anthony (primary), Claude (support)  

## 1. Objectives

- Validate that the 6-role system behaves according to `docs/ROLE_SYSTEM_REFERENCE.md`.
- Confirm auto-provisioning + admin UI flows cover new and existing users.
- Ensure API response standardization remains intact throughout core workflows.
- Document manual + automated coverage to support go/no-go for production cutover.

## 2. Environments

| Environment | URL | Notes |
| --- | --- | --- |
| Local Dev | `http://localhost:3000` | Requires `CONVEX_URL`, `CONVEX_ADMIN_KEY`, Google OAuth test account. |
| Staging | `https://staging.ipupytesoreria.app` | Mirror production datasets; run final regression here. |

## 3. Pre-Requisites

- Google Workspace accounts for each role (`admin`, `treasurer`, `fund_director`, `pastor`, `church_manager`, `secretary`, new user).
- Convex dev deployment running with `ensureProfile` mutation deployed.
- Admin UI available at `/admin/users`.
- Smoke test artifacts (`docs/WS2_PHASE2_SMOKE_TEST_RESULTS.md`) reviewed to confirm baseline.

## 4. Test Matrix

| ID | Scenario | Accounts / Data | Steps | Expected Outcome | Automation |
| --- | --- | --- | --- | --- | --- |
| T6-001 | Admin login + dashboard | `administracion@ipupy.org.py` | Sign in → visit `/dashboard` | Full dashboard tiles load, approvals grid present, no auth errors | Manual |
| T6-002 | Admin assigns role via UI | Admin + `nuevo@ipupy.org.py` | Create user → change role to treasurer → assign church/fund | Role change saved; toast confirms; Convex profile updated | Manual |
| T6-003 | Admin deactivates/reactivates user | Same as T6-002 | Toggle status → reassign role | User status flips; reactivation keeps role/scopes | Manual |
| T6-004 | Treasurer approves church report | `tesorero@ipupy.org.py`, sample report pending | Approve report from admin UI / API | Report status → `aprobado`; transactions created; toasts show success | Manual |
| T6-005 | Pastor cannot approve report | `pastor@iglesia1.ipupy.org.py`, same report | Attempt approval via UI/API | Operation denied with “tesorero o administrador” error | Manual |
| T6-006 | Pastor creates monthly report | Pastor account | Submit report with deposit evidence | Report status → `enviado`; auto-calculations intact | Manual |
| T6-007 | Fund director submits event | `director@ipupy.org.py` | Create event, add budget, submit | Status → `submitted`; treasurer sees for approval | Manual |
| T6-008 | Treasurer approves fund event | Treasurer account | Approve submitted event | Status → `approved`; audit metadata captured | Manual |
| T6-009 | Church manager view-only | `manager@iglesia1.ipupy.org.py` | Login → attempt edits | Read-only access; edits blocked with permission error | Manual |
| T6-010 | Secretary limited access | `secretario@iglesia1.ipupy.org.py` | View members/reports, attempt create | Reads succeed; mutations fail with permission warning | Manual |
| T6-011 | New user auto-provisioning | `nuevo@ipupy.org.py` | Login first time | Profile created with secretary role; admin UI lists user | Automated (Smoke) |
| T6-012 | Domain restriction | Non-workspace email | Attempt login | Sign-in fails with “domain” error (frontend toast + backend log) | Manual |
| T6-013 | Providers CRUD with treasurer | Treasurer account | Create/edit/archive provider | Mutations succeed; history tracked; API envelope verified | Manual |
| T6-014 | Transactions bulk create | Treasurer account | Upload CSV / use UI flow | Bulk summary returns standard envelope; rows inserted | Manual |
| T6-015 | API error envelope spot check | Any role | Trigger validation error (missing deposit photo) | Response matches `{ success: false, error }` | Automated |

## 5. Regression Checks

- `npm run typecheck`, `npm run lint`.
- `npm run migrate:profiles -- --dry-run` (should report zero changes).
- Optional: audit Convex logs (`ctx.auth`) for failed guard attempts.

## 6. Exit Criteria

- All manual cases executed in staging and logged in PR description.
- Zero blocker defects; medium severity issues triaged with fix/waiver.
- WS-4 auth migration prerequisites confirmed (no remaining NextAuth references).

## 7. Artifacts

- Test run notes appended to this document per cycle.
- Convex dashboard screenshots for approval flows.
- Any bug tickets linked from here (format: `[BUG-###](url)`).
