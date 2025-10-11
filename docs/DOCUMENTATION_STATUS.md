# Documentation Status – IPU PY Tesorería

**Last Updated:** October 9, 2025  
**Editor:** Claude Code

---

## Active Documentation (Source of Truth)

| Document | Purpose | Notes |
| --- | --- | --- |
| `README.md` | Project overview & local setup | Keep onboarding steps current with Convex Auth flow |
| `CLAUDE.md` | Coding assistant guidance | Update when architecture or processes change |
| `docs/ROLE_SYSTEM_REFERENCE.md` | Authoritative 6-role model & permission matrix | Replaces legacy 7-role documentation |
| `docs/API_CONTRACTS.md` | REST envelope & error patterns | Reference for ApiResponse<T> contract |
| `docs/SECURITY.md` | Authentication, secrets, and rollout policy | Align with Convex Auth + rate-limiter plans |
| `docs/DATA_MIGRATION_NOTES.md` | Historical data import (legacy spreadsheet) | Document any future migration scripts |
| `docs/WS2_PHASE6_E2E_TEST_PLAN.md` | Role-system validation checklist | Execute before production rollout |

---

## Archived / Historical References

| Document | Status | Action |
| --- | --- | --- |
| `docs/archive/misc/ROLES_AND_PERMISSIONS.md` | ⚠️ Reference only (pre-final consolidation) | Banner added; read-only |
| `docs/archive/misc/USER_MANAGEMENT_GUIDE.md` | ❌ Outdated 7-role flow & NextAuth screenshots | Banner added; use admin UI docs instead |
| `docs/archive/misc/CORRECT_PERMISSIONS_MODEL.md` | ⚠️ Supabase-era proposals | Leave untouched; do not implement |
| `docs/archive/misc/ROLE_SYSTEM_EVOLUTION.md` | ✅ Historical changelog | Keep for timeline context |
| `docs/archive/misc/DOCUMENTATION_STRUCTURE.md` | ⚠️ Pre-Convex outline | Superseded by this index |

---

## Update Triggers

1. **Role or permission changes** → update `docs/ROLE_SYSTEM_REFERENCE.md`, sync admin UI screenshots, refresh this index.
2. **API contract adjustments** → refresh `docs/API_CONTRACTS.md` and annotate changelog.
3. **Auth or deployment changes** → update `docs/SECURITY.md`, `CLAUDE.md`, and onboarding instructions.
4. **Data migrations** → log in `docs/DATA_MIGRATION_NOTES.md` and append migration scripts to appendix.

---

## Maintenance Checklist

- [ ] Confirm banners exist on every legacy role/auth doc inside `docs/archive/misc/`.
- [ ] Review this index during weekly documentation review.
- [ ] Add session-log entry in `docs/TASK_TRACKER.md` whenever documentation status changes.
- [ ] Snapshot doc ownership (add Maintainer column) once team assignments are finalized.
