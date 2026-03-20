/**
 * src/app/api/webhooks/stripe/route.ts
 *
 * Stripe webhook endpoint. The most security-critical API route.
 *
 * Rules:
 * 1. Always validate webhook signature before processing
 * 2. Every handler is idempotent — safe to call twice with the same event
 * 3. Return 200 quickly — do heavy work asynchronously if needed
 * 4. Return 400 on signature failure (Stripe retries on 5xx, not 4xx)
 * 5. Return 500 only on handler errors (Stripe will retry)
 * 6. Log every event — payments need a full audit trail
 */
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// Raw body required for signature verification
// 'nodejs' runtime supports req.text() — 'edge' does not
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body      = await req.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    logger.warn('Stripe webhook: missing signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    logger.warn({ err }, `Stripe webhook signature invalid: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  logger.info({ eventId: event.id, eventType: event.type }, 'Stripe event received');

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info({ eventType: event.type }, 'Unhandled Stripe event — ignoring');
    }
  } catch (err) {
    logger.error({ err, eventId: event.id }, 'Stripe webhook handler error');
    // 500 causes Stripe to retry — appropriate for handler errors
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── Idempotent handlers ────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  if (!userId) {
    logger.error({ sessionId: session.id }, 'checkout.session.completed: no client_reference_id');
    return;
  }

  // Idempotency check: skip if already processed
  // (replace with your actual DB check)
  // const existing = await db.orders.findFirst({ where: { stripeSessionId: session.id } });
  // if (existing) return;

  logger.info({ sessionId: session.id, userId }, 'Processing checkout completion');
  // TODO: create order in database, grant access, send confirmation email
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  logger.info({ subscriptionId: subscription.id, status: subscription.status }, 'Subscription changed');
  // TODO: update subscription status in database
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  logger.info({ subscriptionId: subscription.id }, 'Subscription cancelled');
  // TODO: revoke access, send cancellation email
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logger.warn({ invoiceId: invoice.id, customerId: invoice.customer }, 'Payment failed');
  // TODO: notify user, schedule retry reminder
}
