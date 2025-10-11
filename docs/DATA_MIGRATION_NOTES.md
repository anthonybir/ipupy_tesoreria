# Data Migration Notes

**Last updated:** 2025-10-09

## Source of Truth

- The only records currently stored in Convex (profiles, funds, transactions, reports, providers, etc.) are **historical** imports.
- These rows were populated from the legacy spreadsheet `legacy_data/Registro Diario IPU PY (1).xlsx`.
- No live production activity has been captured in the new system yet.

## Launch Plan

- When the new treasury dashboard goes live, teams will begin entering **new** operational data directly in this Convex deployment.
- Historical entries remain available for reference/analytics but should be treated as read-only.
- Any scripts or migrations must assume that existing `created_by`, `transactions_created_by`, balances, and report flags correspond to the legacy spreadsheet, not the future production workflow.

## Reminders for Future Work

- Before launch, ensure that all user-facing views clearly distinguish legacy records (e.g., pre-2025) from new activity.
- Data backfill scripts (e.g., `npm run migrate:created-by`) must be re-run if additional historical rows are imported from the spreadsheet.
- Documentation, dashboards, and onboarding material should call out that the dataset resets once the production cut-over happens. This avoids confusing test/historical figures with real-time treasury numbers.

## Summary

- Current Convex database = historical import only (no live transactions).
- Source file: `legacy_data/Registro Diario IPU PY (1).xlsx`.
- Launch plan: clear demarcation when production data starts; reset expectations with stakeholders.
