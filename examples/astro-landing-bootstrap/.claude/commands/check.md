Run the full quality gate before considering any task complete.
Execute each step and report findings:

1. Type check
   pnpm type-check
   Report: zero errors expected. List any errors with file:line.

2. Lint
   pnpm lint
   Report: zero errors, zero warnings expected. List any issues.

3. Format check
   pnpm format:check
   Report: all files should be formatted. List any unformatted files.

4. Build
   pnpm build
   Report: build must succeed. List any build errors.

5. Token consistency
   grep -rn "color:\s*#\|background.*#\|rgba\|rgb(" src/ --include="*.astro" --include="*.css" --include="*.ts"
   Report: any hardcoded colour values found. These are bugs.

6. Console.log sweep
   grep -rn "console\.log" src/
   Report: any console.log found in production code. These must be removed.

7. Verify environment
   node scripts/verify-env.js local
   Report: environment manifest must verify cleanly.

Summary: report pass/fail for each step. Fix all failures before declaring task complete.
