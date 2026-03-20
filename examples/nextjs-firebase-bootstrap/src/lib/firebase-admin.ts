/**
 * src/lib/firebase-admin.ts — Firebase ADMIN SDK
 *
 * SERVER ONLY. Never import this in client components.
 * The 'server-only' import enforces this at build time.
 *
 * Bypasses Firebase Security Rules — has full database access.
 * Use only when security rules cannot express the required logic.
 */
import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth }      from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage }   from 'firebase-admin/storage';

import { env } from './env';

// Prevent re-initialisation in Next.js development hot reload
const adminApp =
  getApps().find((a) => a.name === 'admin') ??
  initializeApp(
    {
      credential: cert({
        projectId:   env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Private key comes from env as a single-line string with literal \n
        privateKey:  env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    },
    'admin',
  );

export const adminAuth    = getAuth(adminApp);
export const adminDb      = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
