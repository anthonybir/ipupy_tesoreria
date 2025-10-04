/**
 * Rate limiting implementation for API endpoints
 * Protects against brute force attacks and API abuse
 *
 * Uses Vercel KV (Redis) for persistent, distributed rate limiting
 */

import { type NextRequest, NextResponse } from 'next/server';

// Import Vercel KV - graceful fallback for local development
let kv: {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  ttl: (key: string) => Promise<number>;
} | null = null;

// Try to import @vercel/kv if available (production)
try {
  // Dynamic import to avoid build errors when KV is not configured
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const kvModule = require('@vercel/kv');
  kv = kvModule.kv;
} catch {
  // Fallback to in-memory for local development
  console.warn('[Rate Limit] Vercel KV not available, using in-memory fallback (NOT RECOMMENDED FOR PRODUCTION)');
}

// Fallback in-memory store for local development only
const memoryStore = new Map<string, { count: number; resetTime: number }>();

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
 * Clean up expired entries from the memory store (fallback only)
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Check if request should be rate limited
 * Uses Vercel KV (Redis) in production, memory fallback for development
 */
export async function isRateLimited(
  request: NextRequest,
  configType: keyof typeof configs = 'api'
): Promise<{ limited: boolean; retryAfter?: number | undefined; message?: string | undefined }> {
  const config = configs[configType] ?? configs['api'];
  if (!config) {
    throw new Error(`Rate limit config not found for type: ${configType}`);
  }

  const clientId = `ratelimit:${configType}:${getClientId(request)}`;
  const now = Date.now();
  const windowSec = Math.floor(config.windowMs / 1000);
  const windowKey = `${clientId}:${Math.floor(now / config.windowMs)}`;

  // Use Vercel KV if available (production)
  if (kv) {
    try {
      const count = await kv.incr(windowKey);

      // Set expiration on first request in window
      if (count === 1) {
        await kv.expire(windowKey, windowSec);
      }

      if (count > config.maxRequests) {
        const ttl = await kv.ttl(windowKey);
        return {
          limited: true,
          retryAfter: ttl > 0 ? ttl : windowSec,
          message: config.message
        };
      }

      return { limited: false };
    } catch (error) {
      console.error('[Rate Limit] KV error, falling back to memory:', error);
      // Fall through to memory store on KV error
    }
  }

  // Fallback to in-memory store (development only)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  let entry = memoryStore.get(windowKey);

  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs
    };
    memoryStore.set(windowKey, entry);
    return { limited: false };
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      limited: true,
      retryAfter: retryAfter,
      message: config.message
    };
  }

  return { limited: false };
}

/**
 * Rate limiting middleware for API routes (async)
 * Usage:
 * ```typescript
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
 * Create a custom rate limiter with specific configuration (uses in-memory store)
 */
export function createRateLimiter(config: RateLimitConfig): (request: NextRequest) => NextResponse | null {
  return (request: NextRequest): NextResponse | null => {
    const clientId = `custom:${getClientId(request)}`;
    const now = Date.now();

    let entry = memoryStore.get(clientId);

    if (!entry || entry.resetTime < now) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs
      };
      memoryStore.set(clientId, entry);
      return null;
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return NextResponse.json(
        {
          error: config.message || 'Rate limit exceeded',
          retryAfter
        },
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
 * Reset rate limit for a specific client (useful for testing - uses in-memory store)
 */
export function resetRateLimit(clientId: string, configType?: string): void {
  const key = configType ? `${configType}:${clientId}` : clientId;
  memoryStore.delete(key);
}

/**
 * Get current rate limit status for monitoring (uses in-memory store)
 */
export function getRateLimitStatus(): {
  storeSize: number;
  entries: Array<{ key: string; count: number; expiresIn: number }>;
} {
  const now = Date.now();
  const entries = Array.from(memoryStore.entries()).map(([key, value]) => ({
    key,
    count: value.count,
    expiresIn: Math.max(0, Math.ceil((value.resetTime - now) / 1000))
  }));

  return {
    storeSize: memoryStore.size,
    entries
  };
}