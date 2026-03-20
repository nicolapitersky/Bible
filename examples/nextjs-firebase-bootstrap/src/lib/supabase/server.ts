/**
 * src/lib/supabase/server.ts — Supabase SERVER client
 *
 * SERVER ONLY. Use in Server Components, Server Actions, and API routes.
 * Reads and sets cookies for session management.
 *
 * For admin operations bypassing RLS, use createAdminSupabaseClient().
 */
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/types/database';
import { env } from '@/lib/env';

/** Anon client — respects Row Level Security */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component read — cookie setting fails silently (expected)
          }
        },
      },
    },
  );
}

/** Service role client — bypasses RLS. Use sparingly and deliberately. */
export function createAdminSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}
