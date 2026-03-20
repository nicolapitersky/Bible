import { z } from 'zod';

/**
 * src/lib/env.ts
 *
 * ALL environment variables validated at startup.
 * If any required variable is missing or wrong-shaped,
 * this throws with a clear message before any request is served.
 *
 * No more "undefined is not a string" in production at 2am.
 *
 * Usage: import { env } from '@/lib/env';
 * Never: process.env.VARIABLE_NAME directly in application code.
 */

const envSchema = z.object({
  // Runtime
  NODE_ENV:          z.enum(['development', 'staging', 'production', 'test']),
  NEXT_PUBLIC_ENV:   z.enum(['development', 'staging', 'production', 'test']),

  // Firebase (client — safe to expose)
  NEXT_PUBLIC_FIREBASE_API_KEY:             z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:         z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:          z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:      z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID:              z.string().min(1),

  // Firebase Admin (server only — never expose to client)
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY:  z.string().min(100),

  // Supabase (client URL and anon key are safe to expose)
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1), // Server only

  // Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_SECRET_KEY:                  z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET:              z.string().startsWith('whsec_'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXTAUTH_SECRET:     z.string().min(32),
});

// Validate and export. Throws at module load time with a clear error.
export const env = envSchema.parse(process.env);

// Type export for use in other files
export type Env = z.infer<typeof envSchema>;
