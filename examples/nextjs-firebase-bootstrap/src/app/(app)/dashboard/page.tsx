import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { adminAuth } from '@/lib/firebase-admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * src/app/(app)/dashboard/page.tsx
 *
 * Server Component — fetches data server-side, no client JS needed.
 * Auth already verified by (app)/layout.tsx — no need to re-check here.
 *
 * Pattern for all authenticated pages:
 * 1. Get the verified session from the cookie
 * 2. Fetch data using the user's ID
 * 3. Render. Pass data to client components only where interactivity needed.
 */

export const metadata: Metadata = {
  title: 'Dashboard',
};

async function getCurrentUser() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return null;

  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const decodedToken = await getCurrentUser();
  if (!decodedToken) return null; // Layout will have redirected

  const supabase = createServerSupabaseClient();

  // Fetch user data from Supabase — RLS ensures users see only their own data
  const { data: user } = await supabase
    .from('users')
    .select('display_name, plan')
    .eq('firebase_uid', decodedToken.uid)
    .single();

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Welcome back{user?.display_name ? `, ${user.display_name}` : ''}
        </h1>
        <p className="mt-2 text-text-secondary">
          You're on the <span className="font-medium capitalize">{user?.plan ?? 'free'}</span> plan.
        </p>

        {/* Dashboard content goes here */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats, activity, projects... */}
        </div>
      </div>
    </div>
  );
}
