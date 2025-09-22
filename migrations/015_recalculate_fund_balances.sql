-- Migration: Recalculate Fund Balances from Transaction History
-- Purpose: Fix mismatches between stored balances and actual transaction totals
-- Date: 2025-09-21

BEGIN;

-- First, let's create a backup of current balances
CREATE TABLE IF NOT EXISTS fund_balance_backup_20250921 AS
SELECT
    id,
    name,
    current_balance,
    updated_at,
    NOW() as backup_timestamp
FROM funds;

-- Recalculate balances for each fund based on transaction history
UPDATE funds f
SET
    current_balance = subquery.calculated_balance,
    updated_at = NOW()
FROM (
    SELECT
        fund_id,
        COALESCE(SUM(amount_in), 0) - COALESCE(SUM(amount_out), 0) as calculated_balance
    FROM transactions
    GROUP BY fund_id
) subquery
WHERE f.id = subquery.fund_id;

-- Log the balance corrections
DO $$
DECLARE
    fund_record RECORD;
    old_balance NUMERIC;
    new_balance NUMERIC;
BEGIN
    FOR fund_record IN
        SELECT f.id, f.name, fb.current_balance as old_balance, f.current_balance as new_balance
        FROM funds f
        JOIN fund_balance_backup_20250921 fb ON f.id = fb.id
        WHERE ABS(fb.current_balance - f.current_balance) > 0.01
    LOOP
        RAISE NOTICE 'Fund % balance corrected: % -> %',
            fund_record.name,
            fund_record.old_balance,
            fund_record.new_balance;
    END LOOP;
END $$;

-- Verify all balances now match calculations
DO $$
DECLARE
    mismatch_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO mismatch_count
    FROM funds f
    LEFT JOIN (
        SELECT
            fund_id,
            COALESCE(SUM(amount_in), 0) - COALESCE(SUM(amount_out), 0) as calculated_balance
        FROM transactions
        GROUP BY fund_id
    ) t ON f.id = t.fund_id
    WHERE ABS(f.current_balance - COALESCE(t.calculated_balance, 0)) > 0.01;

    IF mismatch_count > 0 THEN
        RAISE EXCEPTION 'Balance recalculation failed - % funds still have mismatches', mismatch_count;
    END IF;

    RAISE NOTICE 'All fund balances successfully recalculated and verified';
END $$;

-- Add trigger to ensure balance integrity going forward
CREATE OR REPLACE FUNCTION update_fund_balance_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    delta_old NUMERIC(18,2);
    delta_new NUMERIC(18,2);
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE funds
        SET current_balance = current_balance + (NEW.amount_in - NEW.amount_out),
            updated_at = NOW()
        WHERE id = NEW.fund_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        delta_old = OLD.amount_in - OLD.amount_out;
        delta_new = NEW.amount_in - NEW.amount_out;

        IF NEW.fund_id = OLD.fund_id THEN
            IF delta_old <> delta_new THEN
                UPDATE funds
                SET current_balance = current_balance - delta_old + delta_new,
                    updated_at = NOW()
                WHERE id = NEW.fund_id;
            END IF;
        ELSE
            UPDATE funds
            SET current_balance = current_balance - delta_old,
                updated_at = NOW()
            WHERE id = OLD.fund_id;

            UPDATE funds
            SET current_balance = current_balance + delta_new,
                updated_at = NOW()
            WHERE id = NEW.fund_id;
        END IF;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE funds
        SET current_balance = current_balance - (OLD.amount_in - OLD.amount_out),
            updated_at = NOW()
        WHERE id = OLD.fund_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_fund_balance_trigger ON transactions;

-- Create the trigger
CREATE TRIGGER update_fund_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_fund_balance_on_transaction();

COMMIT;