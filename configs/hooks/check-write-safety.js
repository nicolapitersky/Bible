#!/usr/bin/env node
/**
 * configs/hooks/check-write-safety.js
 * Template: copy to .claude/hooks/check-write-safety.js in any project.
 * 
 * PreToolUse hook — blocks file writes containing hardcoded environment IDs.
 * Cross-references .env.manifest for this project's known resource IDs.
 * 
 * This is the ENFORCEMENT LAYER counterpart to the "never hardcode env IDs"
 * rule in AGENTS.md. See ENVIRONMENTS.md — The Two Governance Layers.
 * 
 * Wire in .claude/settings.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Write|Edit|MultiEdit",
 *       "hooks": [{"type": "command", "command": "node .claude/hooks/check-write-safety.js"}]
 *     }]
 *   }
 * }
 */

'use strict';
const fs   = require('fs');
const path = require('path');

async function main() {
  let input;
  try {
    const raw = fs.readFileSync('/dev/stdin', 'utf8');
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // Cannot parse input — fail open
  }

  const content  = input?.tool_input?.new_contents ?? input?.tool_input?.content ?? '';
  const filePath = input?.tool_input?.path ?? input?.tool_input?.file_path ?? '';

  // Skip non-source files
  if (isNonSourceFile(filePath)) {
    process.stdout.write(JSON.stringify({ allow: true }));
    return;
  }

  // Load .env.manifest
  const manifestPath = path.join(process.cwd(), '.env.manifest');
  if (!fs.existsSync(manifestPath)) {
    process.exit(0); // No manifest — cannot check, allow
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    process.exit(0); // Cannot parse manifest — allow
  }

  const knownIds = extractIds(manifest);
  if (knownIds.length === 0) {
    process.stdout.write(JSON.stringify({ allow: true }));
    return;
  }

  const violations = knownIds.filter(id =>
    id.length > 6 &&
    content.includes(id) &&
    !isSafeUsage(content, id)
  );

  if (violations.length > 0) {
    process.stdout.write(JSON.stringify({
      deny: true,
      reason:
        `ENVIRONMENT ID PROTECTION: File write blocked.\n` +
        `Hardcoded environment ID(s) detected in: ${filePath}\n\n` +
        violations.map(id => `  "${id}"`).join('\n') + '\n\n' +
        `These IDs must come from environment variables, not be hardcoded.\n` +
        `Use process.env.VARIABLE_NAME or reference .env.manifest.\n` +
        `If this is an intentional reference, use an env var wrapper.`,
    }));
    return;
  }

  process.stdout.write(JSON.stringify({ allow: true }));
}

function extractIds(obj, ids = []) {
  if (typeof obj === 'string' && obj.length > 6) {
    // Skip metadata fields and common non-ID strings
    const skip = ['handbook', 'version', 'github.com', 'http', 'https', 'europe', 'us-'];
    if (!skip.some(s => obj.toLowerCase().includes(s))) {
      ids.push(obj);
    }
  } else if (obj && typeof obj === 'object') {
    const { _meta, ...rest } = obj;
    Object.values(rest).forEach(v => extractIds(v, ids));
  }
  return [...new Set(ids)]; // Deduplicate
}

function isSafeUsage(content, id) {
  // Allow: process.env.VAR, env.VAR, ${VARIABLE}, import.meta.env.VAR
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`process\\.env\\.[A-Z_0-9]+`),
    new RegExp(`import\\.meta\\.env\\.[A-Z_0-9]+`),
    new RegExp(`\\$\\{[A-Z_0-9]+\\}`),
    new RegExp(`env\\.[A-Z_0-9]+`),
  ].some(p => {
    // Check if the ID appears within 100 chars of a safe pattern
    const matches = [...content.matchAll(new RegExp(escaped, 'g'))];
    return matches.some(m => {
      const context = content.slice(Math.max(0, m.index - 50), m.index + 50);
      return p.test(context);
    });
  });
}

function isNonSourceFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const nonSource = ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.lock'];
  // Allow .env.example (template files intentionally have placeholder values)
  if (filePath.endsWith('.env.example')) return true;
  // Allow .env.manifest itself
  if (filePath.endsWith('.env.manifest')) return true;
  return false; // Check all source files
}

main().catch(() => process.exit(0)); // Always fail open on unexpected errors
