/**
 * src/lib/firebase.ts — Firebase CLIENT SDK
 *
 * Safe to import in client components and server components.
 * Uses only NEXT_PUBLIC_ prefixed environment variables.
 *
 * For server-only operations (admin tasks, secure reads),
 * use src/lib/firebase-admin.ts instead.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

import { env } from './env';

const firebaseConfig = {
  apiKey:            env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent re-initialisation during hot reload in development
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// Connect to emulators in local development
if (
  env.NEXT_PUBLIC_ENV === 'development' &&
  typeof window !== 'undefined' &&
  !(auth as any)._canInitEmulator === undefined // Only connect once
) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}
