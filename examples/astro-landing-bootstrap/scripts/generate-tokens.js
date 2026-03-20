#!/usr/bin/env node
/**
 * generate-tokens.js
 * Converts design-tokens/tokens.json → design-tokens/tokens.css
 *                                    → design-tokens/tokens.ts (TypeScript constants)
 *
 * Run: node scripts/generate-tokens.js
 * Run automatically: added to package.json "prebuild" hook
 *
 * The CSS output uses custom properties consumed by Tailwind and component styles.
 * The TS output provides type-safe token references for runtime use.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const tokensPath = path.join(process.cwd(), 'design-tokens', 'tokens.json');
const cssOut     = path.join(process.cwd(), 'design-tokens', 'tokens.css');
const tsOut      = path.join(process.cwd(), 'design-tokens', 'tokens.ts');

if (!fs.existsSync(tokensPath)) {
  console.error('✗ design-tokens/tokens.json not found');
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

// ── CSS Generator ─────────────────────────────────────────────────────────────
const cssLines = [
  '/* design-tokens/tokens.css',
  ' * AUTO-GENERATED — do not edit.',
  ' * Source: design-tokens/tokens.json',
  ` * Generated: ${new Date().toISOString()}`,
  ' *',
  ' * Import once in your root layout:',
  ' *   import \'../design-tokens/tokens.css\';',
  ' */',
  '',
  ':root {',
];

const darkLines = [
  '',
  '[data-theme="dark"] {',
];

function kebab(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function flattenTokens(obj, prefix = '') {
  const result = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === '_meta') continue;
    const varName = prefix ? `${prefix}-${key}` : key;
    if (val && typeof val === 'object' && 'value' in val) {
      result.push({ name: varName, value: val.value, description: val.description });
    } else if (val && typeof val === 'object') {
      result.push(...flattenTokens(val, varName));
    }
  }
  return result;
}

// Light mode tokens (everything except color-dark)
const lightTokens = {};
for (const [k, v] of Object.entries(tokens)) {
  if (k !== 'color-dark' && k !== '_meta') lightTokens[k] = v;
}

const flat = flattenTokens(lightTokens);
for (const { name, value, description } of flat) {
  if (description) cssLines.push(`  /* ${description} */`);
  cssLines.push(`  --${name}: ${value};`);
}
cssLines.push('}');

// Dark mode overrides
if (tokens['color-dark']) {
  const darkFlat = flattenTokens(tokens['color-dark'], 'color');
  for (const { name, value } of darkFlat) {
    darkLines.push(`  --${name}: ${value};`);
  }
  darkLines.push('}');
  cssLines.push(...darkLines);
}

// Responsive font sizes
cssLines.push('', '/* Responsive typography */', '@media (max-width: 640px) {', '  :root {');
const mobileFontOverrides = [
  ['--typography-font-size-4xl', '2rem'],
  ['--typography-font-size-5xl', '2.5rem'],
  ['--typography-font-size-6xl', '3rem'],
];
for (const [k, v] of mobileFontOverrides) {
  cssLines.push(`    ${k}: ${v};`);
}
cssLines.push('  }', '}');

// Reduced motion
cssLines.push(
  '',
  '/* Reduced motion */',
  '@media (prefers-reduced-motion: reduce) {',
  '  :root {',
  '    --animation-duration-fast: 0ms;',
  '    --animation-duration-normal: 0ms;',
  '    --animation-duration-slow: 0ms;',
  '    --animation-duration-slower: 0ms;',
  '  }',
  '}'
);

fs.writeFileSync(cssOut, cssLines.join('\n'), 'utf8');
console.log('✓ design-tokens/tokens.css generated');

// ── TypeScript Generator ──────────────────────────────────────────────────────
const tsLines = [
  '/**',
  ' * design-tokens/tokens.ts',
  ' * AUTO-GENERATED — do not edit.',
  ' * Source: design-tokens/tokens.json',
  ` * Generated: ${new Date().toISOString()}`,
  ' */',
  '',
  '// Use these constants for runtime token access (animations, JS calculations)',
  '// For CSS: use var(--token-name) instead',
  '',
  'export const tokens = {',
];

function buildTsObj(obj, indent = 2) {
  const lines = [];
  const pad = ' '.repeat(indent);
  for (const [key, val] of Object.entries(obj)) {
    if (key === '_meta') continue;
    if (val && typeof val === 'object' && 'value' in val) {
      const jsKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      lines.push(`${pad}${jsKey}: '${val.value}',`);
    } else if (val && typeof val === 'object') {
      const jsKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      lines.push(`${pad}${jsKey}: {`);
      lines.push(...buildTsObj(val, indent + 2));
      lines.push(`${pad}},`);
    }
  }
  return lines;
}

tsLines.push(...buildTsObj(lightTokens));
tsLines.push('} as const;', '', 'export type Tokens = typeof tokens;');

fs.writeFileSync(tsOut, tsLines.join('\n'), 'utf8');
console.log('✓ design-tokens/tokens.ts generated');

console.log('\nDone. Import tokens.css in your root layout.');
console.log('Use var(--color-brand-primary) in CSS.');
console.log('Use tokens.animation.duration.fast in JS/TS.');
