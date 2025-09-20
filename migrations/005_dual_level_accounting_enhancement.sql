-- Enhancement for dual-level accounting system (PostgreSQL)
-- Adds church-level account management and budget tracking capabilities

CREATE TABLE IF NOT EXISTS church_accounts (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_number TEXT,
  bank_name TEXT,
  opening_balance NUMERIC(18,2) DEFAULT 0,
  current_balance NUMERIC(18,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, account_name),
  FOREIGN KEY (church_id) REFERENCES churches (id),
  CHECK (account_type IN ('checking', 'savings', 'petty_cash', 'special_fund'))
);

CREATE TABLE IF NOT EXISTS church_transaction_categories (
  id BIGSERIAL PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  category_type TEXT NOT NULL,
  parent_category_id BIGINT,
  is_system BOOLEAN DEFAULT FALSE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (parent_category_id) REFERENCES church_transaction_categories (id),
  CHECK (category_type IN ('income', 'expense'))
);

CREATE TABLE IF NOT EXISTS church_transactions (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL,
  transaction_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  transaction_type TEXT NOT NULL,
  category_id BIGINT,
  description TEXT NOT NULL,
  reference_number TEXT,
  check_number TEXT,
  vendor_customer TEXT,
  worship_record_id BIGINT,
  expense_record_id BIGINT,
  report_id BIGINT,
  transfer_account_id BIGINT,
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (account_id) REFERENCES church_accounts (id),
  FOREIGN KEY (category_id) REFERENCES church_transaction_categories (id),
  FOREIGN KEY (transfer_account_id) REFERENCES church_accounts (id),
  FOREIGN KEY (worship_record_id) REFERENCES worship_records (id),
  FOREIGN KEY (expense_record_id) REFERENCES expense_records (id),
  FOREIGN KEY (report_id) REFERENCES reports (id),
  CHECK (transaction_type IN ('income', 'expense', 'transfer'))
);

CREATE TABLE IF NOT EXISTS church_budgets (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  budget_year INTEGER NOT NULL,
  budget_month INTEGER,
  category_id BIGINT NOT NULL,
  budgeted_amount NUMERIC(18,2) NOT NULL,
  actual_amount NUMERIC(18,2) DEFAULT 0,
  variance NUMERIC(18,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, budget_year, budget_month, category_id),
  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (category_id) REFERENCES church_transaction_categories (id)
);

CREATE TABLE IF NOT EXISTS church_financial_goals (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  goal_name TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  target_amount NUMERIC(18,2) NOT NULL,
  current_amount NUMERIC(18,2) DEFAULT 0,
  target_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (church_id) REFERENCES churches (id)
);

CREATE TABLE IF NOT EXISTS church_account_balances (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL,
  balance_date DATE NOT NULL,
  closing_balance NUMERIC(18,2) NOT NULL,
  total_income_month NUMERIC(18,2) DEFAULT 0,
  total_expenses_month NUMERIC(18,2) DEFAULT 0,
  net_change_month NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, balance_date),
  FOREIGN KEY (account_id) REFERENCES church_accounts (id)
);

INSERT INTO church_transaction_categories (category_name, category_type, is_system, description)
VALUES
  ('Diezmos', 'income', TRUE, 'Diezmos recibidos'),
  ('Ofrendas Generales', 'income', TRUE, 'Ofrendas regulares del culto'),
  ('Ofrendas Especiales', 'income', TRUE, 'Ofrendas para propósitos específicos'),
  ('Anexos', 'income', TRUE, 'Ingresos de anexos'),
  ('Caballeros', 'income', TRUE, 'Ofrendas del ministerio de caballeros'),
  ('Damas', 'income', TRUE, 'Ofrendas del ministerio de damas'),
  ('Jóvenes', 'income', TRUE, 'Ofrendas del ministerio de jóvenes'),
  ('Niños', 'income', TRUE, 'Ofrendas del ministerio de niños'),
  ('Otros Ingresos', 'income', TRUE, 'Otros ingresos varios'),
  ('Honorarios Pastorales', 'expense', TRUE, 'Pagos al pastor'),
  ('Servicios Públicos', 'expense', TRUE, 'Luz, agua, basura'),
  ('Mantenimiento', 'expense', TRUE, 'Reparaciones y mantenimiento'),
  ('Suministros', 'expense', TRUE, 'Materiales y suministros'),
  ('Eventos Especiales', 'expense', TRUE, 'Gastos de eventos y actividades'),
  ('Fondo Nacional', 'expense', TRUE, 'Remesas al fondo nacional'),
  ('Otros Gastos', 'expense', TRUE, 'Otros gastos varios')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO church_transaction_categories (category_name, category_type, parent_category_id, is_system, description)
SELECT
  subcategory_name,
  'expense',
  (SELECT id FROM church_transaction_categories WHERE category_name = 'Servicios Públicos'),
  TRUE,
  description
FROM (
  VALUES
    ('Energía Eléctrica', 'Factura de luz'),
    ('Agua Potable', 'Factura de agua'),
    ('Recolección Basura', 'Servicio de recolección de basura')
) AS subcategories (subcategory_name, description)
ON CONFLICT (category_name) DO NOTHING;

DROP FUNCTION IF EXISTS refresh_church_account_balance(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION refresh_church_account_balance(p_account_id BIGINT)
RETURNS VOID AS $$
BEGIN
  IF p_account_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE church_accounts ca
  SET current_balance = ca.opening_balance + COALESCE((
    SELECT SUM(CASE
      WHEN ct.transaction_type = 'income' AND ct.account_id = ca.id THEN ct.amount
      WHEN ct.transaction_type = 'expense' AND ct.account_id = ca.id THEN -ct.amount
      WHEN ct.transaction_type = 'transfer' AND ct.account_id = ca.id THEN -ct.amount
      WHEN ct.transaction_type = 'transfer' AND ct.transfer_account_id = ca.id THEN ct.amount
      ELSE 0
    END)
    FROM church_transactions ct
    WHERE ct.account_id = ca.id OR ct.transfer_account_id = ca.id
  ), 0)
  WHERE ca.id = p_account_id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS trg_church_transactions_refresh_balance() CASCADE;
CREATE OR REPLACE FUNCTION trg_church_transactions_refresh_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM refresh_church_account_balance(NEW.account_id);
    IF NEW.transfer_account_id IS NOT NULL THEN
      PERFORM refresh_church_account_balance(NEW.transfer_account_id);
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM refresh_church_account_balance(OLD.account_id);
    IF OLD.transfer_account_id IS NOT NULL THEN
      PERFORM refresh_church_account_balance(OLD.transfer_account_id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_church_transactions_balance ON church_transactions;
CREATE TRIGGER trg_church_transactions_balance
AFTER INSERT OR UPDATE OR DELETE ON church_transactions
FOR EACH ROW EXECUTE FUNCTION trg_church_transactions_refresh_balance();

CREATE OR REPLACE VIEW church_financial_summary AS
SELECT
  c.id AS church_id,
  c.name AS church_name,
  c.city,
  c.pastor,
  COALESCE(acc_summary.total_checking, 0) AS total_checking,
  COALESCE(acc_summary.total_savings, 0) AS total_savings,
  COALESCE(acc_summary.total_cash, 0) AS total_cash,
  COALESCE(acc_summary.total_all_accounts, 0) AS total_all_accounts,
  COALESCE(month_activity.monthly_income, 0) AS current_month_income,
  COALESCE(month_activity.monthly_expenses, 0) AS current_month_expenses,
  COALESCE(month_activity.monthly_net, 0) AS current_month_net,
  COALESCE(ytd_activity.ytd_income, 0) AS ytd_income,
  COALESCE(ytd_activity.ytd_expenses, 0) AS ytd_expenses,
  COALESCE(ytd_activity.ytd_net, 0) AS ytd_net
FROM churches c
LEFT JOIN (
  SELECT
    church_id,
    SUM(CASE WHEN account_type = 'checking' THEN current_balance ELSE 0 END) AS total_checking,
    SUM(CASE WHEN account_type = 'savings' THEN current_balance ELSE 0 END) AS total_savings,
    SUM(CASE WHEN account_type = 'petty_cash' THEN current_balance ELSE 0 END) AS total_cash,
    SUM(current_balance) AS total_all_accounts
  FROM church_accounts
  WHERE is_active
  GROUP BY church_id
) acc_summary ON c.id = acc_summary.church_id
LEFT JOIN (
  SELECT
    ct.church_id,
    SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END) AS monthly_income,
    SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END) AS monthly_expenses,
    SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE -ct.amount END) AS monthly_net
  FROM church_transactions ct
  WHERE DATE_TRUNC('month', ct.transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY ct.church_id
) month_activity ON c.id = month_activity.church_id
LEFT JOIN (
  SELECT
    ct.church_id,
    SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END) AS ytd_income,
    SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END) AS ytd_expenses,
    SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE -ct.amount END) AS ytd_net
  FROM church_transactions ct
  WHERE DATE_PART('year', ct.transaction_date) = DATE_PART('year', CURRENT_DATE)
  GROUP BY ct.church_id
) ytd_activity ON c.id = ytd_activity.church_id
WHERE c.active;

CREATE OR REPLACE VIEW national_treasury_summary AS
SELECT
  TO_CHAR(r.period_start, 'YYYY') AS year,
  TO_CHAR(r.period_start, 'MM') AS month,
  COUNT(DISTINCT r.church_id) AS reporting_churches,
  COUNT(r.id) AS total_reports,
  SUM(r.total_entradas) AS total_national_income,
  SUM(r.total_salidas) AS total_national_expenses,
  SUM(r.total_fondo_nacional) AS total_national_fund,
  SUM(r.monto_depositado) AS total_deposits,
  SUM(COALESCE(micro.church_income, 0)) AS total_micro_income,
  SUM(COALESCE(micro.church_expenses, 0)) AS total_micro_expenses,
  SUM(r.total_entradas) - SUM(COALESCE(micro.church_income, 0)) AS income_variance,
  SUM(r.total_salidas) - SUM(COALESCE(micro.church_expenses, 0)) AS expense_variance
FROM (
  SELECT r.*, DATE_TRUNC('month', r.created_at) AS period_start
  FROM reports r
) r
LEFT JOIN (
  SELECT
    ct.church_id,
    DATE_TRUNC('month', ct.transaction_date) AS period_start,
    SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END) AS church_income,
    SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END) AS church_expenses
  FROM church_transactions ct
  GROUP BY ct.church_id, DATE_TRUNC('month', ct.transaction_date)
) micro ON r.church_id = micro.church_id AND r.period_start = micro.period_start
GROUP BY r.period_start
ORDER BY r.period_start DESC;
