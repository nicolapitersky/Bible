# Acme App

Full-stack SaaS application — Next.js 15 + Firebase Auth + Supabase + Stripe.

**Bootstrapped with the [Complete Development Handbook](https://github.com/nicolapitersky/Bible) v1.1.0**

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| Auth | Firebase Auth + httpOnly session cookies |
| Database | Supabase Postgres (primary) + Firestore (user docs) |
| Payments | Stripe Checkout Sessions + webhooks |
| Deployment | Vercel |
| CSS | Tailwind CSS (token-based) |

## Getting started

```bash
cp .env.example .env.local   # fill in your values
pnpm install
pnpm emulators               # start Firebase emulators (separate terminal)
pnpm dev                     # http://localhost:3000
```

## Key commands

```bash
pnpm dev             # development server
pnpm build           # production build (runs type-check + verify-env)
pnpm type-check      # TypeScript
pnpm lint            # ESLint
pnpm test:unit       # Vitest
pnpm test:e2e        # Playwright
pnpm quality         # weekly quality audit
pnpm tokens          # regenerate CSS/TS from tokens.json
pnpm emulators       # Firebase emulators (auth + firestore + storage)
```

## Architecture

```
src/
  app/
    (app)/           # Authenticated routes — guarded by session cookie
      layout.tsx     # Verifies Firebase session server-side on every request
      dashboard/
    (marketing)/     # Public marketing pages
    login/           # Auth pages
    api/
      auth/session/  # Creates/deletes the httpOnly session cookie
      webhooks/      # Stripe webhooks (signature-validated)
  lib/
    env.ts           # All env vars validated at startup with Zod
    firebase.ts      # Firebase client SDK (with emulator support)
    firebase-admin.ts# Firebase Admin SDK — server only
    supabase/
      server.ts      # Supabase server client (respects RLS)
    stripe.ts        # Stripe server SDK — server only
    logger.ts        # Pino structured logging
    errors.ts        # Typed error hierarchy
  middleware.ts      # Edge auth routing
```

## Auth flow

```
1. User signs in via Firebase Auth (email/Google)
2. Client gets Firebase ID token
3. POST /api/auth/session — server verifies token, creates httpOnly cookie
4. All subsequent requests: (app)/layout.tsx verifies cookie via Admin SDK
5. Sign out: DELETE /api/auth/session — clears cookie, Firebase signs out
```

## Design tokens

All visual values in `design-tokens/tokens.json`. Never hardcode values.

```bash
pnpm tokens   # regenerates tokens.css and tokens.ts
```

## Before deploying

```bash
node scripts/verify-env.js production
pnpm build
```

## Agents

AI agents: read `AGENTS.md` before any task.
