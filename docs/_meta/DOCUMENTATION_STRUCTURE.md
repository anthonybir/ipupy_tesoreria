# Documentation Structure & Maintenance Guide

_Last updated: 2025-10-06_

This guide explains how the `docs/` directory is organized after the October 2025 cleanup. Use it as the source of truth for where new documentation should live, how to keep existing guides current, and which files are historical records.

---

## 1. Top-Level Taxonomy

| Category | Path | Purpose | Status | Primary Audience |
|----------|------|---------|--------|------------------|
| **Portal** | `docs/README.md`<br>`docs/00-INDEX.md` | Entry points into the documentation set (role-based and topic-based navigation). | ✅ Current | Everyone |
| **Architecture** | `docs/architecture/` | System design, project structure, dual accounting architecture. | ✅ Current | Architects, Tech Leads |
| **API** | `docs/api/` | HTTP API contracts (`API_COMPLETE_REFERENCE.md`, `ENDPOINTS.md`). | ✅ Needs expansion for new endpoints | Backend, Integration devs |
| **Database** | `docs/database/` | Schema, RLS policies, business logic, indexes. | ✅ Current | DB team, Security |
| **Security** | `docs/SECURITY.md`<br>`docs/SECURITY_TESTING.md` | Security model, testing playbooks, helper functions. | ✅ Current | Security, Backend |
| **Development** | `docs/development/` | Getting started, common tasks, troubleshooting, type safety guides. | ✅ Current | Engineers |
| **Features** | `docs/features/` | End-to-end feature guides (Monthly Reports, Fund Events, Provider Registry, Transaction Ledger). | ✅ Current | Product, Support |
| **Deployment & Ops** | `docs/deployment/`<br>`docs/CI_CD.md`<br>`docs/DISASTER_RECOVERY.md`<br>`docs/MONITORING.md` | Runbooks, CI/CD, monitoring & recovery plans. | ✅ Current | SRE, DevOps |
| **Configuration** | `docs/CONFIGURATION.md` | Runtime configuration matrix. | 🔄 Review quarterly | SRE, Backend |
| **Audits & Compliance** | `docs/audits/` | All audit, verification, and compliance reports (moved from root). | 🕒 Historical snapshots | Leadership, Security |
| **Migrations** | `docs/migrations/` | Migration history, consolidation summaries, verification checklists. | ✅ Current | DB, Backend |
| **Project Status & Roadmaps** | `docs/project-status/` | Execution roadmaps, alignment reports, remediation plans. | 🟡 Living documents | Leadership, PM |
| **Future Improvements** | `docs/future-improvements/` | Design backlogs, long-term initiatives (`ACCESSIBILITY_RESTORATION_PLAN.md`, etc.). | 🟡 Review before release cycles | Product, Design |
| **Planning & Research** | `docs/planning/` | Internal planning notes, Codex configuration status. | 🕒 Historical reference | Docs maintainers |
| **Archive** | `docs/archive/` | Frozen legacy documentation kept for historical context. | 🧊 Do not modify | Docs maintainers |

---

## 2. Core Reference Files (Root of `docs/`)

Only canonical references remain at the root level:

- `ARCHITECTURE.md` – One-page architecture overview.
- `DATABASE.md` – Database quick reference summary.
- `COMPONENTS.md` – UI/components reference.
- `CONFIGURATION.md` – Environment and runtime settings.
- `CI_CD.md` – Pipeline operations guide.
- `DEVELOPER_GUIDE.md` – High-level engineering practices.
- `QUICK_START.md` – Fast onboarding checklist.
- `ROLES_AND_PERMISSIONS.md` – Current six-role model.
- `SECURITY.md` / `SECURITY_TESTING.md` – Security posture and test suites.
- `TESTING.md` – Manual/automated testing strategy.
- `USER_GUIDE.md` / `USER_MANAGEMENT_GUIDE.md` – End-user operations.
- `API_REFERENCE.md` – Legacy summary (points to `api/API_COMPLETE_REFERENCE.md`).

Everything else has been moved into dedicated subdirectories (see table above).

---

## 3. Historical & Compliance Records

Historical documentation is now grouped by directory:

- `docs/audits/` contains all audit and verification deliverables, including `AUDIT_SUMMARY_2025-10-05.md`, `COMPREHENSIVE_AUDIT_REPORT_2025-10-05.md`, and the documentation audit deliverables.
- `docs/migrations/` includes all migration verification logs (`MIGRATION_038/039/040/041_*`), the running migration history, and treasurer consolidation briefs.
- `docs/project-status/` contains progress trackers (`TYPE_SAFETY_PROGRESS.md`, `COMPLETE_IMPLEMENTATION_ROADMAP.md`, `GOOGLE_WORKSPACE_*`, etc.).
- `docs/future-improvements/` is the home for long-term initiatives such as the accessibility restoration plan.

When a document transitions from “active” to “record”, move it into the appropriate directory and add a one-line summary to the relevant index (e.g. `docs/audits/ACTION_CHECKLIST.md`).

---

## 4. Maintenance Guidelines

1. **Naming** – Use uppercase snake case for formal deliverables (e.g. `SECURITY_AUDIT_2025-09-28.md`) and sentence case for evergreen guides (`System Architecture.md`).
2. **Status Badges** – At the top of each doc, include a “Last Updated” line and (optional) status: `✅ Current`, `🟡 Needs Update`, `🕒 Historical`.
3. **Cross-Linking** – Prefer relative links (`../development/TYPE_SAFETY_GUIDE.md`) over absolute paths. Avoid hardcoded local filesystem paths.
4. **Category Indexes** – Each directory should maintain its own `README.md` (features, migrations, audits, etc.). Add a short description when creating new docs.
5. **Historical Files** – Do not edit archived documents unless you are appending an errata section. Instead, create new docs in the appropriate category and cross-reference the original.
6. **New Documentation Requests** – Place working drafts under `docs/project-status/` or `docs/future-improvements/` until they graduate to a stable category.

---

## 5. Backlog & Follow-Ups

- **API docs** – Expand `docs/api/API_COMPLETE_REFERENCE.md` to cover webhook payloads and admin endpoints that were added after October 2025.
- **Configuration matrix** – Review `docs/CONFIGURATION.md` for new environment variables introduced in the Supabase migration.
- **Deployment guide** – Incorporate recent Vercel workflow changes into `docs/deployment/DEPLOYMENT.md` and `docs/CI_CD.md`.
- **Docs portal** – Consider merging `docs/README.md` and `docs/00-INDEX.md` into a single navigation page once role-based links are stable.

---

For any new documentation, update this structure guide and the relevant directory `README.md` so the index stays accurate.
