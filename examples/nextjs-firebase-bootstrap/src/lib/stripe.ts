/**
 * src/lib/stripe.ts — Stripe SERVER SDK
 *
 * Server only. Never import in client components.
 * The 'server-only' package enforces this at build time.
 */
import 'server-only';
import Stripe from 'stripe';
import { env } from './env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // Pinned — update deliberately after testing
  typescript: true,
  appInfo: {
    name:    'Acme App',
    version: '1.0.0',
    url:     'https://app.acme.app',
  },
});
