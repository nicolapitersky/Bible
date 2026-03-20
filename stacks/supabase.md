# stacks/supabase.md — Supabase Stack Addendum

> Full Supabase-specific rules, patterns, and configurations.
> Read alongside `stacks/vercel.md` for the Vercel-Supabase integration setup.
> Last reviewed: See git log.

---

## Approved Versions

- `@supabase/supabase-js`: v2.x (always latest minor)
- `@supabase/ssr`: v0.x (required for Next.js App Router)
- Supabase CLI: always latest (`brew upgrade supabase/tap/supabase`)

---

## Project Setup — Non-Negotiable Steps

```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase

# 2. Initialise the project (run once, commit the supabase/ folder)
supabase init

# 3. Link to your remote project
supabase link --project-ref {{SUPABASE_PROJECT_REF}}

# 4. Start the local development stack
supabase start
# Starts: Postgres (54322), Auth (54321), Storage, Studio UI (54323)
# Studio: http://localhost:54323 — local dashboard for your dev database

# 5. Generate TypeScript types (run after every schema change)
pnpm supabase:types
# Add to package.json: "supabase:types": "supabase gen types typescript
#   --project-id {{SUPABASE_PROJECT_REF}} --schema public > src/types/database.ts"

# 6. Commit everything
git add supabase/ src/types/database.ts
```

---

## `supabase/config.toml`

This file is committed and defines the local development environment.
Matches your remote project's settings.

```toml
# supabase/config.toml

[api]
enabled  = true
port     = 54321
schemas  = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port     = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled  = true
port     = 54323

[inbucket]
# Local email testing (captures all emails sent in development)
enabled = true
port    = 54324
smtp_port = 54325
pop3_port = 54326

[storage]
enabled = true
# Maximum file size for uploads in local development
file_size_limit = "50MiB"

[auth]
enabled        = true
site_url       = "http://localhost:3000"
# Add all redirect URLs your app uses
additional_redirect_urls = [
  "http://localhost:3000/auth/callback",
  "https://{{STAGING_URL}}/auth/callback",
]
jwt_expiry     = 3600     # 1 hour
enable_refresh_token_rotation = true
refresh_token_reuse_interval  = 10

[auth.email]
enable_signup        = true
double_confirm_changes = true  # Require email confirmation for email changes
enable_confirmations = true    # Require email verification on signup

[auth.external.google]
enabled     = true
client_id   = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"
secret      = "env(SUPABASE_AUTH_GOOGLE_SECRET)"

[auth.external.apple]
enabled     = true
client_id   = "env(SUPABASE_AUTH_APPLE_CLIENT_ID)"
secret      = "env(SUPABASE_AUTH_APPLE_SECRET)"
```

---

## Supabase Folder Structure

```
supabase/
├── config.toml          ← Local dev config (committed)
├── seed.sql             ← Development seed data (committed)
├── migrations/
│   ├── 20250101000000_initial_schema.sql
│   ├── 20250115000000_add_orders_table.sql
│   └── 20250201000000_add_orders_index.sql
└── functions/
    ├── _shared/         ← Shared utilities across functions
    │   └── cors.ts
    ├── create-checkout/
    │   └── index.ts
    └── send-notification/
        └── index.ts
```

**Rule:** The `supabase/` folder is the single source of truth for the database schema
and Edge Function code. Never modify the production schema through the Supabase dashboard.
All changes are migrations: committed, reviewed, and applied via CI.

---

## Seed Data (`supabase/seed.sql`)

Seed data creates realistic test data for local development.
Runs automatically when you `supabase db reset`.

```sql
-- supabase/seed.sql
-- Development seed data. Never runs in staging or production.

-- Truncate first to make it idempotent (safe to run multiple times)
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE public.products CASCADE;

-- Seed users (auth.users is managed by Supabase Auth — seed public.users only)
INSERT INTO public.users (id, email, display_name, plan, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com', 'Alice Chen',   'pro',  NOW()),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com',   'Bob Williams', 'free', NOW()),
  ('00000000-0000-0000-0000-000000000003', 'admin@example.com', 'Admin User',   'enterprise', NOW());

-- Seed products (public catalogue)
INSERT INTO public.products (id, name, price_pence, description, active) VALUES
  (gen_random_uuid(), 'Starter Plan',     999,  'Everything you need to get started.', true),
  (gen_random_uuid(), 'Pro Plan',        2999,  'For growing teams.',                  true),
  (gen_random_uuid(), 'Enterprise Plan', 9999,  'For large organisations.',            true);
```

---

## Schema Design Rules

```sql
-- Primary keys: UUID (not serial integer)
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

-- Timestamps: always with timezone, always with server default
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

-- Soft deletes (never hard-delete user-generated data)
deleted_at TIMESTAMPTZ,

-- Status fields: use CHECK constraints, not open TEXT
status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),

-- Money: pence/cents as INTEGER — never DECIMAL or FLOAT (floating point errors)
price_pence INTEGER NOT NULL CHECK (price_pence >= 0),

-- Foreign keys to auth.users (Supabase's built-in user table)
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```

### The `updated_at` trigger (apply to every table with `updated_at`)

```sql
-- Create once, reuse everywhere
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply per table
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Indexes (add these or CI will warn about slow queries)

```sql
-- Index every foreign key
CREATE INDEX idx_orders_user_id ON public.orders (user_id);

-- Index status columns used in WHERE clauses
CREATE INDEX idx_orders_status ON public.orders (status) WHERE deleted_at IS NULL;

-- Composite index for common query patterns
CREATE INDEX idx_orders_user_created ON public.orders (user_id, created_at DESC);

-- Full-text search (see full-text section below)
CREATE INDEX idx_products_fts ON public.products
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

---

## Row Level Security — Complete Guide

### The `anon` vs `authenticated` role

Supabase has two core roles every query runs as:

- **`anon`** — unauthenticated request. Used when no JWT is present in the request.
  The anon key in your client SDK does not grant access — it only identifies the project.
  What `anon` can do is entirely determined by your RLS policies.
- **`authenticated`** — request with a valid Supabase JWT. `auth.uid()` returns the user's ID.

```sql
-- Show current role for debugging (run in SQL editor)
SELECT current_user, auth.uid(), auth.role();
```

### Mandatory pattern: RLS on every table

```sql
-- Always enable RLS on every table, even public tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Explicitly deny all by default (belt and braces)
-- This is the fallback if no other policy matches
CREATE POLICY "deny_all_by_default"
  ON public.products AS RESTRICTIVE
  FOR ALL USING (false);

-- Then add explicit allow policies
CREATE POLICY "products_public_read"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (active = true AND deleted_at IS NULL);

CREATE POLICY "products_admin_write"
  ON public.products FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');
```

### Standard user-scoped policies

```sql
-- Users table: self-access only
CREATE POLICY "users_select_own"  ON public.users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "users_update_own"  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY "users_no_delete"   ON public.users FOR DELETE
  USING (false); -- soft delete only

-- Orders: user reads and inserts their own, no direct update/delete
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
-- Updates come via Edge Functions (service role) only
```

### RLS gotchas — read these carefully

**Views do NOT automatically inherit RLS from their underlying tables.**
You must either create policies on the view itself, or use `security_invoker = true`:

```sql
-- Safe: view runs as the calling user, inheriting their RLS
CREATE VIEW public.active_orders
  WITH (security_invoker = true)
  AS SELECT * FROM public.orders WHERE deleted_at IS NULL;

-- Dangerous: default views run as the view owner, bypassing RLS
-- Don't do this unless you explicitly want the bypass
CREATE VIEW public.active_orders AS ...;  -- runs as postgres role
```

**Functions bypass RLS by default** when defined with `SECURITY DEFINER`:

```sql
-- Dangerous: runs as postgres, ignores RLS
CREATE FUNCTION get_user_orders(uid UUID)
RETURNS SETOF orders SECURITY DEFINER AS $$ ... $$;

-- Safe: runs as calling user, respects RLS
CREATE FUNCTION get_user_orders(uid UUID)
RETURNS SETOF orders SECURITY INVOKER AS $$ ... $$;
```

### Testing RLS policies

```bash
# Run in Supabase CLI
supabase test db

# Or test manually in Studio SQL editor:
```

```sql
-- Impersonate a specific user
SET request.jwt.claims = '{"sub": "USER_UUID_HERE", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

-- Test your queries — should only return that user's data
SELECT * FROM public.orders;
SELECT * FROM public.users WHERE id = auth.uid();

-- Reset
RESET ROLE;
```

---

## Auth Patterns for Next.js App Router

### The critical missing piece: `updateSession` in middleware

Without this, Supabase sessions silently expire while the user is active.
The session cookie is refreshed in middleware — which runs on every request.

```typescript
// src/middleware.ts — REQUIRED for Supabase auth to work correctly
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()                { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not remove this line — it refreshes the session
  const { data: { user } } = await supabase.auth.getUser();

  // Auth guard: redirect unauthenticated users
  if (!user && !request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth).*)'],
};
```

### Auth callback route

```typescript
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
```

### Auth in Server Components

```typescript
// In any Server Component or Server Action
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const supabase = createServerSupabaseClient();

  // Always use getUser() — not getSession() — for server-side auth checks
  // getUser() validates the JWT with Supabase's servers (more secure)
  // getSession() only reads the local cookie without re-validating
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Fetch data — RLS ensures user sees only their own records
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return <div>Hello, {profile?.display_name}</div>;
}
```

### Setting custom claims (for admin roles)

```typescript
// supabase/functions/set-user-role/index.ts
// Called after user creation to set role claims

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { userId, role } = await req.json();

  // Admin client — bypasses RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Set custom claim in app_metadata — included in the JWT
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { user_role: role },
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok: true }));
});
```

---

## Storage

Supabase Storage is S3-compatible object storage with RLS-based access control.
Use it for: user profile images, file uploads, generated reports, exports.

### Bucket setup

```sql
-- Create buckets in a migration (not via dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Public bucket: avatars are publicly readable
  ('avatars', 'avatars', true,  2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  -- Private bucket: documents require authenticated access
  ('documents', 'documents', false, 10485760, ARRAY['application/pdf', 'text/csv']);
```

### Storage RLS policies

```sql
-- Public bucket: anyone can read, only owner can upload/delete
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    -- Enforce filename pattern: [user-id]/avatar.jpg
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Private bucket: only owner can read, upload, delete
CREATE POLICY "documents_owner_all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

### Upload from client

```typescript
'use client';
import { getSupabaseClient } from '@/lib/supabase/client';

async function uploadAvatar(file: File, userId: string) {
  const supabase = getSupabaseClient();

  // Validate before uploading — don't trust the browser
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP allowed.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 2MB.');
  }

  const ext  = file.name.split('.').pop();
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      upsert: true,          // Replace if exists
      contentType: file.type,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Return the public URL (for public buckets)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
```

### Signed URLs (for private buckets)

```typescript
// Server-side — generate a temporary URL for a private file
async function getDocumentUrl(path: string, expiresInSeconds = 3600) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Failed to generate URL: ${error.message}`);
  return data.signedUrl;
}
```

---

## Edge Functions

### Local development

```bash
# Serve a specific function locally
supabase functions serve create-checkout --env-file .env.local --no-verify-jwt

# Serve all functions
supabase functions serve --env-file .env.local

# Functions are available at: http://localhost:54321/functions/v1/[function-name]
```

### Secrets management

```bash
# Set secrets for a deployed function (not in code, not in env files)
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set RESEND_API_KEY=re_...

# List secrets (values not shown)
supabase secrets list

# Reference in function code:
# Deno.env.get('STRIPE_SECRET_KEY')
```

### Shared utilities pattern

```typescript
// supabase/functions/_shared/cors.ts
// Shared across all Edge Functions — import with relative path

export const corsHeaders = {
  'Access-Control-Allow-Origin':  Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// supabase/functions/_shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization header');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorised');
  return user;
}
```

### Database webhooks (trigger Edge Functions on row changes)

Database webhooks call an Edge Function when rows are inserted, updated, or deleted.
Use for: sending emails on new order, syncing data to external services, audit logging.

```sql
-- In a migration: create a webhook trigger
-- Go to: Supabase Dashboard → Database → Webhooks → Create new webhook

-- Or via SQL (using pg_net extension which Supabase enables):
SELECT net.http_post(
  url     := 'https://[PROJECT_REF].supabase.co/functions/v1/on-order-created',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
  body    := row_to_json(NEW)::jsonb
) FROM public.orders;
```

The recommended approach is the Supabase Dashboard webhooks UI:
1. Dashboard → Database → Webhooks → Create a new hook
2. Name: `on_order_insert`
3. Table: `orders`
4. Events: `Insert`
5. Type: `Supabase Edge Functions`
6. Function: `on-order-created`

---

## Full-Text Search

```sql
-- 1. Add a tsvector column to your table
ALTER TABLE public.products
  ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(tags::text, '')
    )
  ) STORED;

-- 2. Create a GIN index (fast full-text search)
CREATE INDEX idx_products_fts ON public.products USING gin(fts);

-- 3. Query
SELECT * FROM public.products
WHERE fts @@ to_tsquery('english', 'project & management')
ORDER BY ts_rank(fts, to_tsquery('english', 'project & management')) DESC;
```

In TypeScript with the Supabase client:

```typescript
const { data, error } = await supabase
  .from('products')
  .select()
  .textSearch('fts', query, {
    type:   'websearch',      // Handles AND, OR, NOT, phrase queries naturally
    config: 'english',
  });
```

---

## Scheduled Jobs with `pg_cron`

Supabase enables the `pg_cron` extension for scheduled Postgres jobs.
Use for: purging expired sessions, aggregating daily stats, sending digest emails.

```sql
-- Enable the extension (once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run a job every day at midnight
SELECT cron.schedule(
  'purge-expired-sessions',           -- Job name
  '0 0 * * *',                        -- Cron expression (midnight UTC)
  $$
    DELETE FROM public.user_sessions
    WHERE expires_at < now() - interval '7 days';
  $$
);

-- Run weekly (Monday 06:00 UTC) — pair with the weekly quality audit
SELECT cron.schedule(
  'weekly-data-cleanup',
  '0 6 * * 1',
  $$
    DELETE FROM public.notifications
    WHERE created_at < now() - interval '90 days'
    AND read_at IS NOT NULL;
  $$
);

-- List all scheduled jobs
SELECT * FROM cron.job;

-- Remove a job
SELECT cron.unschedule('purge-expired-sessions');
```

---

## Real-time

### Presence (who is currently online/in a document)

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

function usePresence(roomId: string, currentUser: { id: string; name: string }) {
  const supabase = getSupabaseClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel>>();

  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // state is { [userId]: [{ ...userData }] }
        console.log('Online users:', Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: currentUser.name, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => { void supabase.removeChannel(channel); }; // Always clean up
  }, [roomId, currentUser.id]);
}
```

### Broadcast (ephemeral events, no database persistence)

```typescript
// Sender
const channel = supabase.channel('cursor-positions');
channel.subscribe();
await channel.send({
  type:    'broadcast',
  event:   'cursor-move',
  payload: { x: 100, y: 200, userId: currentUser.id },
});

// Receiver
channel.on('broadcast', { event: 'cursor-move' }, ({ payload }) => {
  updateCursorPosition(payload.userId, payload.x, payload.y);
});
```

---

## TypeScript Client Patterns

### Server client (Next.js App Router — SSR)

```typescript
// src/lib/supabase/server.ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()            { return cookieStore.getAll(); },
        setAll(toSet) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component — expected */ }
        },
      },
    }
  );
}

// Admin client — bypasses RLS. Use only when user context is unavailable.
export function createAdminSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

### Client component singleton

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
```

---

## Migration Workflow

```bash
# ── Development ────────────────────────────────────────────────────────────

# Make schema changes in Supabase Studio (localhost:54323)
# Then generate a migration file from the diff:
supabase db diff -f add_orders_table

# Review the generated migration
cat supabase/migrations/$(ls -t supabase/migrations | head -1)

# Apply locally to confirm it runs cleanly
supabase db reset      # Wipes local DB and re-runs all migrations + seed

# Regenerate types
pnpm supabase:types
git add supabase/migrations/ src/types/database.ts

# ── Staging ────────────────────────────────────────────────────────────────

supabase db push --project-ref {{SUPABASE_STAGING_REF}}
# OR: this runs automatically in CI on push to staging branch

# ── Production ─────────────────────────────────────────────────────────────

# NEVER run manually in production without a confirmed incident reason
# Runs automatically in CI via GitHub Actions on push to main
```

### GitHub Actions: auto-migrate on deploy

```yaml
# .github/workflows/ci.yml — add this job
migrate-database:
  name: Run database migrations
  runs-on: ubuntu-latest
  needs: [quality, test, build]  # Only migrate after passing checks
  if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
  steps:
    - uses: actions/checkout@v4

    - uses: supabase/setup-cli@v1
      with:
        version: latest

    - name: Link project
      run: supabase link --project-ref ${{ vars.SUPABASE_PROJECT_REF }}
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

    - name: Run migrations
      run: supabase db push
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        SUPABASE_DB_PASSWORD:  ${{ secrets.SUPABASE_DB_PASSWORD }}

    - name: Verify migration
      run: supabase db diff --linked
      # If diff is non-empty, local migrations don't match remote — fail loudly
```

---

## Monitoring

Supabase provides several built-in monitoring tools. Use them before reaching for
external observability solutions.

**Query Performance (Dashboard → Database → Query Performance)**
- Shows slow queries sorted by total time
- Review weekly — anything over 100ms is a candidate for an index
- Look for N+1 patterns (same query running hundreds of times)

**Logs Explorer (Dashboard → Logs → Edge network / Postgres)**
- Real-time streaming logs from your database and API
- Filter by status code, user ID, or query text
- Use to debug RLS issues: failed queries appear as 403s in edge logs

**Database Reports (Dashboard → Reports)**
- Request counts, cache hit rate, row read/write counts
- Cache hit rate below 95% suggests missing indexes

**Alerts (Dashboard → Project Settings → Alerts)**
- Set up email alerts for: high CPU, storage approaching limit, high error rate
- Recommended thresholds: CPU > 80% for 5 minutes, storage > 80% capacity
