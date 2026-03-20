import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import '../design-tokens/tokens.css';

/**
 * src/app/layout.tsx — Root layout
 *
 * Responsibilities:
 * - Load design tokens (must be first style import)
 * - Load fonts via next/font (zero CLS, no CDN request)
 * - Set site-wide metadata defaults
 * - Mount analytics (Vercel — no cookie consent required)
 * - Dark mode detection (no flash)
 */

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://app.acme.app'),
  title: {
    default: 'Acme App',
    template: '%s — Acme',
  },
  description: 'The platform that powers modern software teams.',
  robots: {
    index: false, // App is authenticated — do not index
    follow: false,
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Dark mode: detect before paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (saved === 'dark' || (!saved && prefersDark)) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-surface-background text-text-primary`}>
        {/* Skip to content — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[600]
                     focus:px-4 focus:py-2 focus:bg-brand-accent focus:text-white
                     focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>

        {children}

        {/* Vercel Analytics — privacy-first, no cookie consent needed */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
