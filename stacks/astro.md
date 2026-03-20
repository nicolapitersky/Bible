# stacks/astro.md — Astro Stack Addendum

> For brochure sites, marketing pages, and content-heavy sites.
> Astro ships zero JavaScript by default — only add JS where needed.

---

## When to Use Astro (vs Next.js)

**Use Astro for:**
- Marketing / brochure sites
- Blogs and content-heavy sites
- Documentation sites
- Landing pages

**Use Next.js for:**
- Web applications with user authentication
- Dashboards
- Sites with significant client-side interactivity
- When server-side data fetching per request is needed

**Rule:** Do not add unnecessary JavaScript to an Astro site.
Every island of interactivity must justify its existence.

---

## Required Configuration

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react'; // Only if React components needed
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';

export default defineConfig({
  site: 'https://example.com', // Required for sitemap
  integrations: [
    tailwind({
      applyBaseStyles: false, // We manage base styles
    }),
    react(), // Remove if no React components needed
    sitemap({
      filter: (page) => !page.includes('/admin/'), // Exclude non-public pages
    }),
    compress(), // Compress HTML, CSS, JS in production
  ],
  output: 'static', // or 'hybrid' if some routes need SSR
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp', // Image optimisation
    },
  },
});
```

---

## Content Collections (for blogs/articles)

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string().max(60),          // SEO: keep under 60 chars
    description: z.string().max(160),   // SEO: keep under 160 chars
    publishedAt: z.date(),
    updatedAt: z.date().optional(),
    author: z.string(),
    image: image().optional(),
    imageAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

---

## Base Layout (SEO-complete)

```astro
---
// src/layouts/BaseLayout.astro
import { SEO } from 'astro-seo';
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
  image?: string;
  canonicalURL?: string;
}

const {
  title,
  description,
  image = '/og-default.jpg',
  canonicalURL = Astro.url.href,
} = Astro.props;

const siteTitle = 'Site Name';
const fullTitle = title === siteTitle ? title : `${title} | ${siteTitle}`;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <SEO
      title={fullTitle}
      description={description}
      canonical={canonicalURL}
      openGraph={{
        basic: {
          title: fullTitle,
          type: 'website',
          image: new URL(image, Astro.site).toString(),
        },
        optional: {
          description,
          siteName: siteTitle,
          locale: 'en_GB',
        },
      }}
      twitter={{
        card: 'summary_large_image',
        title: fullTitle,
        description,
        image: new URL(image, Astro.site).toString(),
      }}
    />
    
    <!-- Structured data slot -->
    <slot name="structured-data" />
    
    <!-- Preconnect to critical origins -->
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  </head>
  <body>
    <slot />
  </body>
</html>
```

---

## Islands Architecture

```astro
---
// Only hydrate components that need interactivity
// client:load    — hydrate immediately on page load (use sparingly)
// client:idle    — hydrate when browser is idle (non-critical UI)
// client:visible — hydrate when component enters viewport (lazy)
// client:only    — render only on client (no SSR)
---

<!-- Static: no JS shipped -->
<StaticHeader />

<!-- Interactive: hydrates when visible (preferred for below-fold content) -->
<PricingToggle client:visible />

<!-- Interactive: hydrates when idle (good for non-critical UI) -->
<NewsletterSignup client:idle />

<!-- Critical: hydrates immediately (for above-fold interactive content) -->
<HeroCarousel client:load />
```

**Rule:** Prefer `client:visible` and `client:idle` over `client:load`.
Use `client:load` only for interactive content that must work immediately (e.g. a search box).

---

# stacks/vite.md — Vite Stack Addendum

> For single-page applications and build tooling.
> Use Vite for SPAs where Next.js server features aren't needed.

---

## When to Use Vite (vs Next.js)

**Use Vite for:**
- SPAs that don't need SSR
- Applications hosted fully client-side (e.g. Firebase Hosting)
- Tools and utilities
- When you need a fast build tool for non-React projects

**Use Next.js for:**
- SSR/SSG requirements
- SEO-critical pages
- Better performance on initial load

---

## Required Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyser — generates stats.html on build
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tokens': path.resolve(__dirname, './design-tokens'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
    sourcemap: true, // For Sentry source maps
    // Target modern browsers (adjust based on audience)
    target: 'es2020',
  },
  // Environment variable handling
  envPrefix: 'VITE_', // Only VITE_ prefixed vars are exposed to the client
});
```

## Environment Variables in Vite

```typescript
// src/lib/env.ts — Validated at startup
import { z } from 'zod';

const envSchema = z.object({
  VITE_ENV: z.enum(['development', 'staging', 'production']),
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  // All required VITE_ vars
});

// Vite exposes env vars via import.meta.env
export const env = envSchema.parse(import.meta.env);
```

## PWA Configuration (when needed)

```typescript
// vite.config.ts additions for PWA
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'firebase-cache' },
      },
    ],
  },
  manifest: {
    name: '{{PROJECT_NAME}}',
    short_name: '{{PROJECT_SLUG}}',
    description: '{{PROJECT_DESCRIPTION}}',
    theme_color: '#0066FF', // From design tokens
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```
