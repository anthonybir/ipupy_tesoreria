-- Initial database schema for IPUPY Tesorería (PostgreSQL)

-- Fund categories table
CREATE TABLE IF NOT EXISTS fund_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Churches table with complete pastor information
CREATE TABLE IF NOT EXISTS churches (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  pastor TEXT NOT NULL,
  phone TEXT,
  pastor_ruc TEXT,
  pastor_cedula TEXT,
  pastor_grado TEXT,
  pastor_posicion TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name)
);

-- Enhanced monthly reports table
CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,

  -- ENTRADAS DEL MES
  diezmos NUMERIC(18,2) DEFAULT 0,
  ofrendas NUMERIC(18,2) DEFAULT 0,
  anexos NUMERIC(18,2) DEFAULT 0,
  caballeros NUMERIC(18,2) DEFAULT 0,
  damas NUMERIC(18,2) DEFAULT 0,
  jovenes NUMERIC(18,2) DEFAULT 0,
  ninos NUMERIC(18,2) DEFAULT 0,
  otros NUMERIC(18,2) DEFAULT 0,
  total_entradas NUMERIC(18,2) DEFAULT 0,

  -- SALIDAS DEL MES
  honorarios_pastoral NUMERIC(18,2) DEFAULT 0,
  honorarios_factura_numero TEXT,
  honorarios_ruc_pastor TEXT,
  fondo_nacional NUMERIC(18,2) DEFAULT 0,
  energia_electrica NUMERIC(18,2) DEFAULT 0,
  agua NUMERIC(18,2) DEFAULT 0,
  recoleccion_basura NUMERIC(18,2) DEFAULT 0,
  otros_gastos NUMERIC(18,2) DEFAULT 0,
  total_salidas NUMERIC(18,2) DEFAULT 0,

  -- OFRENDAS DIRECTAS FONDO NACIONAL
  ofrenda_misiones NUMERIC(18,2) DEFAULT 0,
  lazos_amor NUMERIC(18,2) DEFAULT 0,
  mision_posible NUMERIC(18,2) DEFAULT 0,
  aporte_caballeros NUMERIC(18,2) DEFAULT 0,
  apy NUMERIC(18,2) DEFAULT 0,
  instituto_biblico NUMERIC(18,2) DEFAULT 0,
  diezmo_pastoral NUMERIC(18,2) DEFAULT 0,
  total_fondo_nacional NUMERIC(18,2) DEFAULT 0,

  -- EXISTENCIA EN CAJA
  saldo_mes_anterior NUMERIC(18,2) DEFAULT 0,
  entrada_iglesia_local NUMERIC(18,2) DEFAULT 0,
  total_entrada_mensual NUMERIC(18,2) DEFAULT 0,
  saldo_fin_mes NUMERIC(18,2) DEFAULT 0,

  -- DEPÓSITO BANCARIO
  fecha_deposito DATE,
  numero_deposito TEXT,
  monto_depositado NUMERIC(18,2) DEFAULT 0,

  -- ASISTENCIAS Y BAUTISMOS
  asistencia_visitas INTEGER DEFAULT 0,
  bautismos_agua INTEGER DEFAULT 0,
  bautismos_espiritu INTEGER DEFAULT 0,

  -- ARCHIVOS Y OBSERVACIONES
  foto_informe TEXT,
  foto_deposito TEXT,
  observaciones TEXT,
  estado TEXT DEFAULT 'pendiente',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (church_id, month, year),
  FOREIGN KEY (church_id) REFERENCES churches (id)
);

-- Individual worship records table
CREATE TABLE IF NOT EXISTS worship_records (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  fecha_culto DATE NOT NULL,
  tipo_culto TEXT NOT NULL,
  predicador TEXT,
  encargado_registro TEXT,

  -- TOTALES DEL CULTO
  total_diezmos NUMERIC(18,2) DEFAULT 0,
  total_ofrendas NUMERIC(18,2) DEFAULT 0,
  total_misiones NUMERIC(18,2) DEFAULT 0,
  total_otros NUMERIC(18,2) DEFAULT 0,
  ofrenda_general_anonima NUMERIC(18,2) DEFAULT 0,
  total_recaudado NUMERIC(18,2) DEFAULT 0,

  -- ASISTENCIA
  miembros_activos INTEGER DEFAULT 0,
  visitas INTEGER DEFAULT 0,
  ninos INTEGER DEFAULT 0,
  jovenes INTEGER DEFAULT 0,
  total_asistencia INTEGER DEFAULT 0,
  bautismos_agua INTEGER DEFAULT 0,
  bautismos_espiritu INTEGER DEFAULT 0,

  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id)
);

-- Detailed worship contributions
CREATE TABLE IF NOT EXISTS worship_contributions (
  id BIGSERIAL PRIMARY KEY,
  worship_record_id BIGINT NOT NULL,
  numero_fila INTEGER,
  nombre_aportante TEXT,
  ci_ruc TEXT,
  numero_recibo TEXT,
  diezmo NUMERIC(18,2) DEFAULT 0,
  ofrenda NUMERIC(18,2) DEFAULT 0,
  misiones NUMERIC(18,2) DEFAULT 0,
  otros NUMERIC(18,2) DEFAULT 0,
  otros_concepto TEXT,
  total NUMERIC(18,2) DEFAULT 0,

  FOREIGN KEY (worship_record_id) REFERENCES worship_records (id)
);

-- Detailed expense records
CREATE TABLE IF NOT EXISTS expense_records (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  report_id BIGINT,
  fecha_comprobante DATE NOT NULL,
  numero_comprobante TEXT,
  ruc_ci_proveedor TEXT,
  proveedor TEXT NOT NULL,
  concepto TEXT NOT NULL,
  tipo_salida TEXT,
  monto_exenta NUMERIC(18,2) DEFAULT 0,
  monto_gravada_10 NUMERIC(18,2) DEFAULT 0,
  iva_10 NUMERIC(18,2) DEFAULT 0,
  monto_gravada_5 NUMERIC(18,2) DEFAULT 0,
  iva_5 NUMERIC(18,2) DEFAULT 0,
  total_factura NUMERIC(18,2) DEFAULT 0,
  es_factura_legal BOOLEAN DEFAULT FALSE,
  es_honorario_pastoral BOOLEAN DEFAULT FALSE,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (report_id) REFERENCES reports (id)
);

-- Multi-fund control
CREATE TABLE IF NOT EXISTS fund_movements (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  fund_category_id BIGINT NOT NULL,
  report_id BIGINT,
  worship_record_id BIGINT,
  tipo_movimiento TEXT NOT NULL,
  monto NUMERIC(18,2) NOT NULL,
  concepto TEXT,
  fecha_movimiento DATE NOT NULL,
  fund_destino_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (fund_category_id) REFERENCES fund_categories (id),
  FOREIGN KEY (fund_destino_id) REFERENCES fund_categories (id),
  FOREIGN KEY (report_id) REFERENCES reports (id),
  FOREIGN KEY (worship_record_id) REFERENCES worship_records (id),
  CHECK (tipo_movimiento IN ('entrada', 'salida', 'transferencia'))
);

-- User authentication table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'church',
  church_id BIGINT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id)
);
