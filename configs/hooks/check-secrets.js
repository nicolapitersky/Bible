#!/usr/bin/env node
/**
 * configs/hooks/check-secrets.js
 * Template: copy to .claude/hooks/check-secrets.js in any project.
 * 
 * PreToolUse hook — blocks file writes containing known secret patterns.
 * Same patterns as retrofit-audit.js for consistency.
 * 
 * This is the ENFORCEMENT LAYER counterpart to the "never commit secrets"
 * rule in AGENTS.md. See ENVIRONMENTS.md — The Two Governance Layers.
 * 
 * Wire in .claude/settings.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Write|Edit|MultiEdit",
 *       "hooks": [{"type": "command", "command": "node .claude/hooks/check-secrets.js"}]
 *     }]
 *   }
 * }
 */

'use strict';
const fs = require('fs');

const SECRET_PATTERNS = [
  { pattern: /sk_live_[a-zA-Z0-9]{20,}/,         label: 'Stripe live secret key' },
  { pattern: /sk_test_[a-zA-Z0-9]{20,}/,         label: 'Stripe test secret key' },
  { pattern: /whsec_[a-zA-Z0-9]{20,}/,           label: 'Stripe webhook secret' },
  { pattern: /AIzaSy[a-zA-Z0-9_-]{33}/,          label: 'Google/Firebase API key' },
  { pattern: /service_role.*eyJ[a-zA-Z0-9]/,     label: 'Supabase service role key' },
  { pattern: /eyJhbGciOiJIUzI1NiJ9\.[a-zA-Z0-9]/, label: 'Supabase anon/service key (JWT)' },
  { pattern: /-----BEGIN (RSA )?PRIVATE KEY-----/, label: 'Private key material' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/,              label: 'GitHub personal access token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/,              label: 'GitHub OAuth token' },
  { pattern: /xoxb-[a-zA-Z0-9-]{50,}/,           label: 'Slack bot token' },
  { pattern: /PRIVATE_KEY.*-----BEGIN/s,          label: 'Firebase admin private key' },
];

async function main() {
  let input;
  try {
    const raw = fs.readFileSync('/dev/stdin', 'utf8');
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // Fail open
  }

  const content  = input?.tool_input?.new_contents ?? input?.tool_input?.content ?? '';
  const filePath = input?.tool_input?.path ?? '';

  // Always allow template/example files — they intentionally show structure
  if (filePath.endsWith('.env.example') || filePath.endsWith('.example')) {
    process.stdout.write(JSON.stringify({ allow: true }));
    return;
  }

  // Always allow the manifest (contains IDs, not secrets)
  if (filePath.endsWith('.env.manifest')) {
    process.stdout.write(JSON.stringify({ allow: true }));
    return;
  }

  const found = SECRET_PATTERNS.filter(({ pattern }) => pattern.test(content));

  if (found.length > 0) {
    process.stdout.write(JSON.stringify({
      deny: true,
      reason:
        `SECRETS PROTECTION: File write blocked.\n` +
        `Secret pattern(s) detected in: ${filePath || '(unknown file)'}\n\n` +
        found.map(f => `  - ${f.label}`).join('\n') + '\n\n' +
        `Secrets must never be written to source files.\n` +
        `Store in: Secret Manager (production), .env.local (local dev, gitignored).\n` +
        `Reference via: process.env.VARIABLE_NAME\n` +
        `If this is test/mock data, use obviously-fake values (e.g. sk_test_FAKE_KEY_FOR_TESTS).`,
    }));
    return;
  }

  process.stdout.write(JSON.stringify({ allow: true }));
}

main().catch(() => process.exit(0)); // Always fail open on unexpected errors
