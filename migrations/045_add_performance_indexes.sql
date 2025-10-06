-- Migration 045: Add performance indexes for frequently queried columns
-- Date: 2025-01-06
-- Purpose: Optimize query performance for filtered and sorted queries
-- Related: BUSINESS_LOGIC_AUDIT_2025-01-06.md HIGH Issue #9

-- =============================================================================
-- HIGH PRIORITY: Performance Optimization
-- =============================================================================
-- Indexes improve query performance for:
-- - Filtering by status/estado (WHERE clauses)
-- - Sorting by processed_at (ORDER BY clauses)
-- - Conditional indexes reduce storage for sparse data

BEGIN;

-- =============================================================================
-- 1. REPORTS TABLE INDEXES
-- =============================================================================

-- Index for filtering reports by estado (pendiente_admin, procesado, etc.)
-- Used in: Admin dashboard, report approval workflows
-- Queries: SELECT * FROM reports WHERE estado = 'pendiente_admin'
CREATE INDEX IF NOT EXISTS idx_reports_estado ON reports(estado);

-- Partial index for processed reports with processing timestamp
-- Used in: Historical reports, audit queries, date-range filters
-- Queries: SELECT * FROM reports WHERE processed_at > '2025-01-01' ORDER BY processed_at DESC
-- Note: Partial index (WHERE clause) reduces size by only indexing processed reports
CREATE INDEX IF NOT EXISTS idx_reports_processed_at
  ON reports(processed_at)
  WHERE processed_at IS NOT NULL;

-- Composite index for church + month + year lookups (already has UNIQUE constraint)
-- Note: UNIQUE constraint automatically creates index, so we don't need duplicate
-- Existing: UNIQUE (church_id, month, year) from migration 001

COMMENT ON INDEX idx_reports_estado IS
  'Optimizes filtering reports by estado. Used in admin dashboard and approval workflows.';

COMMENT ON INDEX idx_reports_processed_at IS
  'Partial index for processed reports. Optimizes date-range queries and audit trails. Only indexes non-null processed_at values to reduce storage.';

-- =============================================================================
-- 2. FUND_EVENTS TABLE INDEXES
-- =============================================================================

-- Index for filtering events by status (draft, submitted, approved, etc.)
-- Used in: Fund director dashboard, event approval workflows
-- Queries: SELECT * FROM fund_events WHERE status = 'submitted'
CREATE INDEX IF NOT EXISTS idx_fund_events_status ON fund_events(status);

-- Index for filtering events by fund_id (fund-specific queries)
-- Used in: Fund balance reconciliation, fund-specific event lists
-- Queries: SELECT * FROM fund_events WHERE fund_id = X
CREATE INDEX IF NOT EXISTS idx_fund_events_fund_id ON fund_events(fund_id);

-- Composite index for fund + status queries (common pattern)
-- Used in: Fund director viewing their pending events
-- Queries: SELECT * FROM fund_events WHERE fund_id = X AND status = 'draft'
CREATE INDEX IF NOT EXISTS idx_fund_events_fund_status
  ON fund_events(fund_id, status);

COMMENT ON INDEX idx_fund_events_status IS
  'Optimizes filtering events by status. Used in approval workflows and dashboard views.';

COMMENT ON INDEX idx_fund_events_fund_id IS
  'Optimizes fund-specific event queries. Used in fund balance reconciliation.';

COMMENT ON INDEX idx_fund_events_fund_status IS
  'Composite index for fund + status queries. Optimizes fund director dashboard showing pending events.';

-- =============================================================================
-- 3. TRANSACTIONS TABLE INDEXES
-- =============================================================================

-- Index for filtering transactions by fund_id
-- Used in: Fund ledger views, balance calculations
-- Queries: SELECT * FROM transactions WHERE fund_id = X ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_transactions_fund_date
  ON transactions(fund_id, date DESC);

-- Index for filtering transactions by church_id
-- Used in: Church transaction history, monthly report reconciliation
-- Queries: SELECT * FROM transactions WHERE church_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_transactions_church_created
  ON transactions(church_id, created_at DESC);

COMMENT ON INDEX idx_transactions_fund_date IS
  'Composite index for fund + date queries. Optimizes fund ledger views with DESC order.';

COMMENT ON INDEX idx_transactions_church_created IS
  'Composite index for church + created_at queries. Optimizes church transaction history.';

-- =============================================================================
-- 4. USER_ACTIVITY TABLE INDEXES
-- =============================================================================

-- Index for filtering user activity by user_id
-- Used in: User audit trails, activity monitoring
-- Queries: SELECT * FROM user_activity WHERE user_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created
  ON user_activity(user_id, created_at DESC);

-- Index for filtering activity by action
-- Used in: Security monitoring, specific action audits
-- Queries: SELECT * FROM user_activity WHERE action = 'report.approve'
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity(action);

COMMENT ON INDEX idx_user_activity_user_created IS
  'Composite index for user + created_at queries. Optimizes user audit trail views.';

COMMENT ON INDEX idx_user_activity_action IS
  'Optimizes filtering activity by action type. Used in security monitoring dashboards.';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Check index creation
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- Analyze index usage (run after production use)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

-- Check index sizes
-- SELECT schemaname, tablename, indexname,
--        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- =============================================================================
-- PERFORMANCE IMPACT ESTIMATION
-- =============================================================================
-- Based on current production data (38 churches, ~1000 reports, ~500 events):
--
-- Reports table:
-- - idx_reports_estado: ~8KB (small enum, high cardinality)
-- - idx_reports_processed_at: ~4KB (partial, only processed reports)
--
-- Fund_events table:
-- - idx_fund_events_status: ~4KB
-- - idx_fund_events_fund_id: ~4KB
-- - idx_fund_events_fund_status: ~8KB
--
-- Transactions table:
-- - idx_transactions_fund_date: ~16KB (growing with time)
-- - idx_transactions_church_created: ~16KB
--
-- User_activity table:
-- - idx_user_activity_user_created: ~32KB (audit log, grows continuously)
-- - idx_user_activity_action: ~16KB
--
-- Total estimated storage: ~108KB
-- Expected query performance improvement: 10-100x for filtered queries
