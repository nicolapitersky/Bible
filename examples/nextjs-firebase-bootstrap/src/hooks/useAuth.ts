'use client';

/**
 * src/hooks/useAuth.ts
 *
 * Client-side auth state hook.
 * Wraps Firebase Auth's onAuthStateChanged with React state.
 *
 * Usage:
 *   const { user, loading, signOut } = useAuth();
 *
 * Note: Server-side auth (route protection) happens in:
 *   src/app/(app)/layout.tsx  — reads httpOnly session cookie
 *   src/middleware.ts          — edge routing
 *
 * This hook is for client components that need to know the current user
 * for display purposes (e.g. showing the user's name in the nav).
 */
import { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';

interface AuthState {
  user:    User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
    return unsubscribe; // Clean up on unmount
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // Clear the server-side session cookie
    await fetch('/api/auth/session', { method: 'DELETE' });
    window.location.href = '/login';
  }, []);

  return { ...state, signOut };
}
