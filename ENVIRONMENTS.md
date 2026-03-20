# ENVIRONMENTS.md — Environment Manifest System

> This system exists to solve one problem permanently:
> An agent will NEVER write to the wrong Firebase project, Vercel deployment,
> Supabase database, or cloud resource again.

---

## The Problem This Solves

---

## The Two Governance Layers

Before configuring any environment, understand the fundamental split in how
agent governance works. Confusing these two layers is the source of most
agentic security failures.

### Layer 1 — The Instruction Layer (AGENTS.md / CLAUDE.md)

Sets context, standards, and rules. Agents are **asked** to follow these.
An agent reads AGENTS.md and chooses to comply. A sufficiently persuasive
prompt, an injection in reviewed content, or a confused context window can
cause an agent to deviate. Instruction-layer rules are necessary but not
sufficient for security-critical constraints.

**What belongs here:** coding standards, design system rules, commit message
formats, architectural decisions, NEVER DO reminders, ALWAYS DO checklists.

### Layer 2 — The Enforcement Layer (settings.json / permissions)

Constrains what agents **can do** regardless of what they read or are told.
Enforcement-layer rules cannot be overridden by prompt content. They operate
at the tool-call level — before any action executes.

**What belongs here:** which files may be read or written, which shell commands
may run, which environment variables are visible, whether bypass mode is enabled,
secrets and credential file protection.

### The Hierarchy Within Enforcement

For Claude Code (and equivalently in other tools that support policy layers):

```
Managed / org-level policy   ← highest authority, cannot be overridden
  ↓ overrides
Project .claude/settings.json
  ↓ overrides
User ~/.claude/settings.json ← lowest authority
```

Org-level managed policies set by an administrator cannot be overridden by
project or user settings. This is where security-critical denylists belong
for teams.

### The Principle Applied

> "Never hardcode environment IDs" in AGENTS.md is an **instruction**.
> A hook that intercepts file writes and rejects hardcoded IDs is **enforcement**.
> Both are required. Neither replaces the other.

Every rule in the Bible that is security-critical must have both:
- An instruction in AGENTS.md (so agents understand the rule)
- An enforcement mechanism in settings.json / hooks (so the rule holds
  even if the agent is confused, injected, or operating outside context)

The specific enforcement implementations are tool-dependent:
- Claude Code: `permissions.deny`, `hooks`, `disableBypassPermissionsMode`
- Codex: environment setup scripts, task constraints, disallowed operations
- Cursor: `.cursor/rules/` with action triggers

See `stacks/claude-code.md` for the Claude-specific enforcement implementation.

---

AI agents maintain state within a session but lose it between sessions.
They read configs, hardcoded strings, legacy comments, and old documentation.
They make confident mistakes — deploying to production when working on staging,
writing to the live database when testing, billing real customers in a test flow.

The Environment Manifest is the antidote. It is a single, committed, machine-readable
file that is the ONE authoritative source of environment identity for this project.
Every agent checks it. Every script references it. Every discrepancy is flagged.

---

## The .env.manifest File

This file is committed to the repository. It contains NO secrets — only resource identifiers
(project IDs, slugs, references). It is the manifest of what this project IS, not what it knows.

### Template

```json
{
  "_meta": {
    "project_name": "{{PROJECT_NAME}}",
    "project_slug": "{{PROJECT_SLUG}}",
    "handbook_version": "{{HANDBOOK_VERSION}}",
    "bootstrapped_at": "{{BOOTSTRAP_DATE}}",
    "manifest_version": "1.0.0",
    "schema": "https://github.com/YOUR-ORG/dev-handbook/blob/main/schemas/env-manifest.schema.json"
  },
  "environments": {
    "local": {
      "label": "Local Development",
      "firebase": {
        "projectId": "{{FIREBASE_LOCAL_PROJECT_ID}}",
        "appId": "{{FIREBASE_LOCAL_APP_ID}}",
        "storageBucket": "{{FIREBASE_LOCAL_BUCKET}}",
        "databaseId": "(default)"
      },
      "vercel": null,
      "supabase": {
        "projectRef": "{{SUPABASE_LOCAL_REF}}",
        "region": "{{SUPABASE_REGION}}"
      },
      "stripe": {
        "mode": "test",
        "webhookEndpoint": "http://localhost:3000/api/webhooks/stripe"
      }
    },
    "staging": {
      "label": "Staging / Pre-production",
      "firebase": {
        "projectId": "{{FIREBASE_STAGING_PROJECT_ID}}",
        "appId": "{{FIREBASE_STAGING_APP_ID}}",
        "storageBucket": "{{FIREBASE_STAGING_BUCKET}}",
        "databaseId": "(default)"
      },
      "vercel": {
        "teamSlug": "{{VERCEL_TEAM_SLUG}}",
        "projectId": "{{VERCEL_PROJECT_ID}}",
        "deploymentUrl": "{{STAGING_URL}}"
      },
      "supabase": {
        "projectRef": "{{SUPABASE_STAGING_REF}}",
        "region": "{{SUPABASE_REGION}}"
      },
      "stripe": {
        "mode": "test",
        "webhookEndpoint": "{{STAGING_URL}}/api/webhooks/stripe"
      },
      "netlify": {
        "siteId": "{{NETLIFY_STAGING_SITE_ID}}",
        "teamSlug": "{{NETLIFY_TEAM_SLUG}}"
      }
    },
    "production": {
      "label": "Production",
      "firebase": {
        "projectId": "{{FIREBASE_PROD_PROJECT_ID}}",
        "appId": "{{FIREBASE_PROD_APP_ID}}",
        "storageBucket": "{{FIREBASE_PROD_BUCKET}}",
        "databaseId": "(default)"
      },
      "vercel": {
        "teamSlug": "{{VERCEL_TEAM_SLUG}}",
        "projectId": "{{VERCEL_PROJECT_ID}}",
        "deploymentUrl": "{{PRODUCTION_URL}}"
      },
      "supabase": {
        "projectRef": "{{SUPABASE_PROD_REF}}",
        "region": "{{SUPABASE_REGION}}"
      },
      "stripe": {
        "mode": "live",
        "webhookEndpoint": "{{PRODUCTION_URL}}/api/webhooks/stripe"
      },
      "netlify": {
        "siteId": "{{NETLIFY_PROD_SITE_ID}}",
        "teamSlug": "{{NETLIFY_TEAM_SLUG}}"
      },
      "cloudRun": {
        "projectId": "{{GCP_PROD_PROJECT_ID}}",
        "region": "{{GCP_REGION}}",
        "services": []
      }
    }
  },
  "guards": {
    "productionRequiresExplicitConfirmation": true,
    "stagingAllowedBranches": ["staging", "release/*"],
    "productionAllowedBranches": ["main"],
    "disallowedPatterns": [
      "hardcoded-firebase-project-id",
      "hardcoded-supabase-ref",
      "hardcoded-vercel-project-id"
    ]
  }
}
```

---

## The Manifest Verification Script

Every project bootstrapped with this handbook includes this script at `scripts/verify-env.js`.
It runs at the start of any deployment script and in CI.

```javascript
// scripts/verify-env.js
// Run before any cloud operation: node scripts/verify-env.js [environment]

const fs = require('fs');
const path = require('path');

const targetEnv = process.argv[2] || 'local';
const manifest = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), '.env.manifest'), 'utf8')
);

const env = manifest.environments[targetEnv];
if (!env) {
  console.error(`❌ Unknown environment: "${targetEnv}"`);
  console.error(`   Valid environments: ${Object.keys(manifest.environments).join(', ')}`);
  process.exit(1);
}

// Verify Firebase project ID matches runtime config
if (env.firebase?.projectId && process.env.FIREBASE_PROJECT_ID) {
  if (process.env.FIREBASE_PROJECT_ID !== env.firebase.projectId) {
    console.error('❌ ENVIRONMENT MISMATCH DETECTED');
    console.error(`   Manifest expects: ${env.firebase.projectId}`);
    console.error(`   Runtime has:      ${process.env.FIREBASE_PROJECT_ID}`);
    console.error('   STOPPING. Do not proceed until this is resolved.');
    process.exit(1);
  }
}

// Production guard
if (targetEnv === 'production' && manifest.guards.productionRequiresExplicitConfirmation) {
  const confirmation = process.env.CONFIRM_PRODUCTION_DEPLOY;
  if (confirmation !== `deploy-to-${manifest._meta.project_slug}-production`) {
    console.error('❌ Production deployment requires explicit confirmation.');
    console.error(`   Set CONFIRM_PRODUCTION_DEPLOY=deploy-to-${manifest._meta.project_slug}-production`);
    process.exit(1);
  }
}

console.log(`✅ Environment verified: ${env.label} (${manifest._meta.project_name})`);
```

---

## Rules For Agents

### Reading the Manifest
At the start of any task that involves cloud resources, read `.env.manifest` and confirm:
```
Reading .env.manifest...
Project: {{PROJECT_NAME}}
Current environment: [local | staging | production]
Firebase: {{FIREBASE_PROJECT_ID}}
[...other relevant services]
Proceeding with [environment] configuration.
```

### Detecting the Current Environment
Determine the current environment from (in priority order):
1. `process.env.NODE_ENV` or `FLUTTER_ENV`
2. `process.env.VITE_ENV` or `NEXT_PUBLIC_ENV`
3. The git branch name (staging branch → staging, main → production)
4. **If none of the above are clear: ask the human. Do not guess.**

### When You Find a Discrepancy
If you find ANY resource ID in the codebase that does not match `.env.manifest`:
1. Stop the current task
2. Report: "Found potentially incorrect [resource type] ID: [found value] in [file:line]. Manifest expects [correct value] for [environment]."
3. Ask the human how to proceed
4. Do not continue until the discrepancy is resolved

### Production Operations Require Explicit Permission
Before any operation that:
- Deploys to production
- Writes to a production database
- Modifies production cloud resources
- Sends emails to real users
- Processes real payments

State what you are about to do and ask: "This is a production operation. Please confirm."
Wait for explicit confirmation before proceeding.

---

## The .env.example File

A companion to `.env.manifest`, the `.env.example` file lists all required environment
variables with empty values. This file IS committed. It serves as documentation.

```bash
# .env.example — All required environment variables
# Copy to .env.local and fill in values
# NEVER commit .env.local or any file with actual secrets

# Runtime environment (local | staging | production)
NODE_ENV=
NEXT_PUBLIC_ENV=

# Firebase (get values from Firebase Console → Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=

# Supabase (get values from Supabase Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe (get values from Stripe Dashboard → Developers → API keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Error tracking
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## Gitignore Rules (mandatory)

Every project must have these in `.gitignore`:

```
# Secrets — NEVER commit these
.env
.env.local
.env.*.local
.env.production
.env.staging
*.pem
*.key
serviceAccountKey.json
firebase-adminsdk-*.json
google-services.json.secret

# These ARE committed:
# .env.example  ← template with empty values
# .env.manifest ← resource IDs (no secrets)
```
