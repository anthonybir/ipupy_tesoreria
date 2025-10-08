# Pending Items

1. **Run new migrations in hosted environments**
   - Apply `008_reports_portal_enhancement.sql` and `009_audit_log.sql` to Supabase/Postgres.
   - Backfill `submission_type`, `submitted_by`, and `submitted_at` for historical records if needed.

2. **Notification worker**
   - Implement a background job (cron or serverless function) to send emails for rows in `report_notifications` where `status = 'pending'`.
   - Populate `TREASURY_NOTIFICATION_EMAIL` (and future pastor recipients) in production.

3. **Attachment storage strategy**
   - Decide on file retention/rotation for `/uploads/` or move to cloud object storage.
   - Add virus scanning or size limits if receipts become large.

4. **Pastor wizard polish**
   - Add inline validation/error messaging per field instead of toast-only feedback.
   - Integrate with IndexedDB drafts so users can resume offline progress.

5. **Transactions UX follow-ups**
   - Allow editing/removing individual entries before and after batch submission.
   - Add an “export batch” option (CSV/XLSX) for audit handoffs.

6. **Analytics surface**
   - Consume `monthly_summary`, `fund_overview`, and `status_counts` on the dashboard frontend.
   - Highlight churches without submissions for the current month.

7. **Audit visibility**
   - Create an admin page to browse `audit.log` and `report_status_history` with filters.
