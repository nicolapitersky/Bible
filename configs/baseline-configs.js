// ═══════════════════════════════════════════════════════════════════════════
// prettier.config.js
// Copy to project root. Do not modify values without an ADR.
// ═══════════════════════════════════════════════════════════════════════════

/** @type {import('prettier').Config} */
const prettierConfig = {
  // Formatting
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',

  // File overrides
  overrides: [
    {
      files: ['*.json', '*.jsonc'],
      options: { printWidth: 80 },
    },
    {
      files: ['*.md', '*.mdx'],
      options: { printWidth: 80, proseWrap: 'always' },
    },
    {
      files: ['*.yaml', '*.yml'],
      options: { singleQuote: false },
    },
  ],
};

module.exports = prettierConfig;


// ═══════════════════════════════════════════════════════════════════════════
// tsconfig.json (base — extends per stack)
// Copy to project root and adjust paths as needed.
// ═══════════════════════════════════════════════════════════════════════════
/*
{
  "compilerOptions": {
    // ── Language & Runtime ──────────────────────────────────────────────
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",

    // ── Strictness (all enabled — no exceptions) ────────────────────────
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    // ── Additional strictness ───────────────────────────────────────────
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    // ── Module resolution ───────────────────────────────────────────────
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,

    // ── Path aliases (adjust per project) ──────────────────────────────
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@tokens/*": ["./design-tokens/*"]
    },

    // ── Output ─────────────────────────────────────────────────────────
    "skipLibCheck": true,
    "noEmit": true,
    "incremental": true
  },
  "include": ["src/**/*", "design-tokens/**/*"],
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
*/


// ═══════════════════════════════════════════════════════════════════════════
// lefthook.yml
// Git hooks configuration. Copy to project root.
// Install: pnpm add -D @arkwaid/lefthook && lefthook install
// ═══════════════════════════════════════════════════════════════════════════
/*
pre-commit:
  parallel: true
  commands:
    typecheck:
      run: pnpm type-check
      
    lint-staged:
      glob: "*.{js,ts,jsx,tsx}"
      run: pnpm eslint {staged_files} --max-warnings=0 --cache
      
    format-check:
      glob: "*.{js,ts,jsx,tsx,json,css,md,yaml,yml}"
      run: pnpm prettier --check {staged_files}
      
    secrets-scan:
      run: |
        if command -v gitleaks &> /dev/null; then
          gitleaks protect --staged --redact --quiet
        else
          echo "⚠ gitleaks not installed. Install: brew install gitleaks"
        fi
        
    env-manifest:
      run: node scripts/verify-env.js local

commit-msg:
  commands:
    conventional-commit:
      run: |
        MSG=$(cat {1})
        PATTERN="^(feat|fix|style|refactor|test|docs|chore|security|perf|ci)(\(.+\))?: .{1,100}$"
        if ! echo "$MSG" | grep -qE "$PATTERN"; then
          echo ""
          echo "  ✗ Invalid commit message format"
          echo ""
          echo "  Expected format: type(scope): description"
          echo "  Types: feat | fix | style | refactor | test | docs | chore | security | perf | ci"
          echo ""
          echo "  Examples:"
          echo "    feat(auth): add Google OAuth sign-in"
          echo "    fix(checkout): correct Stripe webhook signature validation"
          echo "    security(api): add rate limiting to auth endpoints"
          echo ""
          exit 1
        fi

pre-push:
  commands:
    unit-tests:
      run: pnpm test:unit --passWithNoTests
      
    build-check:
      run: pnpm build 2>&1 | tail -5
*/


// ═══════════════════════════════════════════════════════════════════════════
// .nvmrc
// Node version lock. Always commit this.
// ═══════════════════════════════════════════════════════════════════════════
/*
22.14.0
*/


// ═══════════════════════════════════════════════════════════════════════════
// knip.json — Dead code detection
// ═══════════════════════════════════════════════════════════════════════════
/*
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/app/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "src/**/*.test.{ts,tsx}",
    "src/**/*.stories.{ts,tsx}",
    "design-tokens/**"
  ],
  "ignoreDependencies": [
    "typescript",
    "@types/*"
  ]
}
*/


// ═══════════════════════════════════════════════════════════════════════════
// .gitignore (comprehensive — copy to project root)
// ═══════════════════════════════════════════════════════════════════════════
/*
# ── Dependencies ──────────────────────────────────────────────────────────
node_modules/
.pnp
.pnp.js

# ── Build outputs ──────────────────────────────────────────────────────────
dist/
build/
.next/
.nuxt/
.output/
out/
.svelte-kit/

# ── Environment & Secrets (NEVER COMMIT THESE) ─────────────────────────────
.env
.env.local
.env.development.local
.env.test.local
.env.staging
.env.staging.local
.env.production
.env.production.local

# Service account keys and credentials
serviceAccountKey.json
firebase-adminsdk-*.json
google-services.json.secret
*-service-account.json
*.pem
*.key

# ── These ARE committed ────────────────────────────────────────────────────
# .env.example      ← empty template
# .env.manifest     ← resource IDs, no secrets
# google-services.json  ← NOT a secret for Flutter (Firebase app config)

# ── Testing & Coverage ─────────────────────────────────────────────────────
coverage/
.nyc_output/
playwright-report/
test-results/

# ── Cache ──────────────────────────────────────────────────────────────────
.cache/
.eslintcache
.tsbuildinfo
*.tsbuildinfo

# ── IDE ────────────────────────────────────────────────────────────────────
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
*.swp
*.swo
.DS_Store
Thumbs.db

# ── Logs ───────────────────────────────────────────────────────────────────
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# ── Flutter ────────────────────────────────────────────────────────────────
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
*.iml
/build/
.packages

# ── Misc ───────────────────────────────────────────────────────────────────
*.zip
.turbo/
emulator-data/
*/
