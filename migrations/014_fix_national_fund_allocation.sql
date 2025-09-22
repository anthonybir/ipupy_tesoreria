-- Fix National Fund Allocation Rules
-- Migration 014: Correctly implements 10% for tithes/offerings and 100% for special mission funds

-- Update fund_bucket constraint to include all special fund types
ALTER TABLE worship_contributions
DROP CONSTRAINT IF EXISTS valid_fund_bucket;

ALTER TABLE worship_contributions
ADD CONSTRAINT valid_fund_bucket
CHECK (fund_bucket IN (
  'diezmo',           -- 10% to national fund
  'ofrenda',          -- 10% to national fund
  'misiones',         -- 100% to national fund (Ofrenda Misiones)
  'lazos_amor',       -- 100% to national fund
  'mision_posible',   -- 100% to national fund
  'apy',              -- 100% to national fund (Asociación Pentecostal Juventud)
  'instituto_biblico',-- 100% to national fund
  'diezmo_pastoral',  -- 100% to national fund
  'caballeros',       -- 100% to national fund (when designated for national)
  'damas',            -- Local church fund
  'jovenes',          -- Local church fund
  'ninos',            -- Local church fund
  'anexos',           -- Local church fund
  'otros'             -- Local church fund
));

-- Drop and recreate the calculate_monthly_totals function with correct fund allocation
DROP FUNCTION IF EXISTS calculate_monthly_totals(BIGINT, INTEGER, INTEGER);

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
  -- National fund breakdown
  fondo_nacional_10_percent NUMERIC(18,2),    -- 10% of tithes/offerings
  fondo_nacional_100_percent NUMERIC(18,2),   -- 100% of special mission funds
  fondo_nacional_total NUMERIC(18,2),         -- Total to national fund
  -- Local church funds
  disponible_local_90_percent NUMERIC(18,2),  -- 90% of tithes/offerings
  disponible_local_otros NUMERIC(18,2),       -- 100% of local designated funds
  disponible_local_total NUMERIC(18,2),       -- Total available locally
  -- Expenses
  total_gastos_servicios NUMERIC(18,2),
  total_gastos_otros NUMERIC(18,2),
  total_gastos NUMERIC(18,2),
  salario_pastoral_calculado NUMERIC(18,2),
  balance_calculado NUMERIC(18,2)
) AS $$
DECLARE
  v_total_diezmos NUMERIC(18,2) := 0;
  v_total_ofrendas NUMERIC(18,2) := 0;
  v_total_misiones_100 NUMERIC(18,2) := 0;
  v_total_local_otros NUMERIC(18,2) := 0;
  v_total_entradas NUMERIC(18,2) := 0;
  v_fondo_nacional_10 NUMERIC(18,2) := 0;
  v_fondo_nacional_100 NUMERIC(18,2) := 0;
  v_fondo_nacional_total NUMERIC(18,2) := 0;
  v_disponible_local_90 NUMERIC(18,2) := 0;
  v_disponible_local_otros NUMERIC(18,2) := 0;
  v_disponible_local_total NUMERIC(18,2) := 0;
  v_total_gastos NUMERIC(18,2) := 0;
  v_salario_pastoral NUMERIC(18,2) := 0;
  v_balance NUMERIC(18,2) := 0;
BEGIN
  -- Calculate income by fund bucket from worship_contributions
  SELECT
    -- 10% national fund items
    COALESCE(SUM(CASE WHEN fund_bucket = 'diezmo' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN fund_bucket = 'ofrenda' THEN total ELSE 0 END), 0),
    -- 100% national fund items
    COALESCE(SUM(CASE WHEN fund_bucket IN ('misiones', 'lazos_amor', 'mision_posible',
                                           'apy', 'instituto_biblico', 'diezmo_pastoral',
                                           'caballeros') THEN total ELSE 0 END), 0),
    -- Local church funds
    COALESCE(SUM(CASE WHEN fund_bucket IN ('anexos', 'damas', 'jovenes', 'ninos', 'otros')
                      THEN total ELSE 0 END), 0),
    COALESCE(SUM(total), 0)
  INTO v_total_diezmos, v_total_ofrendas, v_total_misiones_100, v_total_local_otros, v_total_entradas
  FROM worship_contributions wc
  JOIN worship_records wr ON wc.worship_record_id = wr.id
  WHERE wr.church_id = p_church_id
    AND EXTRACT(MONTH FROM wr.fecha_culto) = p_month
    AND EXTRACT(YEAR FROM wr.fecha_culto) = p_year;

  -- Add anonymous offerings (treated as regular offerings - 10% to national)
  SELECT
    v_total_ofrendas + COALESCE(SUM(ofrenda_general_anonima), 0),
    v_total_entradas + COALESCE(SUM(ofrenda_general_anonima), 0)
  INTO v_total_ofrendas, v_total_entradas
  FROM worship_records
  WHERE church_id = p_church_id
    AND EXTRACT(MONTH FROM fecha_culto) = p_month
    AND EXTRACT(YEAR FROM fecha_culto) = p_year;

  -- Calculate national fund allocations
  -- 10% of tithes and regular offerings
  v_fondo_nacional_10 := ROUND((v_total_diezmos + v_total_ofrendas) * 0.10, 0);
  -- 100% of special mission funds
  v_fondo_nacional_100 := v_total_misiones_100;
  -- Total to national fund
  v_fondo_nacional_total := v_fondo_nacional_10 + v_fondo_nacional_100;

  -- Calculate local available funds
  -- 90% of tithes and regular offerings
  v_disponible_local_90 := ROUND((v_total_diezmos + v_total_ofrendas) * 0.90, 0);
  -- 100% of local designated funds
  v_disponible_local_otros := v_total_local_otros;
  -- Total available locally
  v_disponible_local_total := v_disponible_local_90 + v_disponible_local_otros;

  -- Calculate expenses by category
  SELECT
    COALESCE(SUM(CASE WHEN expense_category = 'servicios_basicos' THEN total_factura ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN expense_category != 'servicios_basicos' AND NOT es_honorario_pastoral
                      THEN total_factura ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT es_honorario_pastoral THEN total_factura ELSE 0 END), 0)
  INTO total_gastos_servicios, total_gastos_otros, v_total_gastos
  FROM expense_records
  WHERE church_id = p_church_id
    AND EXTRACT(MONTH FROM fecha_comprobante) = p_month
    AND EXTRACT(YEAR FROM fecha_comprobante) = p_year;

  -- Calculate pastoral salary (remaining local funds after expenses)
  v_salario_pastoral := GREATEST(v_disponible_local_total - v_total_gastos, 0);

  -- Calculate balance (should be 0 for balanced month)
  v_balance := v_disponible_local_total - v_total_gastos - v_salario_pastoral;

  -- Return calculated values
  total_diezmos := v_total_diezmos;
  total_ofrendas := v_total_ofrendas;
  total_misiones := v_total_misiones_100;
  total_otros := v_total_local_otros;
  total_entradas := v_total_entradas;

  fondo_nacional_10_percent := v_fondo_nacional_10;
  fondo_nacional_100_percent := v_fondo_nacional_100;
  fondo_nacional_total := v_fondo_nacional_total;

  disponible_local_90_percent := v_disponible_local_90;
  disponible_local_otros := v_disponible_local_otros;
  disponible_local_total := v_disponible_local_total;

  total_gastos := v_total_gastos;
  salario_pastoral_calculado := v_salario_pastoral;
  balance_calculado := v_balance;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Update comments for documentation
COMMENT ON FUNCTION calculate_monthly_totals IS 'Calcula totales mensuales con reglas correctas: 10% de diezmos/ofrendas y 100% de fondos misioneros al fondo nacional';