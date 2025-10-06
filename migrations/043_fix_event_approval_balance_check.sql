-- Migration 043: Add negative balance validation to event approval
-- Date: 2025-01-06
-- Purpose: Prevent event approval if expense would create negative fund balance
-- Related: BUSINESS_LOGIC_AUDIT_2025-01-06.md Critical Bug #4

-- =============================================================================
-- CRITICAL FIX: Negative Balance Prevention
-- =============================================================================
-- Current state: process_fund_event_approval calculates v_new_balance but doesn't validate >= 0
-- Required state: Function should raise exception if expense exceeds available balance
-- Business rule: Fund balances must never be negative (BUSINESS_LOGIC.md:447-448)
-- Risk: Events approved that exceed fund balance, creating negative balances

BEGIN;

-- Drop and recreate the function with balance validation
DROP FUNCTION IF EXISTS process_fund_event_approval(UUID, UUID);

CREATE OR REPLACE FUNCTION process_fund_event_approval(p_event_id UUID, p_approved_by UUID)
RETURNS JSON AS $$
DECLARE
  v_event RECORD;
  v_total_income NUMERIC;
  v_total_expense NUMERIC;
  v_net_amount NUMERIC;
  v_transaction_ids INTEGER[];
  v_result JSON;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id INTEGER;
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

  -- Get current fund balance WITH ROW LOCK to prevent race conditions
  SELECT current_balance INTO v_current_balance
  FROM funds WHERE id = v_event.fund_id
  FOR UPDATE;  -- Lock fund row for duration of transaction

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fund not found: %', v_event.fund_id;
  END IF;

  -- Create transaction for income (if any)
  IF v_total_income > 0 THEN
    v_new_balance := v_current_balance + v_total_income;

    INSERT INTO transactions (
      fund_id, church_id, concept, amount_in, amount_out, balance, date, created_by, created_at
    ) VALUES (
      v_event.fund_id,
      v_event.church_id,
      format('Evento: %s - Ingresos', v_event.name),
      v_total_income,
      0,
      v_new_balance,
      v_event.event_date,
      'system',
      now()
    ) RETURNING id INTO v_transaction_id;

    -- Record fund movement
    INSERT INTO fund_movements_enhanced (
      fund_id, transaction_id, previous_balance, movement, new_balance
    ) VALUES (
      v_event.fund_id,
      v_transaction_id,
      v_current_balance,
      v_total_income,
      v_new_balance
    );

    v_current_balance := v_new_balance;
    v_transaction_ids[1] := v_transaction_id;
  END IF;

  -- Create transaction for expenses (if any)
  IF v_total_expense > 0 THEN
    v_new_balance := v_current_balance - v_total_expense;

    -- CRITICAL FIX: Validate balance won't go negative
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Fondos insuficientes en fondo %. Saldo actual: ₲%, gasto requerido: ₲%, déficit: ₲%',
        v_event.fund_id,
        v_current_balance,
        v_total_expense,
        ABS(v_new_balance)
      USING
        HINT = 'Verifique el presupuesto del evento o reduzca los gastos. No se pueden aprobar eventos que excedan el saldo disponible.',
        ERRCODE = 'check_violation';
    END IF;

    INSERT INTO transactions (
      fund_id, church_id, concept, amount_in, amount_out, balance, date, created_by, created_at
    ) VALUES (
      v_event.fund_id,
      v_event.church_id,
      format('Evento: %s - Gastos', v_event.name),
      0,
      v_total_expense,
      v_new_balance,
      v_event.event_date,
      'system',
      now()
    ) RETURNING id INTO v_transaction_id;

    -- Record fund movement
    INSERT INTO fund_movements_enhanced (
      fund_id, transaction_id, previous_balance, movement, new_balance
    ) VALUES (
      v_event.fund_id,
      v_transaction_id,
      v_current_balance,
      -v_total_expense,
      v_new_balance
    );

    v_current_balance := v_new_balance;
    v_transaction_ids[2] := v_transaction_id;
  END IF;

  -- Update fund balance
  UPDATE funds
  SET current_balance = v_current_balance,
      updated_at = now()
  WHERE id = v_event.fund_id;

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
    'final_balance', v_current_balance,
    'transactions_created', v_transaction_ids,
    'transaction_count', COALESCE(array_length(v_transaction_ids, 1), 0)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_fund_event_approval(UUID, UUID) IS
  'Approve fund event and create ledger transactions. VALIDATES balance >= 0 before creating expense transactions. Includes row-level locking (FOR UPDATE) to prevent race conditions.';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Test negative balance prevention:
-- 1. Create test event with expense exceeding fund balance
-- 2. Try to approve it
-- Expected: Exception with message "Fondos insuficientes"

-- Example test scenario:
-- INSERT INTO fund_events (...) VALUES (...);
-- INSERT INTO fund_event_actuals (event_id, line_type, amount) VALUES (test_event_id, 'expense', 999999999);
-- SELECT process_fund_event_approval(test_event_id, admin_user_id);
-- Expected: ERROR: Fondos insuficientes en fondo ...

-- Verify FOR UPDATE lock is working:
-- SELECT current_balance FROM funds WHERE id = test_fund_id FOR UPDATE;
-- (Run in separate transaction while approval is in progress)
-- Expected: Query waits until approval transaction completes
