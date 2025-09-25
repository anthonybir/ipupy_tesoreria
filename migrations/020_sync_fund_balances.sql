-- Synchronize stored fund balances with the ledger
UPDATE funds f
SET current_balance = COALESCE((
  SELECT SUM(t.amount_in - t.amount_out)
  FROM transactions t
  WHERE t.fund_id = f.id
), 0);
