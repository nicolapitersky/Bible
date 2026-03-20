# stacks/codex.md — OpenAI Codex Configuration

> OpenAI Codex (2025) is a cloud-based agentic coding system.
> It is fundamentally different from Claude Code — Codex runs tasks asynchronously
> in isolated cloud sandboxes. You queue work; it runs without you watching.
>
> Read: https://platform.openai.com/docs/codex
> Last reviewed: See git log.

---

## What Codex Is (and Is Not)

**Codex today** is not the Codex model of 2021. It is a complete agentic coding system:

- Runs in an isolated cloud sandbox (not on your machine)
- Executes terminal commands, edits files, runs tests, opens PRs
- Reads `AGENTS.md` in the project root — the same file Claude Code reads
- Operates **asynchronously** — you submit a task and come back to results
- Can run **multiple tasks in parallel** on the same or different repositories
- Internet access is **off by default** — the sandbox cannot fetch external URLs
- GitHub integration is native — it can read issues, clone repos, push branches

**The critical difference from Claude Code:** Claude Code is a synchronous collaborator
(you watch it work, you intervene). Codex is an asynchronous worker (you assign tasks,
it completes them, you review the PR). This changes how you write instructions,
structure tasks, and review output.

---

## How Codex Reads the Handbook

Codex reads `AGENTS.md` in the project root before executing any task.
It follows the same convention as Claude Code — our `AGENTS.md` is the instruction file.

**Key difference from Claude Code:** Codex reads `AGENTS.md` once at task start and
cannot ask follow-up questions during execution. Every instruction in `AGENTS.md` must
be self-contained and unambiguous. There is no back-and-forth.

**File priority:**
1. `AGENTS.md` in the project root — highest priority, always present
2. `AGENTS.md` in subdirectories — for monorepo per-package instructions
3. OpenAI's system-level instructions — lowest priority

There is no global `~/.codex/` equivalent. All instructions are in the project's `AGENTS.md`.

---

## Writing `AGENTS.md` for Codex

Codex tasks are async — the agent cannot ask for clarification mid-task.
This means `AGENTS.md` must be more explicit than it needs to be for Claude Code.

### Additions to include in `AGENTS.md` when Codex is in use

Add a **Codex-specific section** to the project `AGENTS.md`:

```markdown
## CODEX-SPECIFIC RULES

### Sandbox behaviour
Codex runs in an isolated cloud environment.
- Internet access is OFF — do not attempt to fetch external URLs, install from CDN,
  or call external APIs during task execution
- All dependencies must be in package.json — Codex runs pnpm install automatically
- Environment variables are NOT available in the sandbox unless explicitly configured
  in the Codex environment settings (openai.com → Codex → Environments)
- The sandbox resets between tasks — no state persists between separate Codex tasks

### Task completion criteria
A Codex task is complete when:
1. All specified changes are made
2. pnpm type-check passes (zero errors)
3. pnpm lint passes (zero warnings)
4. pnpm test:unit passes (all tests green)
5. A clear commit message is written in format: type(scope): description
6. A PR description is written explaining: what changed, why, how to test it

### What Codex must NOT do
- Never modify .env.manifest or any environment ID
- Never run database migrations (push to staging or production)
- Never deploy — create a PR for human review, never deploy directly
- Never run pnpm build:production or any production build command
- Never commit to main — always commit to a feature/* or fix/* branch
- Never make changes outside the scope of the assigned task

### When Codex is uncertain
Write a comment in the code: // CODEX: uncertain about [X] — needs human review
Add a note in the PR description under a "Questions for reviewer" section.
Do not guess. Do not proceed with an assumption that could be wrong.
```

---

## Environment Setup

Codex tasks run in isolated sandboxes. You configure the sandbox environment once
per project in the OpenAI platform.

### Setting up the Codex environment

1. Go to `platform.openai.com` → **Codex** → **Environments**
2. Create a new environment for this project
3. Set the setup script (runs once when sandbox initialises):

```bash
# Codex setup script (runs on sandbox init — not in git)
# Add this in: OpenAI Platform → Codex → Environments → Setup script

# Install dependencies
pnpm install --frozen-lockfile

# Verify environment manifest (local mode — no cloud ops)
node scripts/verify-env.js local || echo "Warning: manifest check failed"

# Confirm the agent has what it needs
echo "Setup complete. Node: $(node --version), pnpm: $(pnpm --version)"
```

4. Set environment variables (non-secret values only — for local/test context):

```
NODE_ENV=test
NEXT_PUBLIC_ENV=test
NEXT_PUBLIC_FIREBASE_PROJECT_ID=acme-app-staging
# Secrets are NOT set here — Codex cannot and should not access production secrets
```

**Rule:** Never give Codex access to production secrets. The sandbox is for development
and testing. If a task requires production credentials, it is the wrong task for Codex.

---

## Task Design

The quality of Codex output depends almost entirely on task quality.
Vague tasks produce vague results. These patterns work.

### Task anatomy

Every Codex task should have:

1. **Context** — what the current state is and why this change is needed
2. **Scope** — exactly what files/modules are in scope (and what is out of scope)
3. **Acceptance criteria** — explicit, testable conditions for "done"
4. **Constraints** — what not to change, what patterns to follow

### Good task template

```
Context:
The checkout flow currently has no loading state on the "Pay now" button.
Users click it multiple times, causing duplicate Stripe checkout sessions.
See: src/app/(app)/billing/checkout/page.tsx

Task:
Add a loading state to the "Pay now" button that:
1. Shows a spinner and "Processing..." text while the Stripe session is being created
2. Disables the button during loading (prevents double-click)
3. Re-enables the button if the request fails (shows the error message)

Scope:
- src/app/(app)/billing/checkout/page.tsx (the checkout page component)
- src/components/ui/Button.astro or Button.tsx (if a loading prop is needed)
- Tests: src/app/(app)/billing/checkout/page.test.tsx (add/update)

Do NOT change:
- The Stripe API call logic
- The error handling logic (other than re-enabling the button on error)
- Any other components

Acceptance criteria:
1. Button shows spinner + "Processing..." text while loading
2. Button is disabled while loading
3. Button returns to normal state on error
4. pnpm type-check, pnpm lint, pnpm test:unit all pass
5. No hardcoded colours — use design tokens
```

### Anti-patterns

```
# Too vague — Codex will make assumptions you won't like
"Fix the checkout button"

# Too broad — Codex will touch things it shouldn't
"Improve the billing page"

# No acceptance criteria — Codex can't know when it's done
"Add loading states to forms"

# Multiple unrelated concerns — split into separate tasks
"Fix the button AND refactor the API client AND update the tests"
```

---

## Async Workflow: Using Codex Alongside Claude Code

Codex and Claude Code serve different roles on the same project.

| Use Claude Code for | Use Codex for |
|---------------------|---------------|
| Complex features requiring back-and-forth | Well-defined, bounded tasks |
| Exploratory work ("how should we structure this?") | Implementation of agreed designs |
| Debugging with interactive investigation | Writing tests for existing code |
| Architecture decisions | Documentation updates |
| Anything touching environment IDs or deployment | CSS / design token fixes |
| Real-time pair programming | Batch work (5 tasks in parallel) |

### Parallel task batching

Codex's biggest advantage over Claude Code: running multiple independent tasks
simultaneously. Organise work into parallel batches:

```
# Batch 1: independent tasks that can run simultaneously
Task A: Add loading state to checkout button (src/app/(app)/billing/)
Task B: Fix mobile nav overflow on 320px screens (src/components/layout/Nav.astro)
Task C: Write unit tests for order repository (src/repositories/order.test.ts)
Task D: Update llms.txt with Q2 product changes (public/llms.txt)

# Submit all four at once — Codex runs them in parallel
# Review all four PRs when they are ready
```

**Rule:** Tasks in the same batch must not touch the same files. Codex has no
cross-task awareness — concurrent edits to the same file will conflict.

### Handoff between Codex and Claude Code

When handing a task from Codex to Claude Code (or vice versa), use the standard
handoff format from `MULTI_AGENT.md`. Add a `source` field:

```markdown
## [DATE] — Codex — [task description]

Source: Codex (async task)
PR: #[number]
Status: Ready for review

### What was done
[description]

### Files changed
[list]

### Questions for reviewer
[anything Codex marked with // CODEX: uncertain]

### Claude Code follow-up needed
[tasks that emerged that require interactive investigation]
```

---

## Code Review for Codex PRs

Codex PRs require more careful review than human PRs because:
- Codex cannot ask questions during execution — it makes assumptions
- Codex may have changed more than requested (check `git diff` carefully)
- Codex cannot verify visual output — check UI changes in a browser
- Codex cannot feel the UX — always test interactions manually

### PR review checklist (add to `.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## Codex PR checklist
If this PR was opened by Codex, verify:
- [ ] Changes are limited to the stated scope (check git diff for surprises)
- [ ] No hardcoded values introduced (colours, spacing, env IDs)
- [ ] TypeScript strict — zero `any` types introduced
- [ ] No `// CODEX: uncertain` comments left unaddressed
- [ ] UI changes tested in browser at mobile (375px) and desktop (1280px)
- [ ] No changes to .env.manifest, deployment config, or database migrations
```

---

## `AGENTS.md` Sections Codex Uses Most

Codex parses `AGENTS.md` as a whole, but these sections have the most impact
on task output quality. Keep them precise.

**Section 5 (NEVER DO LIST):** Codex respects prohibitions explicitly.
Write them as negative imperatives: "Never hardcode…", "Never modify…"

**Section 6 (ALWAYS DO LIST):** Codex follows these as checklists.
Write them as verifiable steps, not principles.

**Section 4 (DESIGN SYSTEM):** Codex will use tokens if told exactly how.
Include the token reference syntax your project uses:
```markdown
In CSS: var(--color-brand-accent)
In Tailwind: bg-brand-accent, text-text-primary
In TypeScript: tokens.color.brand.accent (from design-tokens/tokens.ts)
```

**Section 3 (STACK & TOOLING):** Codex needs to know the test runner,
linter, and build commands explicitly. It uses these to validate its own work.
```markdown
Validate work:   pnpm type-check && pnpm lint && pnpm test:unit
Run one test:    pnpm test:unit src/path/to/file.test.ts
Build:           pnpm build (do NOT run in production mode)
```

---

## Integrating Codex into the Bootstrap

When Codex is selected as an IDE during bootstrap, Phase 5 generates
an additional `.codex/` directory:

```
.codex/
└── setup.sh     ← Paste this into OpenAI Platform → Codex → Environments → Setup script
```

### `.codex/setup.sh`

```bash
#!/usr/bin/env bash
# Codex sandbox setup script
# Copy the contents of this file into:
# OpenAI Platform → Codex → Environments → [Project Name] → Setup script

set -e

echo "Setting up {{PROJECT_NAME}} Codex environment..."

# Install dependencies
pnpm install --frozen-lockfile

# Verify the handbook manifest (test mode)
if [ -f "scripts/verify-env.js" ]; then
  node scripts/verify-env.js local 2>/dev/null || echo "⚠ Manifest check: review .env.manifest"
fi

# Generate design tokens (ensures tokens.css and tokens.ts are current)
if [ -f "scripts/generate-tokens.js" ]; then
  node scripts/generate-tokens.js
fi

echo "✓ {{PROJECT_NAME}} ready for Codex tasks"
echo "  Node:  $(node --version)"
echo "  pnpm:  $(pnpm --version)"
echo "  Stack: {{PRIMARY_FRAMEWORK}}"
```

---

## Updating `generate-ide-rules.js` for Codex

The `generate-ide-rules.js` script does not yet generate Codex-specific output.
Until it is updated, Codex uses `AGENTS.md` directly — which is correct and sufficient.

When `generate-ide-rules.js` is extended for Codex, it will generate:
- `.codex/AGENTS.md` — a symlink or copy of the root `AGENTS.md`
  (Codex reads the root `AGENTS.md` directly; no additional file needed)

**Conclusion:** No IDE-specific rule file is needed for Codex.
`AGENTS.md` is the native Codex instruction file. Keep it well-written.

---

## Codex vs Claude Code: Decision Guide

```
Is the task fully specified with clear acceptance criteria?
  NO  → Use Claude Code (needs interactive discussion first)
  YES → Continue

Does the task require touching environment IDs, deployment, or database migrations?
  YES → Use Claude Code (needs human-in-the-loop oversight)
  NO  → Continue

Does the task require visual judgment or UX feel?
  YES → Use Claude Code (needs interactive iteration)
  NO  → Continue

Are there 3+ independent tasks that could run simultaneously?
  YES → Use Codex (parallel execution is Codex's main advantage)
  NO  → Either works — use whichever is currently available

Is this exploratory work ("what's the best approach here?")?
  YES → Use Claude Code
  NO  → Use Codex
```

---

## Security Considerations

### What Codex can access

Codex clones your repository from GitHub. It can read:
- All committed code (including history)
- All files in the repo, including any accidentally committed secrets

**Ensure your `.gitignore` and secret scanning are airtight before using Codex.**
Run `gitleaks detect --source=. --report-format=sarif` before first use.

### What Codex cannot access (by default)

- External APIs (internet is off in the sandbox)
- Production environment variables
- Your local filesystem
- Other projects or repositories

### Network access exceptions (if needed)

If a task requires fetching from a specific trusted domain (e.g. your private npm registry),
whitelist it in the sandbox settings:

```
OpenAI Platform → Codex → Environments → [Project] → Network access
Allow: registry.npmjs.org
Allow: your-private-registry.company.com
Block: everything else (default)
```

**Never whitelist production API endpoints.** If Codex needs to call an API,
mock it in the test suite.

---

## Troubleshooting

### "Codex made changes outside the stated scope"

The task description was too vague. Rewrite it with an explicit scope section listing
the exact files that should and should not be touched. Re-run as a new task.

### "Codex introduced TypeScript errors"

Usually means Codex hallucinated an API or function signature. The type errors
will point you to exactly where. Claude Code is better for tasks requiring
deep knowledge of unfamiliar APIs.

### "Codex ignored a rule from AGENTS.md"

Rules must be stated as concrete imperatives, not principles.
- Weak: "Follow the design system"
- Strong: "Never use a hex colour — use `var(--token-name)` CSS custom properties only"

Also check: is the rule in the NEVER DO LIST (Section 5)? Rules buried in prose
sections are less reliably followed.

### "Codex created a PR to main instead of a feature branch"

Add to `AGENTS.md` Section 5 (NEVER DO LIST):
```markdown
- Never commit directly to `main` or `staging`. Always create a branch:
  feature/[slug] for features, fix/[slug] for fixes, chore/[slug] for maintenance.
```

### "Codex dependency installation failed"

The sandbox has no internet access. If `pnpm install` fails, check:
1. All dependencies are in `package.json` (not just in code as bare imports)
2. No package requires a post-install script that fetches from the internet
3. Private packages are accessible via the network allowlist
