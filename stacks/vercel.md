# stacks/vercel.md — Vercel Deployment Addendum

> Vercel-specific configuration, environment management, and deployment rules.
> Covers Next.js, Astro, and Vite deployments.
> Read alongside `stacks/nextjs.md` or `stacks/astro.md` as appropriate.
> Last reviewed: See git log.

---

## Project Linking Rules

```bash
# 1. Install Vercel CLI (once per machine)
pnpm add -g vercel

# 2. Link a project — always scope to the team
vercel link --scope {{VERCEL_TEAM_SLUG}}

# 3. Confirm you are linked to the right project
vercel env ls
# Output must show the project name from .env.manifest

# 4. Pull env vars for local development
vercel env pull .env.local
# Creates .env.local with Development-scoped variables only
# Never commit .env.local
```

**Rule: Never run `vercel deploy --prod` locally.**
Production deploys go through the GitHub integration only — where `verify-env.js`
runs first and the manifest is checked. Manual production deploys bypass all guards.

---

## Environment Variable Scoping

Vercel has three environments, each with independent variable sets:

| Environment | When active | Maps to |
|-------------|-------------|---------|
| `Production` | `main` branch deploys | production |
| `Preview` | all other branch deploys | staging |
| `Development` | `vercel env pull` for local dev | local |

### Variable sensitivity levels

```bash
# Plain — visible in build logs, dashboard, and to all team members
# Use for: public URLs, feature flags, non-sensitive config
vercel env add NEXT_PUBLIC_APP_URL production

# Sensitive — encrypted at rest, never shown in logs or dashboard UI
# Use for: ALL secrets — API keys, database passwords, webhook secrets
vercel env add STRIPE_SECRET_KEY production --sensitive
vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
vercel env add FIREBASE_ADMIN_PRIVATE_KEY production --sensitive
```

**Rule:** Every secret must be marked `--sensitive`. If it is not, it will appear in
build logs and be readable by any team member with dashboard access.

### Syncing with `.env.manifest`

After adding or updating variables, confirm they match the manifest:

```bash
vercel env ls production    # Review what is set
vercel env ls preview       # Must use staging credentials — never production
```

---

## Supabase ↔ Vercel Native Integration

Supabase is a Vercel Marketplace integration. This is the recommended setup for any
project using both — it syncs Supabase environment variables automatically and updates
them when credentials rotate.

### Setup (once per project)

1. Go to `vercel.com/[team]/[project]/settings/integrations`
2. Find **Supabase** in the marketplace
3. Click **Add Integration** → select your Supabase organisation
4. Map environments:
   - `Production` → your **production** Supabase project ref
   - `Preview` → your **staging** Supabase project ref
   - `Development` → your **staging** Supabase project ref (or local emulator)

Vercel automatically sets these in the mapped environments:

```bash
SUPABASE_URL                # https://[ref].supabase.co
SUPABASE_ANON_KEY           # Public anon key
SUPABASE_SERVICE_ROLE_KEY   # Secret service role key (sensitive)
POSTGRES_URL                # Direct connection string (for migrations)
POSTGRES_URL_NON_POOLING    # Non-pooled (for Supabase migrations in CI)
POSTGRES_PRISMA_URL         # Pooled Prisma-compatible URL
POSTGRES_USER
POSTGRES_HOST
POSTGRES_PASSWORD
POSTGRES_DATABASE
```

**After enabling the integration:**
- Remove any manually-set Supabase variables from Vercel — they will conflict
- Remove Supabase variables from `.env.example` that are now integration-managed
- Add a note in `docs/TOOL_REGISTRY.md`: "Supabase vars are set by Vercel integration"

**Variable naming:** The integration uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`
(no `NEXT_PUBLIC_` prefix). Update `src/lib/env.ts` accordingly:

```typescript
// src/lib/env.ts — when using Vercel-Supabase integration
const envSchema = z.object({
  // Server-side only — set by the Vercel-Supabase integration
  SUPABASE_URL:              z.string().url(),
  SUPABASE_ANON_KEY:         z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // ...
});
```

```typescript
// src/lib/supabase/server.ts — use integration-provided variable names
export function createServerSupabaseClient() {
  return createServerClient<Database>(
    process.env.SUPABASE_URL!,       // Not NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_ANON_KEY!,  // Not NEXT_PUBLIC_SUPABASE_ANON_KEY
    { cookies: { ... } }
  );
}
```

---

## `vercel.json` Configuration

### Next.js

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": ".next",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options",    "value": "nosniff" },
        { "key": "X-Frame-Options",           "value": "SAMEORIGIN" },
        { "key": "X-DNS-Prefetch-Control",    "value": "on" },
        { "key": "Referrer-Policy",           "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Permissions-Policy",        "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store, max-age=0" }]
    }
  ],
  "crons": [
    { "path": "/api/cron/weekly-quality", "schedule": "0 6 * * 1" }
  ]
}
```

### Astro (static output)

```json
{
  "framework": "astro",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options",    "value": "nosniff" },
        { "key": "X-Frame-Options",           "value": "SAMEORIGIN" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    },
    {
      "source": "/_astro/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

---

## Skew Protection

**The problem it solves:** During a deployment, there is a brief window where some users
are served old JavaScript bundles but their API requests hit the new server code. If the
API shape changed between versions, this causes cryptic errors for those users mid-session.

**Enable it:** Vercel Dashboard → Project → Settings → Deployment → Skew Protection → On

Once enabled, Vercel keeps the previous deployment alive until all active sessions on it
have completed, and pins each user to the deployment version that served their initial
page load.

**When this matters most:**
- Apps with long user sessions (dashboards, editors, admin tools)
- Apps with frequent deploys (multiple times per day)
- Any release that changes an API route's request or response shape

```typescript
// Next.js — communicate the deployment ID to the client
// Vercel sets NEXT_DEPLOYMENT_ID at build time automatically
// No code changes required — Skew Protection works at the infrastructure level
// Just enable it in the dashboard and forget about it
```

---

## Deployment Protection

Preview URLs are publicly accessible by default. Any team member who accidentally
shares a preview link exposes your staging environment to the internet.

**Enable:** Vercel Dashboard → Project → Settings → Deployment → Deployment Protection

| Option | Use case |
|--------|----------|
| Vercel Authentication | Internal tools — requires Vercel account |
| Password | Client or stakeholder previews |
| Off (specific branches only) | Public marketing previews |

### E2E tests bypassing protection

When running Playwright or Cypress against a protected preview, use the bypass token:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_TOKEN ?? '',
    },
  },
});
```

```yaml
# .github/workflows/ci.yml
- name: E2E tests
  env:
    VERCEL_BYPASS_TOKEN: ${{ secrets.VERCEL_BYPASS_TOKEN }}
  run: pnpm test:e2e
```

---

## Vercel Firewall (WAF)

Available on Pro and Enterprise plans. Runs at the edge before your code executes.
Blocks known attack patterns without consuming function invocations.

**Enable:** Vercel Dashboard → Project → Settings → Security → Firewall

**What it blocks by default:**
- Known malicious IP ranges and bot networks
- OWASP Top 10 attack patterns (SQL injection, XSS, path traversal)
- Credential stuffing and brute force attempts

**Recommended custom rules for any app handling user data:**

```
Rule 1: Rate limit auth endpoints
  IF path starts with /api/auth
  AND rate > 20 requests per minute per IP
  THEN challenge (CAPTCHA)

Rule 2: Block requests with no User-Agent
  IF user-agent is empty
  THEN block

Rule 3: Restrict admin endpoints to known origins
  IF path starts with /api/admin
  AND origin NOT IN [your production domain]
  THEN block

Rule 4: Geo-block if legally required
  IF country IN [your restricted list]
  THEN block
```

**Ongoing:** Review the Firewall Logs tab weekly for blocked request patterns.
Add a Firewall review item to `docs/QUALITY_CHECKLIST.md`.

---

## Fluid Compute

Vercel's Fluid compute is now the default execution model. It changes how functions
are provisioned — understanding it prevents unexpected behaviour.

| | Traditional Serverless | Fluid Compute |
|---|---|---|
| Concurrency | One request per instance | Multiple concurrent requests per instance |
| Cold starts | Frequent | Rare — instances stay warm |
| In-memory state | Isolated per request | Shared within an instance (use with care) |
| Cost | Per invocation | Per CPU-second used |

**Implication for Supabase:** A single Fluid compute instance may open multiple database
connections simultaneously. Always use the **pooled** connection string (Transaction pooler
from Supabase Dashboard → Settings → Database → Connection string), not the direct string.

```typescript
// src/lib/supabase/server.ts — use pooled connection with Fluid compute
// The Vercel-Supabase integration sets POSTGRES_URL to the pooled URL by default
// If connecting directly to Postgres (e.g. for migrations), use POSTGRES_URL_NON_POOLING
```

**Implication for in-memory singletons:** Be explicit that any shared state inside a
function is only shared within a single instance, not across all instances globally.
Never use in-memory state for anything requiring consistency across requests.

---

## Edge Functions vs Serverless vs Fluid Compute

```typescript
// Default: Fluid compute — warm, multi-concurrent, full Node.js
// Use for: database queries, business logic, all standard API routes
export default async function handler(req: Request) { ... }

// Edge runtime: V8 isolate at CDN edge, globally distributed
// Use for: middleware, auth redirects, geo-routing, simple transforms
// Cannot use: Node.js fs/crypto, most npm packages requiring Node
export const runtime = 'edge';

// Opt out of Fluid compute sharing — guarantees fresh per-request isolation
// Use for: routes with strict isolation requirements (rare)
export const dynamic = 'force-dynamic';
```

**Decision guide:**
- `src/middleware.ts` → always `edge`
- Simple auth checks, redirects → `edge`
- Supabase/database queries → default (Fluid compute serverless)
- Stripe webhook handlers → `runtime = 'nodejs'` explicitly (needs `req.text()`)
- File upload processing → default (serverless, memory limit applies)

---

## Custom Domains and SSL

```bash
# Add a domain
vercel domains add app.acme.app --scope {{VERCEL_TEAM_SLUG}}

# Check status (DNS propagation can take up to 48h)
vercel domains inspect app.acme.app
```

**DNS records at your provider:**

```
# Apex domain (acme.app):
A     @     76.76.21.21          # Vercel's anycast IP

# Subdomain (app.acme.app):
CNAME  app   cname.vercel-dns.com
```

SSL certificates are provisioned and renewed automatically via Let's Encrypt.

**Redirect www → apex in `vercel.json`** (do not use DNS redirects):
```json
{
  "redirects": [
    {
      "source": "/",
      "has": [{ "type": "host", "value": "www.acme.app" }],
      "destination": "https://acme.app/",
      "permanent": true
    }
  ]
}
```

---

## Vercel Analytics and Speed Insights

```typescript
// src/app/layout.tsx — add to root layout
import { Analytics }     from '@vercel/analytics/react';
import { SpeedInsights }  from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />     {/* Privacy-first, no cookies, GDPR compliant */}
        <SpeedInsights /> {/* Real-user Core Web Vitals → Vercel dashboard */}
      </body>
    </html>
  );
}
```

Use these instead of Google Analytics:
- No cookie consent banner required
- GDPR/CCPA compliant by default
- Included in all Vercel plans
- Speed Insights shows P75 LCP, CLS, INP per page — feeds the weekly quality audit

---

## Vercel CLI Cheatsheet

```bash
# Environment
vercel env ls [production|preview|development]
vercel env add KEY [env] [--sensitive]
vercel env rm KEY [env]
vercel env pull .env.local

# Deployments
vercel                              # Preview deploy
vercel ls                           # List deployments
vercel inspect [url]                # Inspect a deployment
vercel rollback [url]               # Roll back to previous deployment
vercel logs [url]                   # Stream logs

# Domains
vercel domains add DOMAIN
vercel domains ls
vercel domains inspect DOMAIN
```

---

## Pre-Deploy Checklist

```bash
# Run before every production deploy (add to CI pre-deploy step)

# 1. Environment manifest matches Vercel
node scripts/verify-env.js production

# 2. Supabase integration vars present
vercel env ls production | grep -E "SUPABASE|POSTGRES"

# 3. No high/critical dependency vulnerabilities
pnpm audit --audit-level=high

# 4. Build succeeds with production config
NODE_ENV=production pnpm build

# 5. One-time setup checks (verify in dashboard)
#    - Skew Protection: on
#    - Deployment Protection: configured for preview
#    - Firewall: enabled with custom rules
```
