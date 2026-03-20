#!/usr/bin/env node
/**
 * generate-ide-rules.js
 * Generates .cursorrules, .windsurfrules, and .aidigest from AGENTS.md
 *
 * Usage:
 *   node scripts/generate-ide-rules.js
 *   node scripts/generate-ide-rules.js --ide=cursor --out=.
 *
 * Run after bootstrap, or whenever AGENTS.md changes.
 * Commit the generated files — IDEs read them at session start.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Parse args ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.replace('--', '').split('=');
      return [k, v ?? true];
    })
);

const ideTarget = args.ide ?? 'all';
const handbookDir = args.handbook ?? '/tmp/handbook';
const outDir = args.out ?? '.';

// ── Read source files ─────────────────────────────────────────────────────────
const agentsPath = path.join(outDir, 'AGENTS.md');
const handbookPrinciplesPath = path.join(handbookDir, 'PRINCIPLES.md');

if (!fs.existsSync(agentsPath)) {
  console.error('✗ AGENTS.md not found in', outDir);
  console.error('  Run the bootstrap first to generate AGENTS.md');
  process.exit(1);
}

const agentsMd = fs.readFileSync(agentsPath, 'utf8');

// ── Extract sections from AGENTS.md ───────────────────────────────────────────
function extractSection(md, heading) {
  const regex = new RegExp(`## ${heading}[\\s\\S]*?(?=\\n## |$)`, 'g');
  const match = md.match(regex);
  return match ? match[0] : '';
}

function extractListItems(section, marker) {
  const lines = section.split('\n');
  return lines
    .filter(l => l.includes(marker))
    .map(l => l.replace(/^[^`]*/, '').trim())
    .join('\n');
}

const neverSection = extractSection(agentsMd, '5\\. NEVER DO LIST');
const alwaysSection = extractSection(agentsMd, '6\\. ALWAYS DO LIST');
const envSection = extractSection(agentsMd, '2\\. ENVIRONMENT MANIFEST');
const stackSection = extractSection(agentsMd, '3\\. STACK & TOOLING');

// Pull out just the project identity block
const identityMatch = agentsMd.match(/```\n(Project Name[\s\S]*?)```/);
const identityBlock = identityMatch ? identityMatch[1].trim() : '';

// ── Build rule content ────────────────────────────────────────────────────────
function buildRules() {
  return `# AI Agent Rules — Auto-generated from AGENTS.md
# DO NOT EDIT — regenerate with: node scripts/generate-ide-rules.js
# Source: AGENTS.md · Handbook: github.com/nicolapitersky/Bible

## PROJECT IDENTITY
${identityBlock}

## CRITICAL: READ BEFORE EVERY TASK
1. Read AGENTS.md in the project root — it is the authoritative project constitution
2. Read .env.manifest and verify environment IDs match before any cloud operation
3. Run \`git status\` to understand current branch and state
4. Check docs/TOOL_REGISTRY.md before building any new tool or utility

## NEVER DO (hard prohibitions — stop and alert the human if you are about to do these)
- Never hardcode Firebase project IDs, Vercel project IDs, Supabase refs, or cloud resource IDs
- Never use production environment IDs in local development or testing
- Never commit secrets, API keys, or credentials to git
- Never use \`any\` type in TypeScript — use \`unknown\` and narrow
- Never hardcode colours, font sizes, spacing, or border radius — use design tokens only
- Never build a custom tool when an approved tool in docs/TOOL_REGISTRY.md already exists
- Never add a dependency without checking TOOLING.md first
- Never run destructive operations (drop table, delete bucket, purge cache) without explicit confirmation
- Never proceed if you cannot confirm which environment you are operating in
- Never merge to the primary branch without CI passing

## ALWAYS DO (before writing code)
- Read AGENTS.md fully at the start of every session
- Check docs/TOOL_REGISTRY.md — does a tool already exist for this?
- Check the component library — does a component already exist for this?
- Confirm your environment: \`node scripts/verify-env.js local\`
- Write tests alongside code, not after

## ALWAYS DO (when finishing a task)
- Run: pnpm type-check && pnpm lint && pnpm test:unit
- Remove all console.log from production code
- Update docs/TECH_DEBT.md for any compromise made
- Write a handoff report to docs/AGENT_HANDOFF.md
- Commit with format: type(scope): description

## DESIGN SYSTEM (non-negotiable)
- All visual values come from design-tokens/tokens.json or design-tokens/tokens.css
- No hardcoded hex values, pixel sizes, or font weights anywhere
- Token reference in CSS: \`var(--color-brand-primary)\`
- Token reference in Flutter: \`AppTokens.brandPrimary\`
- Before adding a visual property: check if the token exists, if not propose it

## ENVIRONMENT LOCK
- The ONLY authoritative environment IDs are in .env.manifest
- If you find a different ID anywhere in the codebase, STOP and flag it
- Production operations require explicit human confirmation

## COMMIT FORMAT
type(scope): description
Types: feat | fix | style | refactor | test | docs | chore | security | perf

## WHEN UNCERTAIN
Stop. State what you were about to do. Ask for guidance.
Do not guess on: environment IDs, credentials, destructive operations, third-party integrations.
`;
}

// ── Write output files ────────────────────────────────────────────────────────
const rules = buildRules();

const filesToWrite = [];

if (ideTarget === 'all' || ideTarget === 'cursor') {
  filesToWrite.push({
    name: '.cursorrules',
    content: rules,
  });
}

if (ideTarget === 'all' || ideTarget === 'windsurf') {
  filesToWrite.push({
    name: '.windsurfrules',
    content: rules,
  });
}

// .aidigest works with multiple IDEs as a fallback
if (ideTarget === 'all') {
  filesToWrite.push({
    name: '.aidigest',
    content: rules,
  });
}

// Claude Code also reads CLAUDE.md (same as AGENTS.md)
if (ideTarget === 'all' || ideTarget === 'claude-code') {
  // For Claude Code, AGENTS.md IS the rules file
  // But we also write CLAUDE.md as Claude Code reads both
  if (fs.existsSync(agentsPath)) {
    filesToWrite.push({
      name: 'CLAUDE.md',
      content: `# CLAUDE.md — Points to AGENTS.md\n\n` +
               `This project uses AGENTS.md as the agent constitution.\n` +
               `Read AGENTS.md in full before starting any task.\n`,
    });
  }
}

for (const file of filesToWrite) {
  const filePath = path.join(outDir, file.name);
  fs.writeFileSync(filePath, file.content, 'utf8');
  console.log(`✓ Generated: ${file.name}`);
}

console.log(`\nDone. ${filesToWrite.length} file(s) generated.`);
console.log(`Commit these files — your IDE reads them at session start.`);
console.log(`Regenerate whenever AGENTS.md changes: node scripts/generate-ide-rules.js`);
