# PRINCIPLES.md — Core Development Principles

> These are not preferences. They are the operating principles of this organisation.
> Every agent reads and internalises these before touching any project.

---

## P1. Production-Grade From Line One

There is no "prototype phase" in this organisation. There is no "we'll clean it up later."
Every line of code written today is production code. This means:

- Strict TypeScript / Dart types from the start. No `any`. No `dynamic`.
- Error handling from the start. No unhandled promise rejections. No silent failures.
- Tests from the start. Business logic, auth flows, and payment code have tests before shipping.
- Security from the start. Every endpoint is authenticated. Every input is validated.
- Observability from the start. Errors are logged. Performance is measured.

**The cost of doing it right the first time is always lower than fixing it in production.**

---

## P2. One Source of Truth, Always

Every piece of information in this system has exactly one authoritative source.

- Design values → `design-tokens/tokens.json`
- Environment IDs → `.env.manifest`
- Approved tools → `docs/TOOL_REGISTRY.md`
- Technical decisions → `docs/adr/`
- Known issues → `docs/TECH_DEBT.md`
- Project instructions → `AGENTS.md`

If information exists in two places, one of them is wrong. If you find duplication, consolidate.
If you are about to store information in a second place, don't. Update the authoritative source.

---

## P3. The Tool Registry Rule

Before building any tool, utility, integration, or abstraction, ask:
**"Does this already exist?"**

Check in order:
1. `docs/TOOL_REGISTRY.md` — approved tools for this project
2. `TOOLING.md` — the organisation's full approved tool registry
3. The framework's built-in capabilities
4. The language's standard library

Only after exhausting these options should you consider building something custom.
Custom code is a liability. Maintained libraries are assets.

This prevents:
- Reinventing a date library when `date-fns` is already approved
- Building a custom HTTP client when `fetch` or `axios` is sufficient
- Writing a custom file upload handler when Firebase Storage SDK does it
- Creating a custom analytics wrapper when an approved SDK exists

---

## P4. Change One Thing At a Time

Agents have a tendency to refactor broadly while fixing narrowly. Do not do this.

When fixing a bug: fix the bug. Do not also "improve" surrounding code.
When adding a feature: add the feature. Do not also reorganise the file structure.
When updating a dependency: update the dependency. Do not also update unrelated dependencies.

Each commit should have one clear purpose. If you find something worth improving that isn't
related to your current task, log it in `docs/TECH_DEBT.md` and continue.

---

## P5. Mobile and Desktop Are Equal Citizens

This organisation builds for mobile and desktop with equal priority. There is no "desktop first"
or "we'll do mobile later." Every feature is designed and implemented for both simultaneously.

For web projects:
- Design tokens include responsive breakpoints
- Every component is tested at mobile (320px), tablet (768px), and desktop (1280px) widths
- Touch targets are minimum 44×44px
- No hover-only interactions (hover enhances, but does not gate functionality)

For Flutter projects:
- Layouts use `LayoutBuilder` and adaptive widgets
- Platform-specific behaviour (iOS vs Android) is handled explicitly
- Test on both platforms before considering a feature complete

---

## P6. Explicitness Over Cleverness

Code is read far more often than it is written. Optimise for readability and clarity.

Prefer:
```typescript
// Good: explicit and readable
const isUserAuthenticated = user !== null && user.emailVerified === true;
if (isUserAuthenticated) { ... }

// Bad: clever but opaque
if (user?.emailVerified) { ... }
```

Prefer explicit error handling:
```typescript
// Good
const { data, error } = await supabase.from('orders').select('*');
if (error) {
  logger.error('Failed to fetch orders', { error, userId: user.id });
  throw new DatabaseError('Order fetch failed', { cause: error });
}

// Bad
const { data } = await supabase.from('orders').select('*');
// Where did the error go?
```

Name things for what they are, not what they contain:
```typescript
// Good: names describe purpose
const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
const formattedUserName = `${user.firstName} ${user.lastName}`.trim();

// Bad: names describe implementation
const filteredList = subscriptions.filter(s => s.status === 'active');
const str = `${user.firstName} ${user.lastName}`.trim();
```

---

## P7. Document Decisions, Not Implementation

Comments explain *why*, not *what*. The code explains what it does.
Comments that explain what the code does are a sign the code should be simpler.

```typescript
// Bad: explains what the code does (obvious)
// Loop through users and send emails
users.forEach(user => sendEmail(user));

// Good: explains why this decision was made
// Stripe requires sequential processing — parallel requests trigger rate limits
for (const user of users) {
  await sendEmail(user);
}
```

Significant decisions go in ADRs, not inline comments.

---

## P8. Security Is Not A Feature

Security is not a checklist item. It is not a phase. It is a property of every piece of code.

Every developer and agent is responsible for security at the point of writing, not as a review step.
This means:
- Validate all inputs at the boundary (API routes, form handlers, webhook endpoints)
- Authenticate before authorising before processing
- Never trust client-provided data for server-side decisions
- Rate limit anything that can be abused
- Log security-relevant events (login, failed auth, permission denied)

See `SECURITY.md` for the full security constitution.

---

## P9. Fail Loudly in Development, Gracefully in Production

**Development:** Errors should be impossible to miss. Verbose logs. Stack traces. Big red error pages.
The goal is to catch every problem during development.

**Production:** Users see friendly error messages. All errors are logged with full context.
The system degrades gracefully — one failing service does not crash the entire application.

Implement this via:
- Environment-aware error boundaries
- Structured logging (JSON logs in production, pretty-printed in development)
- Sentry (or equivalent) for error tracking in production
- Health check endpoints for all services

---

## P10. Every Shortcut Is A Debt With Interest

If you make a compromise — a quick fix, a temporary workaround, a skipped test — you must:
1. Make it work correctly first
2. Log it in `docs/TECH_DEBT.md` with:
   - What the compromise is
   - Why it was made
   - What the proper solution is
   - An estimate of effort to fix it
   - The risk if it is not fixed

Tech debt that is not logged is tech debt that will never be repaid.
The weekly quality run reviews and prioritises the tech debt log.

---

## P11. Treat Agents As Junior Developers, Not Oracles

AI development agents are powerful but imperfect. They:
- Hallucinate APIs and function signatures
- Confidently write subtly wrong code
- Forget context between sessions
- Can make sweeping changes without understanding downstream effects

Treat agent output as a first draft that requires review, not finished work.
CI/CD, type checking, linting, and tests are not optional — they are the quality gate.
The agent is a fast typist, not an infallible architect.

---

## P12. The Weekly Quality Run Is Mandatory

Every Monday, a scheduled quality agent run executes `docs/QUALITY_CHECKLIST.md`.
This is not optional. It is not skipped due to time pressure.

The weekly run covers:
- Dependency vulnerability audit
- Bundle size and performance regression check
- Design token consistency audit
- Dead code detection
- Accessibility scan
- Security header verification
- SEO/AEO freshness check
- Tech debt log review and prioritisation

Findings create GitHub issues. Issues are triaged in the next sprint.
The cost of the weekly run is low. The cost of skipping it compounds.
