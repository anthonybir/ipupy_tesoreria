-- Member management system tables (PostgreSQL)
-- Phase 2 of the schema

-- Families table for grouping members (jefe_familia constraint added after members creation)
CREATE TABLE IF NOT EXISTS families (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  apellido_familia TEXT NOT NULL,
  direccion_principal TEXT,
  telefono_principal TEXT,
  jefe_familia_id BIGINT,
  observaciones TEXT,
  es_activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id)
);

-- Complete member information table
CREATE TABLE IF NOT EXISTS members (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  family_id BIGINT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  ci_ruc TEXT,
  fecha_nacimiento DATE,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  estado_civil TEXT,
  profesion TEXT,
  sexo TEXT,
  fecha_bautismo_agua DATE,
  fecha_bautismo_espiritu DATE,
  fecha_membresia DATE,
  es_miembro_activo BOOLEAN DEFAULT TRUE,
  tipo_membresia TEXT DEFAULT 'miembro',
  grado_ministerial TEXT,
  posicion_ministerial TEXT,
  dones_espirituales TEXT,
  es_jefe_familia BOOLEAN DEFAULT FALSE,
  parentesco_jefe TEXT,
  contacto_emergencia_nombre TEXT,
  contacto_emergencia_telefono TEXT,
  contacto_emergencia_relacion TEXT,
  observaciones TEXT,
  notas_pastorales TEXT,
  foto_perfil TEXT,
  es_activo BOOLEAN DEFAULT TRUE,
  fecha_ultima_asistencia DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (family_id) REFERENCES families (id)
);

-- Add constraint for jefe_familia now that members exists
-- Using a PL/pgSQL block to handle if constraint already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'families_jefe_familia_fk'
        AND table_name = 'families'
    ) THEN
        ALTER TABLE families
          ADD CONSTRAINT families_jefe_familia_fk
          FOREIGN KEY (jefe_familia_id) REFERENCES members (id);
    END IF;
END $$;

-- Ministries and departments table
CREATE TABLE IF NOT EXISTS ministries (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  lider_id BIGINT,
  presupuesto_anual NUMERIC(18,2) DEFAULT 0,
  fund_category_id BIGINT,
  es_activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (lider_id) REFERENCES members (id),
  FOREIGN KEY (fund_category_id) REFERENCES fund_categories (id)
);

-- Member attendance per worship service
CREATE TABLE IF NOT EXISTS member_attendance (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL,
  worship_record_id BIGINT NOT NULL,
  presente BOOLEAN DEFAULT TRUE,
  tipo_asistencia TEXT DEFAULT 'miembro',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (member_id, worship_record_id),
  FOREIGN KEY (member_id) REFERENCES members (id),
  FOREIGN KEY (worship_record_id) REFERENCES worship_records (id)
);

-- Ministry participation (many-to-many)
CREATE TABLE IF NOT EXISTS member_ministries (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL,
  ministry_id BIGINT NOT NULL,
  rol TEXT DEFAULT 'participante',
  fecha_inicio DATE DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  es_activo BOOLEAN DEFAULT TRUE,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (member_id, ministry_id),
  FOREIGN KEY (member_id) REFERENCES members (id),
  FOREIGN KEY (ministry_id) REFERENCES ministries (id)
);

-- Member contributions/donations
CREATE TABLE IF NOT EXISTS member_contributions (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL,
  worship_record_id BIGINT,
  fund_category_id BIGINT NOT NULL,
  monto NUMERIC(18,2) NOT NULL,
  tipo_contribucion TEXT NOT NULL,
  metodo_pago TEXT DEFAULT 'efectivo',
  numero_recibo TEXT,
  requiere_recibo BOOLEAN DEFAULT FALSE,
  numero_recibo_fiscal TEXT,
  ruc_ci_contribuyente TEXT,
  fecha_contribucion DATE NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (member_id) REFERENCES members (id),
  FOREIGN KEY (worship_record_id) REFERENCES worship_records (id),
  FOREIGN KEY (fund_category_id) REFERENCES fund_categories (id)
);

-- Church events
CREATE TABLE IF NOT EXISTS church_events (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT NOT NULL,
  ministry_id BIGINT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ,
  ubicacion TEXT,
  responsable_id BIGINT,
  presupuesto NUMERIC(18,2) DEFAULT 0,
  capacidad_maxima INTEGER,
  requiere_inscripcion BOOLEAN DEFAULT FALSE,
  estado TEXT DEFAULT 'planificado',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (church_id) REFERENCES churches (id),
  FOREIGN KEY (ministry_id) REFERENCES ministries (id),
  FOREIGN KEY (responsable_id) REFERENCES members (id)
);

-- Event registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
  estado TEXT DEFAULT 'confirmado',
  observaciones TEXT,
  personas_acompanantes INTEGER DEFAULT 0,
  requerimientos_especiales TEXT,

  UNIQUE (event_id, member_id),
  FOREIGN KEY (event_id) REFERENCES church_events (id),
  FOREIGN KEY (member_id) REFERENCES members (id)
);
