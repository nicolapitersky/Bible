# PROMPTS/ — Director's Prompt Library

> These are copy-paste prompts for the most common agentic development scenarios.
> Replace {{PLACEHOLDERS}} with actual values before using.
> Every prompt instructs the agent to read the Handbook first.

---

## HOW TO USE THESE PROMPTS

Paste the prompt into Claude Code, Cursor, Firebase Studio, or Windsurf.
The agent reads the Handbook, checks the environment, then executes.
Do not abbreviate the handbook-reading instruction — it is load-bearing.

---

## PROMPT 1 — New Project Bootstrap

**When:** Starting any new project from scratch.

```
You are the Bootstrap Orchestrator for a new project.

Step 1: Clone the handbook
  git clone https://github.com/YOUR-ORG/dev-handbook /tmp/handbook

Step 2: Read these files in order, confirming each:
  /tmp/handbook/BOOTSTRAP.md     ← Follow every phase in this file
  /tmp/handbook/PRINCIPLES.md
  /tmp/handbook/ENVIRONMENTS.md
  /tmp/handbook/DESIGN_SYSTEM.md
  /tmp/handbook/SECURITY.md
  /tmp/handbook/TOOLING.md
  /tmp/handbook/QUALITY.md
  /tmp/handbook/SEO_AEO.md
  /tmp/handbook/STRUCTURE.md

Step 3: Follow BOOTSTRAP.md exactly — all 6 phases, in order.
  Do not skip Phase 2 (environment manifest confirmation).
  Do not write application code until Phase 6 is complete.

Begin now. State "Handbook loaded. Starting Phase 0." when you start.
```

---

## PROMPT 2 — Start a New Feature

**When:** Beginning work on a feature within an existing project.

```
You are a development agent working on {{PROJECT_NAME}}.

Before writing any code:
1. Read AGENTS.md in this project root — all of it
2. Read .env.manifest and confirm the environment IDs
3. Confirm which git branch you are on: run `git status`
4. Check docs/TOOL_REGISTRY.md — does a tool already exist for any part of this feature?
5. Check the component library at {{COMPONENT_LIBRARY_PATH}} — do any components already exist?

Then implement: {{FEATURE_DESCRIPTION}}

Requirements:
- Use only design tokens for all visual values (tokens.css / AppTokens)
- Write tests alongside the code (not after)
- Handle all error states explicitly
- Mobile and desktop — implement and verify both
- Zero TypeScript errors, zero lint errors before you consider it done
- Update docs/TECH_DEBT.md if you make any compromises

When done, run:
  pnpm type-check && pnpm lint && pnpm test:unit

Report: what you built, what tests cover it, any compromises logged to TECH_DEBT.md
```

---

## PROMPT 3 — Fix a Bug

**When:** Investigating and fixing a reported bug.

```
You are a development agent working on {{PROJECT_NAME}}.

Before touching any code:
1. Read AGENTS.md in this project root
2. Run `git status` — understand the current state
3. Run the failing test or reproduce the bug first — confirm you can reproduce it

Bug report: {{BUG_DESCRIPTION}}

Investigation rules:
- Fix only the bug. Do not refactor surrounding code.
- If you find related issues while investigating, log them in docs/TECH_DEBT.md — do not fix them now.
- The fix must have a test that would have caught the original bug.

After fixing:
- Run the full test suite: pnpm test
- Run type check: pnpm type-check
- Run lint: pnpm lint

Report: root cause, what you changed, what test now catches it.
```

---

## PROMPT 4 — Weekly Quality Run

**When:** Every Monday. Run this as a scheduled agent task.

```
You are the Weekly Quality Agent for {{PROJECT_NAME}}.

Date: {{DATE}}
Branch: main (or staging)

Read AGENTS.md, then execute docs/QUALITY_CHECKLIST.md in full.

For each section of the checklist:
1. Run the relevant tools/checks
2. Document findings with severity: [LOW | MEDIUM | HIGH | CRITICAL]
3. For CRITICAL findings: create a GitHub issue immediately
4. For HIGH findings: add to docs/TECH_DEBT.md and create a GitHub issue
5. For MEDIUM/LOW findings: add to docs/TECH_DEBT.md

Sections to run:
- pnpm audit (dependency vulnerabilities)
- pnpm outdated (stale dependencies)
- knip (dead code / unused exports)
- grep -r "console.log" src/ (stray logs)
- grep -r "TODO\|FIXME\|HACK" src/ (undocumented shortcuts)
- Lighthouse CI run (performance regression)
- Token consistency check: grep -r "color:" src/ | grep -v "var(--" (hardcoded values)
- Secret scan: git log --oneline -50 | run trufflehog or gitleaks on recent commits
- Review docs/TECH_DEBT.md — flag any items older than 4 weeks

At the end, create a single GitHub issue titled:
  "Weekly Quality Report — {{DATE}}"
  Label: weekly-quality
  
Include: summary of all findings, severity counts, top 3 priority actions.

State when complete.
```

---

## PROMPT 5 — Security Audit

**When:** Before any major release, or if a security concern is raised.

```
You are the Security Audit Agent for {{PROJECT_NAME}}.

Read AGENTS.md, then read /tmp/handbook/SECURITY.md (or the handbook SECURITY.md).

Perform a comprehensive security audit covering:

1. AUTHENTICATION & AUTHORISATION
   - Audit every API route: does each one verify authentication before processing?
   - Audit every database query: does each filter by user ID?
   - Check: are any admin routes accessible without role verification?

2. INPUT VALIDATION
   - Audit every API endpoint: does each validate input with Zod?
   - Check: is any user input used in database queries without parameterisation?
   - Check: is any user input rendered as HTML without sanitisation?

3. SECRETS & ENVIRONMENT
   - Run: git log --all -- '*.env*' (look for committed secrets in history)
   - Scan: grep -r "sk_live\|pk_live\|AIza\|AAAA" src/ (check for hardcoded keys)
   - Verify: every secret in .env.example has no value

4. FIREBASE / SUPABASE RULES
   - Read current firestore.rules / storage.rules
   - Identify: any collection with overly permissive rules
   - Test: do rules allow a user to read another user's data?

5. DEPENDENCIES
   - Run: pnpm audit --audit-level=moderate
   - Report: all vulnerabilities with severity and package

6. HTTP SECURITY
   - Verify: security headers present on all routes
   - Check: CORS configuration — no wildcards in production
   - Verify: rate limiting on auth and payment endpoints

7. STRIPE WEBHOOKS
   - Verify: webhook signature validation present
   - Verify: idempotency keys used for payment operations

For each finding, report:
  - Severity: CRITICAL | HIGH | MEDIUM | LOW
  - File and line number
  - What the vulnerability is
  - How to fix it

Create GitHub issues for all CRITICAL and HIGH findings.
Do not attempt to fix anything — report only. Fixes require separate review.
```

---

## PROMPT 6 — Dependency Update Sprint

**When:** Monthly dependency maintenance.

```
You are the Dependency Maintenance Agent for {{PROJECT_NAME}}.

Read AGENTS.md first.

Step 1: Audit current state
  pnpm audit
  pnpm outdated

Step 2: For each outdated package, assess:
  - Is it a patch update? (safe to update — do it)
  - Is it a minor update? (check changelog — usually safe — update with test run)
  - Is it a major update? (breaking changes likely — flag for human review)

Step 3: Update safe packages (patches and tested minors):
  pnpm update [package]
  Run: pnpm test && pnpm type-check && pnpm build

Step 4: Report on major updates needed:
  For each: package name, current version, latest version, changelog URL, estimated effort

Step 5: Check for deprecated packages
  Any package with npm deprecation warning → flag as TECH_DEBT with HIGH priority

Do not update major versions without human approval.
Do not update firebase, stripe, or supabase major versions without an ADR.

Report: what was updated, what needs human review, what is deprecated.
```

---

## PROMPT 7 — New Developer / Agent Onboarding to Existing Project

**When:** A new agent or human developer starts on a project that already exists.

```
You are joining {{PROJECT_NAME}} as a development agent.

Before doing anything else, orient yourself completely:

1. Read AGENTS.md (project root) — the project constitution
2. Read .env.manifest — the environment identifiers
3. Read docs/TOOL_REGISTRY.md — what tools are approved for this project
4. Read docs/TECH_DEBT.md — what shortcuts exist and where
5. Read docs/adr/ — list all ADRs and read the most recent 3
6. Run: git log --oneline -20 (understand recent changes)
7. Run: pnpm install && pnpm type-check && pnpm test
   (verify everything passes before you touch anything)

Then report:
- Any issues found during setup (failing tests, type errors, etc.)
- Your understanding of the project's current state
- Any immediate risks you observe in docs/TECH_DEBT.md

Do not make any code changes during onboarding. Orient first.
Ask if anything in AGENTS.md is unclear before starting work.
```

---

## PROMPT 8 — Design System Audit

**When:** Design consistency has drifted, or before a major UI release.

```
You are the Design System Audit Agent for {{PROJECT_NAME}}.

Read AGENTS.md, then read the design-tokens section.

Audit for design system violations:

1. HARDCODED COLOURS
   grep -rn "color:\s*#\|background:\s*#\|border.*#\|rgba(\|rgb(" src/ --include="*.tsx" --include="*.ts" --include="*.css"
   grep -rn "Color(0x" lib/ (Flutter)
   Report every occurrence.

2. HARDCODED SPACING
   grep -rn "margin:\s*[0-9]\|padding:\s*[0-9]" src/ --include="*.tsx" --include="*.css"
   grep -rn "EdgeInsets.all([^A]" lib/ (Flutter — not using token)
   Report every occurrence that isn't a token reference.

3. HARDCODED FONT SIZES
   grep -rn "font-size:\s*[0-9]\|fontSize:\s*[0-9]" src/
   Report every occurrence not referencing a token.

4. ROGUE COMPONENTS
   List every component file in src/components/ or lib/presentation/widgets/
   For each: does it use the design system, or define its own styles?

5. INCONSISTENT NAMING
   List all Button-like components — are they all using the same component?
   List all Input-like components — ditto?
   List all Card-like components — ditto?

For each violation, report:
  - File and line number
  - What value is hardcoded
  - What token it should use instead

Create a summary:
  - Total violations found
  - Most common violation type
  - Estimated effort to fix

Do not fix anything — audit only. Create a GitHub issue with the full report.
```

---

## PROMPT 9 — Pre-Launch Checklist

**When:** Any project goes live for the first time, or a major version ships.

```
You are the Pre-Launch Verification Agent for {{PROJECT_NAME}}.

This is a production launch. Work methodically. Do not rush.

Read AGENTS.md. Then verify every item:

ENVIRONMENT
- [ ] .env.manifest production IDs confirmed with human
- [ ] All production environment variables set in Vercel/Netlify/Cloud Run
- [ ] node scripts/verify-env.js production passes
- [ ] Firebase/Supabase production project is NOT the same as staging

SECURITY
- [ ] pnpm audit — zero high/critical vulnerabilities
- [ ] Security headers: curl -I https://{{PRODUCTION_URL}} and check headers
- [ ] Firebase Security Rules deployed and tested
- [ ] Stripe webhook secret is production key (not test)
- [ ] Rate limiting active on auth and payment endpoints
- [ ] No secrets in git history (run gitleaks)
- [ ] CORS configured explicitly (no wildcards)

SEO
- [ ] Every page has unique title and description
- [ ] sitemap.xml accessible at /sitemap.xml
- [ ] robots.txt accessible at /robots.txt
- [ ] llms.txt accessible at /llms.txt
- [ ] Google Search Console configured
- [ ] Structured data valid: https://validator.schema.org

PERFORMANCE
- [ ] Lighthouse score ≥ 90 on key pages
- [ ] Core Web Vitals passing: LCP < 2.5s, CLS < 0.1
- [ ] All images using next/image or equivalent optimisation
- [ ] Bundle size within budget

MONITORING
- [ ] Sentry configured and tested (throw a test error)
- [ ] Firebase/Vercel analytics active
- [ ] Error alerting configured

LEGAL/COMPLIANCE (flag for human — agent does not assess legal requirements)
- [ ] Privacy policy published
- [ ] Cookie consent (if applicable to jurisdiction)
- [ ] Terms of service published

Report each item as PASS / FAIL / NEEDS_HUMAN.
Do not launch if any item is FAIL.
```

---

## PROMPT 10 — Emergency Hotfix

**When:** Production is broken and needs an immediate fix.

```
EMERGENCY HOTFIX MODE for {{PROJECT_NAME}}.

Production issue: {{ISSUE_DESCRIPTION}}
Reported at: {{TIME}}

CRITICAL RULES FOR HOTFIX MODE:
1. Do NOT commit directly to main — create a hotfix/[description] branch
2. Fix ONLY the reported issue — nothing else
3. Every change must have a test
4. pnpm test must pass before merge
5. After merge: create a post-mortem entry in docs/adr/ describing what happened

Step 1: Orient
  git checkout main && git pull
  git checkout -b hotfix/{{SHORT_DESCRIPTION}}
  Reproduce the issue in development first

Step 2: Fix
  Minimal change that fixes the issue
  Add a regression test

Step 3: Verify
  pnpm test && pnpm type-check && pnpm lint && pnpm build

Step 4: Document
  Commit with: security(scope): [description]
  Add to docs/TECH_DEBT.md: root cause and any follow-up work needed
  
Step 5: Report
  What was broken, why, what you changed, what test prevents recurrence

After the hotfix is merged and deployed, a full security review of the affected area
should be scheduled within 48 hours.
```

---

## PROMPT 11 — Quick Retrofit (Existing Project, Minimum Viable)

**When:** An existing project has no handbook files. You need the critical protections
in place quickly — environment lock, agent constitution, tech debt log.
Takes about 30 minutes of agent work. Does NOT attempt to fix anything.

```
You are the Retrofit Agent for an existing project.
The Complete Development Handbook is at: /tmp/handbook

Step 1 — Read the retrofit guide:
  cat /tmp/handbook/RETROFIT.md

Step 2 — Run the automated audit (read-only, makes no changes):
  node /tmp/handbook/scripts/retrofit-audit.js
  cat docs/RETROFIT_AUDIT.md

Step 3 — Discover the project (read only, make NO changes yet):
  cat package.json 2>/dev/null || cat pubspec.yaml 2>/dev/null
  git log --oneline -20
  ls src/ 2>/dev/null || ls lib/ 2>/dev/null

Step 4 — Generate ONLY these three files, calibrated to what you discovered:

  A. .env.manifest
     Use the schema in /tmp/handbook/ENVIRONMENTS.md.
     IMPORTANT: Use {{PLACEHOLDER}} for any ID you do not know.
     Show it to the human and ask them to fill in the real values.
     State clearly: "I need the following IDs from you: [list]"

  B. AGENTS.md
     Use /tmp/handbook/AGENTS_TEMPLATE.md as the base.
     Add a MIGRATION STATUS section reflecting the ACTUAL current state:
     - Which handbook standards are already met
     - Which are partially met (with how many violations)
     - Which are not yet in place
     Do NOT write aspirational rules that contradict the current codebase.

  C. docs/TECH_DEBT.md
     Create with one entry per CRITICAL or HIGH finding from the audit.
     Use the format from /tmp/handbook/QUALITY.md.

Step 5 — Report:
  - List the 3 files generated
  - List the IDs you still need from the human
  - List the top 3 CRITICAL/HIGH items from the audit that need human attention

Do NOT:
- Fix any existing code
- Add dependencies
- Run migrations
- Change any existing files other than generating the 3 listed above
```

---

## PROMPT 12 — Full Retrofit (Existing Project, Staged Process)

**When:** You want to fully bring an existing project under handbook governance.
This is a staged process: Session 1 is discovery and planning only.
You review the output, then confirm which items to tackle in Session 2.

```
You are the Full Retrofit Agent for an existing project.
The Complete Development Handbook is at: /tmp/handbook

════════════════════════════════════════════════════════════
SESSION 1: DISCOVERY AND PLANNING — make no code changes
════════════════════════════════════════════════════════════

Step 1 — Read the retrofit guide:
  cat /tmp/handbook/RETROFIT.md
  cat /tmp/handbook/PRINCIPLES.md

Step 2 — Run the automated audit:
  node /tmp/handbook/scripts/retrofit-audit.js
  cat docs/RETROFIT_AUDIT.md

Step 3 — Deep discovery (read only, no changes):

  Identity:
    cat package.json 2>/dev/null || cat pubspec.yaml
    node --version && cat .nvmrc 2>/dev/null

  Existing handbook files:
    for f in AGENTS.md CLAUDE.md .env.manifest .env.example \
              docs/TECH_DEBT.md design-tokens/tokens.json; do
      [ -f "$f" ] && echo "=== $f ===" && cat "$f" || echo "MISSING: $f"
    done

  Directory structure:
    find . -maxdepth 3 -not -path "./.git/*" -not -path "./node_modules/*" \
           -not -path "./.next/*" -not -path "./dist/*" -type d | sort

  All routes and pages:
    find src/app -name "page.tsx" -o -name "route.ts" -o -name "layout.tsx" \
      2>/dev/null | sort
    find src/pages -name "*.tsx" 2>/dev/null | sort

  Component inventory:
    find src/components lib/presentation/widgets -type f 2>/dev/null | sort

  Key patterns — read 3 representative files each:
    cat $(find src/lib -name "*.ts" | head -3) 2>/dev/null
    cat $(find src/app/api -name "route.ts" | head -2) 2>/dev/null
    cat $(find src/components -name "*.tsx" | head -2) 2>/dev/null

  Largest files (complexity hotspots):
    find src lib app -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.dart" \) \
      -exec wc -l {} + 2>/dev/null | sort -rn | head -15

  Services in use:
    grep -E "firebase|supabase|stripe|resend|twilio|sentry" package.json 2>/dev/null

  Environment IDs (critical):
    grep -rn "projectId\|SUPABASE_URL\|DATABASE_URL\|VERCEL_PROJECT" \
      src/ lib/ .env* --include="*.ts" --include="*.env*" 2>/dev/null | \
      grep -v "process.env\|env\." | head -20

  Hardcoded visual values:
    grep -rn "color.*#\|background.*#\|rgba(" src/ --include="*.ts" \
      --include="*.tsx" --include="*.css" 2>/dev/null | wc -l

  Tests:
    find src lib -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l
    ls .github/workflows/ 2>/dev/null

  Recent history:
    git log --oneline -20

Step 4 — Read the relevant stack addendums:
  Based on what you found, read from /tmp/handbook/stacks/:
  - The framework stack (nextjs.md, astro.md, flutter.md, etc.)
  - The backend stack (firebase.md, supabase.md)
  - claude-code.md (always)

Step 5 — Generate Session 1 outputs (these two documents only):

  A. docs/CODEBASE.md
     Use /tmp/handbook/configs/CODEBASE_TEMPLATE.md as the base.
     Fill in every section from your discovery above.
     Be SPECIFIC and HONEST. Do not write aspirational descriptions.
     "Data fetching: mix of direct fetch() calls with no consistent
     error handling" is better than "data fetched via API".
     This document is read by every agent before every task.
     Its quality directly determines how well agents understand the project.

  B. docs/MIGRATION_PLAN.md
     Use the template from RETROFIT.md Phase 4.
     Populate with actual findings from the audit.
     Include the recommended migration sequence from RETROFIT.md.
     Include ALL items needed: Session 2 items AND sprint items.
     Label items as: SESSION 2 / SPRINT 2 / SPRINT 3 / ONGOING

Step 6 — Present findings to human:
  State:
  "Session 1 complete. I have read the codebase and produced:
   - docs/RETROFIT_AUDIT.md — audit findings with severities
   - docs/CODEBASE.md — orientation guide for future agents
   - docs/MIGRATION_PLAN.md — staged migration roadmap

  Summary:
  [CRITICAL findings count and what they are]
  [HIGH findings count and what they are]
  [Recommended Session 2 scope]

  Please review docs/MIGRATION_PLAN.md and confirm:
  1. Are the environment IDs correct in the audit? (I will need them for .env.manifest)
  2. Which Session 2 items should I tackle?
  3. Are there project-specific rules or decisions I should know about?

  I will wait for your confirmation before making any changes."

════════════════════════════════════════════════════════════
SESSION 2: GENERATE HANDBOOK FILES (after human confirms)
════════════════════════════════════════════════════════════

Step 7 — Re-read your Session 1 outputs before starting:
  cat docs/CODEBASE.md
  cat docs/MIGRATION_PLAN.md
  cat docs/RETROFIT_AUDIT.md

Step 8 — Generate files in this exact order:

  A. .env.manifest  ← ALWAYS FIRST — do not skip
     Use schema from /tmp/handbook/ENVIRONMENTS.md.
     Use {{PLACEHOLDER}} for every ID you do not know.
     Show it to human. Ask for every missing value explicitly.
     State: "I need these IDs confirmed: [list each one]"
     Wait for confirmation before generating AGENTS.md.

  B. AGENTS.md
     Base: /tmp/handbook/AGENTS_TEMPLATE.md
     Add these sections specific to this project:
       - MIGRATION STATUS: current reality for each area
         (design tokens: ~N hardcoded values, migrating incrementally)
         (tests: infrastructure in place, write for new code only)
         (CI: in place / not yet in place)
       - Link to docs/CODEBASE.md for orientation
       - NEVER DO items specific to this project's known risks
     Every rule must be true TODAY, not aspirational.
     Label aspirational targets as [TARGET: when migration is complete]

  C. docs/TECH_DEBT.md
     One entry per CRITICAL/HIGH finding from the audit.
     Format from /tmp/handbook/QUALITY.md.
     Include the migration items from MIGRATION_PLAN.md as TD entries.

  D. CI/CD pipeline (HIGH priority — do this in Session 2)
     Copy /tmp/handbook/configs/workflows/ci.yml → .github/workflows/ci.yml
     Adjust to match actual package.json scripts.
     If no test:unit script yet, add the job but skip the test step with a comment:
     # Tests: not yet configured — tracked in TECH_DEBT.md as TD-XXX

  E. design-tokens/tokens.json
     Extract the 10 most common colour values from the codebase.
     These are the values to start with — do not invent a full token system.
     Run: node /tmp/handbook/scripts/generate-tokens.js

  F. IDE files
     node /tmp/handbook/scripts/generate-ide-rules.js --out=.

  G. .codex/setup.sh (if Codex is in use)
     See /tmp/handbook/stacks/codex.md

  H. .claude/settings.json (if Claude Code is in use)
     See /tmp/handbook/stacks/claude-code.md

  I. scripts/ (copy from handbook)
     cp /tmp/handbook/scripts/verify-env.js scripts/
     cp /tmp/handbook/scripts/generate-tokens.js scripts/
     cp /tmp/handbook/scripts/weekly-quality.js scripts/

Step 9 — Commit everything:
  git add -A
  git commit -m "chore: retrofit to Complete Development Handbook v{{HANDBOOK_VERSION}}

  Adds: AGENTS.md, .env.manifest, docs/CODEBASE.md, docs/MIGRATION_PLAN.md,
        docs/TECH_DEBT.md, CI/CD pipeline, design token infrastructure,
        handbook scripts, IDE rule files"

Step 10 — Final report:
  - List every file generated or modified
  - List every {{PLACEHOLDER}} still needing a real value
  - State the top 3 next actions from MIGRATION_PLAN.md
  - State: "Run node scripts/weekly-quality.js any time to check progress."
```

---

## PROMPT 13 — Update Existing AGENTS.md to Current Handbook Version

**When:** A project was bootstrapped with an older handbook version and AGENTS.md
is outdated. This updates it without disrupting the existing project-specific content.

```
You are updating the AGENTS.md for {{PROJECT_NAME}} from an older handbook version.
The current handbook is at: /tmp/handbook

Step 1 — Read both files:
  cat AGENTS.md                          (existing project file)
  cat /tmp/handbook/AGENTS_TEMPLATE.md   (current handbook template)

Step 2 — Identify:
  A. Sections in AGENTS_TEMPLATE.md that are MISSING from AGENTS.md
  B. Sections in AGENTS.md that have project-specific content to PRESERVE
  C. Sections that are present but outdated (reference old patterns)

Step 3 — Merge:
  - Keep ALL project-specific values (env IDs, project name, stack details)
  - Add missing sections from the template
  - Update outdated sections to current patterns
  - Update the handbook version in the header
  - Add to the AGENTS.md header: "Updated from v[old] to v[new] on [date]"

Step 4 — Regenerate IDE rule files:
  node /tmp/handbook/scripts/generate-ide-rules.js --out=.

Step 5 — Report:
  - What sections were added
  - What was preserved unchanged
  - What was updated
  - Run: git diff AGENTS.md  (show the diff to the human for review)
```

---

## PROMPT 14 — /scratchpad:learn (End of Session)

**When:** Closing any session — Claude Code, Codex, Cursor, Firebase Studio,
or after manual work in Vercel/Supabase/Firebase dashboards.
Run manually. The AI will suggest it when you use closing signals
("wrap up", "what's next", "did we forget anything", "safely deploy")
but will never write to the scratchpad without your explicit instruction.

```
You are capturing learnings from this session into the project scratchpad.

Step 0 — Check Claude's automatic memory first (Claude Code sessions only):
  cat ~/.claude/MEMORY.md 2>/dev/null | tail -30
  cat MEMORY.md 2>/dev/null
  # If MEMORY.md already captured today's key learning, note it.
  # A scratchpad entry is still worth writing if the learning could be
  # promoted to the Public Bible. If it is purely local/project-specific,
  # MEMORY.md alone may be sufficient — state this and ask the human.

Review this conversation (or the work I'm about to describe) and produce
a scratchpad entry.

If I'm describing manual work (something I did in Vercel dashboard, Supabase,
Firebase, GitHub directly), I will describe it now in plain language and you
will structure it. If capturing from this conversation, read it yourself.

For the entry, answer honestly:
1. Did anything break, fail unexpectedly, or require a non-obvious fix?
2. Was anything surprising about how a tool, API, or framework behaved?
3. Did we discover a gap in the project's AGENTS.md, handbook rules, or tooling?
4. Did we make a compromise that future agents should know about?

If the answer to all four is no: state "Nothing worth capturing from this session."
Do not write a file.

If yes to any: write docs/scratchpad/[TODAY]-[2-3-word-slug].md using this format:

---
# Scratchpad Entry
Date: [TODAY]
Session: [Claude Code / Codex / Cursor / Manual / Firebase Studio / other]
Project area: [auth / payments / UI / deployment / database / CI / tooling / other]

## What happened
[One paragraph. What was being worked on, what failed or was surprising.
 No project names or IDs. Describe it as if you don't know which project this is.]

## What fixed it / what was learned
[One paragraph. The solution, the correct pattern, or the insight.]

## Maturity signal
[ ] rule    — confident this is universal, ready for Public Bible consideration
[ ] watch   — first time seeing this, need more evidence before promoting
[ ] resolved — one-off, no systemic lesson

## Future rule (complete only if 'rule' is checked)
[One sentence. Draft the rule as if writing it for AGENTS.md or a stack file.
 Write it generically — no project-specific context.]

## Affects (complete only if 'rule' is checked)
[Which Public Bible file would this update? e.g. stacks/supabase.md,
 AGENTS_TEMPLATE.md, retrofit-audit.js, SECURITY.md]
---

After writing: state the filename, the maturity signal you chose, and why.
```

---

## PROMPT 15 — /scratchpad:summary (End of Day)

**When:** End of day, or whenever you want to distil accumulated session entries.
Rewrites docs/scratchpad/DAILY.md clean — not appended.

```
You are distilling today's scratchpad entries into a clean daily summary.

Step 1 — Read all of today's raw entries:
  ls docs/scratchpad/
  cat docs/scratchpad/[TODAY]-*.md 2>/dev/null

Step 2 — Read the existing DAILY.md to pick up 'watch' entries from previous days:
  cat docs/scratchpad/DAILY.md 2>/dev/null

Step 3 — Analyse:
  - Identify duplicate findings (same issue in multiple sessions) → merge into one
  - Identify conflicts (two sessions found different solutions) → flag explicitly
  - Graduate 'watch' entries seen 2+ times to 'rule'
  - Confirm 'resolved' entries need no further action

Step 4 — Rewrite docs/scratchpad/DAILY.md completely using this format:

---
# Daily Summary — [TODAY]

## Rules (ready for Public Bible consideration)
[One section per finding that reached 'rule' status today or graduated from 'watch'.
 Write each as if you don't know which project this is. Fully anonymised.]

### [Short descriptive title]
**What:** [The universal rule in one sentence]
**Why:** [The incident that prompted it — described generically]
**Affects:** [Which Public Bible file]
**Confidence:** high / medium
**Seen:** [number of sessions/times today]

## Watching
[Entries where maturity is 'watch'. Preserved from previous DAILY.md
 plus any new 'watch' entries from today.]

### [Title]
**What:** [Description]
**First seen:** [date]
**Times seen:** [count]
**Promote to rule if:** [what would need to happen]

## Resolved today
- [brief one-line description of each resolved entry]

## Pending export to Public Bible
[Checkboxes for each 'rule' entry ready to promote]
- [ ] [title] → [target file]
- [ ] [title] → [target file]
---

Step 5 — Report:
"Summary complete. X rules, Y watching, Z resolved.
 [If any conflicts found]: ⚠ Conflict found: [describe]. Human decision needed.
 Run /scratchpad:export when ready to propose Public Bible updates."
```

---

## PROMPT 16 — /scratchpad:export (Prepare Public Bible Proposals)

**When:** When you want to consider promoting learnings to the Public Bible.
Run after /scratchpad:summary. Produces docs/scratchpad/EXPORT.md for your review.
Nothing goes to the Public Bible until you review and approve EXPORT.md.

```
You are preparing anonymised proposals for the Public Bible from this project's
scratchpad.

Step 1 — Read the distilled summary:
  cat docs/scratchpad/DAILY.md

Step 2 — Read the relevant Public Bible files for context:
  # For each entry in "Pending export", read the target file
  cat /tmp/handbook/[target-file] 2>/dev/null ||
  cat /tmp/handbook/stacks/[relevant-stack].md 2>/dev/null

Step 3 — For each pending export entry, determine:
  A. Is this already in the Public Bible (in different words)?
     → If yes: mark as 'already documented' — no proposal needed
  B. Is this universal enough to help developers who don't share my stack?
     → If no: mark as 'too specific' — stays in project docs only
  C. Is this Tier 1 (documentation addition) or Tier 2 (structural change)?
     Tier 1: adding a pattern, updating a version, adding a NEVER DO item
     Tier 2: changing a process, adding a new stack file, changing audit scripts

Step 4 — Write docs/scratchpad/EXPORT.md:

---
# Public Bible Export Proposals
Generated: [TODAY]
Source project: [REDACTED]
Review at: https://github.com/nicolapitersky/Bible
Handbook version: [current version from AGENTS.md]

[For each approved proposal:]

## Proposal [N]: [short title]

**Target file:** [exact filename in Public Bible]
**Change type:** Tier [1/2] — [description]
**Section:** [which section of that file]

**Why this belongs in the Public Bible:**
[One sentence — why is this universal, not project-specific?]

**Proposed text:**
[The exact text to add, in the style of the target file.
 No project names, no IDs, no private context.
 Written as if it was always part of the Public Bible.]

**If Tier 2 — decision needed:**
[What structural change is required. Why it cannot be a simple documentation addition.]

**Human review:**
- [ ] Already documented elsewhere? (if yes, reject)
- [ ] Universal enough to help others? (if no, reject)
- [ ] Text is clear and actionable?
- [ ] APPROVE for PR
- [ ] REJECT
- [ ] DEFER (revisit later)

---

[For entries not making the cut:]

## Not promoted

| Entry | Reason |
|-------|--------|
| [title] | Already in Public Bible — [where] |
| [title] | Too specific to this stack combination |
| [title] | Tier 2 — flagged separately |

---

Step 5 — Report:
"Export ready. X proposals. Y not promoted (see reasons).
 Review docs/scratchpad/EXPORT.md, tick APPROVE on proposals you accept,
 then run /bible:update."
```

---

## PROMPT 17 — /bible:update (Open PRs on Public Bible)

**When:** After you have reviewed EXPORT.md and ticked APPROVE on proposals.
Requires: Public Bible cloned to /tmp/handbook, GitHub CLI (`gh`) authenticated.
Opens PRs — never commits directly to main.

```
You are opening pull requests on the Public Bible for approved proposals.

Step 1 — Read the approved proposals:
  cat docs/scratchpad/EXPORT.md
  # Only process entries with [x] APPROVE checked

Step 2 — Confirm the Public Bible is available and up to date:
  ls /tmp/handbook/ 2>/dev/null || git clone https://github.com/nicolapitersky/Bible /tmp/handbook
  cd /tmp/handbook && git pull origin main

Step 3 — For each APPROVED Tier 1 proposal:
  A. Create a branch:
     git -C /tmp/handbook checkout -b scratchpad/[slug]-[TODAY]

  B. Make the specific change to the target file:
     [Apply the proposed text exactly as written in EXPORT.md]
     [Do not change anything else in the file]

  C. Verify the change:
     git -C /tmp/handbook diff

  D. Commit:
     git -C /tmp/handbook commit -m "docs([file]): [one-line description]
     
     Source: scratchpad learning, promoted via Two-Bible pipeline.
     Handbook version: [current]"

  E. Push and open PR:
     git -C /tmp/handbook push origin scratchpad/[slug]-[TODAY]
     gh pr create \
       --repo nicolapitersky/Bible \
       --title "docs: [short description]" \
       --body "[proposed text from EXPORT.md]\n\nSource: Daily scratchpad learning.\nTier 1 — documentation addition." \
       --base main

Step 4 — For each APPROVED Tier 2 proposal:
  Do NOT open a PR automatically.
  Instead, create a file: /tmp/handbook/docs/tier2-proposals/[TODAY]-[slug].md
  containing the full proposal for deliberate human review.
  State: "⚠ Tier 2 proposal saved for manual review: [filename]. This requires
  a structural decision — review separately before implementing."

Step 5 — Mark entries in EXPORT.md:
  For each processed entry, add "EXPORTED [TODAY]" below the APPROVE checkbox.

Step 6 — Report:
  "X PR(s) opened on nicolapitersky/Bible:
   [list each PR URL]
   
   Y Tier 2 proposal(s) saved to /tmp/handbook/docs/tier2-proposals/ for manual review.
   
   Review PRs at: https://github.com/nicolapitersky/Bible/pulls"
```
