-- Fund Management Enhancement
-- Adds tables for national-level fund management and transaction tracking

-- National funds table (for national treasury management)
CREATE TABLE IF NOT EXISTS funds (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  description TEXT,
  current_balance NUMERIC(18,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (type IN ('nacional', 'construccion', 'misionero', 'especial', 'obras_beneficas', 'educativo', 'otro'))
);

-- National transactions table (for tracking all treasury transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  church_id BIGINT,
  report_id BIGINT,
  fund_id BIGINT NOT NULL,
  concept TEXT NOT NULL,
  provider TEXT,
  document_number TEXT,
  amount_in NUMERIC(18,2) DEFAULT 0,
  amount_out NUMERIC(18,2) DEFAULT 0,
  balance NUMERIC(18,2) DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (report_id) REFERENCES reports (id),
  FOREIGN KEY (fund_id) REFERENCES funds (id),
  CHECK (amount_in >= 0 AND amount_out >= 0),
  CHECK (NOT (amount_in > 0 AND amount_out > 0))
);

-- Enhanced fund movements table for tracking fund balance changes
-- This supplements the existing fund_movements table
CREATE TABLE IF NOT EXISTS fund_movements_enhanced (
  id BIGSERIAL PRIMARY KEY,
  fund_id BIGINT NOT NULL,
  transaction_id BIGINT,
  previous_balance NUMERIC(18,2) NOT NULL,
  movement NUMERIC(18,2) NOT NULL,
  new_balance NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (fund_id) REFERENCES funds (id),
  FOREIGN KEY (transaction_id) REFERENCES transactions (id)
);

-- Insert actual funds from legacy Excel data
-- These are the real funds used by IPU Paraguay National Treasury
INSERT INTO funds (name, type, description, current_balance, is_active, created_by)
VALUES
  ('General', 'nacional', 'Fondo General - Principal fondo de operaciones', 0, TRUE, 'system'),
  ('Caballeros', 'especial', 'Fondo de Caballeros - Ministerio masculino', 0, TRUE, 'system'),
  ('Misiones', 'misionero', 'Fondo de Misiones - Apoyo misionero nacional e internacional', 0, TRUE, 'system'),
  ('APY', 'especial', 'Fondo APY - Asociación Pentecostal de Jóvenes', 0, TRUE, 'system'),
  ('Lazos de Amor', 'obras_beneficas', 'Fondo Lazos de Amor - Obras benéficas y caridad', 0, TRUE, 'system'),
  ('Mision Posible', 'misionero', 'Fondo Misión Posible - Proyectos misioneros especiales', 0, TRUE, 'system'),
  ('Niños', 'especial', 'Fondo de Niños - Ministerio infantil', 0, TRUE, 'system'),
  ('IBA', 'educativo', 'Fondo IBA - Instituto Bíblico y educación teológica', 0, TRUE, 'system'),
  ('Damas', 'especial', 'Fondo de Damas - Ministerio femenino', 0, TRUE, 'system')
ON CONFLICT (name) DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_fund_date ON transactions (fund_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_church_date ON transactions (church_id, date);
CREATE INDEX IF NOT EXISTS idx_fund_movements_enhanced_fund ON fund_movements_enhanced (fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_movements_enhanced_transaction ON fund_movements_enhanced (transaction_id);

-- Update trigger to maintain fund balances
CREATE OR REPLACE FUNCTION update_fund_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the fund's current balance
  UPDATE funds
  SET current_balance = NEW.new_balance,
      updated_at = NOW()
  WHERE id = NEW.fund_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fund_balance ON fund_movements_enhanced;
CREATE TRIGGER trigger_update_fund_balance
  AFTER INSERT ON fund_movements_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION update_fund_balance();