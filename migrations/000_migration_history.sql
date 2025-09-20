-- Migration tracking table (PostgreSQL)
CREATE TABLE IF NOT EXISTS migration_history (
  id BIGSERIAL PRIMARY KEY,
  migration_file TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  checksum TEXT,
  execution_time_ms INTEGER
);
