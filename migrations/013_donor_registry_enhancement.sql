-- Enhanced Donor Registry and Monthly Balance System
-- Migration 013: Creates donor registry and enhances existing tables for detailed tracking

-- Create donors table for permanent donor registry
CREATE TABLE IF NOT EXISTS donors (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  nombre_completo TEXT NOT NULL,
  ci_ruc TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  fecha_primera_contribucion DATE,
  tipo_donante TEXT DEFAULT 'regular', -- regular/visitante/itinerante
  observaciones TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id),
  UNIQUE (church_id, ci_ruc)
);

-- Add donor tracking columns to worship_contributions
ALTER TABLE worship_contributions
ADD COLUMN IF NOT EXISTS donor_id BIGINT REFERENCES donors(id),
ADD COLUMN IF NOT EXISTS fund_bucket TEXT DEFAULT 'diezmo'; -- diezmo/ofrenda/misiones/anexos/otros

-- Update fund_bucket constraint
ALTER TABLE worship_contributions
ADD CONSTRAINT valid_fund_bucket
CHECK (fund_bucket IN ('diezmo', 'ofrenda', 'misiones', 'anexos', 'caballeros', 'damas', 'jovenes', 'ninos', 'otros'));

-- Add balance tracking fields to reports table
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS balance_status TEXT DEFAULT 'abierto', -- abierto/balanceado/deficit/pendiente
ADD COLUMN IF NOT EXISTS balance_delta NUMERIC(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_by TEXT;

-- Update balance_status constraint
ALTER TABLE reports
ADD CONSTRAINT valid_balance_status
CHECK (balance_status IN ('abierto', 'balanceado', 'deficit', 'pendiente', 'cerrado'));

-- Add enhanced expense category tracking
ALTER TABLE expense_records
ADD COLUMN IF NOT EXISTS expense_category TEXT DEFAULT 'otros'; -- servicios_basicos/honorarios/ministerio/otros

-- Update expense category constraint
ALTER TABLE expense_records
ADD CONSTRAINT valid_expense_category
CHECK (expense_category IN ('servicios_basicos', 'honorarios', 'ministerio', 'materiales', 'mantenimiento', 'otros'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_donors_church_ci ON donors(church_id, ci_ruc);
CREATE INDEX IF NOT EXISTS idx_donors_name_search ON donors USING gin(to_tsvector('spanish', nombre_completo));
CREATE INDEX IF NOT EXISTS idx_worship_contributions_donor ON worship_contributions(donor_id);
CREATE INDEX IF NOT EXISTS idx_worship_contributions_fund_bucket ON worship_contributions(fund_bucket);
CREATE INDEX IF NOT EXISTS idx_expense_records_category ON expense_records(expense_category);
CREATE INDEX IF NOT EXISTS idx_reports_balance_status ON reports(balance_status);

-- Function to automatically update donor's first contribution date
CREATE OR REPLACE FUNCTION update_donor_first_contribution()
RETURNS TRIGGER AS $$
BEGIN
  -- Update first contribution date if this is earlier
  UPDATE donors
  SET fecha_primera_contribucion = LEAST(
    COALESCE(fecha_primera_contribucion, NEW.created_at::date),
    NEW.created_at::date
  ),
  updated_at = NOW()
  WHERE id = NEW.donor_id
  AND NEW.donor_id IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating donor first contribution
DROP TRIGGER IF EXISTS trigger_update_donor_first_contribution ON worship_contributions;
CREATE TRIGGER trigger_update_donor_first_contribution
  AFTER INSERT ON worship_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_donor_first_contribution();

-- Function to automatically calculate report totals from detail tables
CREATE OR REPLACE FUNCTION calculate_monthly_totals(
  p_church_id BIGINT,
  p_month INTEGER,
  p_year INTEGER
) RETURNS TABLE (
  total_diezmos NUMERIC(18,2),
  total_ofrendas NUMERIC(18,2),
  total_misiones NUMERIC(18,2),
  total_otros NUMERIC(18,2),
  total_entradas NUMERIC(18,2),
  fondo_nacional_10_percent NUMERIC(18,2),
  disponible_local_90_percent NUMERIC(18,2),
  total_gastos_servicios NUMERIC(18,2),
  total_gastos_otros NUMERIC(18,2),
  total_gastos NUMERIC(18,2),
  salario_pastoral_calculado NUMERIC(18,2),
  balance_calculado NUMERIC(18,2)
) AS $$
DECLARE
  v_total_entradas NUMERIC(18,2) := 0;
  v_total_gastos NUMERIC(18,2) := 0;
  v_fondo_nacional NUMERIC(18,2) := 0;
  v_disponible_local NUMERIC(18,2) := 0;
  v_salario_pastoral NUMERIC(18,2) := 0;
  v_balance NUMERIC(18,2) := 0;
BEGIN
  -- Calculate income by fund bucket from worship_contributions
  SELECT
    COALESCE(SUM(CASE WHEN fund_bucket = 'diezmo' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN fund_bucket = 'ofrenda' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN fund_bucket = 'misiones' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN fund_bucket NOT IN ('diezmo', 'ofrenda', 'misiones') THEN total ELSE 0 END), 0),
    COALESCE(SUM(total), 0)
  INTO total_diezmos, total_ofrendas, total_misiones, total_otros, v_total_entradas
  FROM worship_contributions wc
  JOIN worship_records wr ON wc.worship_record_id = wr.id
  WHERE wr.church_id = p_church_id
    AND EXTRACT(MONTH FROM wr.fecha_culto) = p_month
    AND EXTRACT(YEAR FROM wr.fecha_culto) = p_year;

  -- Add anonymous offerings from worship_records
  SELECT
    v_total_entradas + COALESCE(SUM(ofrenda_general_anonima), 0)
  INTO v_total_entradas
  FROM worship_records
  WHERE church_id = p_church_id
    AND EXTRACT(MONTH FROM fecha_culto) = p_month
    AND EXTRACT(YEAR FROM fecha_culto) = p_year;

  -- Calculate national fund (10%) and local available (90%)
  v_fondo_nacional := ROUND(v_total_entradas * 0.10, 0);
  v_disponible_local := v_total_entradas - v_fondo_nacional;

  -- Calculate expenses by category
  SELECT
    COALESCE(SUM(CASE WHEN expense_category = 'servicios_basicos' THEN total_factura ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN expense_category != 'servicios_basicos' AND NOT es_honorario_pastoral THEN total_factura ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT es_honorario_pastoral THEN total_factura ELSE 0 END), 0)
  INTO total_gastos_servicios, total_gastos_otros, v_total_gastos
  FROM expense_records
  WHERE church_id = p_church_id
    AND EXTRACT(MONTH FROM fecha_comprobante) = p_month
    AND EXTRACT(YEAR FROM fecha_comprobante) = p_year;

  -- Calculate pastoral salary (remaining after expenses)
  v_salario_pastoral := GREATEST(v_disponible_local - v_total_gastos, 0);

  -- Calculate balance (should be 0 for balanced month)
  v_balance := v_disponible_local - v_total_gastos - v_salario_pastoral;

  -- Return calculated values
  total_entradas := v_total_entradas;
  fondo_nacional_10_percent := v_fondo_nacional;
  disponible_local_90_percent := v_disponible_local;
  total_gastos := v_total_gastos;
  salario_pastoral_calculado := v_salario_pastoral;
  balance_calculado := v_balance;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create or match donors from contribution entries
CREATE OR REPLACE FUNCTION find_or_create_donor(
  p_church_id BIGINT,
  p_nombre TEXT,
  p_ci_ruc TEXT
) RETURNS BIGINT AS $$
DECLARE
  v_donor_id BIGINT;
  v_clean_ci_ruc TEXT;
  v_clean_nombre TEXT;
BEGIN
  -- Clean and normalize input
  v_clean_ci_ruc := TRIM(UPPER(REGEXP_REPLACE(p_ci_ruc, '[^0-9A-Z-]', '', 'g')));
  v_clean_nombre := TRIM(INITCAP(p_nombre));

  -- Try to find existing donor by CI/RUC first
  SELECT id INTO v_donor_id
  FROM donors
  WHERE church_id = p_church_id
    AND ci_ruc = v_clean_ci_ruc
  LIMIT 1;

  -- If not found, try by name similarity
  IF v_donor_id IS NULL THEN
    SELECT id INTO v_donor_id
    FROM donors
    WHERE church_id = p_church_id
      AND similarity(nombre_completo, v_clean_nombre) > 0.6
    ORDER BY similarity(nombre_completo, v_clean_nombre) DESC
    LIMIT 1;
  END IF;

  -- If still not found, create new donor
  IF v_donor_id IS NULL THEN
    INSERT INTO donors (church_id, nombre_completo, ci_ruc, fecha_primera_contribucion)
    VALUES (p_church_id, v_clean_nombre, v_clean_ci_ruc, CURRENT_DATE)
    RETURNING id INTO v_donor_id;
  ELSE
    -- Update existing donor name if needed (in case of typos)
    UPDATE donors
    SET nombre_completo = v_clean_nombre,
        updated_at = NOW()
    WHERE id = v_donor_id
      AND LENGTH(v_clean_nombre) > LENGTH(nombre_completo);
  END IF;

  RETURN v_donor_id;
END;
$$ LANGUAGE plpgsql;

-- Enable pg_trgm extension for name similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Comments for documentation
COMMENT ON TABLE donors IS 'Registro permanente de donantes por iglesia con historial completo';
COMMENT ON COLUMN donors.tipo_donante IS 'Tipo de donante: regular (miembro), visitante, itinerante (otras iglesias)';
COMMENT ON COLUMN worship_contributions.fund_bucket IS 'Categoría del aporte para cálculos automáticos del 10%';
COMMENT ON COLUMN reports.balance_status IS 'Estado del balance mensual: abierto, balanceado, deficit, cerrado';
COMMENT ON FUNCTION calculate_monthly_totals IS 'Calcula automáticamente totales mensuales desde tablas de detalle';
COMMENT ON FUNCTION find_or_create_donor IS 'Busca o crea donante automáticamente con matching inteligente';