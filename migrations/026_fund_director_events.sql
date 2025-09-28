-- Migration: Fund Director Event Management System
-- Purpose: Enable fund directors to plan events, track budgets, and get treasurer approval
-- Author: System Architecture
-- Date: 2025-09-27
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 0: PREREQUISITES - ASSIGNMENT TABLE & RLS HELPER FUNCTIONS
-- ============================================================================

-- Create fund director assignments table FIRST (before functions reference it)
CREATE TABLE IF NOT EXISTS fund_director_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fund_id INTEGER REFERENCES funds(id) ON DELETE CASCADE, -- NULL means access to all funds
  church_id INTEGER REFERENCES churches(id) ON DELETE SET NULL, -- NULL means all churches
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Ensure unique assignments per fund/church combination
  CONSTRAINT unique_fund_director_assignment UNIQUE NULLS NOT DISTINCT (profile_id, fund_id, church_id)
);

CREATE INDEX IF NOT EXISTS idx_fund_director_assignments_profile ON fund_director_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_fund_director_assignments_fund ON fund_director_assignments(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_director_assignments_church ON fund_director_assignments(church_id);

COMMENT ON TABLE fund_director_assignments IS 'Assigns fund_director role users to specific funds/churches they can manage';
COMMENT ON COLUMN fund_director_assignments.profile_id IS 'User with fund_director role';
COMMENT ON COLUMN fund_director_assignments.fund_id IS 'Fund this director manages (null = all funds)';
COMMENT ON COLUMN fund_director_assignments.church_id IS 'Optional church scope for this assignment';

-- Enable RLS on assignments table
ALTER TABLE fund_director_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fund_director_assignments
-- Admins and treasurers can see all assignments
CREATE POLICY "Admins/treasurers can view all fund director assignments"
ON fund_director_assignments FOR SELECT TO authenticated
USING (
  app_current_user_role() IN ('admin', 'treasurer')
);

-- Fund directors can see their own assignments
CREATE POLICY "Fund directors can view their own assignments"
ON fund_director_assignments FOR SELECT TO authenticated
USING (
  app_current_user_role() = 'fund_director'
  AND profile_id = app_current_user_id()
);

-- Only admins can create/update/delete assignments
CREATE POLICY "Only admins can manage fund director assignments"
ON fund_director_assignments FOR ALL TO authenticated
USING (app_current_user_role() = 'admin')
WITH CHECK (app_current_user_role() = 'admin');

-- Function to check if current user is a fund director
CREATE OR REPLACE FUNCTION app_user_is_fund_director()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_current_user_role() = 'fund_director';
$$;

COMMENT ON FUNCTION app_user_is_fund_director() IS 'Returns true if current user has fund_director role';

-- Function to get current user's assigned fund IDs
-- CRITICAL: Short-circuit before querying RLS-protected table to avoid permission errors for non-fund-directors
CREATE OR REPLACE FUNCTION app_user_assigned_funds()
RETURNS INTEGER[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Only fund_directors have assignments; short-circuit for all other roles
  IF NOT app_user_is_fund_director() THEN
    RETURN ARRAY[]::INTEGER[];
  END IF;

  -- Query assignments table (safe: RLS allows fund_directors to read their own rows)
  RETURN COALESCE(
    (SELECT ARRAY_AGG(DISTINCT fund_id) FILTER (WHERE fund_id IS NOT NULL)
     FROM fund_director_assignments
     WHERE profile_id = app_current_user_id()),
    ARRAY[]::INTEGER[]
  );
END;
$$;

COMMENT ON FUNCTION app_user_assigned_funds() IS 'Returns array of fund IDs assigned to current fund_director (short-circuits for non-fund-directors to avoid RLS violations)';

-- Function to check if user has access to a specific fund
-- CRITICAL: Short-circuit for admin/treasurer before querying RLS-protected table
CREATE OR REPLACE FUNCTION app_user_has_fund_access(p_fund_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Admins and treasurers always have access (short-circuit)
  IF app_current_user_role() IN ('admin', 'treasurer') THEN
    RETURN TRUE;
  END IF;

  -- Non-fund-directors have no fund access
  IF NOT app_user_is_fund_director() THEN
    RETURN FALSE;
  END IF;

  -- Fund director: check specific assignment OR all-funds assignment
  RETURN (
    p_fund_id = ANY(app_user_assigned_funds()) OR
    EXISTS (
      SELECT 1 FROM fund_director_assignments
      WHERE profile_id = app_current_user_id()
      AND fund_id IS NULL
    )
  );
END;
$$;

COMMENT ON FUNCTION app_user_has_fund_access(INTEGER) IS 'Returns true if current user can access the specified fund (short-circuits for admin/treasurer to avoid RLS violations)';

-- ============================================================================
-- PHASE 1: CREATE CORE TABLES
-- ============================================================================

-- Main event tracking table
CREATE TABLE fund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  church_id INTEGER REFERENCES churches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_revision', 'submitted', 'approved', 'rejected', 'cancelled')),

  -- Audit trail
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,

  -- Metadata
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fund_events IS 'Fund director event planning and approval workflow';
COMMENT ON COLUMN fund_events.status IS 'Event lifecycle: draft → submitted → approved/pending_revision/rejected';
COMMENT ON COLUMN fund_events.rejection_reason IS 'Reason for treasurer rejection, returned to director for revision';

-- Budget line items (projected expenses)
CREATE TABLE fund_event_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES fund_events(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('venue', 'materials', 'food', 'transport', 'honoraria', 'marketing', 'other')),
  description TEXT NOT NULL,
  projected_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (projected_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fund_event_budget_items IS 'Projected budget line items for events';
COMMENT ON COLUMN fund_event_budget_items.projected_amount IS 'Estimated cost for this budget line (non-negative)';

-- Actual income and expenses
CREATE TABLE fund_event_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES fund_events(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL CHECK (line_type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  receipt_url TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE fund_event_actuals IS 'Actual income and expenses recorded for approved events';
COMMENT ON COLUMN fund_event_actuals.line_type IS 'Type of entry: income (registration fees, donations) or expense (costs incurred)';
COMMENT ON COLUMN fund_event_actuals.receipt_url IS 'Optional URL to receipt/invoice document';

-- Status change audit trail
CREATE TABLE fund_event_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES fund_events(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  comment TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fund_event_audit IS 'Complete audit trail of event status changes and comments';

-- ============================================================================
-- PHASE 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_fund_events_fund_id ON fund_events(fund_id);
CREATE INDEX idx_fund_events_church_id ON fund_events(church_id) WHERE church_id IS NOT NULL;
CREATE INDEX idx_fund_events_status ON fund_events(status);
CREATE INDEX idx_fund_events_created_by ON fund_events(created_by);
CREATE INDEX idx_fund_events_event_date ON fund_events(event_date);
CREATE INDEX idx_fund_event_budget_items_event_id ON fund_event_budget_items(event_id);
CREATE INDEX idx_fund_event_actuals_event_id ON fund_event_actuals(event_id);
CREATE INDEX idx_fund_event_audit_event_id ON fund_event_audit(event_id);

-- ============================================================================
-- PHASE 3: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE fund_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_event_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_event_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_event_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 4: CREATE RLS POLICIES
-- ============================================================================

-- Fund directors can view/edit events for their assigned funds (draft or pending_revision only)
CREATE POLICY "Fund directors manage draft events"
ON fund_events FOR ALL TO authenticated
USING (
  (app_user_is_fund_director() AND
   app_user_has_fund_access(fund_id) AND
   status IN ('draft', 'pending_revision'))
  OR app_current_user_role() IN ('admin', 'treasurer')
)
WITH CHECK (
  (app_user_is_fund_director() AND
   app_user_has_fund_access(fund_id) AND
   status IN ('draft', 'pending_revision'))
  OR app_current_user_role() IN ('admin', 'treasurer')
);

-- Fund directors can view all their events (read-only for submitted/approved)
CREATE POLICY "Fund directors view all their events"
ON fund_events FOR SELECT TO authenticated
USING (
  (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
  OR app_current_user_role() IN ('admin', 'treasurer')
);

-- Treasurers and admins have full access to all events
CREATE POLICY "Treasurers manage all events"
ON fund_events FOR ALL TO authenticated
USING (app_current_user_role() IN ('admin', 'treasurer'))
WITH CHECK (app_current_user_role() IN ('admin', 'treasurer'));

-- Budget items inherit parent event access
CREATE POLICY "Budget items inherit event access - read"
ON fund_event_budget_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

CREATE POLICY "Budget items inherit event access - write"
ON fund_event_budget_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND status IN ('draft', 'pending_revision')
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

CREATE POLICY "Budget items inherit event access - update"
ON fund_event_budget_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND status IN ('draft', 'pending_revision')
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

CREATE POLICY "Budget items inherit event access - delete"
ON fund_event_budget_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND status IN ('draft', 'pending_revision')
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

-- Actuals can be viewed by anyone with access to the event
CREATE POLICY "Event actuals inherit event access - read"
ON fund_event_actuals FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

-- Actuals can be added by event owner or treasurer/admin
CREATE POLICY "Event actuals inherit event access - write"
ON fund_event_actuals FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

CREATE POLICY "Event actuals inherit event access - update/delete"
ON fund_event_actuals FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id) AND created_by = app_current_user_id())
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

-- Audit trail is read-only for everyone with event access
CREATE POLICY "Event audit trail - read"
ON fund_event_audit FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      (app_user_is_fund_director() AND app_user_has_fund_access(fund_id))
      OR app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

-- Audit trail can only be written for events the user owns or manages
CREATE POLICY "Event audit trail - write"
ON fund_event_audit FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fund_events
    WHERE id = event_id
    AND (
      created_by = app_current_user_id() OR
      app_current_user_role() IN ('admin', 'treasurer')
    )
  )
);

-- ============================================================================
-- PHASE 5: CREATE WORKFLOW FUNCTIONS
-- ============================================================================

-- Function to process event approval and create ledger transactions
CREATE OR REPLACE FUNCTION process_fund_event_approval(p_event_id UUID, p_approved_by UUID)
RETURNS JSON AS $$
DECLARE
  v_event RECORD;
  v_total_income NUMERIC;
  v_total_expense NUMERIC;
  v_net_amount NUMERIC;
  v_transaction_ids INTEGER[];
  v_result JSON;
BEGIN
  -- Get event details
  SELECT * INTO v_event FROM fund_events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  IF v_event.status != 'submitted' THEN
    RAISE EXCEPTION 'Event must be in submitted status to approve (current: %)', v_event.status;
  END IF;

  -- Calculate totals from actuals
  SELECT COALESCE(SUM(amount), 0) INTO v_total_income
  FROM fund_event_actuals WHERE event_id = p_event_id AND line_type = 'income';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_expense
  FROM fund_event_actuals WHERE event_id = p_event_id AND line_type = 'expense';

  v_net_amount := v_total_income - v_total_expense;

  -- Create transaction for income (if any)
  IF v_total_income > 0 THEN
    INSERT INTO transactions (
      fund_id, church_id, concept, amount_in, amount_out, date, created_by, created_at
    ) VALUES (
      v_event.fund_id,
      v_event.church_id,
      format('Evento: %s - Ingresos', v_event.name),
      v_total_income,
      0,
      v_event.event_date,
      'system',
      now()
    ) RETURNING id INTO v_transaction_ids[1];
  END IF;

  -- Create transaction for expenses (if any)
  IF v_total_expense > 0 THEN
    INSERT INTO transactions (
      fund_id, church_id, concept, amount_in, amount_out, date, created_by, created_at
    ) VALUES (
      v_event.fund_id,
      v_event.church_id,
      format('Evento: %s - Gastos', v_event.name),
      0,
      v_total_expense,
      v_event.event_date,
      'system',
      now()
    ) RETURNING id INTO v_transaction_ids[2];
  END IF;

  -- Update event status
  UPDATE fund_events
  SET status = 'approved',
      approved_by = p_approved_by,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_event_id;

  -- Build result JSON
  v_result := json_build_object(
    'event_id', p_event_id,
    'event_name', v_event.name,
    'fund_id', v_event.fund_id,
    'total_income', v_total_income,
    'total_expense', v_total_expense,
    'net_amount', v_net_amount,
    'transactions_created', v_transaction_ids,
    'transaction_count', COALESCE(array_length(v_transaction_ids, 1), 0)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_fund_event_approval(UUID, UUID) IS 'Approve fund event and automatically create ledger transactions from actuals';

-- Function to get event summary with calculated totals
CREATE OR REPLACE FUNCTION get_fund_event_summary(p_event_id UUID)
RETURNS JSON AS $$
DECLARE
  v_event RECORD;
  v_budget_total NUMERIC;
  v_income_total NUMERIC;
  v_expense_total NUMERIC;
  v_budget_count INTEGER;
  v_actuals_count INTEGER;
  v_result JSON;
BEGIN
  SELECT * INTO v_event FROM fund_events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  -- Get budget totals
  SELECT
    COALESCE(SUM(projected_amount), 0),
    COUNT(*)
  INTO v_budget_total, v_budget_count
  FROM fund_event_budget_items WHERE event_id = p_event_id;

  -- Get actuals totals
  SELECT
    COALESCE(SUM(CASE WHEN line_type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN line_type = 'expense' THEN amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_income_total, v_expense_total, v_actuals_count
  FROM fund_event_actuals WHERE event_id = p_event_id;

  v_result := json_build_object(
    'event_id', p_event_id,
    'name', v_event.name,
    'status', v_event.status,
    'event_date', v_event.event_date,
    'budget', json_build_object(
      'total', v_budget_total,
      'item_count', v_budget_count
    ),
    'actuals', json_build_object(
      'income', v_income_total,
      'expense', v_expense_total,
      'net', v_income_total - v_expense_total,
      'item_count', v_actuals_count
    ),
    'variance', json_build_object(
      'amount', (v_income_total - v_expense_total) - v_budget_total,
      'percentage', CASE
        WHEN v_budget_total > 0 THEN
          ROUND((((v_income_total - v_expense_total) - v_budget_total) / v_budget_total) * 100, 2)
        ELSE 0
      END
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_fund_event_summary(UUID) IS 'Get comprehensive event summary with budget vs actuals';

-- ============================================================================
-- PHASE 6: SEED ROLE PERMISSIONS
-- ============================================================================

INSERT INTO role_permissions (role, permission, scope, description) VALUES
  ('fund_director', 'events.create', 'assigned', 'Create events for assigned funds'),
  ('fund_director', 'events.edit', 'assigned', 'Edit draft/pending_revision events'),
  ('fund_director', 'events.submit', 'assigned', 'Submit events for treasurer approval'),
  ('fund_director', 'events.view', 'assigned', 'View all events for assigned funds'),
  ('fund_director', 'events.actuals', 'assigned', 'Record actual income/expenses'),
  ('treasurer', 'events.approve', 'all', 'Approve or reject submitted events'),
  ('treasurer', 'events.manage', 'all', 'Full access to all events and actuals'),
  ('treasurer', 'events.create', 'all', 'Create events for any fund'),
  ('admin', 'events.manage', 'all', 'Full administrative access to all events')
ON CONFLICT (role, permission) DO NOTHING;

-- ============================================================================
-- PHASE 7: UPDATE AUTO-TIMESTAMP TRIGGER
-- ============================================================================

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to fund_events
CREATE TRIGGER update_fund_events_updated_at
  BEFORE UPDATE ON fund_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to budget items
CREATE TRIGGER update_fund_event_budget_items_updated_at
  BEFORE UPDATE ON fund_event_budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 8: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count new tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('fund_events', 'fund_event_budget_items', 'fund_event_actuals', 'fund_event_audit');

  -- Count new indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_fund_event%';

  -- Count new policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename LIKE 'fund_event%';

  -- Count new functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN ('process_fund_event_approval', 'get_fund_event_summary');

  RAISE NOTICE '';
  RAISE NOTICE '=== Migration 026: Fund Director Event Management ===';
  RAISE NOTICE 'Tables created: % (expected 4)', table_count;
  RAISE NOTICE 'Indexes created: % (expected 8)', index_count;
  RAISE NOTICE 'RLS policies created: % (expected 12+)', policy_count;
  RAISE NOTICE 'Functions created: % (expected 2)', function_count;
  RAISE NOTICE '';

  IF table_count = 4 AND index_count >= 8 AND policy_count >= 12 AND function_count = 2 THEN
    RAISE NOTICE '✅ Migration completed successfully';
  ELSE
    RAISE WARNING '⚠️  Some objects may not have been created correctly';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Save as 026_fund_director_events_rollback.sql)
-- ============================================================================
/*
BEGIN;

-- Drop tables (cascades to all dependent objects)
DROP TABLE IF EXISTS fund_event_audit CASCADE;
DROP TABLE IF EXISTS fund_event_actuals CASCADE;
DROP TABLE IF EXISTS fund_event_budget_items CASCADE;
DROP TABLE IF EXISTS fund_events CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS process_fund_event_approval(UUID, UUID);
DROP FUNCTION IF EXISTS get_fund_event_summary(UUID);

-- Remove permissions
DELETE FROM role_permissions WHERE permission LIKE 'events.%';

COMMIT;
*/