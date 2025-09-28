-- PostgREST & Connection Performance Monitoring Queries
-- Run these periodically to track database health and API performance

-- ============================================================================
-- 1. PostgREST Schema Introspection Performance
-- ============================================================================
-- Shows how expensive PostgREST metadata queries are
-- Run this to see if schema introspection is becoming a bottleneck

SELECT
  'PostgREST Introspection' as metric_category,
  left(query, 80) as query_type,
  calls,
  total_exec_time::numeric(10,2) as total_time_ms,
  mean_exec_time::numeric(10,2) as avg_time_ms,
  (total_exec_time / (SELECT sum(total_exec_time) FROM pg_stat_statements) * 100)::numeric(5,2) as pct_total_time,
  rows as avg_rows_returned
FROM pg_stat_statements
WHERE (
  query LIKE '%pg_namespace%'
  OR query LIKE '%pg_class%'
  OR query LIKE '%information_schema%'
  OR query LIKE '%pg_constraint%'
)
AND query NOT LIKE '%pg_stat_statements%'  -- Exclude monitoring queries
ORDER BY total_exec_time DESC
LIMIT 15;

-- ============================================================================
-- 2. Connection Pool Efficiency
-- ============================================================================
-- Shows connection usage patterns and pooling effectiveness

SELECT
  'Connection Statistics' as metric,
  (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections,
  (SELECT count(*) FROM pg_stat_activity) as current_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') as idle_in_transaction,
  (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock') as waiting_on_locks;

-- ============================================================================
-- 3. Dead Tuples Monitoring
-- ============================================================================
-- Tracks tables that need VACUUM to maintain performance

SELECT
  schemaname,
  relname as tablename,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  round((n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) * 100)::numeric, 2) as dead_tuple_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  CASE
    WHEN n_dead_tup > 1000 AND n_dead_tup::float / NULLIF(n_live_tup, 0) > 0.2 THEN 'VACUUM RECOMMENDED'
    WHEN n_dead_tup > 100 AND n_dead_tup::float / NULLIF(n_live_tup, 0) > 0.5 THEN 'VACUUM URGENT'
    ELSE 'OK'
  END as vacuum_status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_dead_tup > 0
ORDER BY dead_tuple_pct DESC NULLS LAST, n_dead_tup DESC
LIMIT 20;

-- ============================================================================
-- 4. Top Query Performance by Total Time
-- ============================================================================
-- Identifies most expensive queries overall

SELECT
  left(query, 100) as query_start,
  calls,
  total_exec_time::numeric(10,2) as total_time_ms,
  mean_exec_time::numeric(10,2) as avg_time_ms,
  min_exec_time::numeric(10,2) as min_time_ms,
  max_exec_time::numeric(10,2) as max_time_ms,
  stddev_exec_time::numeric(10,2) as stddev_time_ms,
  rows as avg_rows,
  (total_exec_time / (SELECT sum(total_exec_time) FROM pg_stat_statements) * 100)::numeric(5,2) as pct_total_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- ============================================================================
-- 5. Cache Hit Ratio
-- ============================================================================
-- Shows how effectively PostgreSQL is using memory cache

SELECT
  'Cache Performance' as metric,
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  round(
    (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100)::numeric,
    2
  ) as cache_hit_ratio_pct,
  CASE
    WHEN sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.99 THEN 'EXCELLENT'
    WHEN sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.95 THEN 'GOOD'
    WHEN sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.90 THEN 'FAIR'
    ELSE 'NEEDS TUNING'
  END as status
FROM pg_statio_user_tables;

-- ============================================================================
-- 6. Index Usage Statistics
-- ============================================================================
-- Shows which indexes are actually being used

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE
    WHEN idx_scan = 0 THEN 'UNUSED - Consider dropping'
    WHEN idx_scan < 10 THEN 'RARELY USED'
    WHEN idx_scan < 100 THEN 'OCCASIONALLY USED'
    ELSE 'ACTIVELY USED'
  END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
LIMIT 30;

-- ============================================================================
-- 7. Table Bloat Estimation
-- ============================================================================
-- Estimates table bloat from dead tuples and updates

SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_dead_tup as dead_tuples,
  round((n_dead_tup::float / NULLIF(n_live_tup, 0) * 100)::numeric, 1) as bloat_pct,
  CASE
    WHEN n_dead_tup > n_live_tup * 0.2 THEN 'High bloat - VACUUM recommended'
    WHEN n_dead_tup > n_live_tup * 0.1 THEN 'Moderate bloat'
    ELSE 'Low bloat'
  END as bloat_status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 20;

-- ============================================================================
-- 8. Long Running Queries
-- ============================================================================
-- Shows queries that are currently running and taking a long time

SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  now() - query_start as duration,
  wait_event_type,
  wait_event,
  left(query, 100) as query_start
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
/*
Run these queries periodically (daily or weekly) to monitor:

1. PostgREST performance: If introspection queries consume > 5% of total time,
   consider schema optimization or check Supabase settings for schema cache.

2. Connection pool: If idle_in_transaction > 10, there may be connection leaks.
   If waiting_on_locks > 0, investigate lock contention.

3. Dead tuples: Any table with > 20% dead tuples should be VACUUMed.
   Set up autovacuum if not already configured.

4. Cache hit ratio: Should be > 95%. If lower, consider increasing shared_buffers
   or effective_cache_size (Supabase dashboard settings).

5. Index usage: Unused indexes waste storage and slow down writes.
   Review and drop indexes with 0 scans after 30 days of monitoring.

6. Table bloat: High bloat slows down queries. Regular VACUUM prevents this.

7. Long running queries: Queries running > 30 seconds may need optimization.

8. Query performance: Focus on queries with high total_time and high calls.
   These are the best candidates for optimization.

MANUAL VACUUM (when needed):
Note: Cannot run VACUUM inside a transaction or via Supabase SQL editor.
Use Supabase CLI or direct psql connection:

  supabase db execute "VACUUM ANALYZE public.funds;"
  supabase db execute "VACUUM ANALYZE public.profiles;"
*/