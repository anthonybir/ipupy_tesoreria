-- Migration 048: Fix Event Approval Balance Locking
-- Adds FOR UPDATE clause to prevent race conditions during concurrent event approvals
--
-- ISSUE: Migration 029 (process_fund_event_approval) retrieves fund balance without locking
-- RISK: Two concurrent approvals could read the same balance, leading to incorrect final balance
-- FIX: Add FOR UPDATE to lock the fund row before calculating new balance
--
-- Related: MEDIUM #15 - Review migration 029 for balance locking
-- Audit: docs/audits/ACTION_CHECKLIST.md line 232

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

  -- ⚠️ CRITICAL FIX: Lock fund row to prevent race conditions
  -- Get current fund balance WITH FOR UPDATE to prevent concurrent modifications
  SELECT current_balance INTO v_current_balance
  FROM funds WHERE id = v_event.fund_id
  FOR UPDATE;  -- 🔒 THIS WAS MISSING IN MIGRATION 029

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

    -- Check for negative balance (added in migration 043)
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Fondos insuficientes en fondo %. Saldo actual: %, gasto requerido: %',
        v_event.fund_id, v_current_balance, v_total_expense
      USING HINT = 'Verifique el presupuesto del evento o reduzca los gastos.';
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
  'Approve fund event and automatically create ledger transactions from actuals with proper balance tracking, fund_movements_enhanced entries, and row-level locking to prevent race conditions (migration 048 fix)';
