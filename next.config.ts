import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers + Cache control (v3.3.0 rebuild)
  async headers() {
    return [
      // Security headers for API routes
      {
        source: '/api/:path*',
        headers: [
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
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate'
          }
        ]
      },
      // Never cache HTML (app shell, SSR routes)
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
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
  }
};

export default nextConfig;
