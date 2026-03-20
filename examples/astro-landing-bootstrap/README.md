# Acme Landing

Marketing and brochure site for Acme — built with Astro, deployed on Netlify.

**Bootstrapped with the [Complete Development Handbook](https://github.com/nicolapitersky/Bible) v1.0.0**

---

## Getting started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev           # http://localhost:4321

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Key commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm type-check` | TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm tokens` | Regenerate CSS/TS from tokens.json |
| `pnpm test:unit` | Unit tests |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm lighthouse` | Lighthouse CI audit |

## Design tokens

All visual values live in `design-tokens/tokens.json`.
**Never hardcode colours, spacing, or font sizes in components.**

After editing `tokens.json`:
```bash
pnpm tokens   # regenerates tokens.css and tokens.ts
```

## Before deploying

```bash
node scripts/verify-env.js production   # verify environment manifest
pnpm build                               # confirm clean build
```

## Agent instructions

AI agents working on this project: read `AGENTS.md` before starting any task.

```bash
# Claude Code: reads AGENTS.md automatically
# Cursor: reads .cursorrules (generated from AGENTS.md)
# Run to regenerate IDE rules after AGENTS.md changes:
node /tmp/handbook/scripts/generate-ide-rules.js
```

## Architecture decisions

See `docs/adr/` for all significant technical decisions.

## Known issues / tech debt

See `docs/TECH_DEBT.md`.
