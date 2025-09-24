-- Add extended expense categories and per-report donor tracking
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS mantenimiento NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materiales NUMERIC(18,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS report_tithers (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  church_id BIGINT NOT NULL REFERENCES churches (id),
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  document TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_report_tithers_report_id ON report_tithers (report_id);
CREATE INDEX IF NOT EXISTS idx_report_tithers_document ON report_tithers (document);
