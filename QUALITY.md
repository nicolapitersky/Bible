# QUALITY.md — Quality Loops & CI/CD

> Quality is not a phase at the end of development.
> It is a continuous practice built into every commit, every PR, and every week.

---

## The Three Quality Loops

### Loop 1: Per-Commit (automated, seconds)
Pre-commit hooks via `lefthook` run before every commit:
- ESLint (zero errors)
- Prettier (format check)
- TypeScript (zero type errors)
- Secret scanning (no credentials)
- Commit message format check

If any check fails, the commit is rejected. Fix it before committing.

### Loop 2: Per-PR (automated, minutes)
CI pipeline runs on every pull request:
- Full lint + type check
- Unit + integration tests (must pass)
- E2E tests on critical paths (must pass)
- Bundle size check (must be within budget)
- Lighthouse CI performance audit (must meet thresholds)
- Dependency vulnerability audit (no high/critical)
- Security header check
- Visual regression tests (if configured)

A PR cannot be merged until all checks pass. No exceptions.

#### AI-Powered PR Review

Use `anthropics/claude-code-action` as a focused review lane in Loop 2, with
path-specific prompts and strict trust gating.

**A. Path-specific review pattern**

```yaml
name: AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      payments: ${{ steps.filter.outputs.payments }}
      api: ${{ steps.filter.outputs.api }}
      ui: ${{ steps.filter.outputs.ui }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            payments:
              - "src/**/checkout/**"
              - "src/**/stripe/**"
            api:
              - "src/app/api/**"
              - "src/**/server/**"
            ui:
              - "src/components/**"

  review-payments:
    needs: changes
    if: needs.changes.outputs.payments == 'true' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@beta
        with:
          prompt: |
            Security-focused payment review:
            - Verify auth and authorization boundaries
            - Verify idempotency and webhook signature handling
            - Flag secret leakage and insecure defaults

  review-api:
    needs: changes
    if: needs.changes.outputs.api == 'true' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@beta
        with:
          prompt: |
            API review:
            - Auth checks on every mutating route
            - Input validation at boundary
            - Safe error handling and no sensitive leaks

  review-ui:
    needs: changes
    if: needs.changes.outputs.ui == 'true' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@beta
        with:
          prompt: |
            UI review:
            - Accessibility regressions
            - Design-token compliance
            - No debug-only artifacts in production UI
```

**B. External contributor gating**

Never run this lane automatically on forked/external PRs. Minimum condition:

```yaml
if: github.event.pull_request.head.repo.full_name == github.repository
```

For public repositories, also enable "Require approval for all external contributors"
in repository Actions settings before any AI review workflow can execute.

**C. Custom review checklist pattern**

Create `.claude/pr-review-checklist.md` and require AI review prompts to check:
- `.env.manifest` unchanged unless explicitly intended
- No hardcoded environment IDs introduced
- No new `console.log` in production paths
- Design-token compliance in UI changes
- Auth checks on new or modified API routes

**D. `/security-review` slash command**

Add `.claude/commands/security-review.md` for focused manual diff review:

```markdown
Run a security-focused review of the current branch diff against the PR base.

Review priorities:
1. AuthN/AuthZ boundary regressions
2. Secret leakage and unsafe config defaults
3. Injection risks in newly introduced query and parsing code
4. Stripe/Firebase/Supabase security guardrail regressions

Use project-specific instructions from:
- .claude/security-review-instructions.md
- .claude/pr-review-checklist.md

Report findings with severity: CRITICAL | HIGH | MEDIUM | LOW.
For each finding include: file, line, exploit path, and concrete remediation.
```

### Loop 3: Weekly Quality Run (automated, runs Monday 06:00 UTC)

Executed by `scripts/weekly-quality.js` — a 9-check automated agent:

```bash
# Run manually at any time
node scripts/weekly-quality.js

# Or via npm script
pnpm quality
```

The 9 checks:
1. Dependency vulnerability audit (`pnpm audit`)
2. Outdated package detection
3. Dead code / unused exports (`knip`)
4. Design token compliance — scans for hardcoded colours, spacing, font sizes
5. `console.log` sweep in production code
6. TODO/FIXME sweep and TECH_DEBT.md sync
7. Secret pattern detection in source files
8. AGENTS.md freshness check (warns if >90 days stale)
9. TypeScript strict compliance

Output: `docs/quality-reports/YYYY-MM-DD.md`  
GitHub: creates issue titled `Weekly Quality Report — YYYY-MM-DD`  
Exit code: non-zero on CRITICAL findings — blocks deployment if run in CI

---

## CI Pipeline Configuration

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Quality checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm type-check
      
      - name: Lint
        run: pnpm lint
      
      - name: Format check
        run: pnpm format:check
      
      - name: Security audit
        run: pnpm audit --audit-level=high
      
      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}

  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Unit tests
        run: pnpm test:unit --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
      
      - name: E2E tests
        run: pnpm test:e2e
        env:
          # Use test environment — never production
          NODE_ENV: test

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
        env:
          NODE_ENV: production
      
      - name: Analyse bundle
        run: pnpm bundle:analyse
      
      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}

  lighthouse:
    name: Lighthouse CI
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          configPath: lighthouserc.json
          uploadArtifacts: true
          temporaryPublicStorage: true

  verify-environment:
    name: Verify environment manifest
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate manifest
        run: node scripts/verify-env.js ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
```

### `lighthouserc.json`
```json
{
  "ci": {
    "collect": {
      "startServerCommand": "pnpm start",
      "url": ["http://localhost:3000", "http://localhost:3000/about"]
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }]
      }
    }
  }
}
```

---

## Weekly Quality Checklist

```markdown
# Weekly Quality Checklist — {{DATE}}
# Run by: Quality Agent
# Project: {{PROJECT_NAME}}

## Dependencies
- [ ] `pnpm audit` — any new vulnerabilities?
- [ ] `pnpm outdated` — any packages > 2 minor versions behind?
- [ ] Check for deprecated packages (look at npm warnings on install)
- [ ] Review Dependabot/Renovate PRs — merge or close

## Code Health
- [ ] `knip` — unused exports, files, dependencies
- [ ] Dead code review — files not imported, routes not linked
- [ ] TODO/FIXME sweep — add any found to TECH_DEBT.md
- [ ] Console.log sweep — any left in production code?
- [ ] `any` type sweep — any TypeScript `any` introduced this week?

## Design System
- [ ] Token consistency audit — any hardcoded colours, fonts, spacing?
- [ ] Component library check — any one-off components that should be in the library?
- [ ] Responsive check — any new components tested at mobile breakpoints?

## Performance
- [ ] Bundle size vs last week — regressed?
- [ ] Lighthouse scores vs last week — regressed?
- [ ] Core Web Vitals vs last week — regressed?
- [ ] Check image optimisation — any large unoptimised images added?

## Security
- [ ] Security headers check (securityheaders.com)
- [ ] Firebase/Supabase rules review — any gaps introduced this week?
- [ ] Secrets scan — any patterns in git history?
- [ ] Auth flow check — any new endpoints without auth?
- [ ] Input validation check — any new endpoints without Zod validation?

## Accessibility
- [ ] Axe accessibility scan on key pages
- [ ] Keyboard navigation test on any new components
- [ ] Check colour contrast on any new UI

## SEO/AEO (see SEO_AEO.md for full checklist)
- [ ] Any new pages missing title/description?
- [ ] Structured data valid? (schema.org validator)
- [ ] Sitemap up to date?
- [ ] llms.txt up to date?

## Tech Debt
- [ ] Review TECH_DEBT.md — anything now overdue?
- [ ] Prioritise top 3 items for next sprint
- [ ] Close any resolved items

## Documentation
- [ ] AGENTS.md still accurate?
- [ ] Any new environment variables documented in .env.example?
- [ ] Any new tools documented in TOOL_REGISTRY.md?
- [ ] Any significant decisions this week that need an ADR?

## Output
Findings logged as GitHub issues with label `weekly-quality`.
Summary posted to team Slack/Discord channel.
```

---

## Tech Debt Log Format

`docs/TECH_DEBT.md`

```markdown
# Tech Debt Log
# Items are added when a compromise is made. Reviewed weekly.

## Active Items

### TD-001 — [Short description]
- **Added:** {{DATE}}
- **Added by:** Agent/Human
- **What:** [What is the compromise]
- **Why:** [Why it was made — time pressure, dependency issue, etc.]
- **Risk:** Low | Medium | High
- **Proper solution:** [What the correct implementation looks like]
- **Effort:** [S | M | L | XL]
- **Status:** Active | In Progress | Resolved

## Resolved Items

### TD-000 — [Description]
- **Resolved:** {{DATE}}
- **How:** [What was done to resolve it]
```

---

## ADR (Architecture Decision Records)

### `docs/adr/ADR-000-template.md`

```markdown
# ADR-{{NUMBER}} — {{Title}}

**Date:** {{DATE}}
**Status:** Proposed | Accepted | Superseded | Deprecated

## Context

[What is the situation or problem that required a decision?
What forces are at play? What constraints exist?]

## Decision

[What decision was made? Be specific and direct.]

## Consequences

**Positive:**
- [What becomes easier or better?]

**Negative / Trade-offs:**
- [What becomes harder or worse?]
- [What technical debt does this create, if any?]

**Neutral:**
- [Other changes that will happen as a result]

## Alternatives Considered

[What other options were evaluated and why were they rejected?]

## References

- [Links to relevant documentation, issues, or discussions]
```

### When to Write an ADR
Write an ADR when you:
- Choose a database or storage solution
- Choose a state management approach
- Define the folder structure or architecture pattern
- Make a security decision that could be questioned later
- Choose between two reasonable approaches and the choice isn't obvious
- Add a significant new dependency
- Change an existing architectural pattern

---

## Git Hooks Configuration

### `lefthook.yml`
```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx}"
      run: pnpm eslint {staged_files} --max-warnings=0
    type-check:
      run: pnpm type-check
    format:
      glob: "*.{js,ts,jsx,tsx,json,css,md}"
      run: pnpm prettier --check {staged_files}
    secrets:
      run: git-secrets --scan
    manifest:
      run: node scripts/verify-env.js local

commit-msg:
  commands:
    format:
      run: |
        if ! echo "{1}" | grep -qE "^(feat|fix|style|refactor|test|docs|chore|security|perf)(\(.+\))?: .{1,72}$"; then
          echo "❌ Invalid commit message format"
          echo "   Expected: type(scope): description"
          echo "   Example:  feat(auth): add Google OAuth sign-in"
          exit 1
        fi

pre-push:
  commands:
    tests:
      run: pnpm test:unit
```
