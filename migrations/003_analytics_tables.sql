-- Analytics and advanced reporting tables (PostgreSQL)

CREATE TABLE IF NOT EXISTS analytics_kpis (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income NUMERIC(18,2) DEFAULT 0,
  total_tithes NUMERIC(18,2) DEFAULT 0,
  total_offerings NUMERIC(18,2) DEFAULT 0,
  national_fund_amount NUMERIC(18,2) DEFAULT 0,
  fund_health_score NUMERIC(5,2) DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  active_members INTEGER DEFAULT 0,
  new_members INTEGER DEFAULT 0,
  member_retention_rate NUMERIC(5,2) DEFAULT 0,
  average_attendance NUMERIC(10,2) DEFAULT 0,
  attendance_growth_rate NUMERIC(5,2) DEFAULT 0,
  service_count INTEGER DEFAULT 0,
  active_ministries INTEGER DEFAULT 0,
  ministry_participation_rate NUMERIC(5,2) DEFAULT 0,
  financial_growth_rate NUMERIC(5,2) DEFAULT 0,
  member_growth_rate NUMERIC(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (church_id) REFERENCES churches (id)
);

CREATE TABLE IF NOT EXISTS analytics_trends (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT,
  metric_name TEXT NOT NULL,
  trend_direction TEXT NOT NULL,
  trend_strength NUMERIC(5,2) NOT NULL,
  current_value NUMERIC(18,2) NOT NULL,
  predicted_3_months NUMERIC(18,2),
  predicted_6_months NUMERIC(18,2),
  predicted_12_months NUMERIC(18,2),
  prediction_confidence NUMERIC(5,2) DEFAULT 0,
  seasonal_pattern TEXT,
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (church_id) REFERENCES churches (id)
);

CREATE TABLE IF NOT EXISTS analytics_insights (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT,
  insight_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metric_affected TEXT,
  current_value NUMERIC(18,2),
  recommended_action TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (church_id) REFERENCES churches (id)
);

CREATE TABLE IF NOT EXISTS custom_reports (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  filters TEXT,
  columns TEXT,
  aggregations TEXT,
  visualizations TEXT,
  is_scheduled BOOLEAN DEFAULT FALSE,
  schedule_frequency TEXT,
  next_run TIMESTAMPTZ,
  created_by TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (church_id) REFERENCES churches (id)
);

CREATE TABLE IF NOT EXISTS analytics_benchmarks (
  id BIGSERIAL PRIMARY KEY,
  metric_name TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  avg_value NUMERIC(18,2),
  median_value NUMERIC(18,2),
  min_value NUMERIC(18,2),
  max_value NUMERIC(18,2),
  percentile_25 NUMERIC(18,2),
  percentile_75 NUMERIC(18,2),
  percentile_90 NUMERIC(18,2),
  church_count INTEGER,
  total_sample_size INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  before_value NUMERIC(18,2),
  after_value NUMERIC(18,2),
  change_magnitude NUMERIC(18,2),
  detection_method TEXT,
  context_data TEXT,
  requires_action BOOLEAN DEFAULT FALSE,
  action_taken TEXT,
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (church_id) REFERENCES churches (id)
);

CREATE INDEX IF NOT EXISTS idx_kpis_church_period ON analytics_kpis (church_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_trends_church_metric ON analytics_trends (church_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_insights_church_priority ON analytics_insights (church_id, priority, is_read);
CREATE INDEX IF NOT EXISTS idx_events_church_type ON analytics_events (church_id, event_type, detected_at);
