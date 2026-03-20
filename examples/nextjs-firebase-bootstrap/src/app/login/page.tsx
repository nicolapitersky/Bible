'use client';

/**
 * src/app/login/page.tsx
 *
 * Login page — client component because it uses Firebase Auth SDK.
 *
 * Flow:
 * 1. User enters credentials
 * 2. Firebase Auth SDK signs them in (client-side)
 * 3. We get the ID token from Firebase
 * 4. POST the ID token to /api/auth/session
 * 5. Server creates an httpOnly session cookie
 * 6. Redirect to /dashboard (or the 'next' param)
 *
 * This two-step process (Firebase client auth → server session cookie)
 * is intentional: Firebase handles the auth, but the session is
 * a secure httpOnly cookie that protects against XSS.
 */
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type AuthError,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';

const googleProvider = new GoogleAuthProvider();

export default function LoginPage() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const nextPath      = searchParams.get('next') ?? '/dashboard';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function createSession(idToken: string) {
    const res = await fetch('/api/auth/session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error('Failed to create session');
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken    = await credential.user.getIdToken();
      await createSession(idToken);
      router.push(nextPath);
    } catch (err) {
      setError(getFirebaseErrorMessage(err as AuthError));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const idToken    = await credential.user.getIdToken();
      await createSession(idToken);
      router.push(nextPath);
    } catch (err) {
      setError(getFirebaseErrorMessage(err as AuthError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-background-alt flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface-1 rounded-xl border border-border shadow-lg p-8">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Sign in to Acme</h1>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-md bg-semantic-error-subtle border border-semantic-error
                       text-sm text-semantic-error"
          >
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5
                     border border-border rounded-md text-sm font-medium
                     text-text-primary bg-surface-1 hover:bg-surface-2
                     transition-colors duration-fast
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-border-focus"
        >
          {/* Google icon — inline SVG, no external request */}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-tertiary">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-primary mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface-1
                         text-text-primary placeholder:text-text-tertiary text-sm
                         focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-transparent
                         transition-colors duration-fast"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text-primary">
                Password
              </label>
              <a href="/forgot-password" className="text-xs text-text-link hover:text-text-link-hover">
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface-1
                         text-text-primary text-sm
                         focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-transparent
                         transition-colors duration-fast"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-brand-accent text-white text-sm font-medium
                       hover:bg-brand-accent-hover transition-colors duration-fast
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-border-focus"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Don't have an account?{' '}
          <a href="/signup" className="text-text-link hover:text-text-link-hover font-medium">
            Sign up free
          </a>
        </p>
      </div>
    </div>
  );
}

function getFirebaseErrorMessage(err: AuthError): string {
  switch (err.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
