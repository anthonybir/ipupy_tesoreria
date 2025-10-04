import { NextResponse } from 'next/server';

/**
 * Get allowed origins based on environment
 * Production: Only exact production domains
 * Development: localhost only
 */
const getAllowedOrigins = (): string[] => {
  const env = process.env['NODE_ENV'];
  const customOrigins = process.env['ALLOWED_ORIGINS'];

  // Production: strict whitelist
  if (env === 'production') {
    const productionOrigins = [
      'https://ipupytesoreria.vercel.app',
      process.env['NEXT_PUBLIC_SITE_URL'], // Custom domain if configured
    ].filter(Boolean) as string[];

    // Allow custom origins in production only if explicitly set
    if (customOrigins) {
      productionOrigins.push(
        ...customOrigins.split(',').map((origin) => origin.trim())
      );
    }

    return productionOrigins;
  }

  // Development: localhost only (no remote origins for security)
  return [
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:3000',
  ];
};

export const buildCorsHeaders = (origin?: string | null): HeadersInit => {
  const allowedOrigins = getAllowedOrigins();

  const headers: Record<string, string> = {
    // Only allow necessary HTTP methods (removed unused methods)
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400' // 24 hours
  };

  // SECURITY: Never use wildcard (*) with credentials
  // Only set CORS header if origin is explicitly in whitelist
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin && allowedOrigins.length > 0) {
    // For requests without origin (e.g., server-side), use first allowed origin
    const firstOrigin = allowedOrigins[0];
    if (firstOrigin) {
      headers['Access-Control-Allow-Origin'] = firstOrigin;
    }
  } else if (origin) {
    // Log rejected origins for monitoring (but don't set header)
    console.warn('[CORS] Rejected origin:', origin, 'Allowed:', allowedOrigins);
  }
  // If origin is not allowed, no CORS header is set (browser will block)

  return headers;
};

export const handleCorsPreflight = (request: Request): NextResponse | null => {
  if (request.method !== 'OPTIONS') {
    return null;
  }
  const headers = buildCorsHeaders(request.headers.get('origin'));
  return new NextResponse(null, { status: 204, headers });
};

export const setCORSHeaders = (response: Response, origin?: string | null): void => {
  const headers = buildCorsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value as string);
  });
  const vary = response.headers.get('Vary');
  response.headers.set('Vary', vary ? `${vary}, Origin` : 'Origin');
};
