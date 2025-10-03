/**
 * Rate limiting implementation for API endpoints
 * Protects against brute force attacks and API abuse
 */

import { type NextRequest } from 'next/server';

// Store for rate limit tracking
// In production, use Redis or similar persistent store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

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
 * Clean up expired entries from the store
 * Should be called periodically in production
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if request should be rate limited
 * @returns true if request should be blocked, false if allowed
 */
export function isRateLimited(
  request: NextRequest,
  configType: keyof typeof configs = 'api'
): { limited: boolean; retryAfter?: number | undefined; message?: string | undefined } {
  const config = configs[configType] ?? configs['api'];
  if (!config) {
    throw new Error(`Rate limit config not found for type: ${configType}`);
  }
  const clientId = `${configType}:${getClientId(request)}`;
  const now = Date.now();

  // Clean up old entries periodically
  if (Math.random() < 0.01) {  // 1% chance
    cleanupExpiredEntries();
  }

  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);

  if (!entry || entry.resetTime < now) {
    // Create new window
    entry = {
      count: 1,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(clientId, entry);
    return { limited: false };
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);  // seconds
    return {
      limited: true,
      retryAfter: retryAfter,
      message: config.message
    };
  }

  return { limited: false };
}

/**
 * Rate limiting middleware for API routes
 * Usage:
 * ```typescript
 * import { withRateLimit } from '@/lib/rate-limit';
 *
 * export async function GET(request: NextRequest) {
 *   const rateLimit = withRateLimit(request, 'api');
 *   if (rateLimit) return rateLimit;
 *
 *   // Your API logic here
 * }
 * ```
 */
export function withRateLimit(
  request: NextRequest,
  configType: keyof typeof configs = 'api'
): Response | null {
  const result = isRateLimited(request, configType);

  if (result.limited) {
    return new Response(
      JSON.stringify({
        error: result.message || 'Too many requests',
        retryAfter: result.retryAfter
      }),
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
 * Create a custom rate limiter with specific configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (request: NextRequest) => {
    const clientId = `custom:${getClientId(request)}`;
    const now = Date.now();

    let entry = rateLimitStore.get(clientId);

    if (!entry || entry.resetTime < now) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs
      };
      rateLimitStore.set(clientId, entry);
      return null;
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return new Response(
        JSON.stringify({
          error: config.message || 'Rate limit exceeded',
          retryAfter
        }),
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter)
          }
        }
      );
    }

    return null;
  };
}

/**
 * Reset rate limit for a specific client (useful for testing)
 */
export function resetRateLimit(clientId: string, configType?: string): void {
  const key = configType ? `${configType}:${clientId}` : clientId;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for monitoring
 */
export function getRateLimitStatus(): {
  storeSize: number;
  entries: Array<{ key: string; count: number; expiresIn: number }>;
} {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries()).map(([key, value]) => ({
    key,
    count: value.count,
    expiresIn: Math.max(0, Math.ceil((value.resetTime - now) / 1000))
  }));

  return {
    storeSize: rateLimitStore.size,
    entries
  };
}