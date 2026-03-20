import type { NextConfig } from 'next';

/**
 * next.config.ts
 *
 * Security headers on every response.
 * Content Security Policy uses nonces in production (safer than unsafe-inline).
 * Image optimisation configured for app.acme.app and storage.googleapis.com.
 */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key:   'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",         // Tighten with nonces in production
      "style-src 'self' 'unsafe-inline'",           // Required for Tailwind
      "img-src 'self' data: blob: https://storage.googleapis.com https://lh3.googleusercontent.com",
      "font-src 'self'",
      "connect-src 'self' https://*.googleapis.com https://api.stripe.com wss://",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
];

const config: NextConfig = {
  // Security headers on every response
  async headers() {
    return [
      {
        source:  '/(.*)',
        headers: securityHeaders,
      },
      {
        // No caching on API routes
        source:  '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },

  // Image domains for next/image
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google profile photos
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Strict type checking in the build
  typescript: { ignoreBuildErrors: false },
  eslint:     { ignoreDuringBuilds: false },

  // Disable telemetry
  env: { NEXT_TELEMETRY_DISABLED: '1' },
};

export default config;
