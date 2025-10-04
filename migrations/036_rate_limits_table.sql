-- Migration: Supabase-Based Rate Limiting
-- Purpose: Replace Vercel KV with PostgreSQL-based rate limiting
-- Author: Security Hardening
-- Date: 2025-10-04
-- =============================================================================

BEGIN;

-- Create rate_limits table with auto-expiring entries
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INT NOT NULL CHECK (window_seconds > 0),
  count INT NOT NULL DEFAULT 0 CHECK (count >= 0),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS
    (window_start + make_interval(secs => window_seconds)) STORED,
  PRIMARY KEY (key, window_start, window_seconds)
);

-- Index for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at
  ON public.rate_limits (expires_at);

-- RLS: Only service_role can access (defense in depth)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.rate_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Enable pg_cron extension for automatic cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup job (runs every 15 minutes) - idempotent
DO $$
BEGIN
  -- Remove existing job if it exists (idempotent re-application)
  PERFORM cron.unschedule('rate_limits_cleanup');
EXCEPTION
  WHEN undefined_object THEN NULL;  -- Ignore if job doesn't exist
END $$;

SELECT cron.schedule(
  'rate_limits_cleanup',
  '*/15 * * * *',
  $$DELETE FROM public.rate_limits WHERE expires_at < NOW()$$
);

-- Atomic rate limit function (fixed window algorithm)
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  _key TEXT,
  _limit INT,
  _window_seconds INT
)
RETURNS TABLE(allowed BOOLEAN, remaining INT, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Calculate window start (floor to window boundary)
  v_window_start := NOW() - make_interval(
    secs => (EXTRACT(EPOCH FROM NOW())::INT % _window_seconds)
  );

  v_reset_at := v_window_start + make_interval(secs => _window_seconds);

  -- Atomic UPSERT: Insert or increment count
  INSERT INTO public.rate_limits AS rl (key, window_start, window_seconds, count)
  VALUES (_key, v_window_start, _window_seconds, 1)
  ON CONFLICT (key, window_start, window_seconds)
  DO UPDATE SET count = rl.count + 1
    WHERE rl.count < _limit  -- Only increment if under limit
  RETURNING rl.count INTO v_count;

  -- If v_count is NULL, limit was already exceeded (UPDATE skipped)
  IF v_count IS NULL THEN
    -- Get current count for the exceeded window
    SELECT count INTO v_count
    FROM public.rate_limits
    WHERE key = _key
      AND window_start = v_window_start
      AND window_seconds = _window_seconds;

    -- Return rate limit exceeded
    RETURN QUERY SELECT
      FALSE AS allowed,
      0 AS remaining,
      v_reset_at AS reset_at;
  ELSE
    -- Return success with remaining count
    RETURN QUERY SELECT
      (v_count <= _limit) AS allowed,
      (_limit - v_count) AS remaining,
      v_reset_at AS reset_at;
  END IF;
END;
$$;

-- Grant execute permission only to service_role (backend only)
REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INT, INT) TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.rate_limits IS
  'Rate limiting table using fixed window algorithm. ' ||
  'Automatically cleaned up by pg_cron every 15 minutes.';

COMMENT ON FUNCTION public.rate_limit_hit(TEXT, INT, INT) IS
  'Atomic rate limit check function. ' ||
  'Returns allowed status, remaining count, and reset time. ' ||
  'Uses UPSERT to prevent race conditions.';

COMMIT;
