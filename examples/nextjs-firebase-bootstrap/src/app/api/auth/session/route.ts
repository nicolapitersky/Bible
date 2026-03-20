/**
 * src/app/api/auth/session/route.ts
 *
 * Creates a server-side Firebase session cookie from a client ID token.
 *
 * Flow:
 * 1. Client signs in with Firebase Auth (email/password, Google, etc.)
 * 2. Client sends the Firebase ID token to this endpoint
 * 3. Server verifies the ID token, creates a session cookie (14 days)
 * 4. Session cookie is httpOnly, Secure, SameSite=Strict
 * 5. App layout reads this cookie to gate all authenticated routes
 *
 * This approach is more secure than storing the Firebase token in localStorage:
 * - httpOnly cookie cannot be read by JavaScript (XSS-resistant)
 * - Server validates the token before creating a session
 * - Session can be revoked server-side (logout all devices)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { adminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const createSessionSchema = z.object({
  idToken: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = createSessionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
  }

  try {
    // Verify the ID token is valid and not expired
    const decodedToken = await adminAuth.verifyIdToken(result.data.idToken);

    // Create a session cookie (more durable than ID token — expires in 14 days)
    const sessionCookie = await adminAuth.createSessionCookie(result.data.idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    logger.info({ uid: decodedToken.uid }, 'Session created');

    const response = NextResponse.json({ status: 'ok' });

    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   SESSION_DURATION_MS / 1000,
      path:     '/',
    });

    return response;
  } catch (err) {
    logger.warn({ err }, 'Session creation failed — invalid ID token');
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
}

export async function DELETE() {
  // Sign out — clear the session cookie
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.delete('session');
  return response;
}
