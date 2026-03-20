/**
 * src/app/(app)/layout.tsx — Authenticated app shell
 *
 * Guards all routes in this group behind Firebase Auth.
 * Redirects to /login if no valid session.
 *
 * Route group (app) keeps auth-required routes separate from
 * public marketing routes (marketing) — both at the same URL level.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { adminAuth } from '@/lib/firebase-admin';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify Firebase session cookie server-side
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    redirect('/login');
  }

  try {
    // Verify the session cookie and check for revocation
    await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    // Cookie invalid or revoked — clear it and redirect
    redirect('/login?reason=session_expired');
  }

  return (
    <div className="min-h-screen bg-surface-background-alt">
      {/* App shell — nav, sidebar would go here */}
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
