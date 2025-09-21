-- Phase 4: basic audit trail for key financial tables

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id BIGINT,
  changed_data JSONB,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION audit.record_change()
RETURNS TRIGGER AS $$
DECLARE
  actor TEXT := current_setting('audit.user', true);
BEGIN
  INSERT INTO audit.log (table_name, action, record_id, changed_data, actor)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' THEN TO_JSONB(OLD) ELSE TO_JSONB(NEW) END,
    actor
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_audit_reports ON reports;
CREATE TRIGGER tr_audit_reports
AFTER INSERT OR UPDATE OR DELETE ON reports
FOR EACH ROW EXECUTE FUNCTION audit.record_change();

DROP TRIGGER IF EXISTS tr_audit_transactions ON transactions;
CREATE TRIGGER tr_audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION audit.record_change();
