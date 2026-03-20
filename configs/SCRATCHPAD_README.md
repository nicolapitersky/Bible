# docs/scratchpad/ — Daily Learning Capture

> This directory captures operational learnings from development sessions.
> It is the first layer of the Two-Bible knowledge pipeline.
> Everything here is private to this project. Nothing leaves this repo
> without going through the export and human review process.

---

## How This Works

### During the day

Each time you close a session (Claude Code, Codex, Cursor, Firebase Studio,
or any manual work in Vercel/Supabase/Firebase dashboards), you can capture
what was learned with `/scratchpad:learn`.

**This is manual only.** The AI will sometimes suggest it when you use closing
signals like "wrap up", "what's next", "did we forget anything", "safely deploy".
It will never write to the scratchpad without your prompt.

Each session produces one file: `YYYY-MM-DD-[context].md`

### End of day

Run `/scratchpad:summary` to distil all of today's raw entries into `DAILY.md`.
This rewrites DAILY.md clean — it does not append. Yesterday's entries are
preserved as individual files.

### When ready to update the Public Bible

Run `/scratchpad:export` to produce `EXPORT.md` — a reviewed, anonymised set
of proposals ready for the Public Bible. You review this file, tick the proposals
you approve, then run `/bible:update` to open PRs.

---

## Files in This Directory

| File | Purpose | Updated by |
|------|---------|-----------|
| `DAILY.md` | Distilled summary of recent learnings. Agents read this. | `/scratchpad:summary` |
| `EXPORT.md` | Anonymised proposals for Public Bible. Human reviews. | `/scratchpad:export` |
| `YYYY-MM-DD-[context].md` | Raw session entries. Audit trail only. | `/scratchpad:learn` |

---

## The Maturity Signal

Every raw entry has a maturity signal:

**`rule`** — confident this is universal. Ready for Public Bible consideration.
Set this when: the fix is clearly applicable beyond this project, the Public Bible
has a gap this fills, or a security/safety issue was discovered.

**`watch`** — might be a pattern. Need to see it again before promoting.
Set this when: first time seeing this failure, not sure if it's universal,
or the project's unusual setup might be the cause.

**`resolved`** — one-off. No systemic lesson. Close it.
Set this when: operator error, already documented, or the fix was project-specific
and won't help anyone else.

`watch` entries graduate to `rule` when seen a second time in any session,
or when `/scratchpad:summary` finds the same pattern across multiple sessions.

---

## What Gets Anonymised Before Export

When `/scratchpad:export` produces EXPORT.md, it strips:
- This project's name
- Environment IDs (Firebase project IDs, Supabase refs, Vercel project IDs)
- Client or product names
- Specific file paths that reveal project structure
- Any detail that identifies the project owner

What remains: the universal rule, the generic description of what failed,
and the specific Bible file that should be updated.

---

## Relationship to Claude Code's MEMORY.md

Claude Code automatically maintains `~/.claude/MEMORY.md` (machine-local) and
may write to a project-level `MEMORY.md` when it learns something during a session.

**These are complementary, not competing:**

| | MEMORY.md | docs/scratchpad/DAILY.md |
|---|---|---|
| Written by | Claude Code automatically | Human via /scratchpad:learn |
| Scope | Claude Code on this machine | All agents, all environments |
| In git | No — machine-local | Yes — private to this repo |
| Purpose | Claude remembers for itself | Cross-agent promotion pipeline |
| Feeds | Future Claude sessions | Public Bible via export |

**When running `/scratchpad:learn` in a Claude Code session:**
Read `MEMORY.md` first. If it already captured the key learning and that
learning is purely local or project-specific, MEMORY.md alone is sufficient.
Write a scratchpad entry when: the learning could be promoted to the Public Bible,
or when the learning came from a non-Claude agent or manual work.

---

## Commands Reference

```
/scratchpad:learn     End of session. Produces one raw entry file.
/scratchpad:summary   End of day. Rewrites DAILY.md from all today's entries.
/scratchpad:export    When ready. Produces anonymised EXPORT.md for Public Bible.
/bible:update         After reviewing EXPORT.md. Opens PRs on nicolapitersky/Bible.
```

See `prompts/PROMPT_LIBRARY.md` in the Public Bible for the full prompts.

---

## Agents: Read This

If `DAILY.md` exists in this directory and was modified today or yesterday,
read it before starting any task. It contains recent learnings that may
directly affect your work.

Pay particular attention to entries marked `rule` — these are confirmed
patterns that apply to this project and stack.
