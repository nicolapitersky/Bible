#!/usr/bin/env node
/**
 * handbook-update-agent.js
 *
 * Fetches authoritative sources, detects what has changed since the handbook
 * was last updated, and produces a structured report with specific proposed
 * changes for human review.
 *
 * Run manually:   node scripts/handbook-update-agent.js
 * Run in CI:      called by .github/workflows/handbook-update.yml
 *
 * What it checks:
 *   - MCP server registry (new servers relevant to our stack)
 *   - npm package versions (have our key dependencies released new majors?)
 *   - IDE changelogs (Claude Code, Cursor, Windsurf, Codex)
 *   - Framework changelogs (Next.js, Astro, Flutter, Supabase, Vercel, Stripe)
 *   - Security advisories (CVEs affecting our stack)
 *
 * Output:
 *   docs/handbook-updates/YYYY-MM.md   — human-readable report
 *   docs/handbook-updates/YYYY-MM.json — machine-readable for CI
 *
 * Exit codes:
 *   0 — no action needed
 *   1 — critical findings (security or breaking changes)
 *   2 — updates found (new tools, versions)
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const TODAY  = new Date().toISOString().split('T')[0];
const MONTH  = TODAY.slice(0, 7); // YYYY-MM
const CWD    = process.cwd();
const OUT_DIR = path.join(CWD, 'docs', 'handbook-updates');

const c = {
  red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m',
  blue:'\x1b[34m', bold:'\x1b[1m', dim:'\x1b[2m', reset:'\x1b[0m',
};

// ── Fetch utility ─────────────────────────────────────────────────────────────
function fetch(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs, headers: {
      'User-Agent': 'nicolapitersky/Bible handbook-update-agent/1.0',
      'Accept': 'application/json, text/plain, */*',
    }}, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ ok: true, status: res.statusCode, text: data, json: JSON.parse(data) }); }
        catch { resolve({ ok: true, status: res.statusCode, text: data, json: null }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

// ── Result accumulator ─────────────────────────────────────────────────────────
const updates = [];
function update(category, severity, title, detail, action) {
  updates.push({ category, severity, title, detail, action });
}

function info(msg)  { process.stdout.write(`  ${c.blue}·${c.reset} ${msg}\n`); }
function ok(msg)    { process.stdout.write(`  ${c.green}✓${c.reset} ${msg}\n`); }
function warn(msg)  { process.stdout.write(`  ${c.yellow}⚠${c.reset} ${msg}\n`); }

// ── 1. MCPs ───────────────────────────────────────────────────────────────────
console.log(`\n${c.bold}Checking MCP servers...${c.reset}`);

const KNOWN_MCPS = new Set([
  '@modelcontextprotocol/server-filesystem',
  '@modelcontextprotocol/server-github',
  '@modelcontextprotocol/server-google-drive',
  '@modelcontextprotocol/server-postgres',
  '@modelcontextprotocol/server-brave-search',
  '@modelcontextprotocol/server-memory',
  '@firebase/mcp',
  'supabase-mcp-server',
  '@stripe/agent-toolkit',
  '@vercel/mcp',
]);

// Fetch the official MCP server list from npm @modelcontextprotocol org
const mcpOrg = await fetch('https://registry.npmjs.org/-/org/modelcontextprotocol/package?format=true');
if (mcpOrg.ok && mcpOrg.json) {
  const allMcpPackages = Object.keys(mcpOrg.json);
  const serverPackages = allMcpPackages.filter(p => p.includes('server-'));
  const newMcps = serverPackages.filter(p => !KNOWN_MCPS.has(p));

  if (newMcps.length > 0) {
    // Filter to only servers relevant to our stack
    const relevantKeywords = ['firebase', 'supabase', 'stripe', 'vercel', 'netlify',
      'postgres', 'search', 'git', 'github', 'flutter', 'google', 'typescript',
      'nextjs', 'next', 'astro', 'database', 'auth', 'storage'];
    const relevant = newMcps.filter(p =>
      relevantKeywords.some(k => p.toLowerCase().includes(k))
    );

    if (relevant.length > 0) {
      update('MCPs', 'medium', `${relevant.length} potentially relevant new MCP server(s)`,
        relevant.join('\n'),
        `Review each and add relevant ones to TOOLING.md MCP section:\n${relevant.map(p => `  npm: ${p}`).join('\n')}`
      );
      relevant.forEach(p => warn(`New MCP: ${p}`));
    } else {
      ok(`No new relevant MCPs (${newMcps.length} new total, none relevant to our stack)`);
    }
  } else {
    ok('MCP registry: no new servers');
  }
} else {
  info('MCP registry: could not fetch (network or rate limit)');
}

// Also check glama.ai MCP directory for community servers
const glamaMcp = await fetch('https://glama.ai/api/mcp/servers?limit=20&sort=newest');
if (glamaMcp.ok && glamaMcp.json?.servers) {
  const recentServers = glamaMcp.json.servers.slice(0, 10);
  const stackKeywords = ['firebase', 'supabase', 'stripe', 'vercel', 'flutter',
    'nextjs', 'react', 'postgres', 'auth', 'payments'];
  const relevant = recentServers.filter(s =>
    stackKeywords.some(k =>
      (s.name + s.description).toLowerCase().includes(k)
    )
  );
  if (relevant.length > 0) {
    update('MCPs', 'low', `${relevant.length} new community MCP server(s) on glama.ai`,
      relevant.map(s => `${s.name}: ${s.description}`).join('\n'),
      'Review at https://glama.ai/mcp/servers — add relevant ones to TOOLING.md'
    );
  }
}

// ── 2. npm package version drift ─────────────────────────────────────────────
console.log(`\n${c.bold}Checking npm package versions...${c.reset}`);

const KEY_PACKAGES = {
  // Framework
  'next':              { currentMajor: 15, handbook: 'stacks/nextjs.md' },
  'astro':             { currentMajor: 5,  handbook: 'stacks/astro.md' },
  // Supabase
  '@supabase/supabase-js': { currentMajor: 2, handbook: 'stacks/supabase.md' },
  '@supabase/ssr':         { currentMajor: 0, handbook: 'stacks/supabase.md' },
  // Firebase / Google
  'firebase':              { currentMajor: 10, handbook: 'stacks/firebase.md' },
  'firebase-admin':        { currentMajor: 12, handbook: 'stacks/firebase.md' },
  '@google/generative-ai': { currentMajor: 0,  handbook: 'stacks/gemini.md' },
  '@google-cloud/vertexai':{ currentMajor: 1,  handbook: 'stacks/gemini.md' },
  '@google-cloud/secret-manager': { currentMajor: 5, handbook: 'stacks/google-cloud.md' },
  // Stripe
  'stripe':                { currentMajor: 16, handbook: 'stacks/stripe.md' },
  '@stripe/stripe-js':     { currentMajor: 4,  handbook: 'stacks/stripe.md' },
  // AI providers
  '@anthropic-ai/sdk':     { currentMajor: 0,  handbook: 'stacks/ai-providers.md' },
  'openai':                { currentMajor: 4,  handbook: 'stacks/ai-providers.md' },
  'ai':                    { currentMajor: 3,  handbook: 'stacks/ai-providers.md' },  // Vercel AI SDK
  '@ai-sdk/anthropic':     { currentMajor: 0,  handbook: 'stacks/ai-providers.md' },
  '@ai-sdk/openai':        { currentMajor: 0,  handbook: 'stacks/ai-providers.md' },
  '@ai-sdk/google':        { currentMajor: 0,  handbook: 'stacks/ai-providers.md' },
  // State/Data
  '@tanstack/react-query': { currentMajor: 5, handbook: 'TOOLING.md' },
  'zod':                   { currentMajor: 3, handbook: 'TOOLING.md' },
  // Build/Quality
  'vitest':                { currentMajor: 1, handbook: 'TOOLING.md' },
  'lefthook':              { currentMajor: 1, handbook: 'TOOLING.md' },
  '@playwright/test':      { currentMajor: 1, handbook: 'TOOLING.md' },
  // Vercel
  '@vercel/analytics':     { currentMajor: 1, handbook: 'stacks/vercel.md' },
  '@vercel/postgres':      { currentMajor: 0, handbook: 'stacks/vercel.md' },
  // Netlify
  '@netlify/functions':    { currentMajor: 2, handbook: 'stacks/netlify.md' },
};

for (const [pkg, { currentMajor, handbook }] of Object.entries(KEY_PACKAGES)) {
  const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
  if (!res.ok || !res.json?.version) continue;

  const latestVersion = res.json.version;
  const latestMajor   = parseInt(latestVersion.split('.')[0], 10);

  if (latestMajor > currentMajor) {
    warn(`${pkg}: new major v${latestMajor} (handbook references v${currentMajor})`);
    update('Packages', 'high', `${pkg} has a new major version`,
      `Handbook references: v${currentMajor}.x\nLatest: v${latestVersion}\nChangelog: ${res.json.homepage || res.json.repository?.url || 'check npm'}`,
      `Update ${handbook} to reference v${latestMajor}.x — check breaking changes first`
    );
  } else {
    ok(`${pkg} v${latestMajor}.x — current`);
  }

  await new Promise(r => setTimeout(r, 100)); // rate limit
}

// ── 3. IDE changelogs ─────────────────────────────────────────────────────────
console.log(`\n${c.bold}Checking IDE changelogs...${c.reset}`);

const IDE_SOURCES = [
  {
    name: 'Claude Code',
    url: 'https://docs.anthropic.com/claude-code/changelog',
    handbook: 'stacks/claude-code.md',
    keywords: ['AGENTS.md', 'MCP', 'slash command', 'permission', 'settings'],
  },
  {
    name: 'Cursor',
    url: 'https://changelog.cursor.com',
    handbook: 'stacks/claude-code.md',
    keywords: ['.cursorrules', 'MCP', 'rules', 'context'],
  },
  {
    name: 'Stripe API',
    url: 'https://stripe.com/docs/upgrades',
    handbook: 'stacks/stripe.md',
    keywords: ['breaking', 'deprecated', 'removed', 'required'],
  },
  {
    name: 'Supabase changelog',
    url: 'https://supabase.com/changelog',
    handbook: 'stacks/supabase.md',
    keywords: ['RLS', 'auth', 'storage', 'edge function', 'breaking', 'migration'],
  },
  {
    name: 'Vercel changelog',
    url: 'https://vercel.com/changelog',
    handbook: 'stacks/vercel.md',
    keywords: ['Fluid compute', 'Firewall', 'skew', 'environment', 'breaking', 'AI SDK', 'v0'],
  },
  {
    name: 'Netlify changelog',
    url: 'https://www.netlify.com/changelog',
    handbook: 'stacks/netlify.md',
    keywords: ['breaking', 'deprecated', 'edge function', 'build plugin', 'image CDN'],
  },
  {
    name: 'Anthropic API release notes',
    url: 'https://docs.anthropic.com/en/release-notes/api',
    handbook: 'stacks/ai-providers.md',
    keywords: ['new model', 'deprecated', 'breaking', 'tool use', 'context window', 'pricing'],
  },
  {
    name: 'Gemini API changelog',
    url: 'https://ai.google.dev/gemini-api/docs/changelog',
    handbook: 'stacks/gemini.md',
    keywords: ['new model', 'deprecated', 'breaking', 'context window', 'pricing', 'feature'],
  },
  {
    name: 'Vertex AI release notes',
    url: 'https://cloud.google.com/vertex-ai/docs/release-notes',
    handbook: 'stacks/gemini.md',
    keywords: ['breaking', 'deprecated', 'new feature', 'SDK', 'model'],
  },
  {
    name: 'Cloud Run release notes',
    url: 'https://cloud.google.com/run/docs/release-notes',
    handbook: 'stacks/google-cloud.md',
    keywords: ['breaking', 'deprecated', 'new feature', 'container', 'service account'],
  },
  {
    name: 'Firebase JS release notes',
    url: 'https://firebase.google.com/support/release-notes/js',
    handbook: 'stacks/firebase.md',
    keywords: ['breaking', 'deprecated', 'new', 'security rules', 'auth'],
  },
];

for (const source of IDE_SOURCES) {
  const res = await fetch(source.url);
  if (!res.ok) {
    info(`${source.name}: could not fetch changelog`);
    continue;
  }

  // Look for keywords in the last ~5000 chars (recent content)
  const recent = res.text.slice(0, 5000).toLowerCase();
  const hits   = source.keywords.filter(kw => recent.includes(kw.toLowerCase()));

  if (hits.length > 0) {
    warn(`${source.name}: recent changes mention: ${hits.join(', ')}`);
    update('IDEs & Changelogs', 'medium',
      `${source.name}: recent changelog mentions handbook-relevant terms`,
      `Keywords found: ${hits.join(', ')}\nSource: ${source.url}`,
      `Review ${source.url} manually and update ${source.handbook} if needed`
    );
  } else {
    ok(`${source.name}: no handbook-relevant changes detected`);
  }

  await new Promise(r => setTimeout(r, 200));
}

// ── 4. Security advisories ────────────────────────────────────────────────────
console.log(`\n${c.bold}Checking security advisories...${c.reset}`);

// GitHub Advisory Database — query for our key packages
const SECURITY_PACKAGES = ['next', 'firebase', '@supabase/supabase-js', 'stripe',
  '@firebase/app', 'astro', '@tanstack/react-query'];

const ghAdvisory = await fetch(
  'https://api.github.com/advisories?type=reviewed&ecosystem=npm&severity=high,critical&per_page=20',
);

if (ghAdvisory.ok && Array.isArray(ghAdvisory.json)) {
  for (const advisory of ghAdvisory.json) {
    const affectedPkgs = advisory.vulnerabilities?.map(v => v.package?.name) ?? [];
    const match = affectedPkgs.filter(p => SECURITY_PACKAGES.includes(p));

    if (match.length > 0) {
      warn(`Security: ${advisory.severity?.toUpperCase()} — ${match.join(', ')}: ${advisory.summary}`);
      update('Security', advisory.severity === 'critical' ? 'critical' : 'high',
        `${advisory.severity?.toUpperCase()} vulnerability in ${match.join(', ')}`,
        `${advisory.summary}\nCVSS: ${advisory.cvss?.score ?? 'N/A'}\nAdvisory: ${advisory.html_url}`,
        `Check if projects use affected version. Update immediately if affected.\nUpdate SECURITY.md if this changes recommended patterns.`
      );
    }
  }

  const ourPackageAdvisories = ghAdvisory.json.filter(a =>
    a.vulnerabilities?.some(v => SECURITY_PACKAGES.includes(v.package?.name))
  );

  if (ourPackageAdvisories.length === 0) {
    ok('No recent security advisories for our key packages');
  }
} else {
  info('Security advisories: GitHub API unavailable (may need auth token)');
}

// ── 5. AI provider model tracking ────────────────────────────────────────────
console.log(`\n${c.bold}Checking AI provider models...${c.reset}`);

// Anthropic models — fetch the models list page
const anthropicModels = await fetch('https://docs.anthropic.com/en/docs/about-claude/models');
if (anthropicModels.ok) {
  const content = anthropicModels.text.toLowerCase();
  // Look for model names newer than what we track
  const knownModels = ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4'];
  const hasNewModel = ['claude-4', 'claude-3-7', 'claude-3-6']
    .some(m => content.includes(m) && !knownModels.some(km => content.includes(km)));

  if (hasNewModel) {
    update('AI Models', 'high', 'New Claude model(s) detected',
      'New model names found in Anthropic docs that are not in the handbook',
      'Update stacks/ai-providers.md CLAUDE_MODELS and model selection guide\nFetch: https://docs.anthropic.com/en/docs/about-claude/models for details'
    );
    warn('New Claude model detected — update stacks/ai-providers.md');
  } else {
    ok('Claude models: current');
  }
}

// OpenAI models — check the models page
const openaiModels = await fetch('https://platform.openai.com/docs/models');
if (openaiModels.ok) {
  const content = openaiModels.text.toLowerCase();
  const newModelSignals = ['o3', 'gpt-5', 'o2'].filter(m => content.includes(m));
  if (newModelSignals.length > 0) {
    update('AI Models', 'high', `New OpenAI model signal: ${newModelSignals.join(', ')}`,
      `Terms found in OpenAI models page`,
      'Verify and update stacks/ai-providers.md OPENAI_MODELS\nFetch: https://platform.openai.com/docs/models'
    );
    warn(`OpenAI: possible new models: ${newModelSignals.join(', ')}`);
  } else {
    ok('OpenAI models: current');
  }
}

// Gemini models — check AI Studio
const geminiModels = await fetch('https://ai.google.dev/gemini-api/docs/models');
if (geminiModels.ok) {
  const content = geminiModels.text.toLowerCase();
  const newSignals = ['gemini-3', 'gemini-2.5', 'gemini-ultra'].filter(m => content.includes(m));
  if (newSignals.length > 0) {
    update('AI Models', 'high', `New Gemini model signal: ${newSignals.join(', ')}`,
      `Terms found in Gemini models page`,
      'Verify and update stacks/gemini.md models table\nFetch: https://ai.google.dev/gemini-api/docs/models'
    );
    warn(`Gemini: possible new models: ${newSignals.join(', ')}`);
  } else {
    ok('Gemini models: current');
  }
}
await new Promise(r => setTimeout(r, 200));

// ── 6. MCP protocol updates ───────────────────────────────────────────────────
console.log(`\n${c.bold}Checking MCP protocol specification...${c.reset}`);

const mcpSpec = await fetch('https://registry.npmjs.org/@modelcontextprotocol/sdk/latest');
if (mcpSpec.ok && mcpSpec.json?.version) {
  const latestSdkVersion = mcpSpec.json.version;
  const currentSdkMajor  = parseInt(latestSdkVersion, 10);
  ok(`MCP SDK latest: v${latestSdkVersion}`);

  // Check if our handbook's claude-code.md references an older version
  const claudeCodeContent = fs.existsSync(path.join(CWD, 'stacks/claude-code.md'))
    ? fs.readFileSync(path.join(CWD, 'stacks/claude-code.md'), 'utf8')
    : '';

  if (claudeCodeContent && !claudeCodeContent.includes(latestSdkVersion)) {
    update('MCPs', 'low', `MCP SDK v${latestSdkVersion} available`,
      `Check if new SDK version has new server types or breaking changes`,
      'Review https://github.com/modelcontextprotocol/typescript-sdk/releases'
    );
  }
}

// ── 6. Flutter/Dart (pub.dev) ─────────────────────────────────────────────────
console.log(`\n${c.bold}Checking Flutter packages...${c.reset}`);

const FLUTTER_PACKAGES = [
  { name: 'flutter_riverpod', currentMajor: 2 },
  { name: 'go_router',        currentMajor: 14 },
  { name: 'freezed',          currentMajor: 2 },
  { name: 'dio',              currentMajor: 5 },
];

for (const { name, currentMajor } of FLUTTER_PACKAGES) {
  const res = await fetch(`https://pub.dev/api/packages/${name}`);
  if (!res.ok || !res.json?.latest?.version) { info(`${name}: could not fetch`); continue; }

  const latest      = res.json.latest.version;
  const latestMajor = parseInt(latest.split('.')[0], 10);

  if (latestMajor > currentMajor) {
    warn(`${name}: new major v${latestMajor} (handbook references v${currentMajor})`);
    update('Flutter Packages', 'high', `${name} has a new major version`,
      `Handbook: v${currentMajor}.x — Latest: v${latest}`,
      `Update stacks/flutter.md to reference v${latestMajor} — check breaking changes`
    );
  } else {
    ok(`${name} v${latestMajor}.x — current`);
  }
  await new Promise(r => setTimeout(r, 100));
}

// ── 7. llms.txt standard ─────────────────────────────────────────────────────
console.log(`\n${c.bold}Checking llms.txt standard...${c.reset}`);

const llmsTxt = await fetch('https://llmstxt.org');
if (llmsTxt.ok) {
  const content = llmsTxt.text.toLowerCase();
  const newSections = ['llms-full', 'llms-ctx', 'format', 'fields'].filter(kw =>
    content.includes(kw)
  );
  if (newSections.length > 0) {
    update('SEO/AEO', 'low', 'llms.txt specification may have updates',
      `Relevant terms found: ${newSections.join(', ')}`,
      'Review https://llmstxt.org and update SEO_AEO.md if the spec has changed'
    );
  } else {
    ok('llms.txt: specification appears stable');
  }
}

// ── 8. Quarterly checks (run on Jan/Apr/Jul/Oct) ──────────────────────────────
const month = parseInt(TODAY.slice(5, 7), 10);
const isQuarterlyMonth = [1, 4, 7, 10].includes(month);

if (isQuarterlyMonth) {
  console.log(`\n${c.bold}Running quarterly checks (month ${month})...${c.reset}`);

  // 8a. AGENTS.md standard — check for spec updates
  const agentsMdSpec = await fetch('https://platform.openai.com/docs/codex/agents-md');
  if (agentsMdSpec.ok) {
    const content = agentsMdSpec.text.toLowerCase();
    const signals = ['new section', 'deprecated', 'breaking', 'version', 'precedence'].filter(
      kw => content.includes(kw)
    );
    if (signals.length > 0) {
      update('Standards', 'medium', 'AGENTS.md standard may have updates',
        `Signals found: ${signals.join(', ')}\nSource: https://platform.openai.com/docs/codex/agents-md`,
        'Review spec and compare against AGENTS_TEMPLATE.md for compliance\nSee HANDBOOK_UPDATE.md Part 2B item 15'
      );
      warn('AGENTS.md spec: signals detected — manual quarterly review recommended');
    } else {
      ok('AGENTS.md standard: no signals of change');
    }
  } else {
    info('AGENTS.md spec page: could not fetch');
  }
  await new Promise(r => setTimeout(r, 200));

  // 8b. zebbern/claude-code-guide — check for recent commits
  const zebbernCommits = await fetch(
    'https://api.github.com/repos/zebbern/claude-code-guide/commits?per_page=5',
    5000
  );
  if (zebbernCommits.ok && Array.isArray(zebbernCommits.json)) {
    const commits = zebbernCommits.json;
    const mostRecent = commits[0]?.commit?.author?.date;
    const daysSince = mostRecent
      ? Math.round((Date.now() - new Date(mostRecent).getTime()) / 86400000)
      : 999;

    if (daysSince < 90) {
      const messages = commits.slice(0, 3).map(c => c.commit.message.split('\n')[0]);
      update('Community', 'low', 'zebbern/claude-code-guide: recent commits',
        `Last commit: ${daysSince} days ago\nRecent: ${messages.join('; ')}`,
        'Review https://github.com/zebbern/claude-code-guide for new patterns\n' +
        'Apply cross-agent filter: universal patterns → claude-code.md or MULTI_AGENT.md\n' +
        'See HANDBOOK_UPDATE.md Part 2B item 17'
      );
      warn(`zebbern/claude-code-guide: ${daysSince} days since last commit — quarterly review recommended`);
    } else {
      ok(`zebbern/claude-code-guide: no recent commits (${daysSince} days)`);
    }
  } else {
    info('zebbern/claude-code-guide: GitHub API unavailable');
  }
  await new Promise(r => setTimeout(r, 200));

  // 8c. Anthropic MEMORY.md / agent hooks documentation
  const anthropicMemory = await fetch('https://docs.anthropic.com/claude-code/memory');
  if (anthropicMemory.ok) {
    const content = anthropicMemory.text.toLowerCase();
    const signals = ['memory.md', 'auto-memory', 'agent hooks', 'new', 'updated'].filter(
      kw => content.includes(kw)
    );
    if (signals.length > 2) {
      update('IDEs & Changelogs', 'medium', 'Anthropic MEMORY.md/hooks documentation has content',
        `Signals: ${signals.join(', ')}\nSource: https://docs.anthropic.com/claude-code/memory`,
        'Review memory documentation and update:\n' +
        '  stacks/claude-code.md (MEMORY.md section)\n' +
        '  configs/SCRATCHPAD_README.md (if behaviour changed)\n' +
        'See HANDBOOK_UPDATE.md Part 2B item 18'
      );
      warn('Anthropic memory docs: quarterly review recommended');
    } else {
      ok('Anthropic memory documentation: no significant signals');
    }
  } else {
    info('Anthropic memory docs: could not fetch');
  }

  update('Standards', 'low', 'Quarterly review due',
    `Month ${month} — quarterly checks completed`,
    'Run the full quarterly review prompt from HANDBOOK_UPDATE.md Part 2B\n' +
    'Items to review: AGENTS.md standard, Packmind, zebbern guide, Anthropic memory'
  );

  console.log(`\n  ${c.yellow}⚠${c.reset} Quarterly review month — run manual Part 2B checks from HANDBOOK_UPDATE.md`);
} else {
  console.log(`\n${c.dim}  Quarterly checks skipped (run in Jan/Apr/Jul/Oct)${c.reset}`);
}

// ── Generate report ───────────────────────────────────────────────────────────
console.log(`\n${c.bold}Generating report...${c.reset}`);

const counts = {
  critical: updates.filter(u => u.severity === 'critical').length,
  high:     updates.filter(u => u.severity === 'high').length,
  medium:   updates.filter(u => u.severity === 'medium').length,
  low:      updates.filter(u => u.severity === 'low').length,
};

const reportLines = [
  `# Handbook Update Report — ${MONTH}`,
  ``,
  `**Generated:** ${TODAY}`,
  `**Script:** scripts/handbook-update-agent.js`,
  ``,
  `## Summary`,
  ``,
  `| Severity | Count |`,
  `|----------|-------|`,
  `| 🔴 Critical | ${counts.critical} |`,
  `| 🟠 High | ${counts.high} |`,
  `| 🟡 Medium | ${counts.medium} |`,
  `| 🟢 Low | ${counts.low} |`,
  ``,
  updates.length === 0
    ? `**No updates needed this month. All sources current.**`
    : `**Action required: review findings below and update handbook files as indicated.**`,
  ``,
  `## Findings`,
  ``,
];

if (updates.length === 0) {
  reportLines.push('*All sources checked. Handbook is current.*');
} else {
  for (const { category, severity, title, detail, action } of updates) {
    const emoji = { critical:'🔴', high:'🟠', medium:'🟡', low:'🟢' }[severity] ?? '⚪';
    reportLines.push(`### ${emoji} [${severity.toUpperCase()}] ${category}: ${title}`);
    reportLines.push('');
    if (detail) {
      reportLines.push('**Detail:**');
      reportLines.push('```');
      reportLines.push(detail);
      reportLines.push('```');
    }
    reportLines.push(`**Action:** ${action}`);
    reportLines.push('');
  }
}

reportLines.push(
  `## Sources Checked`,
  ``,
  `**Monthly:**`,
  `- MCP Registry: https://registry.npmjs.org/-/org/modelcontextprotocol/package`,
  `- MCP Community: https://glama.ai/api/mcp/servers`,
  `- npm packages: registry.npmjs.org (${Object.keys(KEY_PACKAGES).length} packages)`,
  `- IDE changelogs: Claude Code, Cursor, Stripe, Supabase, Vercel, Netlify, Anthropic API, Gemini, Vertex AI, Cloud Run, Firebase`,
  `- AI model pages: Anthropic models, OpenAI models, Gemini models`,
  `- GitHub Advisories: api.github.com/advisories`,
  `- Flutter packages: pub.dev (${FLUTTER_PACKAGES.length} packages)`,
  `- llms.txt: llmstxt.org`,
  ``,
  `**Quarterly (Jan/Apr/Jul/Oct):**`,
  `- AGENTS.md standard: platform.openai.com/docs/codex/agents-md`,
  `- zebbern/claude-code-guide: api.github.com/repos/zebbern/claude-code-guide/commits`,
  `- Anthropic memory docs: docs.anthropic.com/claude-code/memory`,
  ``,
  `*Next monthly run: first Monday of ${new Date(TODAY).toLocaleString('en-GB', { month: 'long', year: 'numeric' })} (following month)*`,
  isQuarterlyMonth
    ? `*Next quarterly run: first Monday of ${['January','April','July','October'][[1,4,7,10].indexOf(month) === 3 ? 0 : [1,4,7,10].indexOf(month) + 1] ?? 'January'} (following quarter)*`
    : `*Next quarterly run: first Monday of ${['January','April','July','October'].find(m => [1,4,7,10][[0,1,2,3].find(i => [1,4,7,10][i] > month) ?? 0] !== undefined ? true : false) ?? 'January'}*`,
  ``,
  `*To run manually: \`node scripts/handbook-update-agent.js\`*`,
);

// Write outputs
fs.mkdirSync(OUT_DIR, { recursive: true });
const mdPath   = path.join(OUT_DIR, `${MONTH}.md`);
const jsonPath = path.join(OUT_DIR, `${MONTH}.json`);
fs.writeFileSync(mdPath, reportLines.join('\n'), 'utf8');
fs.writeFileSync(jsonPath, JSON.stringify({ date: TODAY, counts, updates }, null, 2), 'utf8');

// Print summary
console.log(`\n${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
console.log(`${c.bold}  Handbook Update — ${MONTH}${c.reset}`);
console.log(`${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
console.log(`  Critical: ${counts.critical > 0 ? c.red : c.dim}${counts.critical}${c.reset}`);
console.log(`  High:     ${counts.high > 0 ? c.yellow : c.dim}${counts.high}${c.reset}`);
console.log(`  Medium:   ${c.dim}${counts.medium}${c.reset}`);
console.log(`  Low:      ${c.dim}${counts.low}${c.reset}`);
console.log(`\n  Report: ${c.blue}${mdPath}${c.reset}\n`);

if (counts.critical > 0) process.exit(1);
if (counts.high + counts.medium > 0) process.exit(2);
process.exit(0);
