# RETROFIT.md — Applying the Handbook to Existing Projects

> The bootstrap assumes a blank slate. This document covers the different problem:
> applying the handbook to a project that already exists, already has code,
> already has choices made — some good, some not.
>
> The retrofit is not a rewrite. It is an honest audit followed by a structured plan.

---

## The Core Principle: Audit Before Mandate

The single most common mistake when retrofitting an existing project is generating
an `AGENTS.md` that says "never hardcode colours" when the codebase has 200 of them.

An agent that reads that rule will either:
- Ignore it (because the context contradicts it)
- Try to fix all 200 in one go (catastrophic — breaks everything)
- Be confused about whether to follow the rule or match the existing code

The retrofit process is different from the bootstrap for this reason. It starts with
**discovery** — understanding the gap between the ideal (the handbook) and the reality
(the codebase). The output is not a mandate but a **migration plan** with priorities.

---

## The Two Retrofit Paths

### Path A — Quick Retrofit (30 minutes)
For projects where you need the minimum viable handbook presence immediately.
Gets the most critical files in place without a full audit.

Best for:
- Projects you are actively working on right now
- When an agent is about to start a task on a project with no guidance
- When you need environment ID protection urgently

**Output:** `AGENTS.md`, `.env.manifest`, `docs/TECH_DEBT.md`

Use Prompt 11 from `prompts/PROMPT_LIBRARY.md`.

### Path B — Full Retrofit (2–4 hours, split over sessions)
For projects you want to properly bring under handbook governance.
Produces a complete audit, migration plan, and all handbook files.

Best for:
- Projects actively being developed that will be long-lived
- Projects where quality problems are costing time
- Before a major new feature or release

**Output:** Everything the bootstrap produces, calibrated to the existing codebase.

Use Prompt 12 from `prompts/PROMPT_LIBRARY.md`.

---

## Phase 1: Discovery (Do Not Skip)

Before generating any files, the retrofit agent must understand what exists.
Running a retrofit without discovery produces incorrect, aspirational files
that agents will contradict every time they look at the actual codebase.

### What the discovery agent reads

```
1. package.json / pubspec.yaml         → framework, dependencies, scripts
2. Directory tree (2 levels)           → structure, patterns, deviations
3. Any existing .env, config files     → environment setup, services used
4. Any existing AGENTS.md / CLAUDE.md → previous guidance to preserve or update
5. A sample of source files (10–15)   → coding patterns, token usage, error handling
6. Recent git log (last 20 commits)   → what's been changing, active areas
7. Any CI/CD config                   → what quality gates already exist
```

### Discovery questions the agent answers

**Identity:** What framework? What backend? What deployment? What services (auth, payments, DB)?

**Environment:** What cloud project IDs are in the codebase? Are they hardcoded anywhere?
Do staging and production use different IDs? Is there anything resembling a manifest?

**Design system:** Are there design tokens? A component library? Or is styling ad-hoc?
How many unique colour values appear in the codebase? How many font sizes?

**Quality:** Are there tests? What is the test coverage? Is there a linter configured?
Is there CI? When did tests last fail?

**Security:** Are there any secrets in the codebase? In git history? Are API routes
authenticated? Is there any input validation?

**Tech debt:** What TODOs exist? What are the largest, most complex files?
What has been commented out?

---

## Phase 2: Gap Analysis

The discovery output maps the codebase against handbook standards.
The gap analysis produces a prioritised list of what needs to change.

### Severity levels for gaps

**CRITICAL (fix before the next deploy)**
- Secrets committed to git
- Wrong environment IDs (production credentials in staging config)
- No authentication on API routes that handle user data or payments
- Stripe webhooks without signature validation

**HIGH (fix this sprint)**
- No `.env.manifest` — environment IDs could be wrong at any time
- Hardcoded environment IDs scattered across the codebase
- No error handling on payment or auth flows
- TypeScript disabled or with `strict: false`

**MEDIUM (fix this month)**
- No design tokens — every component has hardcoded colours and spacing
- No tests on business logic, auth, or payment code
- No CI — quality checks are entirely manual
- console.log in production code

**LOW (track in TECH_DEBT.md, fix incrementally)**
- Individual instances of hardcoded visual values (after design tokens are added)
- Missing JSDoc on exported functions
- Unused dependencies
- Inconsistent naming patterns

---

## Phase 3: Honest AGENTS.md Generation

The retrofit `AGENTS.md` is different from the bootstrap `AGENTS.md` in one critical way:
it must reflect the **current reality** of the codebase, not the ideal.

### The pattern for each gap

For each HIGH or MEDIUM gap found in Phase 2, the AGENTS.md gets an entry like this:

```markdown
## MIGRATION STATUS (read before every task)

This project is being brought under Complete Development Handbook governance.
Not everything is compliant yet. This section tells you the current state.

### Design tokens: IN MIGRATION
The project does not yet have a complete design token system.
- New code MUST use CSS custom properties (var(--token-name))
- Tokens are defined in design-tokens/tokens.css
- ~150 hardcoded colour values exist in legacy components — tracked in TECH_DEBT.md (TD-001)
- When editing a legacy component, migrate its hardcoded values to tokens
- Do NOT do a full migration in one pass — only migrate files you are already editing

### Environment IDs: PARTIALLY SECURED
.env.manifest exists and is the authoritative source.
- CRITICAL: acme-prod Firebase project ID must NEVER appear in local development
- 3 files still contain hardcoded staging project IDs — tracked as TD-002
- When you encounter a hardcoded ID, replace it with the env var and note it in TD-002

### Tests: NOT YET IN PLACE
The project currently has no test suite.
- New code you write MUST have tests
- Do not spend time writing tests for existing untested code during feature work
- Tests for existing critical paths (auth, payments) are scheduled as TD-003
```

This approach:
- Is honest — agents won't be confused by rules that contradict the code they see
- Is progressive — improvements compound over time
- Is safe — agents won't attempt big-bang migrations that break things
- Is tracked — TECH_DEBT.md becomes the source of truth for the migration

---

## Phase 4: Core Outputs of Session 1

Session 1 produces three documents — all read-only analysis, no code changes:

### `docs/CODEBASE.md` — Agent Orientation Guide

**This is the most important document for fixing "agents don't know the codebase."**

Every agent reads this before starting any task on this project. It answers:
- What the project is and who uses it
- Where things live (directory map, component inventory)
- What patterns are in use (data fetching, error handling, validation, state)
- What the routes and pages are
- What services are connected
- What is complex and should be touched minimally
- What the design system and test status are

Use `configs/CODEBASE_TEMPLATE.md` as the base. Populate every section from discovery.

**Rule:** Be honest and specific. "Data fetching uses a mix of fetch() and axios
with no consistent error handling" is more useful than "data is fetched from APIs."
An agent reading a vague CODEBASE.md will make assumptions. An agent reading a
specific CODEBASE.md will make fewer mistakes.

### `docs/MIGRATION_PLAN.md` — Prioritised Roadmap

```markdown
# Handbook Migration Plan — {{PROJECT_NAME}}

Retrofitted: {{DATE}}
Handbook version: {{HANDBOOK_VERSION}}

## Status

| Area | Status | Priority | Notes |
|------|--------|----------|-------|
| Environment manifest | ❌ | CRITICAL | Session 2 |
| Agent constitution (AGENTS.md) | ❌ | CRITICAL | Session 2 |
| Security: API auth check | ⚠️ Partial | HIGH | 3 routes unprotected |
| CI/CD pipeline | ❌ | HIGH | Session 2 |
| Test infrastructure | ❌ | HIGH | Sprint 2 |
| Design tokens | ❌ | MEDIUM | Sprint 3 |
| TypeScript strict mode | ❌ | MEDIUM | Sprint 4 |
| Tech debt documentation | ❌ | MEDIUM | Session 2 |

## Recommended migration order

**Session 2 (next, with agent):**
1. .env.manifest — locks environment IDs, prevents wrong-project writes
2. AGENTS.md — gives all future agents orientation and rules
3. docs/TECH_DEBT.md — makes invisible debt visible
4. CI/CD pipeline — quality gate on every PR from now on

**Sprint 2 (this week, human-reviewed PRs):**
5. Test infrastructure setup (vitest + minimal config)
6. Tests for auth flow and payment webhooks only
7. Fix CRITICAL security findings from audit

**Sprint 3 (next week):**
8. Design tokens — extract existing values, create tokens.json
9. Migrate 5 most-used components to tokens

**Sprint 4 (ongoing):**
10. TypeScript strict mode — enable, fix errors in batches
11. Remaining component migration to tokens

## Notes
- Do not attempt full test coverage in one pass — write tests for new code + critical paths only
- Do not migrate all design values at once — migrate files as you edit them
- CI/CD can be set up in 30 minutes — do this in Session 2, it pays dividends immediately
```

The plan is shown to the human for confirmation before Session 2 begins.

### `docs/scratchpad/` — Learning Capture Scaffold

The third Session 1 output is the scratchpad directory — scaffolded immediately
so that any learnings from the retrofit process itself are captured from day one.

```bash
mkdir -p docs/scratchpad
cp /tmp/handbook/configs/SCRATCHPAD_README.md docs/scratchpad/README.md
```

Create `docs/scratchpad/DAILY.md` with a seed entry capturing the key findings
from the retrofit audit that are `watch`-maturity — things discovered during
the retrofit that may or may not be universal patterns:

```markdown
# Daily Summary — [RETROFIT DATE]

## Watching
[Seed with any findings from the audit that could be universal patterns
 but need more evidence. Use 'watch' maturity — promote to 'rule' if seen again.]

## Notes
This project was retrofitted to the Public Bible on [date].
The retrofit audit findings are documented in docs/RETROFIT_AUDIT.md.
```

The retrofit agent seeds the scratchpad — it does not write to the Public Bible.
Any audit findings worth promoting go through the normal scratchpad pipeline.

---

## The Migration Sequence That Works

When a project has no tests, no CI, and invisible tech debt simultaneously,
the instinct is to fix all three at once. This always fails.

**The correct order:**

### 1. Make debt visible first (30 minutes)
Without `docs/TECH_DEBT.md`, every shortcut disappears into the codebase.
Agents don't know about it. It never gets fixed.

Create `docs/TECH_DEBT.md` with one entry per finding from the audit.
This alone changes how agents work — they log compromises rather than burying them.

### 2. CI/CD before tests (1–2 hours)
Counter-intuitive but correct: set up CI before writing any tests.

Why: If you write tests with no CI, they only run when someone remembers to run them.
CI makes tests mandatory. Once CI is in place, every future test immediately becomes
part of the quality gate.

Set up the minimum viable CI pipeline from `configs/workflows/ci.yml`:
- Type check
- Lint
- Build

No test job yet — that comes next. But now you have a quality gate.

### 3. Test infrastructure, not test coverage (1 hour)
Add `vitest` (or `flutter_test`). Configure it. Add `pnpm test:unit` to the CI workflow.
Write exactly three tests: one for the auth flow, one for the payment webhook, one for
the most critical business logic function.

Do not aim for coverage. Aim for the infrastructure being in place so that every
new feature written from now on has tests written alongside it.

### 4. Design tokens in parallel (across multiple PRs)
Do not do a big-bang token migration. Instead:
1. Create `design-tokens/tokens.json` with the most common values extracted from the codebase
2. Generate `tokens.css`
3. Import `tokens.css` in the global stylesheet
4. Add to `AGENTS.md`: "When editing any component, replace hardcoded values with token references"

From this point, every PR that touches a component also migrates that component's values.
The migration happens as a byproduct of normal development. It takes longer but never breaks anything.

### 5. TypeScript strict — last, in a dedicated PR
Enable strict mode, measure the errors, fix them in a single PR with nothing else in it.
Never enable strict mode alongside feature work — the diffs become unreviable.

---

## Handling Specific Common Situations

### "The project has no tests at all"

Do not generate a test suite in the retrofit. That is a separate sprint of work.
Instead:
1. Add `vitest` (or `flutter_test`) to `devDependencies`
2. Create `vitest.config.ts` with the correct config
3. Add `"test:unit": "vitest run"` to `package.json`
4. Add to `AGENTS.md`: "New code must have tests. Existing untested code is tracked as TD-003."
5. Add TD-003 to `TECH_DEBT.md` with estimated effort

The infrastructure is in place. Coverage grows naturally as new code is written.

### "The project has TypeScript but strict mode is off"

Do not enable strict mode during the retrofit. It will break the build immediately
and produce hundreds of errors. Instead:
1. Audit how many errors `tsc --strict` produces: `pnpm tsc --strict --noEmit 2>&1 | tail -5`
2. Add to `TECH_DEBT.md` with the error count
3. Add to `AGENTS.md`: "TypeScript strict mode migration in progress. New code must be strict-compatible."
4. Schedule strict mode enablement as a dedicated PR (not part of feature work)

### "The project has hardcoded environment IDs everywhere"

This is the most dangerous situation — an agent editing the codebase might
inadvertently write to the wrong environment.

1. Create `.env.manifest` immediately — this is the first action, not the last
2. Run `grep -r "FIREBASE_PROJECT_ID_LITERAL\|HARDCODED_ID" src/` to find all occurrences
3. Add each file to TECH_DEBT.md as TD-002
4. Add to `AGENTS.md` NEVER DO: "Never use a hardcoded environment ID. Every occurrence is listed in TD-002 and must be replaced when you touch that file."

### "There's no component library — every page has its own styles"

Do not create a component library during the retrofit. It will be wrong and unused.
1. Create `design-tokens/tokens.json` with values extracted from the most common values in the codebase
2. Generate `design-tokens/tokens.css`
3. Add to `AGENTS.md`: "Design token migration in progress. Add to tokens.css before adding any new value. Migrate existing values when editing a file."
4. The component library emerges naturally as components are standardised

### "The project was bootstrapped with an old handbook version"

If an `AGENTS.md` already exists but it's outdated or incomplete:
1. Read the existing `AGENTS.md` carefully — preserve any project-specific decisions
2. Compare it against the current `AGENTS_TEMPLATE.md`
3. Merge: keep existing project-specific content, add missing sections from the template
4. Update the handbook version header
5. Add a note: "This file was updated from handbook v[old] to v[new] on [date]."

---

## The Retrofit is Never "Done"

A retrofit is not a one-time event. It is the beginning of a migration.
The project moves from "unmanaged" to "managed under handbook governance" gradually.

The weekly quality agent (`scripts/weekly-quality.js`) is the engine of this migration.
Every Monday it audits the project, finds new violations, and adds them to TECH_DEBT.md.
The MIGRATION_PLAN.md tracks the overall progress.

A project is "fully retrofitted" when:
- `.env.manifest` is in place and accurate
- `AGENTS.md` reflects the actual current state
- CI/CD is running on every PR
- TECH_DEBT.md exists and is being worked
- The weekly quality run is producing diminishing findings

It does not require zero tech debt. It requires that the tech debt is visible,
tracked, and being reduced.
