#!/usr/bin/env node
/**
 * retrofit-audit.js
 * Automated discovery scan for existing projects being brought under
 * Complete Development Handbook governance.
 *
 * Run from the project root:
 *   node /tmp/handbook/scripts/retrofit-audit.js
 *   node /tmp/handbook/scripts/retrofit-audit.js --output=docs/RETROFIT_AUDIT.md
 *
 * What it does:
 *   - Scans the codebase for handbook compliance gaps
 *   - Identifies hardcoded values, missing files, security issues
 *   - Produces a structured audit report with prioritised findings
 *   - Does NOT make any changes — read-only scan
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CWD    = process.cwd();
const OUTPUT = process.argv.find(a => a.startsWith('--output='))?.split('=')[1]
                ?? 'docs/RETROFIT_AUDIT.md';

const c = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m',
};

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', cwd: CWD }).trim(); }
  catch (e) { return e.stdout?.trim() ?? ''; }
}

function exists(p) { return fs.existsSync(path.join(CWD, p)); }
function read(p) {
  try { return fs.readFileSync(path.join(CWD, p), 'utf8'); }
  catch { return ''; }
}

function grepCount(pattern, dirs = 'src lib app') {
  const result = run(`grep -r "${pattern}" ${dirs} --include="*.ts" --include="*.tsx" --include="*.dart" --include="*.js" --include="*.astro" --include="*.css" 2>/dev/null | wc -l`);
  return parseInt(result, 10) || 0;
}

function grepFiles(pattern, dirs = 'src lib') {
  return run(`grep -rl "${pattern}" ${dirs} --include="*.ts" --include="*.tsx" --include="*.dart" --include="*.js" --include="*.astro" 2>/dev/null || true`)
    .split('\n').filter(Boolean);
}

const today  = new Date().toISOString().split('T')[0];
const findings = [];

function finding(severity, area, title, detail, recommendation) {
  findings.push({ severity, area, title, detail, recommendation });
}

// ─── Banner ────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold}Complete Development Handbook — Retrofit Audit${c.reset}`);
console.log(`${c.dim}Project: ${path.basename(CWD)} · ${today}${c.reset}\n`);

// ─── 1. Identity ───────────────────────────────────────────────────────────────
process.stdout.write('Scanning project identity... ');

const pkgJson   = exists('package.json')   ? JSON.parse(read('package.json'))   : null;
const pubspec   = exists('pubspec.yaml');
const isFlutter = pubspec;
const isNext    = pkgJson?.dependencies?.next;
const isAstro   = pkgJson?.dependencies?.astro;
const isVite    = pkgJson?.devDependencies?.vite || pkgJson?.dependencies?.vite;

const detectedStack = isFlutter ? 'Flutter'
  : isNext   ? 'Next.js'
  : isAstro  ? 'Astro'
  : isVite   ? 'Vite'
  : pkgJson  ? 'Node.js'
  : 'Unknown';

const hasFirebase  = !!(pkgJson?.dependencies?.firebase || pkgJson?.dependencies?.['firebase-admin']);
const hasSupabase  = !!(pkgJson?.dependencies?.['@supabase/supabase-js']);
const hasStripe    = !!(pkgJson?.dependencies?.stripe || pkgJson?.dependencies?.['@stripe/stripe-js']);

console.log(`${c.green}✓${c.reset} (${detectedStack})`);

// ─── 2. Handbook files ────────────────────────────────────────────────────────
process.stdout.write('Checking handbook files...   ');

const handbookFiles = {
  'AGENTS.md':                exists('AGENTS.md'),
  '.env.manifest':            exists('.env.manifest'),
  '.env.example':             exists('.env.example'),
  'design-tokens/tokens.json':exists('design-tokens/tokens.json'),
  'docs/TECH_DEBT.md':        exists('docs/TECH_DEBT.md'),
  'docs/AGENT_HANDOFF.md':    exists('docs/AGENT_HANDOFF.md'),
  'scripts/verify-env.js':    exists('scripts/verify-env.js'),
};

const missingHandbook = Object.entries(handbookFiles).filter(([, v]) => !v).map(([k]) => k);

if (!handbookFiles['AGENTS.md']) {
  finding('CRITICAL', 'Handbook', 'AGENTS.md missing',
    'No agent constitution. Every AI agent working on this project has no guidance.',
    'Run the retrofit prompt (PROMPT 12 in PROMPT_LIBRARY.md) to generate AGENTS.md');
}
if (!handbookFiles['.env.manifest']) {
  finding('CRITICAL', 'Environment', '.env.manifest missing',
    'No environment manifest. Agents cannot verify which cloud project they are operating in.',
    'Create .env.manifest during retrofit — see ENVIRONMENTS.md for the schema');
}

console.log(`${c.green}✓${c.reset} (${Object.values(handbookFiles).filter(Boolean).length}/${Object.keys(handbookFiles).length} present)`);

// ─── 3. Environment ID safety ─────────────────────────────────────────────────
process.stdout.write('Scanning environment IDs...  ');

const envIssues = [];

// Firebase hardcoded IDs
const firebaseIdPattern = '[a-z][a-z0-9-]+-[0-9]{5,}'; // Matches typical Firebase project ID pattern
const hardcodedFirebase = run(`grep -rn "projectId.*['\\"'][a-z][a-z0-9-]*['\\"']" src/ lib/ --include="*.ts" --include="*.tsx" --include="*.dart" --include="*.js" 2>/dev/null | grep -v "process.env\|env\.\|import\|\/\/" | head -10 || true`);
if (hardcodedFirebase) {
  envIssues.push('Possible hardcoded Firebase project ID');
  finding('CRITICAL', 'Environment', 'Hardcoded Firebase project ID detected',
    hardcodedFirebase.split('\n').slice(0, 3).join('\n'),
    'Replace with process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID and add to .env.manifest');
}

// Secrets in code
const secretPatterns = [
  { pattern: 'sk_live_', label: 'Stripe live secret key' },
  { pattern: 'sk_test_', label: 'Stripe test secret key' },
  { pattern: 'AIzaSy',   label: 'Google/Firebase API key' },
  { pattern: 'whsec_',   label: 'Stripe webhook secret' },
];
for (const { pattern, label } of secretPatterns) {
  const files = grepFiles(pattern, 'src lib app');
  if (files.length > 0) {
    finding('CRITICAL', 'Security', `${label} hardcoded in source`,
      `Found in: ${files.join(', ')}`,
      'Remove immediately and rotate the key. Add to .env.example with empty value only.');
  }
}

// .env files committed
const committedEnv = run(`git ls-files | grep -E "^\\.env$|^\\.env\\." | grep -v example | grep -v manifest || true`);
if (committedEnv) {
  finding('CRITICAL', 'Security', '.env file(s) committed to git',
    `Committed: ${committedEnv}`,
    'Remove from git: git rm --cached .env && add to .gitignore. Rotate all secrets.');
}

console.log(envIssues.length > 0 ? `${c.red}✗${c.reset} (issues found)` : `${c.green}✓${c.reset}`);

// ─── 4. Design token compliance ───────────────────────────────────────────────
process.stdout.write('Scanning design tokens...    ');

const hasTokenFile = exists('design-tokens/tokens.json') || exists('design-tokens/tokens.css');
const hardcodedColours = grepCount('color:\\s*#|background.*#|rgba(|rgb(');
const hardcodedFlutterColours = grepCount('Color(0x|Colors\\.', 'lib');
const tailwindArbitrary = grepCount('\\[#[0-9a-fA-F]|\\[\\d+px\\]');

const totalHardcoded = hardcodedColours + hardcodedFlutterColours + tailwindArbitrary;

if (!hasTokenFile && totalHardcoded > 0) {
  finding('MEDIUM', 'Design', 'No design token system, hardcoded values throughout',
    `~${totalHardcoded} hardcoded visual values found`,
    'Create design-tokens/tokens.json during retrofit. Migrate incrementally.');
} else if (hasTokenFile && totalHardcoded > 10) {
  finding('MEDIUM', 'Design', 'Design tokens exist but compliance is incomplete',
    `~${totalHardcoded} hardcoded values still in codebase`,
    'Track as tech debt. Migrate files when they are edited.');
} else if (hasTokenFile && totalHardcoded <= 10) {
  // Good — tokens exist and mostly used
}

console.log(`${c.green}✓${c.reset} (~${totalHardcoded} hardcoded values)`);

// ─── 5. Security ──────────────────────────────────────────────────────────────
process.stdout.write('Scanning security posture... ');

// Unprotected API routes (Next.js)
if (isNext) {
  const apiRouteFiles = run(`find src/app/api -name "route.ts" -o -name "route.tsx" 2>/dev/null | head -20 || true`).split('\n').filter(Boolean);
  const unprotectedRoutes = [];
  for (const routeFile of apiRouteFiles.slice(0, 10)) {
    const content = read(routeFile);
    const isMutation = content.includes('POST') || content.includes('PUT') || content.includes('DELETE');
    const hasAuth = content.includes('getServerSession') || content.includes('verifySessionCookie') || content.includes('getUser') || content.includes('auth(');
    if (isMutation && !hasAuth) unprotectedRoutes.push(routeFile);
  }
  if (unprotectedRoutes.length > 0) {
    finding('HIGH', 'Security', `${unprotectedRoutes.length} mutation API route(s) may lack auth check`,
      unprotectedRoutes.slice(0, 3).join('\n'),
      'Add authentication check at the start of each POST/PUT/DELETE handler');
  }
}

// Stripe webhook without signature check
if (hasStripe) {
  const webhookFile = read('src/app/api/webhooks/stripe/route.ts') || read('src/pages/api/webhooks/stripe.ts') || '';
  if (webhookFile && !webhookFile.includes('constructEvent') && !webhookFile.includes('stripe-signature')) {
    finding('CRITICAL', 'Security', 'Stripe webhook handler missing signature validation',
      'Webhook endpoint found but no stripe.webhooks.constructEvent() call detected',
      'Add signature validation — see stacks/stripe.md for the correct pattern');
  }
}

// dangerouslySetInnerHTML without sanitisation
const dangerousHtml = grepCount('dangerouslySetInnerHTML');
if (dangerousHtml > 0) {
  finding('HIGH', 'Security', `dangerouslySetInnerHTML used ${dangerousHtml} time(s)`,
    'Risk of XSS if user-provided content is rendered without sanitisation',
    'Review each usage. Sanitise with DOMPurify or replace with safe alternatives.');
}

// localStorage for auth tokens (insecure)
const localStorageAuth = run(`grep -rn "localStorage.*token\\|localStorage.*session\\|localStorage.*auth" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5 || true`);
if (localStorageAuth) {
  finding('HIGH', 'Security', 'Auth tokens may be stored in localStorage',
    localStorageAuth.split('\n').slice(0, 2).join('\n'),
    'Migrate to httpOnly cookies. LocalStorage is vulnerable to XSS.');
}

console.log(`${c.green}✓${c.reset}`);

// ─── 6. Code quality ──────────────────────────────────────────────────────────
process.stdout.write('Checking code quality...     ');

// TypeScript strict mode
const tsconfig = exists('tsconfig.json') ? JSON.parse(read('tsconfig.json')) : null;
const strictMode = tsconfig?.compilerOptions?.strict === true;
if (!strictMode && (isNext || isVite || isAstro)) {
  const errorCount = parseInt(run('pnpm tsc --strict --noEmit 2>&1 | grep "error TS" | wc -l || echo 0'), 10);
  finding('MEDIUM', 'Quality', 'TypeScript strict mode is not enabled',
    `Enabling strict mode would surface ~${errorCount || '?'} type errors`,
    'Schedule a dedicated strict-mode PR. Do not enable during feature work.');
}

// No linter
const hasEslint = exists('.eslintrc.json') || exists('.eslintrc.js') || exists('eslint.config.js') || pkgJson?.eslintConfig;
if (!hasEslint) {
  finding('HIGH', 'Quality', 'No ESLint configuration found',
    'No automated code quality checks in place',
    'Copy configs/.eslintrc.json from the handbook as a baseline');
}

// No tests
const testFiles = parseInt(run(`find src lib -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" 2>/dev/null | wc -l || echo 0`), 10);
if (testFiles === 0) {
  finding('HIGH', 'Quality', 'No test files found',
    'Zero automated test coverage',
    'Add vitest infrastructure now. Write tests for new code. Schedule critical path tests.');
}

// console.log in production code
const consoleLogs = grepCount('console\\.log', 'src lib app');
if (consoleLogs > 5) {
  finding('LOW', 'Quality', `${consoleLogs} console.log statements in source`,
    'Console logs pollute production output and may expose sensitive data',
    'Replace with structured logger (pino). Add to pre-commit hook to prevent new ones.');
}

// No CI
const hasCI = exists('.github/workflows/ci.yml') || exists('.github/workflows/main.yml');
if (!hasCI) {
  finding('HIGH', 'Quality', 'No CI/CD pipeline',
    'No automated quality gates on pull requests',
    'Copy configs/workflows/ci.yml from the handbook as a baseline');
}

console.log(`${c.green}✓${c.reset}`);

// ─── 7. Dependencies ──────────────────────────────────────────────────────────
process.stdout.write('Auditing dependencies...     ');

const auditOutput = run('pnpm audit --json 2>/dev/null | tail -5 || true');
let criticalVulns = 0, highVulns = 0;
if (auditOutput) {
  try {
    const lines = auditOutput.split('\n').filter(l => { try { JSON.parse(l); return true; } catch { return false; } });
    for (const line of lines) {
      const obj = JSON.parse(line);
      if (obj.type === 'auditSummary') {
        criticalVulns = obj.data?.vulnerabilities?.critical ?? 0;
        highVulns     = obj.data?.vulnerabilities?.high ?? 0;
      }
    }
  } catch { /* parse failure — skip */ }
}

if (criticalVulns > 0) {
  finding('CRITICAL', 'Dependencies', `${criticalVulns} critical vulnerability/vulnerabilities`,
    'Run pnpm audit for details', 'Update affected packages immediately before deployment');
} else if (highVulns > 0) {
  finding('HIGH', 'Dependencies', `${highVulns} high vulnerability/vulnerabilities`,
    'Run pnpm audit for details', 'Update affected packages this sprint');
}

console.log(`${c.green}✓${c.reset} (${criticalVulns} critical, ${highVulns} high)`);

// ─── 8. Codebase orientation (for agents) ────────────────────────────────────
process.stdout.write('Mapping codebase structure... ');

const orientationLines = [];

// Directory tree (2 levels)
const tree = run('find . -maxdepth 3 -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./dist/*" -not -path "./build/*" -type f | sort | head -80 || true');

// Largest files (complexity indicators)
const largestFiles = run('find src lib app -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.dart" \\) -exec wc -l {} + 2>/dev/null | sort -rn | head -10 || true');

// Route structure (Next.js App Router)
const routes = run('find src/app -name "page.tsx" -o -name "route.ts" 2>/dev/null | sed "s|src/app||" | sed "s|/page.tsx||" | sed "s|/route.ts| [API]|" | sort || true');

// Components inventory
const components = run('find src/components lib/presentation -name "*.tsx" -o -name "*.astro" -o -name "*.dart" 2>/dev/null | sed "s|src/components/||" | sed "s|lib/presentation/||" | sort | head -30 || true');

// Key patterns: error handling, logging, auth
const usesLogger    = grepCount('logger\\.', 'src lib') > 0 || grepCount('pino\\.', 'src lib') > 0;
const usesZod       = grepCount('z\\.object\\|z\\.string', 'src lib') > 0;
const usesQueryClient = grepCount('useQuery\\|useMutation', 'src lib') > 0;

orientationLines.push(
  '',
  '## Codebase Orientation (for agent context)',
  '',
  `**Stack detected:** ${detectedStack}${hasFirebase ? ' + Firebase' : ''}${hasSupabase ? ' + Supabase' : ''}${hasStripe ? ' + Stripe' : ''}`,
  '',
  '### Key patterns in use',
  `- Input validation: ${usesZod ? '✅ Zod (use consistently)' : '❌ None detected (add Zod for all API inputs)'}`,
  `- Structured logging: ${usesLogger ? '✅ Logger detected' : '❌ None (add Pino)'}`,
  `- Data fetching: ${usesQueryClient ? '✅ React Query detected' : 'Direct fetch or unknown'}`,
  '',
);

if (routes) {
  orientationLines.push('### Routes / Pages', '```', routes, '```', '');
}
if (components) {
  orientationLines.push('### Components', '```', components, '```', '');
}
if (largestFiles) {
  orientationLines.push(
    '### Largest files (potential complexity hotspots)',
    '```',
    largestFiles,
    '```',
    '',
    '> Files over 300 lines are candidates for refactoring.',
    '> Do not make sweeping changes to these files without explicit instruction.',
    '',
  );
}

console.log(`${c.green}✓${c.reset}`);

// ─── 9. Generate report ───────────────────────────────────────────────────────
const counts = {
  CRITICAL: findings.filter(f => f.severity === 'CRITICAL').length,
  HIGH:     findings.filter(f => f.severity === 'HIGH').length,
  MEDIUM:   findings.filter(f => f.severity === 'MEDIUM').length,
  LOW:      findings.filter(f => f.severity === 'LOW').length,
};

const reportLines = [
  `# Retrofit Audit — ${path.basename(CWD)}`,
  ``,
  `**Date:** ${today}`,
  `**Stack:** ${detectedStack}${hasFirebase ? ' + Firebase' : ''}${hasSupabase ? ' + Supabase' : ''}${hasStripe ? ' + Stripe' : ''}`,
  `**Handbook:** Complete Development Handbook`,
  ``,
  `## Summary`,
  ``,
  `| Severity | Count |`,
  `|----------|-------|`,
  `| 🔴 Critical | ${counts.CRITICAL} |`,
  `| 🟠 High | ${counts.HIGH} |`,
  `| 🟡 Medium | ${counts.MEDIUM} |`,
  `| 🟢 Low | ${counts.LOW} |`,
  ``,
  `## Handbook Files Present`,
  ``,
  ...Object.entries(handbookFiles).map(([k, v]) => `- ${v ? '✅' : '❌'} \`${k}\``),
  ``,
  `## Findings`,
  ``,
];

for (const { severity, area, title, detail, recommendation } of findings) {
  const emoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[severity];
  reportLines.push(`### ${emoji} [${severity}] ${area}: ${title}`);
  if (detail) {
    reportLines.push(`\`\`\``);
    reportLines.push(detail);
    reportLines.push(`\`\`\``);
  }
  reportLines.push(`**Recommendation:** ${recommendation}`);
  reportLines.push('');
}

reportLines.push(...orientationLines);

reportLines.push(
  `## Next Steps`,
  ``,
  `1. Fix all CRITICAL findings before the next deploy`,
  `2. Run the Quick Retrofit prompt (PROMPT 11) to generate minimum viable handbook files`,
  `3. Or run the Full Retrofit prompt (PROMPT 12) for complete handbook governance`,
  `4. Use this report as the basis for TECH_DEBT.md entries`,
  ``,
  `*Generated by Complete Development Handbook — retrofit-audit.js*`,
);

// Write report
fs.mkdirSync(path.join(CWD, 'docs'), { recursive: true });
fs.writeFileSync(path.join(CWD, OUTPUT), reportLines.join('\n'), 'utf8');

// Print summary
console.log(`\n${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
console.log(`${c.bold}  Retrofit Audit — ${path.basename(CWD)}${c.reset}`);
console.log(`${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
console.log(`  Stack:    ${c.bold}${detectedStack}${c.reset}`);
console.log(`  Critical: ${counts.CRITICAL > 0 ? c.red : c.dim}${counts.CRITICAL}${c.reset}`);
console.log(`  High:     ${counts.HIGH > 0 ? c.yellow : c.dim}${counts.HIGH}${c.reset}`);
console.log(`  Medium:   ${c.dim}${counts.MEDIUM}${c.reset}`);
console.log(`  Low:      ${c.dim}${counts.LOW}${c.reset}`);
console.log(`\n  Report:   ${c.blue}${OUTPUT}${c.reset}`);
console.log(`\n  Run the retrofit prompt to generate handbook files.`);
console.log(`  See prompts/PROMPT_LIBRARY.md — PROMPT 11 or PROMPT 12.\n`);

if (counts.CRITICAL > 0) process.exit(1);
