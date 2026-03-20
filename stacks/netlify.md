# stacks/netlify.md — Netlify Deployment Addendum

> For projects deployed to Netlify (typically Astro and Vite sites).

---

## Project Setup

```bash
# Install Netlify CLI
pnpm add -g netlify-cli

# Link to existing Netlify site
netlify link

# Confirm site identity (check against .env.manifest)
netlify status
# Should show the site name and ID from your manifest

# Never deploy production manually
# netlify deploy --prod  ← Only in CI/CD after manifest verification
```

---

## `netlify.toml` Configuration

```toml
# netlify.toml — Commit this to the repository

[build]
  command = "pnpm build"
  publish = "dist"           # Astro: "dist", Vite: "dist", Next.js: ".next"

[build.environment]
  NODE_VERSION = "22"
  PNPM_VERSION = "9"

# ── Headers (security) ─────────────────────────────────────────────────────────
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "SAMEORIGIN"
    X-DNS-Prefetch-Control = "on"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

# No caching on HTML
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

# Long cache on hashed assets
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# ── Redirects ──────────────────────────────────────────────────────────────────
[[redirects]]
  from = "/home"
  to = "/"
  status = 301
  force = true

# SPA fallback (for Vite SPAs)
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  conditions = {Role = ["admin"]}    # Remove this line for public SPAs

# ── Functions ──────────────────────────────────────────────────────────────────
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# ── Scheduled functions ────────────────────────────────────────────────────────
[[scheduled-functions]]
  name = "weekly-quality"
  cron = "0 6 * * 1"               # Monday 06:00 UTC
```

---

## Netlify Functions (Serverless)

```typescript
// netlify/functions/stripe-webhook.ts
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export const handler: Handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  if (!sig) return { statusCode: 400, body: 'No signature' };

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook error: ${err}` };
  }

  // Handle event
  // ...

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
```

---

## Branch Deploys and Deploy Previews

```toml
# Branch-specific configuration in netlify.toml

# Staging branch uses staging environment variables
[context.staging]
  command = "pnpm build"

[context.staging.environment]
  NEXT_PUBLIC_ENV = "staging"

# Production (main branch)
[context.production]
  command = "pnpm build"

[context.production.environment]
  NEXT_PUBLIC_ENV = "production"
```

Set environment variables in the Netlify dashboard under
Site Settings → Environment Variables, per scope (Production/Deploy previews/Branch deploys).

**Never set production environment variables in `netlify.toml`** — they would be visible
in the repository. Set them in the Netlify dashboard only.

---

## Netlify Identity (if using for auth)

If using Netlify Identity (for simple auth without Firebase/Supabase):

```typescript
// Only for low-complexity sites where full auth is overkill
import netlifyIdentity from 'netlify-identity-widget';

netlifyIdentity.init();

// Current user
const user = netlifyIdentity.currentUser();

// Login/logout
netlifyIdentity.open('login');
netlifyIdentity.logout();
```

For any project with payment processing, user data storage, or more than
basic authentication, use Firebase Auth or Supabase Auth instead.
