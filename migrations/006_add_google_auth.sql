-- Google OAuth support for IPU PY Tesorería
-- Adds Google authentication fields to users table

-- Add Google OAuth fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Update existing users to have 'local' auth provider
UPDATE users
SET auth_provider = 'local'
WHERE auth_provider IS NULL OR auth_provider = '';

-- Add constraint to ensure valid auth providers
ALTER TABLE users
ADD CONSTRAINT chk_auth_provider
CHECK (auth_provider IN ('local', 'google'));

-- Add comment for documentation
COMMENT ON COLUMN users.google_id IS 'Google OAuth unique identifier (sub claim from JWT)';
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider: local (email/password) or google (OAuth)';