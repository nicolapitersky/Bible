/**
 * src/middleware.ts — Next.js Edge Middleware
 *
 * Runs before every request. Handles auth routing:
 * - Redirect authenticated users away from /login
 * - Redirect unauthenticated users to /login from protected routes
 *
 * NOTE: We do lightweight routing here. Full session verification
 * (with Firebase Admin SDK) happens in the (app)/layout.tsx server component.
 * Middleware uses the Edge runtime — Firebase Admin SDK is not available here.
 */
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS  = ['/login', '/signup', '/forgot-password', '/'];
const MARKETING_PATHS = ['/', '/about', '/pricing', '/blog'];
const AUTH_PATHS    = ['/login', '/signup', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;
  const isAuthenticated = Boolean(sessionCookie);

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users away from app routes
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    MARKETING_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/fonts') ||
    pathname.includes('.')
  );
}

export const config = {
  // Run on all routes except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
