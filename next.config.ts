import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers + Cache control (v3.3.0 rebuild)
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Base security headers for all routes
    const baseSecurityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY'
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      // HSTS - Only in production (requires HTTPS)
      ...(isProduction ? [{
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      }] : []),
      // Content Security Policy
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // Scripts: self + Vercel Analytics + unsafe-eval for Next.js dev
          isProduction
            ? "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com"
            : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          // API connections: Convex + Supabase (during migration) + Vercel Analytics + Google OAuth
          "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.supabase.co https://*.supabase.in https://accounts.google.com https://oauth2.googleapis.com https://va.vercel-scripts.com",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; ')
      }
    ];

    return [
      // Security headers for API routes
      {
        source: '/api/:path*',
        headers: [
          ...baseSecurityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate'
          }
        ]
      },
      // Security headers for all pages
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          ...baseSecurityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          }
        ]
      },
      // Long cache for hashed static assets (safe - immutable)
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ];
  },


  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb' // Match the legacy 4MB limit
    }
  },

  // React strict mode
  reactStrictMode: true,

  // Image optimization
  images: {
    domains: ['localhost', 'ipupytesoreria.vercel.app']
  },

  // ESLint configuration for build
  eslint: {
    // Allow build to succeed even with ESLint errors
    ignoreDuringBuilds: false,
  },

  // TypeScript configuration for build
  typescript: {
    // We run tsc separately, so we can skip type checking during build
    ignoreBuildErrors: false,
  }
};

export default nextConfig;
