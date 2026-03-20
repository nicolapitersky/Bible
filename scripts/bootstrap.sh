#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# bootstrap.sh — Complete Development Handbook Bootstrap
# https://github.com/nicolapitersky/Bible
#
# USAGE:
#   curl -sSL https://raw.githubusercontent.com/nicolapitersky/Bible/main/scripts/bootstrap.sh | bash
#
# OR clone first and run:
#   git clone https://github.com/nicolapitersky/Bible.git /tmp/handbook
#   bash /tmp/handbook/scripts/bootstrap.sh
#
# WHAT THIS DOES:
#   1. Clones the handbook to /tmp/handbook
#   2. Detects your AI IDE (Claude Code, Cursor, Windsurf, Firebase Studio)
#   3. Prints the correct bootstrap prompt to paste into your agent
#   4. Optionally copies config files into the current directory
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

HANDBOOK_REPO="https://github.com/nicolapitersky/Bible.git"
HANDBOOK_DIR="/tmp/handbook"
HANDBOOK_VERSION=$(date +"%Y.%m")   # Updated by git tag in CI

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Complete Development Handbook — Bootstrap${RESET}"
echo -e "${DIM}  github.com/nicolapitersky/Bible${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Step 1: Clone or update handbook ─────────────────────────────────────────
if [ -d "$HANDBOOK_DIR/.git" ]; then
  echo -e "${BLUE}→${RESET} Updating handbook..."
  git -C "$HANDBOOK_DIR" pull --quiet origin main
  echo -e "${GREEN}✓${RESET} Handbook updated"
else
  echo -e "${BLUE}→${RESET} Cloning handbook..."
  git clone --quiet "$HANDBOOK_REPO" "$HANDBOOK_DIR"
  echo -e "${GREEN}✓${RESET} Handbook cloned to $HANDBOOK_DIR"
fi

HANDBOOK_COMMIT=$(git -C "$HANDBOOK_DIR" rev-parse --short HEAD)
echo -e "${DIM}  Commit: $HANDBOOK_COMMIT${RESET}"
echo ""

# ── Step 2: Detect current project context ────────────────────────────────────
CURRENT_DIR=$(pwd)
PROJECT_NAME=$(basename "$CURRENT_DIR")
IS_GIT_REPO=false
HAS_PACKAGE_JSON=false
HAS_PUBSPEC=false
HAS_NEXT_CONFIG=false
HAS_ASTRO_CONFIG=false
HAS_FLUTTER=false

[ -d ".git" ]                       && IS_GIT_REPO=true
[ -f "package.json" ]               && HAS_PACKAGE_JSON=true
[ -f "pubspec.yaml" ]               && HAS_PUBSPEC=true
[ -f "next.config.js" ] || [ -f "next.config.ts" ] && HAS_NEXT_CONFIG=true
[ -f "astro.config.mjs" ] || [ -f "astro.config.ts" ] && HAS_ASTRO_CONFIG=true
[ -f "pubspec.yaml" ]               && HAS_FLUTTER=true

echo -e "${BOLD}Project Context${RESET}"
echo -e "  Directory: ${BOLD}$CURRENT_DIR${RESET}"
echo -e "  Name:      ${BOLD}$PROJECT_NAME${RESET}"
echo -e "  Git repo:  $( $IS_GIT_REPO && echo "${GREEN}yes${RESET}" || echo "${YELLOW}no — run git init first${RESET}" )"

DETECTED_STACK="unknown"
if $HAS_NEXT_CONFIG; then
  DETECTED_STACK="nextjs"
  echo -e "  Stack:     ${GREEN}Next.js detected${RESET}"
elif $HAS_ASTRO_CONFIG; then
  DETECTED_STACK="astro"
  echo -e "  Stack:     ${GREEN}Astro detected${RESET}"
elif $HAS_FLUTTER; then
  DETECTED_STACK="flutter"
  echo -e "  Stack:     ${GREEN}Flutter detected${RESET}"
elif $HAS_PACKAGE_JSON; then
  DETECTED_STACK="node"
  echo -e "  Stack:     ${YELLOW}Node.js (no framework detected)${RESET}"
else
  echo -e "  Stack:     ${YELLOW}Not detected — bootstrap will ask${RESET}"
fi

echo ""

# ── Step 3: Detect AI IDE ─────────────────────────────────────────────────────
echo -e "${BOLD}Detecting AI IDE...${RESET}"

IDE="unknown"

# Check for Claude Code
if command -v claude &> /dev/null; then
  IDE="claude-code"
  echo -e "  ${GREEN}✓ Claude Code detected${RESET}"
fi

# Check for Cursor
if [ -d "$HOME/.cursor" ] || [ -d "/Applications/Cursor.app" ]; then
  IDE="cursor"
  echo -e "  ${GREEN}✓ Cursor detected${RESET}"
fi

# Check for Windsurf
if [ -d "$HOME/.codeium" ] || command -v windsurf &> /dev/null; then
  IDE="windsurf"
  echo -e "  ${GREEN}✓ Windsurf detected${RESET}"
fi

if [ "$IDE" = "unknown" ]; then
  echo -e "  ${YELLOW}⚠ No IDE auto-detected${RESET}"
  echo ""
  echo "  Which AI IDE are you using?"
  echo "  1) Claude Code"
  echo "  2) Cursor"
  echo "  3) Windsurf"
  echo "  4) Firebase Studio"
  echo "  5) OpenAI Codex"
  echo "  6) Multiple / Other"
  echo ""
  read -r -p "  Enter number [1-6]: " IDE_CHOICE
  case $IDE_CHOICE in
    1) IDE="claude-code" ;;
    2) IDE="cursor" ;;
    3) IDE="windsurf" ;;
    4) IDE="firebase-studio" ;;
    5) IDE="codex" ;;
    *) IDE="other" ;;
  esac
fi

echo ""

# ── Step 4: Copy config files ─────────────────────────────────────────────────
echo -e "${BOLD}Setting up project files...${RESET}"

# Always copy verify-env.js
mkdir -p scripts
cp "$HANDBOOK_DIR/scripts/verify-env.js" scripts/verify-env.js
echo -e "  ${GREEN}✓${RESET} scripts/verify-env.js"

# Copy .env.example if not present
if [ ! -f ".env.example" ]; then
  cat > .env.example << 'EOF'
# Environment variables — copy to .env.local and fill in values
# NEVER commit .env.local

NODE_ENV=
NEXT_PUBLIC_ENV=

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF
  echo -e "  ${GREEN}✓${RESET} .env.example created"
else
  echo -e "  ${DIM}·${RESET} .env.example already exists — skipped"
fi

# Add docs structure
mkdir -p docs/adr
if [ ! -f "docs/TECH_DEBT.md" ]; then
  printf "# Tech Debt Log\n\n## Active Items\n\n_(none yet — this is a good sign)_\n\n## Resolved Items\n" \
    > docs/TECH_DEBT.md
  echo -e "  ${GREEN}✓${RESET} docs/TECH_DEBT.md"
fi

if [ ! -f "docs/adr/ADR-000-template.md" ]; then
  cp "$HANDBOOK_DIR/configs/adr-template.md" docs/adr/ADR-000-template.md 2>/dev/null || \
  cat > docs/adr/ADR-000-template.md << 'EOF'
# ADR-{{NUMBER}} — {{Title}}

**Date:** {{DATE}}
**Status:** Proposed | Accepted | Superseded | Deprecated

## Context
[What situation requires this decision?]

## Decision
[What was decided? Be direct.]

## Consequences
**Positive:** [What improves?]
**Negative:** [What trade-offs?]

## Alternatives Considered
[What else was evaluated and why rejected?]
EOF
  echo -e "  ${GREEN}✓${RESET} docs/adr/ADR-000-template.md"
fi

if [ ! -f "docs/AGENT_HANDOFF.md" ]; then
  printf "# Agent Handoff Log\n\n_No handoffs yet. See MULTI_AGENT.md for format._\n" \
    > docs/AGENT_HANDOFF.md
  echo -e "  ${GREEN}✓${RESET} docs/AGENT_HANDOFF.md"
fi

# IDE-specific rule files
case $IDE in
  cursor|windsurf)
    node "$HANDBOOK_DIR/scripts/generate-ide-rules.js" \
      --ide="$IDE" \
      --handbook="$HANDBOOK_DIR" \
      --out="." 2>/dev/null || \
    echo -e "  ${YELLOW}⚠${RESET} IDE rules: run generate-ide-rules.js after bootstrap"
    ;;
  claude-code)
    echo -e "  ${DIM}·${RESET} Claude Code reads AGENTS.md directly — no extra file needed"
    ;;
  codex)
    echo -e "  ${GREEN}✓${RESET} Generating .codex/setup.sh for OpenAI Codex..."
    mkdir -p .codex
    cat > .codex/setup.sh << CODEX_SETUP
#!/usr/bin/env bash
# Codex sandbox setup script — generated by Complete Development Handbook
# Copy this file's contents into:
# OpenAI Platform → Codex → Environments → ${PROJECT_NAME} → Setup script

set -e

echo "Setting up ${PROJECT_NAME} Codex environment..."
pnpm install --frozen-lockfile
node scripts/verify-env.js local 2>/dev/null || echo "Manifest check: review .env.manifest"
[ -f "scripts/generate-tokens.js" ] && node scripts/generate-tokens.js
echo "✓ ${PROJECT_NAME} ready for Codex. Node: \$(node --version)"
CODEX_SETUP
    chmod +x .codex/setup.sh
    echo -e "  ${DIM}→${RESET} Paste .codex/setup.sh into OpenAI Platform → Codex → Environments"
    ;;
  firebase-studio)
    echo -e "  ${DIM}·${RESET} Firebase Studio: keep AGENTS.md open in editor during sessions"
    ;;
esac

echo ""

# ── Step 5: Print the agent bootstrap prompt ──────────────────────────────────
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  PASTE THIS PROMPT INTO YOUR AI AGENT${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

cat << PROMPT
You are the Bootstrap Orchestrator for a new project.

The Complete Development Handbook is at: /tmp/handbook
Handbook commit: $HANDBOOK_COMMIT

Step 1 — Read the handbook in this exact order:
  cat /tmp/handbook/BOOTSTRAP.md
  cat /tmp/handbook/PRINCIPLES.md
  cat /tmp/handbook/ENVIRONMENTS.md
  cat /tmp/handbook/DESIGN_SYSTEM.md
  cat /tmp/handbook/SECURITY.md
  cat /tmp/handbook/TOOLING.md
  cat /tmp/handbook/QUALITY.md
  cat /tmp/handbook/SEO_AEO.md
  cat /tmp/handbook/STRUCTURE.md
  cat /tmp/handbook/MULTI_AGENT.md

Step 2 — Detected context:
  Project directory: $CURRENT_DIR
  Project name: $PROJECT_NAME
  Detected stack: $DETECTED_STACK
  IDE: $IDE

Step 3 — Follow BOOTSTRAP.md exactly. All 6 phases. In order.
  Phase 2 (environment manifest) requires explicit human confirmation before continuing.
  Do not write application code until Phase 6 is complete.

State "Handbook loaded [$HANDBOOK_COMMIT]. Starting Phase 0." to begin.
PROMPT

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Step 6: Git initialisation check ─────────────────────────────────────────
if ! $IS_GIT_REPO; then
  echo -e "${YELLOW}⚠  This directory is not a git repo.${RESET}"
  echo ""
  read -r -p "   Initialise git repo now? [y/N]: " INIT_GIT
  if [[ "$INIT_GIT" =~ ^[Yy]$ ]]; then
    git init
    git add scripts/ docs/ .env.example
    git commit -m "chore: handbook bootstrap — initial project structure"
    echo -e "${GREEN}✓${RESET} Git repo initialised with bootstrap files"
    echo ""
    echo "  Next: create a GitHub repo and run:"
    echo -e "  ${BOLD}git remote add origin <your-repo-url>${RESET}"
    echo -e "  ${BOLD}git push -u origin main${RESET}"
  fi
fi

echo ""
echo -e "${GREEN}${BOLD}Bootstrap ready.${RESET} Paste the prompt above into your agent."
echo -e "${DIM}Handbook: $HANDBOOK_DIR · Commit: $HANDBOOK_COMMIT${RESET}"
echo ""
