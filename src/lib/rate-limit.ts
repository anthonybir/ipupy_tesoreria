/**
 * Rate limiting implementation for API endpoints
 * Protects against brute force attacks and API abuse
 *
 * Uses Supabase PostgreSQL with pg_cron for persistent, distributed rate limiting
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin client for server-side rate limiting (service_role)
const supabaseAdmin = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Configuration for different endpoint types
interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests in window
  message?: string;  // Custom error message
}

// Default configurations
const configs: Record<string, RateLimitConfig> = {
  // Authentication endpoints - strict limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,  // 5 attempts per 15 minutes
    message: 'Too many authentication attempts. Please try again later.'
  },
  // Admin endpoints - moderate limits
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,  // 30 requests per minute
    message: 'Admin rate limit exceeded. Please slow down.'
  },
  // Regular API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,  // 60 requests per minute
    message: 'API rate limit exceeded. Please try again later.'
  },
  // Report submission - prevent spam
  reports: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,  // 10 reports per hour
    message: 'Report submission rate limit exceeded.'
  },
  // User management - prevent account enumeration
  user_management: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,  // 20 user operations per minute
    message: 'User management rate limit exceeded. Please slow down.'
  }
};

/**
 * Get client identifier from request
 * Uses IP address and user ID if available
 */
function getClientId(request: NextRequest): string {
  // Try to get IP from various headers
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';

  // Add user ID if authenticated (from cookie or header)
  const userId = request.cookies.get('userId')?.value ||
    request.headers.get('x-user-id') ||
    '';

  return `${ip}:${userId}`;
}

/**
 * Rate limit result from database
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

/**
 * Check if request should be rate limited using Supabase
 */
export async function isRateLimited(
  request: NextRequest,
  configType: keyof typeof configs = 'api'
): Promise<{ limited: boolean; retryAfter?: number; message?: string }> {
  const config = configs[configType] ?? configs['api'];
  if (!config) {
    throw new Error(`Rate limit config not found for type: ${configType}`);
  }

  const clientId = `ratelimit:${configType}:${getClientId(request)}`;
  const windowSeconds = Math.floor(config.windowMs / 1000);

  try {
    // Call Supabase RPC function for atomic rate limit check
    const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
      _key: clientId,
      _limit: config.maxRequests,
      _window_seconds: windowSeconds
    });

    if (error) {
      // Fail-open: Log error but allow request
      console.error('[Rate Limit] Supabase RPC error:', error);
      return { limited: false };
    }

    // Handle response (data is array with single row)
    const result = Array.isArray(data) && data.length > 0
      ? (data[0] as RateLimitResult)
      : null;

    if (!result) {
      // Unexpected response, fail-open
      console.error('[Rate Limit] Unexpected response format:', data);
      return { limited: false };
    }

    if (!result.allowed) {
      // Calculate retry-after in seconds
      const resetAt = new Date(result.reset_at).getTime();
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

      return {
        limited: true,
        retryAfter,
        ...(config.message && { message: config.message })
      };
    }

    return { limited: false };
  } catch (error) {
    // Fail-open: Log error but allow request to prevent service disruption
    console.error('[Rate Limit] Exception:', error);
    return { limited: false };
  }
}

/**
 * Rate limiting middleware for API routes
 * Usage:
 * ```typescript
 * export const runtime = 'nodejs'; // Required for Supabase DB access
 *
 * import { withRateLimit } from '@/lib/rate-limit';
 *
 * export async function GET(request: NextRequest) {
 *   const rateLimit = await withRateLimit(request, 'api');
 *   if (rateLimit) return rateLimit;
 *
 *   // Your API logic here
 * }
 * ```
 */
export async function withRateLimit(
  request: NextRequest,
  configType: keyof typeof configs = 'api'
): Promise<NextResponse | null> {
  const result = await isRateLimited(request, configType);

  if (result.limited) {
    return NextResponse.json(
      {
        error: result.message || 'Too many requests',
        retryAfter: result.retryAfter
      },
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter || 60),
          'X-RateLimit-Limit': String(configs[configType]?.maxRequests ?? 60),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() + (result.retryAfter || 60) * 1000)
        }
      }
    );
  }

  return null;  // Request is allowed
}

/**
 * Get rate limit configuration for a specific type
 */
export function getRateLimitConfig(configType: keyof typeof configs): RateLimitConfig | undefined {
  return configs[configType];
}
