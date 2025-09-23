import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [
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
