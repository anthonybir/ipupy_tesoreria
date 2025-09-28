-- Migration: Fix fund event approval to maintain balance integrity
-- This fixes the process_fund_event_approval function to properly update balances
-- and create fund_movements_enhanced entries

-- Drop and recreate the function with proper balance handling
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

  -- Get current fund balance
  SELECT current_balance INTO v_current_balance
  FROM funds WHERE id = v_event.fund_id;

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
  'Approve fund event and automatically create ledger transactions from actuals with proper balance tracking and fund_movements_enhanced entries';