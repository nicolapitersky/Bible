#!/usr/bin/env node
/**
 * generate-tokens.js
 * Converts design-tokens/tokens.json →
 *   design-tokens/tokens.css   (CSS custom properties for web)
 *   design-tokens/tokens.ts    (TypeScript constants for runtime)
 *   design-tokens/theme.dart   (Flutter ThemeData — if pubspec.yaml present)
 *
 * Run: node scripts/generate-tokens.js
 * Auto-runs: added to package.json "prebuild" hook by bootstrap
 *
 * Stack-aware: detects Flutter vs web from presence of pubspec.yaml
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const CWD        = process.cwd();
const TOKENS_SRC = path.join(CWD, 'design-tokens', 'tokens.json');
const CSS_OUT    = path.join(CWD, 'design-tokens', 'tokens.css');
const TS_OUT     = path.join(CWD, 'design-tokens', 'tokens.ts');
const DART_OUT   = path.join(CWD, 'design-tokens', 'theme.dart');

const IS_FLUTTER = fs.existsSync(path.join(CWD, 'pubspec.yaml'));

if (!fs.existsSync(TOKENS_SRC)) {
  console.error('✗ design-tokens/tokens.json not found');
  console.error('  Run the handbook bootstrap to generate it, or create it manually.');
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(TOKENS_SRC, 'utf8'));
const generated = `AUTO-GENERATED — do not edit.\nSource: design-tokens/tokens.json\nGenerated: ${new Date().toISOString()}\nEdit tokens.json and re-run: node scripts/generate-tokens.js`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const name = prefix ? `${prefix}-${k}` : k;
    if (v && typeof v === 'object' && 'value' in v) {
      out.push({ name, value: String(v.value), description: v.description });
    } else if (v && typeof v === 'object') {
      out.push(...flatten(v, name));
    }
  }
  return out;
}

function toCamel(str) {
  return str.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function toFlutterName(str) {
  // colour-brand-primary → colorBrandPrimary
  return toCamel(str.replace(/^colour/, 'color'));
}

// ── CSS output ────────────────────────────────────────────────────────────────
const lightTokens = Object.fromEntries(
  Object.entries(tokens).filter(([k]) => k !== 'color-dark' && k !== '_meta')
);
const darkTokens  = tokens['color-dark'] ?? null;

const cssLines = [
  `/* design-tokens/tokens.css`,
  ` * ${generated.split('\n').join('\n * ')}`,
  ` *`,
  ` * Usage: import once in your root layout.`,
  ` * CSS:   color: var(--color-brand-primary);`,
  ` */`,
  '',
  ':root {',
];

for (const { name, value, description } of flatten(lightTokens)) {
  if (description) cssLines.push(`  /* ${description} */`);
  cssLines.push(`  --${name}: ${value};`);
}
cssLines.push('}');

if (darkTokens) {
  cssLines.push('', '[data-theme="dark"] {');
  for (const { name, value } of flatten(darkTokens, 'color')) {
    cssLines.push(`  --${name}: ${value};`);
  }
  cssLines.push('}');
}

// Responsive font overrides
cssLines.push(
  '',
  '/* Responsive — smaller display type on mobile */',
  '@media (max-width: 640px) {',
  '  :root {',
);
const responsiveOverrides = flatten(lightTokens)
  .filter(t => t.name.includes('font-size') && ['4xl','5xl','6xl'].some(s => t.name.endsWith(s)));
for (const { name, value } of responsiveOverrides) {
  const px = parseFloat(value) * 16;
  const mobilePx = Math.round(px * 0.78);
  cssLines.push(`    --${name}: ${mobilePx / 16}rem; /* ${px}px → ${mobilePx}px */`);
}
cssLines.push('  }', '}');

// Reduced motion
cssLines.push(
  '',
  '@media (prefers-reduced-motion: reduce) {',
  '  :root {',
  '    --animation-duration-instant: 0ms;',
  '    --animation-duration-fast: 0ms;',
  '    --animation-duration-normal: 0ms;',
  '    --animation-duration-slow: 0ms;',
  '    --animation-duration-slower: 0ms;',
  '  }',
  '}',
);

fs.writeFileSync(CSS_OUT, cssLines.join('\n'), 'utf8');
console.log(`✓ design-tokens/tokens.css  (${cssLines.length} lines)`);

// ── TypeScript output ─────────────────────────────────────────────────────────
function buildTsObj(obj, indent = 2) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const jsKey = toCamel(k);
    if (v && typeof v === 'object' && 'value' in v) {
      const comment = v.description ? ` // ${v.description}` : '';
      lines.push(`${pad}${jsKey}: '${v.value}',${comment}`);
    } else if (v && typeof v === 'object') {
      lines.push(`${pad}${jsKey}: {`);
      lines.push(...buildTsObj(v, indent + 2));
      lines.push(`${pad}},`);
    }
  }
  return lines;
}

const tsLines = [
  `/**`,
  ` * design-tokens/tokens.ts`,
  ` * ${generated.split('\n').join('\n * ')}`,
  ` *`,
  ` * Usage (runtime):  import { tokens } from '@tokens/tokens';`,
  ` * Usage (CSS):      prefer var(--token-name) over JS constants`,
  ` */`,
  '',
  'export const tokens = {',
  ...buildTsObj(lightTokens),
  '} as const;',
  '',
  'export type TokenPath = keyof typeof tokens;',
  'export type Tokens = typeof tokens;',
];

fs.writeFileSync(TS_OUT, tsLines.join('\n'), 'utf8');
console.log(`✓ design-tokens/tokens.ts   (${tsLines.length} lines)`);

// ── Dart/Flutter output ───────────────────────────────────────────────────────
if (IS_FLUTTER) {
  const dartLines = [
    `// design_tokens/theme.dart`,
    `// ${generated.split('\n').join('\n// ')}`,
    `//`,
    `// Usage: AppTokens.colorBrandPrimary`,
    `//        Theme.of(context).colorScheme.primary`,
    '',
    `import 'package:flutter/material.dart';`,
    '',
    `abstract class AppTokens {`,
  ];

  for (const { name, value } of flatten(lightTokens)) {
    const dartName = toFlutterName(name);
    // Convert CSS values to Dart equivalents
    if (value.startsWith('#')) {
      const hex = value.replace('#', '');
      const full = hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex;
      dartLines.push(`  static const Color ${dartName} = Color(0xFF${full.toUpperCase()});`);
    } else if (value.endsWith('px')) {
      dartLines.push(`  static const double ${dartName} = ${parseFloat(value)};`);
    } else if (value.endsWith('rem')) {
      dartLines.push(`  static const double ${dartName} = ${parseFloat(value) * 16};`);
    } else if (value.endsWith('ms')) {
      dartLines.push(`  static const Duration ${dartName} = Duration(milliseconds: ${parseInt(value)});`);
    } else if (!isNaN(Number(value))) {
      dartLines.push(`  static const double ${dartName} = ${value};`);
    } else {
      dartLines.push(`  // ${dartName}: '${value}' (not converted — use directly)`);
    }
  }

  dartLines.push(
    '}',
    '',
    '/// Build the app ThemeData from tokens.',
    '/// Usage: MaterialApp(theme: buildAppTheme(isDark: false))',
    'ThemeData buildAppTheme({required bool isDark}) {',
    '  return ThemeData(',
    '    colorScheme: ColorScheme.fromSeed(',
    '      seedColor: AppTokens.colorBrandPrimary,',
    '      brightness: isDark ? Brightness.dark : Brightness.light,',
    '    ),',
    '    useMaterial3: true,',
    '    textTheme: TextTheme(',
    '      bodyMedium: TextStyle(fontSize: AppTokens.typographyFontSizeBase, height: 1.5),',
    '      bodySmall:  TextStyle(fontSize: AppTokens.typographyFontSizeSm),',
    '      titleMedium: TextStyle(fontSize: AppTokens.typographyFontSizeXl, fontWeight: FontWeight.w500),',
    '      titleLarge:  TextStyle(fontSize: AppTokens.typographyFontSize2xl, fontWeight: FontWeight.w600),',
    '      headlineMedium: TextStyle(fontSize: AppTokens.typographyFontSize3xl, fontWeight: FontWeight.w700),',
    '    ),',
    '  );',
    '}',
  );

  fs.writeFileSync(DART_OUT, dartLines.join('\n'), 'utf8');
  console.log(`✓ design-tokens/theme.dart  (${dartLines.length} lines)`);
}

console.log(`\nDone. ${IS_FLUTTER ? 3 : 2} files generated.`);
