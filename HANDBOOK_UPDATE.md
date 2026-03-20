# HANDBOOK_UPDATE.md — Keeping the Handbook Current

> The handbook must evolve with the industry. This document covers both
> the automated update system and the manual monthly review prompt.

---

## Automated Updates (Primary Method)

The `.github/workflows/handbook-update.yml` workflow runs on the first of every
month and on every push to `main`. It calls `scripts/handbook-update-agent.js`
which directly fetches authoritative sources — no web search guessing.

### What `handbook-update-agent.js` checks

| Source | What it detects |
|--------|----------------|
| npmjs.org `@modelcontextprotocol` org | New MCP server packages |
| glama.ai MCP directory | New community MCP servers |
| npmjs.org (15 key packages) | New major versions requiring handbook update |
| pub.dev (4 Flutter packages) | New major versions |
| Claude Code, Cursor, Stripe, Supabase, Vercel changelogs | Recent breaking changes |
| GitHub Advisory Database | High/critical CVEs in our stack |
| llmstxt.org | llms.txt specification changes |

### Output

```
docs/handbook-updates/
  YYYY-MM.md    ← human-readable report
  YYYY-MM.json  ← machine-readable (for CI processing)
```

**Exit codes:**
- `0` — handbook is current, no action needed
- `1` — CRITICAL findings (security CVEs, breaking changes) → GitHub issue opened
- `2` — updates found (new tools, version bumps) → report in `docs/handbook-updates/`

### Running manually

```bash
# From the handbook repo root
node scripts/handbook-update-agent.js

# From any project (handbook cloned to /tmp/handbook)
node /tmp/handbook/scripts/handbook-update-agent.js
```

---

## Manual Monthly Review (Supplement to Automated)

Run this on the first Monday of every month, after the automated agent runs.
It covers things the agent cannot detect automatically — quality of documentation,
new patterns from community practice, agent behaviour changes.

Paste into Claude Code or any agent with web search capability:

```
You are reviewing the Complete Development Handbook for the month of {{MONTH}}.
The handbook is at: /tmp/handbook (or current directory if running from the repo).

The automated agent has already run. Read its report first:
  cat docs/handbook-updates/{{YYYY-MM}}.md

Now perform the MANUAL review — things the agent cannot detect automatically.

════════════════════════════════════════════════════════════
PART 1: FETCH SPECIFIC SOURCES (not search — fetch directly)
════════════════════════════════════════════════════════════

For each source, fetch the URL and look for changes relevant to our handbook.
Be specific: quote the exact changed text and the exact file to update.

1. CLAUDE CODE
   Fetch: https://docs.anthropic.com/claude-code/changelog
   Look for: AGENTS.md behaviour changes, new MCP types, new slash command features,
             changes to .claude/settings.json schema, new permission model entries
   Update: stacks/claude-code.md

2. CURSOR CHANGELOG
   Fetch: https://changelog.cursor.com
   Look for: .cursorrules format changes, new context features, MCP support changes
   Update: stacks/claude-code.md (IDE section), MULTI_AGENT.md

3. OPENAI CODEX / PLATFORM
   Fetch: https://platform.openai.com/docs/changelog
   Look for: AGENTS.md support changes, sandbox behaviour changes, new capabilities
   Update: stacks/codex.md

4. NEXT.JS RELEASES
   Fetch: https://nextjs.org/blog
   Look for: App Router changes, new recommended patterns, deprecated APIs
   Fetch: https://registry.npmjs.org/next/latest (confirm current version)
   Update: stacks/nextjs.md

5. SUPABASE CHANGELOG
   Fetch: https://supabase.com/changelog
   Look for: RLS changes, new auth patterns, Storage changes, Edge Function updates,
             Vercel integration updates, new CLI commands
   Update: stacks/supabase.md

6. VERCEL CHANGELOG
   Fetch: https://vercel.com/changelog
   Look for: Fluid compute changes, new Firewall features, env var handling changes,
             new framework integrations, Supabase integration changes
   Update: stacks/vercel.md

7. FIREBASE RELEASE NOTES
   Fetch: https://firebase.google.com/support/release-notes/js
   Look for: Breaking changes in firebase v10+, new Security Rules features,
             App Check changes, new emulator features
   Update: stacks/firebase.md

8. STRIPE CHANGELOG
   Fetch: https://stripe.com/docs/changelog
   Look for: API version changes, webhook payload changes, new payment methods,
             Stripe Radar changes
   Update: stacks/stripe.md

9. MCP REGISTRY (manual review of top new servers)
   Fetch: https://modelcontextprotocol.io/servers
   Fetch: https://glama.ai/mcp/servers?sort=newest
   Look for: new servers relevant to Firebase, Supabase, Vercel, Stripe, GitHub
   Update: TOOLING.md (MCP section), stacks/claude-code.md (.claude/settings.json examples)

10. FLUTTER RELEASES
    Fetch: https://docs.flutter.dev/release/release-notes
    Look for: new stable release, breaking changes in pubspec.yaml, new APIs
    Update: stacks/flutter.md

════════════════════════════════════════════════════════════
PART 2: QUALITATIVE REVIEW (judgement required)
════════════════════════════════════════════════════════════

11. AGENT BEHAVIOUR PATTERNS
    Have you noticed Claude Code, Codex, or Cursor doing something consistently
    wrong that a handbook rule would prevent? (e.g. hallucinating a package name,
    using a deprecated pattern, ignoring a security concern)
    If yes: add to AGENTS_TEMPLATE.md NEVER DO section
    Also: update the relevant stack's .claude/settings.json denylist

12. MCP COVERAGE GAPS
    Look at the Supabase, Firebase, and Vercel MCPs in TOOLING.md.
    Are there operations agents currently do via CLI that an MCP could handle?
    (e.g. running Supabase migrations, Firebase deployments, Vercel env management)
    If yes: research the MCP, test it, propose adding to TOOLING.md

13. SECURITY POSTURE
    Fetch: https://github.com/advisories?query=ecosystem%3Anpm+severity%3Ahigh
    Look for advisories in: next, firebase, @supabase/supabase-js, stripe, astro
    Fetch: https://ossindex.sonatype.org/search (alternative advisory source)
    If found: update SECURITY.md, add to project TECH_DEBT.md entries

14. SEO / AEO LANDSCAPE
    Search: "AI search engine optimisation {{YYYY}}"
    Search: "llms.txt examples {{YYYY}}"
    Fetch: https://llmstxt.org
    Look for: new llms.txt fields, new AI crawlers, new structured data types
    Update: SEO_AEO.md

════════════════════════════════════════════════════════════
PART 2B: QUARTERLY REVIEW (run every 3 months, not monthly)
════════════════════════════════════════════════════════════

These checks require more judgment than the monthly review and change more slowly.
Run on the first Monday of January, April, July, October.

15. AGENTS.MD STANDARD COMPLIANCE
    The AGENTS.md standard is stewarded by the Linux Foundation's Agentic AI Foundation.
    Our AGENTS_TEMPLATE.md must remain compliant as the standard evolves.

    Fetch: https://agentai.foundation/agents-md (spec homepage)
    Fetch: https://github.com/agentai-foundation/agents-md (spec repository)
    Fetch: https://platform.openai.com/docs/codex/agents-md (Codex's AGENTS.md documentation)

    Compare against AGENTS_TEMPLATE.md section by section:
    - Are there new required or recommended sections in the standard?
    - Have any section names or precedence rules changed?
    - Do any of our handbook-specific extensions conflict with the evolving standard?
    - Are there new tools beyond Codex/Cursor/Claude Code that support the standard?

    Update: AGENTS_TEMPLATE.md (compliance), TWO_BIBLE_MODEL.md (supported tools list)
    Tier: Tier 1 if adding sections, Tier 2 if restructuring

16. PACKMIND — RULE DISTRIBUTION PATTERNS
    Packmind is a complementary SaaS for centralising and distributing AI coding rules.
    Its structural thinking about rule distribution is worth tracking.

    Fetch: https://www.packmind.com/docs (documentation)
    Fetch: https://github.com/PackmindHub (public repos)

    Look for — structural patterns only, not their specific rules:
    - New categories of rules that our generate-ide-rules.js doesn't handle
    - Distribution patterns for getting rules into new or emerging IDEs
    - Any public recipe taxonomies worth adopting in our TOOLING.md structure
    - New IDE integrations that Packmind supports before we do

    Update: scripts/generate-ide-rules.js (new IDE support), TOOLING.md (distribution patterns)
    Do NOT copy their specific rules — only structural/distribution insights

17. ZEBBERN/CLAUDE-CODE-GUIDE — CROSS-AGENT INCORPORATION
    This is the strongest public Claude Code handbook. Check quarterly for new content.

    Fetch: https://github.com/zebbern/claude-code-guide (README and recent commits)
    Fetch: https://github.com/zebbern/claude-code-guide/commits/main (recent changes)

    For each new or substantially updated section, apply the cross-agent filter:
    Q1: Is this principle universal (applies to Codex/Cursor/Windsurf too)?
        → If yes: propose for stacks/claude-code.md AND MULTI_AGENT.md
    Q2: Is this Claude Code-specific but important enough for our claude-code.md?
        → If yes: propose for stacks/claude-code.md only
    Q3: Is this a prompt pattern that improves all agent interactions?
        → If yes: propose for stacks/ai-providers.md prompt engineering section
    Q4: Is this a workflow pattern for long/complex tasks?
        → If yes: propose for MULTI_AGENT.md

    Update: stacks/claude-code.md, MULTI_AGENT.md, stacks/ai-providers.md
    Do NOT copy Claude-specific commands verbatim — generalise them first

18. ANTHROPIC OFFICIAL MEMORY AND CLAUDE.MD DOCUMENTATION
    Anthropic evolves their memory system and CLAUDE.md conventions actively.

    Fetch: https://docs.anthropic.com/claude-code/memory (memory documentation)
    Fetch: https://docs.anthropic.com/claude-code/tutorials (new tutorials)
    Fetch: https://docs.anthropic.com/claude-code/agent-hooks (new hooks/triggers)

    Look for:
    - Changes to MEMORY.md auto-write behaviour (what Claude writes, when, format)
    - New CLAUDE.md layer conventions (new org/project/user level features)
    - New agent hooks that could automate scratchpad capture
    - Changes to how Claude Code reads and prioritises instruction files
    - Any official support for the Two-Bible model pattern (project + global layers)

    Update: stacks/claude-code.md (hierarchy section, MEMORY.md section)
    Update: configs/SCRATCHPAD_README.md (if memory behaviour changes affect scratchpad)
    Update: TWO_BIBLE_MODEL.md (if new layer conventions affect our architecture)

19. AGENTS.MD IN THE WILD — COMMUNITY PATTERN REVIEW
    Periodically review high-quality public AGENTS.md files for emerging patterns.

    Search GitHub: "filename:AGENTS.md stars:>50 pushed:>2025-01-01"
    Filter to: repos with significant activity, professional codebases (not tutorials)

    For each reviewed file, extract only STRUCTURAL patterns:
    - New sections that appear in multiple high-quality AGENTS.md files
    - New safety rules or NEVER DO patterns not in our template
    - New tool-specific sections for IDEs we support
    Ignore: project-specific rules, company-specific conventions, one-off patterns

    Limit to: maximum 10 repos reviewed per quarter
    Update: AGENTS_TEMPLATE.md (new sections/patterns only)

════════════════════════════════════════════════════════════
PART 3: OUTPUT FORMAT (be precise — no vague suggestions)
════════════════════════════════════════════════════════════

For EACH finding, produce:

---
## Proposed Update: {{handbook_file}}

**Source:** {{exact_url_fetched}}
**What changed:** [specific, factual — quote the changelog if possible]

**Current handbook text (exact quote):**
```
[the text that needs changing]
```

**Proposed replacement:**
```
[the exact new text]
```

**Urgency:** Critical | High | Medium | Low
**Why:** [one sentence — why does this matter for our projects?]
---

If no changes needed for a source: "{{source_name}}: no updates needed — current."

End with:
"Summary: X sources checked. Y proposed updates (Z critical/high, W medium/low).
 Next automated check: {{first_of_next_month}}."
```

---

## Sources Reference Card

Bookmark these. Check them directly — never search when you can fetch the authoritative source.

### AI Providers
| Provider | Resource | URL |
|----------|---------|-----|
| Anthropic | API release notes | https://docs.anthropic.com/en/release-notes/api |
| Anthropic | Claude apps release notes | https://docs.anthropic.com/en/release-notes/claude-apps |
| Anthropic | Models list | https://docs.anthropic.com/en/docs/about-claude/models |
| Anthropic | Prompt library | https://docs.anthropic.com/en/prompt-library |
| Anthropic | @anthropic-ai/sdk | https://registry.npmjs.org/@anthropic-ai/sdk/latest |
| OpenAI | API changelog | https://platform.openai.com/docs/changelog |
| OpenAI | Models list | https://platform.openai.com/docs/models |
| OpenAI | openai npm | https://registry.npmjs.org/openai/latest |
| Google | Gemini API changelog | https://ai.google.dev/gemini-api/docs/changelog |
| Google | Gemini models | https://ai.google.dev/gemini-api/docs/models |
| Google | @google/generative-ai | https://registry.npmjs.org/@google/generative-ai/latest |
| Google | @google-cloud/vertexai | https://registry.npmjs.org/@google-cloud/vertexai/latest |
| Vercel | AI SDK docs | https://sdk.vercel.ai/docs |
| Vercel | AI SDK npm | https://registry.npmjs.org/ai/latest |

### AI IDEs
| IDE | Changelog URL |
|-----|--------------|
| Claude Code | https://docs.anthropic.com/claude-code/changelog |
| Cursor | https://changelog.cursor.com |
| Windsurf | https://docs.codeium.com/windsurf/changelog |
| OpenAI Codex | https://platform.openai.com/docs/changelog |

### Google Cloud
| Service | URL |
|---------|-----|
| Cloud Run release notes | https://cloud.google.com/run/docs/release-notes |
| Vertex AI release notes | https://cloud.google.com/vertex-ai/docs/release-notes |
| Secret Manager release notes | https://cloud.google.com/secret-manager/docs/release-notes |
| Firebase JS release notes | https://firebase.google.com/support/release-notes/js |
| GCP Node.js libraries | https://cloud.google.com/nodejs/docs/reference |

### Frameworks
| Framework | URL |
|-----------|-----|
| Next.js | https://nextjs.org/blog |
| Astro | https://astro.build/blog |
| Flutter | https://docs.flutter.dev/release/release-notes |
| Vite | https://vitejs.dev/blog |

### Services
| Service | URL |
|---------|-----|
| Supabase | https://supabase.com/changelog |
| Vercel | https://vercel.com/changelog |
| Netlify | https://www.netlify.com/changelog |
| Stripe | https://stripe.com/docs/changelog |

### MCPs
| Source | URL |
|--------|-----|
| Official registry | https://modelcontextprotocol.io/servers |
| MCP specification | https://spec.modelcontextprotocol.io |
| Community (Glama) | https://glama.ai/mcp/servers |
| Community (mcp.run) | https://mcp.run/registry |
| Official npm org | https://www.npmjs.com/org/modelcontextprotocol |

### Security
| Source | URL |
|--------|-----|
| GitHub Advisories | https://github.com/advisories |
| OSV (Google) | https://osv.dev/list?ecosystem=npm |
| OWASP Top 10 | https://owasp.org/www-project-top-ten |

### Standards
| Standard | URL |
|----------|-----|
| llms.txt | https://llmstxt.org |
| Schema.org | https://schema.org/docs/releases.html |

### Quarterly Sources (Jan / Apr / Jul / Oct)
| Resource | URL | What to check |
|----------|-----|--------------|
| AGENTS.md standard | https://agentai.foundation/agents-md | Spec changes, new sections, new supported tools |
| AGENTS.md (OpenAI docs) | https://platform.openai.com/docs/codex/agents-md | Codex-specific scope and precedence rules |
| Packmind docs | https://www.packmind.com/docs | Rule distribution patterns, new IDE integrations |
| Packmind GitHub | https://github.com/PackmindHub | Public recipe taxonomies |
| zebbern/claude-code-guide | https://github.com/zebbern/claude-code-guide | New sections — apply cross-agent filter before incorporating |
| Anthropic memory docs | https://docs.anthropic.com/claude-code/memory | MEMORY.md behaviour changes |
| Anthropic agent hooks | https://docs.anthropic.com/claude-code/agent-hooks | New automation triggers |
| GitHub AGENTS.md search | https://github.com/search?q=filename%3AAGENTS.md+stars%3A%3E50 | Community structural patterns |

---

## Change Log Protocol

Every accepted update gets a CONTRIBUTING.md changelog entry:

```markdown
### v1.X.0 — YYYY-MM-DD

**Source of change:** [changelog URL or advisory link]

**TOOLING.md**
- Added: [new MCP server] — [what it does]
- Updated: [package] version reference v[old] → v[new]

**stacks/supabase.md**
- Updated: [pattern] — [why it changed]

**SECURITY.md**
- Added: [CVE or advisory] — affects [package], mitigation: [action]
```

---

## Automated Agent Setup

The automated agent requires no API keys for most checks (uses public APIs).
For better GitHub Advisory rate limits, add a `GITHUB_TOKEN` to the repo secrets.

```yaml
# Already configured in .github/workflows/handbook-update.yml
# The workflow runs automatically on the 1st of each month
# You can also trigger it manually from GitHub Actions tab
```

The agent writes to `docs/handbook-updates/YYYY-MM.md`. These files are committed
automatically. Critical findings open a GitHub issue. You review and merge.
