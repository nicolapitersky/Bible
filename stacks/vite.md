# stacks/vite.md — Vite Stack Addendum

> For SPAs, client-side apps, and tooling projects where Next.js SSR is not needed.
> Vite is also the build engine inside other frameworks (Astro, SvelteKit, etc.)
> This file covers Vite used directly as a React SPA framework.

---

## When to Use Vite (vs Next.js vs Astro)

**Use Vite for:**
- Single-page apps where SEO is not critical (internal dashboards, admin panels, authenticated apps)
- Apps hosted purely client-side on Firebase Hosting or Netlify
- Tools, utilities, and developer-facing products

**Use Next.js for:**
- Public-facing apps where SEO matters
- Apps needing SSR or server-side data fetching
- When Vercel deployment is the target

**Use Astro for:**
- Marketing sites, brochure sites, blogs
- When zero JavaScript by default is the goal

**The key question:** Does a search engine or AI crawler need to index this? If yes → Next.js or Astro. If no → Vite is fine.

---

## Approved Versions

- Vite: `^6.x` (latest stable)
- React: `^19.x`
- TypeScript: `^5.x` strict mode
- Node: 22.x LTS (lock with `.nvmrc`)

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
        // Manual chunks for better long-term caching
        manualChunks: {
          vendor:   ['react', 'react-dom'],
          router:   ['react-router-dom'],
          query:    ['@tanstack/react-query'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
    sourcemap: true,      // For Sentry source maps
    target: 'es2020',
    // Warn (not fail) on chunks > 500kb
    chunkSizeWarningLimit: 500,
  },

  // Only VITE_ prefixed vars are exposed to the client — enforced by Vite
  // Server-only secrets must NEVER use the VITE_ prefix
  envPrefix: 'VITE_',
});
```

---

## Environment Variable Validation

```typescript
// src/lib/env.ts — validates at app startup, throws if misconfigured
import { z } from 'zod';

const envSchema = z.object({
  VITE_ENV: z.enum(['development', 'staging', 'production']),
  VITE_FIREBASE_API_KEY:        z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN:    z.string().min(1),
  VITE_FIREBASE_PROJECT_ID:     z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  VITE_FIREBASE_APP_ID:         z.string().min(1),
  // Add all required VITE_ vars here
});

// import.meta.env is Vite's runtime env object
export const env = envSchema.parse(import.meta.env);

// Usage:
// import { env } from '@/lib/env';
// env.VITE_FIREBASE_PROJECT_ID
```

**Rule:** Every environment variable used by the app must be listed in this schema. If it's not listed, it's not validated. If it's not validated, a misconfiguration will cause a runtime error at an unpredictable time instead of a startup error with a clear message.

---

## App Entry Pattern

```typescript
// src/main.tsx — keep this minimal
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query-client';
import { App } from '@/App';

// Validate env at startup — throws with a clear message if misconfigured
import '@/lib/env';

// Import design tokens before any components
import '../design-tokens/tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

---

## Routing Pattern

Use React Router v6 with a centralised route definition:

```typescript
// src/routes.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { AuthGuard } from '@/components/layout/AuthGuard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// Lazy-load all routes for better initial bundle size
const DashboardPage  = lazy(() => import('@/pages/DashboardPage'));
const SettingsPage   = lazy(() => import('@/pages/SettingsPage'));
const LoginPage      = lazy(() => import('@/pages/LoginPage'));
const NotFoundPage   = lazy(() => import('@/pages/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route path="/"           element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
```

**Lazy-load every route.** This reduces initial bundle size dramatically. The loading spinner from `<Suspense fallback>` uses a token-based component, never inline styles.

---

## State Management

Follow the same hierarchy as `TOOLING.md`:

1. `useState` / `useReducer` for local component state
2. React Context for shared low-frequency state (auth, theme)
3. `@tanstack/react-query` for all server state (API data)
4. `zustand` for complex client state that spans many components

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes before refetch
      retry: 1,
      refetchOnWindowFocus: false, // Disable for dashboards — too disruptive
    },
    mutations: {
      retry: 0, // Never retry mutations automatically
    },
  },
});
```

---

## Bundle Analysis

Run after any significant feature to catch bundle size regressions:

```bash
pnpm build
# Opens dist/stats.html — treemap of every chunk and module
open dist/stats.html
```

Add to CI as a warning (not a failure) on every PR. Fail CI if total gzipped JS exceeds the project budget set in `AGENTS.md`.

---

## PWA Support (when needed)

Only add PWA support if there is a genuine offline use case. Do not add it as a default.

```typescript
// vite.config.ts additions — only when offline capability is required
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'firebase-cache', expiration: { maxAgeSeconds: 86400 } },
      },
    ],
  },
  manifest: {
    name:        '{{PROJECT_NAME}}',
    short_name:  '{{PROJECT_SLUG}}',
    description: '{{PROJECT_DESCRIPTION}}',
    theme_color: '#0066FF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

---

## Deployment on Firebase Hosting

Vite SPAs deploy well to Firebase Hosting. The critical config is the rewrite rule:

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
          { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
        ]
      },
      {
        "source": "/assets/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      }
    ]
  }
}
```

The `**` rewrite to `index.html` is essential for client-side routing to work on direct URL visits and refreshes. Without it, every route except `/` returns a 404.

---

## SEO Considerations

Vite SPAs are not indexable by default — the HTML is empty until JavaScript runs.

If the app has any public pages that need SEO (landing, pricing, about), either:
1. Move those pages to Astro or Next.js (recommended — clean separation)
2. Add prerendering via `vite-plugin-prerender` for specific routes
3. Accept that those pages will not be indexed (fine for fully authenticated apps)

Document the decision in an ADR.
