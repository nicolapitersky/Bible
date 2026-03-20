# ADR-001 — Astro chosen over Next.js for marketing site

**Date:** 2025-03-19
**Status:** Accepted

## Context
This project is a marketing/brochure site. It has no user authentication,
no server-side data fetching, and no dynamic API routes. It needs maximum
Lighthouse scores (95+) and minimum bundle size for SEO and conversion.

## Decision
Use Astro with static output instead of Next.js.

## Consequences
**Positive:**
- Zero JavaScript shipped by default — only what we explicitly add with islands
- Native sitemap generation, image optimisation, and Markdown/MDX support
- Lighthouse 100 is achievable without effort
- Build output is pure static HTML/CSS — deploys to Netlify in seconds

**Negative:**
- If this site needs authentication or server-side personalisation later,
  we must migrate to Next.js or add Astro SSR — that is a significant change
- Fewer React ecosystem libraries available (though React islands work)

## Alternatives Considered
- **Next.js (static export):** works, but ships a React runtime even for
  static pages, adding ~40kb gzip overhead with no benefit for this use case
- **Plain HTML:** simpler, but loses component reuse, TypeScript, and
  the build pipeline that enforces quality

## If Requirements Change
If this site needs user authentication, server-rendered pages, or an API,
create an ADR to document the migration to Next.js or Astro SSR mode.
