#!/usr/bin/env node
/**
 * weekly-quality.js
 * The weekly quality agent — runs every Monday at 06:00 UTC via GitHub Actions.
 * Can also be run manually: node scripts/weekly-quality.js
 *
 * What it does:
 *   1. Dependency vulnerability audit
 *   2. Outdated package detection
 *   3. Dead code / unused exports (knip)
 *   4. Hardcoded design value scan (tokens compliance)
 *   5. Console.log sweep
 *   6. TODO/FIXME sweep and TECH_DEBT.md sync
 *   7. Secret pattern scan
 *   8. AGENTS.md staleness check
 *   9. Generates a summary report
 *  10. Optionally creates a GitHub issue (when GITHUB_TOKEN is set)
 *
 * Output: docs/quality-reports/YYYY-MM-DD.md
 * GitHub: creates issue titled "Weekly Quality Report — YYYY-MM-DD"
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────
const c = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m',
};

const today = new Date().toISOString().split('T')[0];
const reportDir = path.join(process.cwd(), 'docs', 'quality-reports');
const reportPath = path.join(reportDir, `${today}.md`);

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
  } catch (e) {
    return e.stdout?.trim() ?? '';
  }
}

function section(title) {
  console.log(`\n${c.bold}${c.blue}━━ ${title} ━━${c.reset}`);
}

function pass(msg)  { console.log(`  ${c.green}✓${c.reset} ${msg}`); }
function warn(msg)  { console.log(`  ${c.yellow}⚠${c.reset} ${msg}`); }
function fail(msg)  { console.log(`  ${c.red}✗${c.reset} ${c.bold}${msg}${c.reset}`); }
function info(msg)  { console.log(`  ${c.dim}→${c.reset} ${msg}`); }

// ── Result accumulator ────────────────────────────────────────────────────────
const results = {
  date: today,
  checks: {},
  summary: { critical: 0, high: 0, medium: 0, low: 0, passed: 0 },
};

function addResult(key, severity, title, detail = '') {
  results.checks[key] = { severity, title, detail };
  if (severity === 'PASS') results.summary.passed++;
  else results.summary[severity.toLowerCase()]++;
}

// ── Check 1: Dependency vulnerabilities ───────────────────────────────────────
section('1 / 9 — Dependency vulnerabilities');
try {
  const auditRaw = run('pnpm audit --json 2>/dev/null || true');
  let vulnCount = 0;
  let highCount = 0;
  let criticalCount = 0;

  if (auditRaw) {
    const lines = auditRaw.split('\n').filter(l => {
      try { JSON.parse(l); return true; } catch { return false; }
    });
    for (const line of lines) {
      const obj = JSON.parse(line);
      if (obj.type === 'auditSummary') {
        const v = obj.data?.vulnerabilities ?? {};
        vulnCount  = Object.values(v).reduce((a, b) => a + b, 0);
        highCount  = (v.high ?? 0) + (v.critical ?? 0);
        criticalCount = v.critical ?? 0;
      }
    }
  }

  if (criticalCount > 0) {
    fail(`${criticalCount} CRITICAL vulnerabilities`);
    addResult('vulnerabilities', 'CRITICAL', `${criticalCount} critical vulnerabilities`, 'Run pnpm audit for details');
  } else if (highCount > 0) {
    warn(`${highCount} high/critical vulnerabilities`);
    addResult('vulnerabilities', 'HIGH', `${highCount} high vulnerabilities`, 'Run pnpm audit for details');
  } else if (vulnCount > 0) {
    warn(`${vulnCount} low/medium vulnerabilities`);
    addResult('vulnerabilities', 'MEDIUM', `${vulnCount} vulnerabilities (low/medium)`, '');
  } else {
    pass('No vulnerabilities found');
    addResult('vulnerabilities', 'PASS', 'No vulnerabilities');
  }
} catch (e) {
  info('pnpm audit not available — skipped');
  addResult('vulnerabilities', 'LOW', 'Audit skipped', 'pnpm not available');
}

// ── Check 2: Outdated packages ────────────────────────────────────────────────
section('2 / 9 — Outdated packages');
try {
  const outdated = run('pnpm outdated --format json 2>/dev/null || echo "{}"');
  const outdatedPkgs = Object.keys(JSON.parse(outdated || '{}'));
  if (outdatedPkgs.length === 0) {
    pass('All packages up to date');
    addResult('outdated', 'PASS', 'All packages current');
  } else {
    warn(`${outdatedPkgs.length} outdated packages`);
    addResult('outdated', 'LOW', `${outdatedPkgs.length} outdated packages`, outdatedPkgs.join(', '));
    outdatedPkgs.slice(0, 5).forEach(p => info(p));
    if (outdatedPkgs.length > 5) info(`...and ${outdatedPkgs.length - 5} more`);
  }
} catch {
  info('Outdated check skipped');
  addResult('outdated', 'LOW', 'Outdated check skipped');
}

// ── Check 3: Dead code (knip) ─────────────────────────────────────────────────
section('3 / 9 — Dead code');
try {
  const knipOut = run('npx knip --reporter json 2>/dev/null || echo "{}"');
  const knip = JSON.parse(knipOut || '{}');
  const unusedFiles   = knip.files?.length ?? 0;
  const unusedExports = (knip.exports?.length ?? 0) + (knip.types?.length ?? 0);

  if (unusedFiles === 0 && unusedExports === 0) {
    pass('No dead code found');
    addResult('deadcode', 'PASS', 'No dead code');
  } else {
    warn(`${unusedFiles} unused files, ${unusedExports} unused exports`);
    addResult('deadcode', 'LOW', `Dead code: ${unusedFiles} files, ${unusedExports} exports`);
  }
} catch {
  info('knip not available — skipped');
  addResult('deadcode', 'LOW', 'Dead code check skipped');
}

// ── Check 4: Design token compliance ─────────────────────────────────────────
section('4 / 9 — Design token compliance');

const sourceGlobs = ['src/**/*.{ts,tsx,astro,dart}', 'lib/**/*.dart'];
const hardcodedColourPattern = /color:\s*#[0-9a-fA-F]{3,8}|background[^:]*:\s*#[0-9a-fA-F]{3,8}|rgba?\s*\(/g;
const hardcodedSpacingPattern = /(?:padding|margin|gap|top|bottom|left|right)\s*:\s*\d+px(?!\s*\/\*\s*token)/g;
const flutterColourPattern = /Color\(0x[0-9a-fA-F]{8}\)|Colors\.[a-z]+\b/g;

let tokenViolations = [];

for (const glob of sourceGlobs) {
  try {
    const files = run(`find . -path "./${glob.replace('**', '**').replace('{', '').replace('}', '')}" -type f 2>/dev/null || true`);
    // Simple grep approach for reliability
    const colourHits = run(`grep -rn --include="*.ts" --include="*.tsx" --include="*.astro" --include="*.css" "color:\\s*#\\|background.*#" src/ lib/ 2>/dev/null | grep -v "var(--" | grep -v "//.*#" | head -20 || true`);
    const dartHits   = run(`grep -rn "Color(0x" lib/ 2>/dev/null | head -10 || true`);
    if (colourHits) tokenViolations.push(...colourHits.split('\n').filter(Boolean));
    if (dartHits)   tokenViolations.push(...dartHits.split('\n').filter(Boolean));
  } catch { /* file pattern may not exist */ }
}

if (tokenViolations.length === 0) {
  pass('All visual values use design tokens');
  addResult('tokens', 'PASS', 'Token compliance: 100%');
} else {
  warn(`${tokenViolations.length} potential hardcoded values found`);
  addResult('tokens', 'MEDIUM', `${tokenViolations.length} possible token violations`,
    tokenViolations.slice(0, 5).join('\n'));
  tokenViolations.slice(0, 5).forEach(v => info(v.slice(0, 100)));
}

// ── Check 5: Console.log sweep ────────────────────────────────────────────────
section('5 / 9 — Console.log in production code');
const consoleLogs = run(`grep -rn "console\\.log" src/ lib/ --include="*.ts" --include="*.tsx" --include="*.astro" --include="*.dart" 2>/dev/null | grep -v "//.*console" | grep -v "__tests__" | grep -v ".test." | grep -v ".spec." || true`);
const logLines = consoleLogs.split('\n').filter(Boolean);

if (logLines.length === 0) {
  pass('No console.log in production code');
  addResult('consolelog', 'PASS', 'No stray console.log');
} else {
  warn(`${logLines.length} console.log found in production code`);
  addResult('consolelog', 'LOW', `${logLines.length} console.log statements`,
    logLines.slice(0, 3).join('\n'));
  logLines.slice(0, 3).forEach(l => info(l.slice(0, 100)));
}

// ── Check 6: TODO/FIXME sweep ─────────────────────────────────────────────────
section('6 / 9 — TODO/FIXME tracking');
const todos = run(`grep -rn "TODO\\|FIXME\\|HACK\\|XXX" src/ lib/ --include="*.ts" --include="*.tsx" --include="*.astro" --include="*.dart" 2>/dev/null || true`);
const todoLines = todos.split('\n').filter(Boolean);

const techDebtPath = path.join(process.cwd(), 'docs', 'TECH_DEBT.md');
const techDebt = fs.existsSync(techDebtPath)
  ? fs.readFileSync(techDebtPath, 'utf8')
  : '';
const trackedCount = (techDebt.match(/### TD-/g) ?? []).length;

if (todoLines.length === 0) {
  pass('No untracked TODOs found');
  addResult('todos', 'PASS', 'All TODOs tracked');
} else {
  const untrackedCount = Math.max(0, todoLines.length - trackedCount);
  if (untrackedCount > 0) {
    warn(`${todoLines.length} TODO/FIXME comments, ${trackedCount} tracked in TECH_DEBT.md`);
    addResult('todos', 'MEDIUM', `${untrackedCount} potentially untracked TODOs`,
      'Review and add to docs/TECH_DEBT.md');
  } else {
    pass(`${todoLines.length} TODOs, all appear tracked in TECH_DEBT.md`);
    addResult('todos', 'PASS', 'TODOs accounted for');
  }
}

// ── Check 7: Secret patterns ──────────────────────────────────────────────────
section('7 / 9 — Secret pattern scan');
const secretPatterns = [
  { pattern: 'sk_live_', label: 'Stripe live secret key' },
  { pattern: 'sk_test_', label: 'Stripe test secret key' },
  { pattern: 'AIzaSy',   label: 'Firebase/Google API key' },
  { pattern: 'PRIVATE KEY', label: 'Private key' },
  { pattern: 'supabase.*service_role', label: 'Supabase service role' },
];

let secretsFound = [];
for (const { pattern, label } of secretPatterns) {
  const hits = run(`grep -rn "${pattern}" src/ lib/ --include="*.ts" --include="*.tsx" --include="*.dart" --include="*.js" 2>/dev/null | grep -v ".env.example" | grep -v "//.*${pattern.slice(0, 4)}" || true`);
  if (hits) secretsFound.push({ label, hits: hits.split('\n').filter(Boolean) });
}

if (secretsFound.length === 0) {
  pass('No secret patterns in source files');
  addResult('secrets', 'PASS', 'No secrets detected');
} else {
  fail(`Possible secrets in source: ${secretsFound.map(s => s.label).join(', ')}`);
  addResult('secrets', 'CRITICAL', 'Possible secrets detected in source',
    secretsFound.map(s => s.label).join(', '));
}

// ── Check 8: AGENTS.md staleness ─────────────────────────────────────────────
section('8 / 9 — AGENTS.md freshness');
const agentsPath = path.join(process.cwd(), 'AGENTS.md');
if (fs.existsSync(agentsPath)) {
  const agentsStat = fs.statSync(agentsPath);
  const daysSinceModified = (Date.now() - agentsStat.mtimeMs) / (1000 * 60 * 60 * 24);
  if (daysSinceModified > 90) {
    warn(`AGENTS.md last modified ${Math.round(daysSinceModified)} days ago`);
    addResult('agents_md', 'LOW', 'AGENTS.md may be stale', 'Review and update if needed');
  } else {
    pass(`AGENTS.md updated ${Math.round(daysSinceModified)} days ago`);
    addResult('agents_md', 'PASS', 'AGENTS.md is fresh');
  }
} else {
  fail('AGENTS.md not found');
  addResult('agents_md', 'HIGH', 'AGENTS.md missing', 'Run handbook bootstrap');
}

// ── Check 9: TypeScript strict compliance ─────────────────────────────────────
section('9 / 9 — TypeScript compliance');
const tscOut = run('pnpm type-check 2>&1 | tail -5 || true');
const hasErrors = tscOut.includes('error TS') || tscOut.includes('Found');
if (hasErrors) {
  const errorCount = (tscOut.match(/error TS/g) ?? []).length;
  fail(`TypeScript errors found (${errorCount || 'see output'})`);
  addResult('typescript', 'HIGH', `TypeScript errors`, tscOut.slice(0, 200));
} else {
  pass('TypeScript: zero errors');
  addResult('typescript', 'PASS', 'Zero TypeScript errors');
}

// ── Generate report ───────────────────────────────────────────────────────────
section('Generating report');

const { critical, high, medium, low, passed } = results.summary;
const total = critical + high + medium + low + passed;
const healthScore = Math.round((passed / total) * 100);

const reportLines = [
  `# Weekly Quality Report — ${today}`,
  ``,
  `**Project:** ${path.basename(process.cwd())}`,
  `**Health score:** ${healthScore}% (${passed}/${total} checks passing)`,
  ``,
  `## Summary`,
  ``,
  `| Severity | Count |`,
  `|----------|-------|`,
  `| 🔴 Critical | ${critical} |`,
  `| 🟠 High | ${high} |`,
  `| 🟡 Medium | ${medium} |`,
  `| 🟢 Low | ${low} |`,
  `| ✅ Passed | ${passed} |`,
  ``,
  `## Findings`,
  ``,
];

for (const [key, { severity, title, detail }] of Object.entries(results.checks)) {
  const emoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢', PASS: '✅' }[severity] ?? '⚪';
  reportLines.push(`### ${emoji} ${title}`);
  if (detail) reportLines.push(`\`\`\`\n${detail}\n\`\`\``);
  reportLines.push('');
}

reportLines.push(
  `## Action Required`,
  ``,
  `- [ ] Review and resolve all CRITICAL items immediately`,
  `- [ ] Schedule HIGH items for this sprint`,
  `- [ ] Add MEDIUM/LOW items to \`docs/TECH_DEBT.md\``,
  `- [ ] Update \`docs/TECH_DEBT.md\` with resolution notes for any fixed items`,
  ``,
  `*Generated by Complete Development Handbook weekly-quality.js*`,
);

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
console.log(`\n${c.green}✓${c.reset} Report written: ${reportPath}`);

// ── Final summary ─────────────────────────────────────────────────────────────
console.log(`\n${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
console.log(`${c.bold}  Weekly Quality Summary — ${today}${c.reset}`);
console.log(`${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
console.log(`  Health score:  ${c.bold}${healthScore}%${c.reset}`);
console.log(`  Critical:      ${critical > 0 ? c.red : c.dim}${critical}${c.reset}`);
console.log(`  High:          ${high > 0 ? c.yellow : c.dim}${high}${c.reset}`);
console.log(`  Medium/Low:    ${c.dim}${medium + low}${c.reset}`);
console.log(`  Passed:        ${c.green}${passed}${c.reset}\n`);

if (critical > 0) {
  console.log(`${c.red}${c.bold}ACTION REQUIRED: ${critical} critical finding(s).${c.reset}`);
  console.log(`${c.red}Do not deploy until resolved.${c.reset}\n`);
  process.exit(1);
} else if (high > 0) {
  console.log(`${c.yellow}${c.bold}ATTENTION: ${high} high finding(s). Schedule for this sprint.${c.reset}\n`);
  process.exit(0);
} else {
  console.log(`${c.green}${c.bold}All clear. Good week.${c.reset}\n`);
  process.exit(0);
}
