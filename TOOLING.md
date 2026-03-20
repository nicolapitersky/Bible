# TOOLING.md — Approved Tool Registry

> Check this file before building ANYTHING.
> If a tool exists here, use it. Do not build a custom replacement.
> If you need a tool not listed here, flag it for human approval before using it.
> Last reviewed: See git log.

---

## The Tool Registry Rule (Repeated For Emphasis)

1. Need to do something? Check this list first.
2. Tool exists? Use it as configured here.
3. Tool doesn't exist? Check if a listed tool can do it.
4. Still can't find it? Propose adding to the registry. Wait for approval.
5. Build custom? Only as a last resort, and document why in an ADR.

This prevents:
- Reinventing date formatting (use `date-fns`)
- Building custom HTTP clients (use native `fetch` or listed SDKs)
- Writing custom environment loaders (use `dotenv` as configured)
- Creating bespoke analytics wrappers (use the listed SDK directly)

---

## Web / JavaScript / TypeScript

### Package Management
| Tool | Use Case | Notes |
|------|---------|-------|
| `pnpm` | Primary package manager | Faster, stricter than npm. Always use pnpm. |
| `npm` | Fallback only | Use only if a tool explicitly requires npm |

```bash
# Always
pnpm install
pnpm add [package]
pnpm add -D [package]  # devDependency
```

### Code Quality
| Tool | Config File | Use Case |
|------|------------|---------|
| `eslint` | `.eslintrc.json` | JavaScript/TypeScript linting |
| `prettier` | `prettier.config.js` | Code formatting |
| `typescript` | `tsconfig.json` | Type checking (strict mode always) |
| `lefthook` | `lefthook.yml` | Git hooks (runs lint + type-check pre-commit) |
| `knip` | `knip.json` | Unused exports, dependencies, files |

### Testing
| Tool | Use Case | When to Use |
|------|---------|------------|
| `vitest` | Unit + integration tests | Primary test runner for web projects |
| `@testing-library/react` | Component tests | All React component tests |
| `playwright` | E2E tests | Critical user journeys |
| `msw` (Mock Service Worker) | API mocking | Mock API calls in tests |
| `@testing-library/user-event` | User interaction simulation | Form interactions, clicks |

### Next.js Stack
| Tool | Use Case | Notes |
|------|---------|-------|
| `next` | Framework | App Router (not Pages Router for new projects) |
| `next/image` | Image optimisation | All images must use this, not `<img>` |
| `next/font` | Font loading | All fonts loaded here, not CDN |
| `next/link` | Internal navigation | Not `<a>` tags for internal links |
| `@next/bundle-analyzer` | Bundle analysis | Run on every significant feature |
| `next-seo` | SEO metadata | Structured SEO management |

### Astro Stack
| Tool | Use Case | Notes |
|------|---------|-------|
| `astro` | Framework | Use for marketing/brochure sites |
| `@astrojs/react` | React islands | When interactivity needed |
| `@astrojs/sitemap` | Sitemap generation | Required for all Astro sites |
| `astro-seo` | SEO | Meta tags management |

### Vite Stack
| Tool | Use Case | Notes |
|------|---------|-------|
| `vite` | Build tool | Preferred for SPAs and tooling |
| `vite-plugin-pwa` | PWA support | When offline capability needed |
| `rollup-plugin-visualizer` | Bundle analysis | Inspect bundle composition |

### Styling
| Tool | Use Case | Notes |
|------|---------|-------|
| `tailwindcss` | Utility CSS | Config must reference design tokens |
| `@tailwindcss/typography` | Prose styling | Long-form content |
| `class-variance-authority` (cva) | Component variants | Type-safe component variant logic |
| `clsx` | Conditional class names | Merge class strings |
| `tailwind-merge` | Merge Tailwind classes | Prevent class conflicts |

**Tailwind must be configured from design tokens:**
```javascript
// tailwind.config.js — must map to design-tokens/tokens.json
module.exports = {
  theme: {
    extend: {
      colors: {
        'brand-primary': 'var(--color-brand-primary)',
        // No hardcoded values here — only token references
      }
    }
  }
}
```

### State Management
| Tool | Use Case | When to Use |
|------|---------|------------|
| React `useState` / `useReducer` | Local component state | First choice always |
| React Context | Shared state (auth, theme) | Cross-component, low frequency |
| `zustand` | Complex client state | When Context becomes unwieldy |
| `@tanstack/react-query` | Server state / data fetching | All API data fetching |
| `jotai` | Atomic global state | When Zustand is overkill |

### Data Fetching & APIs
| Tool | Use Case | Notes |
|------|---------|-------|
| `@tanstack/react-query` | Data fetching, caching, sync | Primary data fetching tool |
| Native `fetch` | Simple HTTP requests | Built-in, use before adding axios |
| `axios` | Complex HTTP (interceptors, transforms) | Only when fetch is insufficient |
| `zod` | Runtime validation + type inference | Validate all API responses and inputs |
| `trpc` | End-to-end type-safe APIs | When using Next.js full-stack |

### Forms
| Tool | Use Case | Notes |
|------|---------|-------|
| `react-hook-form` | Form state management | Primary form library |
| `zod` | Form validation | Combined with react-hook-form via `@hookform/resolvers` |

### Dates & Times
| Tool | Use Case | Notes |
|------|---------|-------|
| `date-fns` | Date manipulation | DO NOT use moment.js (deprecated) |
| `date-fns-tz` | Timezone handling | When timezone-aware dates needed |
| `Temporal` API | Modern date handling | Use when available (via polyfill) |

### Utilities
| Tool | Use Case | Notes |
|------|---------|-------|
| `zod` | Schema validation | Use for all external data |
| `uuid` | UUID generation | For client-side IDs |
| `nanoid` | Short unique IDs | Shorter URLs, readable IDs |

---

## Firebase Stack

| Tool | Use Case | Notes |
|------|---------|-------|
| `firebase` (v10+ modular) | Firebase SDK | Always use modular imports |
| `firebase-admin` | Server-side Firebase | Backend only, never client |
| `firebase-functions` | Cloud Functions | Prefer 2nd gen functions |
| Firebase Emulator Suite | Local development | Always develop against emulators |
| `firebase-tools` CLI | Deployment + management | Use for all Firebase operations |

**Firebase usage rules:**
- Always initialise with config from environment variables, never hardcoded
- Always use Firebase Emulators for local development
- Security Rules are version-controlled in `firestore.rules`, `storage.rules`
- Never deploy rules manually — deploy via CI/CD pipeline
- Use Firebase Extensions before building custom solutions

---

## Supabase Stack

| Tool | Use Case | Notes |
|------|---------|-------|
| `@supabase/supabase-js` | Supabase SDK | Primary client |
| `@supabase/ssr` | Server-side Supabase | For Next.js server components |
| Supabase CLI | Local dev + migrations | All schema changes via migrations |
| `supabase db push` | Apply migrations | Never edit production schema manually |

**Supabase rules:**
- Row Level Security (RLS) is enabled on ALL tables, always
- All schema changes via migration files, never Supabase dashboard
- Never use the service role key on the client side
- Test RLS policies locally with the Supabase CLI

---

## Flutter / Dart

| Tool | Use Case | Notes |
|------|---------|-------|
| `flutter_riverpod` | State management | Primary state tool |
| `go_router` | Navigation | Type-safe routing |
| `dio` | HTTP client | Feature-rich, interceptors |
| `freezed` + `json_serializable` | Data models | Immutable models with codegen |
| `flutter_hooks` | Hook pattern | React-like hooks for Flutter |
| `hive` or `isar` | Local storage | Fast local database |
| `flutter_secure_storage` | Secure key storage | Tokens, secrets |
| `firebase_core` + `firebase_auth` | Firebase integration | Official FlutterFire plugins |
| `flutter_test` | Unit + widget tests | Built-in test framework |
| `integration_test` | Integration tests | Flutter's official integration testing |
| `golden_toolkit` | Golden tests | Visual regression testing |
| `flutter_lints` | Linting | Official Flutter lints, always enabled |
| `very_good_analysis` | Strict linting | Extended lints for production code |

---

## Authentication

| Tool | Use Case | Notes |
|------|---------|-------|
| Firebase Auth | Primary auth (mobile + web) | Google, Apple, email/password, phone |
| Supabase Auth | Supabase projects | Built-in, RLS-integrated |
| `next-auth` (Auth.js) | Next.js standalone auth | OAuth providers, session management |
| Google Identity Services | Google OAuth | Use instead of building custom |

**Auth rules:**
- Never build custom auth from scratch when a listed tool handles it
- Tokens stored in httpOnly cookies, never localStorage
- Refresh tokens handled by the SDK, not custom code
- Google Auth and Apple Sign-In required for mobile apps (App Store requirement)

---

## Payments

| Tool | Use Case | Notes |
|------|---------|-------|
| `stripe` (Node.js SDK) | Server-side Stripe | All payment processing |
| `@stripe/stripe-js` | Client-side Stripe | Payment Element, never raw card data |
| `@stripe/react-stripe-js` | React Stripe components | Stripe Elements in React |

**Stripe rules:**
- Never handle raw card numbers — always use Stripe Elements
- Always validate webhook signatures server-side
- Always use test mode keys in non-production environments
- Log all payment events for audit trail

---

## Monitoring & Observability

| Tool | Use Case | Notes |
|------|---------|-------|
| Sentry | Error tracking | Required for all production apps |
| Vercel Analytics | Web analytics | Built-in, no cookie consent needed |
| Firebase Performance | Mobile + web performance | Automatic with Firebase |
| `pino` | Node.js logging | Fast, structured JSON logs |
| Lighthouse CI | Performance testing | Runs in CI on every PR |

---

## Developer Experience (DX)

| Tool | Use Case | Notes |
|------|---------|-------|
| `@biomejs/biome` | Fast lint + format (alternative to ESLint+Prettier) | Consider for new projects |
| `turbo` | Monorepo task runner | For multi-package repos |
| `changesets` | Versioning and changelogs | For packages and libraries |
| `dotenv-vault` | Secure .env sync | For team secret sharing |
| Storybook | Component development | When team > 2 developers |

---

## MCP (Model Context Protocol) Servers

> MCPs extend AI agent capabilities. Always prefer an MCP over custom tooling.

| MCP Server | Capability | Use When |
|-----------|-----------|----------|
| `@modelcontextprotocol/server-filesystem` | File system operations | Local file operations |
| `@modelcontextprotocol/server-github` | GitHub operations | PR creation, issue management |
| `@modelcontextprotocol/server-google-drive` | Drive operations | Document access |
| `@modelcontextprotocol/server-postgres` | Database queries | Direct Postgres access |
| `@modelcontextprotocol/server-brave-search` | Web search | Research tasks |
| Firebase Studio MCP | Firebase operations | All Firebase Studio integrations |
| Vercel MCP | Deployment operations | Vercel-specific agent tasks |
| Stripe MCP | Payment operations | Stripe dashboard agent tasks |
| Supabase MCP | Supabase operations | Supabase-specific agent tasks |

**MCP update cadence:** Review this list monthly. New MCPs emerge regularly.
Check `https://modelcontextprotocol.io/servers` for the official registry.

---

## Adding a New Tool (Approval Process)

If you need a tool not on this list:

1. **Assess alternatives:** Can a listed tool do this? Can the framework handle it natively?
2. **Evaluate the candidate:** Check npm download counts, last publish date, GitHub stars, open issues, license, security advisories.
3. **Flag to human:** "I need [tool] for [purpose]. It is not in the tool registry. My assessment: [assessment]. Do you want me to add it?"
4. **Wait for approval.**
5. **Add to this file** with the use case and any notes.
6. **Create an ADR** if it's a significant architectural choice.

A package that hasn't been published in 18 months, has unresolved security advisories,
or has fewer than 1000 weekly downloads requires explicit justification.
