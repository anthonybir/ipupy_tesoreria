-- Add fields to track manual report submissions by admin/treasurer
-- These fields help audit when pastors submit paper reports or via WhatsApp/phone

-- Add submission source to track how the report was received
ALTER TABLE reports ADD COLUMN IF NOT EXISTS submission_source TEXT
  CHECK (submission_source IN ('pastor_manual', 'church_online', 'admin_import', 'admin_manual'))
  DEFAULT 'church_online';

-- Add manual report tracking fields
ALTER TABLE reports ADD COLUMN IF NOT EXISTS manual_report_source TEXT
  CHECK (manual_report_source IN ('paper', 'whatsapp', 'email', 'phone', 'in_person', 'other'));

ALTER TABLE reports ADD COLUMN IF NOT EXISTS manual_report_notes TEXT;

-- Add who entered the manual report (if different from submitter)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS entered_by TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS entered_at TIMESTAMP;

-- Update existing records to have proper submission_source
UPDATE reports
SET submission_source = CASE
  WHEN submission_type = 'online' THEN 'church_online'
  WHEN submission_type = 'manual' AND estado = 'importado_excel' THEN 'admin_import'
  WHEN submission_type = 'manual' THEN 'admin_manual'
  ELSE 'church_online'
END
WHERE submission_source IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN reports.submission_source IS 'How the report was submitted: pastor_manual (paper from pastor), church_online (church portal), admin_import (Excel), admin_manual (admin on behalf)';
COMMENT ON COLUMN reports.manual_report_source IS 'For manual reports, how it was received: paper, whatsapp, email, phone, in_person, other';
COMMENT ON COLUMN reports.manual_report_notes IS 'Notes about manual submission, e.g., "Pastor Juan called with numbers", "Received via WhatsApp photo"';
COMMENT ON COLUMN reports.entered_by IS 'Email of admin/treasurer who entered a manual report';
COMMENT ON COLUMN reports.entered_at IS 'When the manual report was entered into the system';