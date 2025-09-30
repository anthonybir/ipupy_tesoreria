-- Migration 030: Add email column to churches table
-- Date: 2025-09-30
-- Purpose: Add institutional contact email field for churches

-- Add email column (nullable to allow for existing records)
ALTER TABLE churches ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups (optional performance optimization)
CREATE INDEX IF NOT EXISTS idx_churches_email ON churches(email) WHERE email IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN churches.email IS 'Correo institucional de contacto de la iglesia';

-- Note: RLS policies already allow SELECT * on churches table,
-- so the email column is automatically included in queries.
-- No RLS policy changes needed.
