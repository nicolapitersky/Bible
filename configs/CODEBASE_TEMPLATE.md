# CODEBASE.md — {{PROJECT_NAME}} Orientation Guide

> This file is the first thing every AI agent reads when starting work on this project.
> It explains how the project is structured, what patterns are in use, where things live,
> and what not to touch without asking.
>
> Generated during retrofit: {{RETROFIT_DATE}}
> Handbook version: {{HANDBOOK_VERSION}}
> Keep this file up to date. Update it when the structure or patterns change.

---

## What This Project Is

{{PROJECT_DESCRIPTION}}

**Users:** {{WHO_USES_IT}}
**Status:** {{PROJECT_STATUS}} (active development / maintenance / legacy)

---

## Stack at a Glance

```
Framework:      {{FRAMEWORK}}
Backend/DB:     {{BACKEND}}
Auth:           {{AUTH_SYSTEM}}
Payments:       {{PAYMENT_SYSTEM}}
Deployment:     {{DEPLOYMENT}}
Node version:   {{NODE_VERSION}}
Package mgr:    {{PACKAGE_MANAGER}}
```

---

## Where Things Live

```
{{PROJECT_STRUCTURE_TREE}}
```

**Key directories:**

| Directory | What goes here |
|-----------|---------------|
| `{{SRC_DIR}}/components/ui/` | Reusable UI primitives — use these before building new ones |
| `{{SRC_DIR}}/components/layout/` | Page shells, navigation, headers, footers |
| `{{SRC_DIR}}/components/features/` | Feature-specific composite components |
| `{{SRC_DIR}}/lib/` | Utilities, service clients, configuration |
| `{{SRC_DIR}}/hooks/` | Custom React/Flutter hooks |
| `{{SRC_DIR}}/types/` | TypeScript types and interfaces |
| `{{SRC_DIR}}/app/api/` | API routes — see routes section below |

---

## Routes and Pages

{{ROUTES_TABLE}}

**Auth model:** {{AUTH_MODEL_DESCRIPTION}}
e.g. "Routes inside `(app)/` are guarded by the layout — session verified server-side."

---

## Component Library

**Before building a new component, check these:**

{{COMPONENT_INVENTORY}}

**Pattern for using existing components:**
```typescript
// ✅ Always check this directory first
import { Button } from '@/components/ui/Button';
import { Card }   from '@/components/ui/Card';

// ❌ Do not create one-off styled elements
<button style={{ background: '#6366f1' }}>  // use Button component
<div style={{ padding: 24 }}>               // use spacing tokens
```

---

## Key Patterns in This Codebase

### Data fetching
{{DATA_FETCHING_PATTERN}}

Example:
```typescript
{{DATA_FETCHING_EXAMPLE}}
```

### Error handling
{{ERROR_HANDLING_PATTERN}}

Example:
```typescript
{{ERROR_HANDLING_EXAMPLE}}
```

### Input validation
{{VALIDATION_PATTERN}}

### State management
{{STATE_MANAGEMENT_PATTERN}}

---

## Design System Status

{{DESIGN_SYSTEM_STATUS}}

```
Design tokens:    {{TOKEN_STATUS}}
Token file:       design-tokens/tokens.json
CSS variables:    design-tokens/tokens.css
Hardcoded values: ~{{HARDCODED_COUNT}} (being migrated — see TD-001 in TECH_DEBT.md)
```

**When editing any file:** replace hardcoded values with token references.
Do not do a bulk migration — only migrate files you are already editing.

---

## Testing Status

```
Test framework:   {{TEST_FRAMEWORK}}
Test files:       {{TEST_FILE_COUNT}}
Coverage:         {{COVERAGE_ESTIMATE}}
Run tests:        {{TEST_COMMAND}}
```

{{TESTING_GUIDANCE}}

---

## CI/CD Status

```
CI pipeline:      {{CI_STATUS}}
Runs on:          {{CI_TRIGGERS}}
Quality gates:    {{QUALITY_GATES}}
Deploy:           {{DEPLOY_PROCESS}}
```

---

## Services and Integrations

{{SERVICES_LIST}}

**Environment IDs:** All in `.env.manifest` — check it before any cloud operation.

---

## Things to Know Before You Start

### DO read these first
- `AGENTS.md` — the full agent constitution for this project
- `.env.manifest` — environment resource IDs
- `docs/TECH_DEBT.md` — known issues and compromises

### DO check these before building
- `src/components/ui/` — component library
- `design-tokens/tokens.json` — all visual values
- `docs/TOOL_REGISTRY.md` — approved tools (if it exists)

### DO NOT touch these without asking
{{DO_NOT_TOUCH_LIST}}

### Largest files (treat with care)
{{LARGE_FILES_LIST}}

These files are complex. Changes to them have wide blast radius.
Make minimal, targeted changes. Do not refactor while implementing features.

---

## Migration in Progress

This project was retrofitted to the Complete Development Handbook on {{RETROFIT_DATE}}.
Not everything is compliant yet. See `AGENTS.md` MIGRATION STATUS section for details.
See `docs/MIGRATION_PLAN.md` for the roadmap.

The weekly quality agent (`scripts/weekly-quality.js`) tracks progress.
