# stacks/stripe.md — Stripe Integration Addendum

> Stripe handles money. Errors here have real consequences.
> Every pattern in this file exists because someone learned it the hard way.
> Read this alongside the base Security.md before touching any payment code.

---

## The Cardinal Rules of Stripe Integration

1. **Never handle raw card data.** Use Stripe Elements or Stripe.js. Full stop.
2. **Always validate webhook signatures.** An unvalidated webhook is an open attack surface.
3. **Always use idempotency keys.** Networks fail. Retries happen. Charges must not double.
4. **Test mode and live mode are different keys.** The manifest controls which is which.
5. **Never log the Stripe secret key.** Ever. For any reason.
6. **Price changes happen in Stripe Dashboard, not code.** Hardcoded prices are a liability.

---

## Environment Configuration

The `.env.manifest` defines Stripe mode per environment:

```json
"stripe": {
  "mode": "test",           // staging and local MUST be "test"
  "webhookEndpoint": "..."
}
```

```bash
# .env.example
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # pk_test_... (staging) or pk_live_... (prod)
STRIPE_SECRET_KEY=                     # sk_test_... (staging) or sk_live_... (prod)
STRIPE_WEBHOOK_SECRET=                 # whsec_... (unique per endpoint)
```

The `verify-env.js` script automatically detects if you have a live key in a test
environment and will halt deployment. This is non-negotiable.

---

## Server-Side Stripe Initialisation

```typescript
// src/lib/stripe.ts — Server only. Never import in client components.
import 'server-only';
import Stripe from 'stripe';
import { env } from '@/lib/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',    // Pin to a specific API version — never use 'latest'
  typescript: true,
  appInfo: {
    name: '{{PROJECT_NAME}}',
    version: '1.0.0',
    url: '{{PRODUCTION_URL}}',
  },
});
```

Pin the API version. When Stripe releases a new version, read the changelog,
test in staging, update the pin deliberately. Never use `latest`.

---

## Client-Side Stripe Initialisation

```typescript
// src/lib/stripe-client.ts — Safe for browser
import { loadStripe } from '@stripe/stripe-js';
import { env } from '@/lib/env';

// Singleton — Stripe recommends only one instance
let stripePromise: ReturnType<typeof loadStripe> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}
```

---

## Checkout Session Pattern (Recommended Flow)

The server creates a Checkout Session. The client redirects to Stripe-hosted checkout.
This is the most secure pattern — no card data touches your server.

```typescript
// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getServerSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { z } from 'zod';

const checkoutSchema = z.object({
  priceId: z.string().startsWith('price_'),
  quantity: z.number().int().positive().max(100),
  successPath: z.string().startsWith('/').optional().default('/dashboard?checkout=success'),
  cancelPath: z.string().startsWith('/').optional().default('/pricing'),
});

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await req.json();
  const result = checkoutSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { priceId, quantity, successPath, cancelPath } = result.data;
  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',              // or 'subscription' for recurring
    customer_email: session.user.email ?? undefined,
    client_reference_id: session.user.id,  // Links Stripe session to your user
    line_items: [{ price: priceId, quantity }],

    // Always use URLs — never inline success content on redirect
    success_url: `${baseUrl}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${cancelPath}`,

    // Collect billing address if needed for tax/compliance
    billing_address_collection: 'auto',

    // Idempotency: use user ID + price ID + timestamp (minute-level)
    // This prevents duplicate sessions if the user clicks twice
    metadata: {
      userId: session.user.id,
      priceId,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

```typescript
// Client: redirect to Stripe checkout
async function handleCheckout(priceId: string) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, quantity: 1 }),
  });

  const { url, error } = await res.json();
  if (error || !url) {
    toast.error('Could not start checkout. Please try again.');
    return;
  }

  window.location.assign(url); // Hard redirect to Stripe
}
```

---

## Webhook Handler (The Most Critical Endpoint)

Webhooks are how Stripe tells your server what happened.
A broken webhook handler means orders that don't fulfil, subscriptions that don't activate,
and refunds that don't process. This must be rock solid.

```typescript
// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { handleCheckoutCompleted } from '@/services/stripe/checkout-completed';
import { handleSubscriptionUpdated } from '@/services/stripe/subscription-updated';
import { handlePaymentFailed } from '@/services/stripe/payment-failed';
import { handleRefundCreated } from '@/services/stripe/refund-created';

// CRITICAL: Next.js must not parse the body — Stripe needs the raw bytes
export const runtime = 'nodejs'; // NOT 'edge' — edge doesn't support rawBody

export async function POST(req: Request) {
  const body = await req.text(); // Raw text, not JSON
  const signature = headers().get('stripe-signature');

  if (!signature) {
    logger.warn('Stripe webhook received with no signature');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn({ err }, `Stripe webhook signature verification failed: ${message}`);
    // Return 400 — Stripe will retry. Do NOT return 500 (Stripe backs off for 5xx).
    return NextResponse.json(
      { error: `Webhook error: ${message}` },
      { status: 400 }
    );
  }

  // Log every event for audit trail
  logger.info({
    stripeEventId: event.id,
    stripeEventType: event.type,
  }, 'Stripe webhook received');

  // Handle events — each handler is idempotent
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'charge.refunded':
        await handleRefundCreated(event.data.object as Stripe.Charge);
        break;

      default:
        // Not an error — just an event we don't handle
        logger.info({ eventType: event.type }, 'Unhandled Stripe event type');
    }
  } catch (err) {
    logger.error({ err, stripeEventId: event.id }, 'Error processing Stripe webhook');
    // Return 500 so Stripe retries — but only for handler errors, not signature errors
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}
```

### Idempotent Webhook Handlers

Every webhook handler must be idempotent — safe to call multiple times with the same event.
Stripe delivers webhooks at least once, not exactly once.

```typescript
// src/services/stripe/checkout-completed.ts
import type Stripe from 'stripe';
import { db } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.client_reference_id;
  const sessionId = session.id;

  if (!userId) {
    logger.error({ sessionId }, 'Checkout completed with no client_reference_id');
    return;
  }

  // ← IDEMPOTENCY CHECK: has this event already been processed?
  const existing = await db.orders.findFirst({
    where: { stripeSessionId: sessionId },
  });

  if (existing) {
    logger.info({ sessionId, orderId: existing.id }, 'Checkout already processed — skipping');
    return; // Safe to return — this is not an error
  }

  // Process the order
  await db.orders.create({
    data: {
      userId,
      stripeSessionId: sessionId,
      stripePaymentIntentId: session.payment_intent as string,
      status: 'confirmed',
      amountPence: session.amount_total ?? 0,
    },
  });

  logger.info({ sessionId, userId }, 'Order created from checkout session');

  // Trigger fulfilment (email, access grant, etc.)
  // These should also be idempotent
}
```

---

## Stripe Elements (Custom Payment Form)

Use when you need a custom-styled payment form instead of Stripe Checkout.

```typescript
// src/components/PaymentForm/PaymentForm.tsx
'use client';
import { useState } from 'react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';

// Wrapper: creates the Elements context
export function PaymentFormWrapper({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          // Match your design tokens
          variables: {
            colorPrimary: 'var(--color-brand-primary)',
            colorBackground: 'var(--color-surface-1)',
            colorText: 'var(--color-text-primary)',
            borderRadius: 'var(--border-radius-md)',
            fontFamily: 'var(--font-sans)',
          },
        },
      }}
    >
      <PaymentForm />
    </Elements>
  );
}

// Inner form: uses stripe and elements hooks
function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard?payment=success`,
      },
    });

    if (error) {
      // Display error to user — Stripe errors are already user-friendly
      setErrorMessage(error.message ?? 'Payment failed. Please try again.');
    }
    // If no error, Stripe redirects to return_url

    setIsProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {errorMessage && (
        <p role="alert" style={{ color: 'var(--color-error)' }}>
          {errorMessage}
        </p>
      )}
      <button type="submit" disabled={!stripe || isProcessing}>
        {isProcessing ? 'Processing...' : 'Pay now'}
      </button>
    </form>
  );
}
```

---

## Subscription Management

```typescript
// Create a customer portal session (let users manage their own subscription)
// src/app/api/billing/portal/route.ts
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Get the Stripe customer ID from your database
  const user = await db.users.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

---

## Stripe CLI — Local Webhook Testing

During development, Stripe webhooks won't reach localhost.
Use the Stripe CLI to forward them:

```bash
# Install (macOS)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI prints your webhook secret for local use:
# > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxx
# Add to .env.local: STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

Add the Stripe CLI to docs/TOOL_REGISTRY.md for this project.

---

## Testing Stripe Integration

```typescript
// src/services/stripe/__tests__/checkout-completed.test.ts
import { handleCheckoutCompleted } from '../checkout-completed';
import { db } from '@/lib/database';

// Mock the database
jest.mock('@/lib/database');

describe('handleCheckoutCompleted', () => {
  it('creates an order from a checkout session', async () => {
    const mockSession = {
      id: 'cs_test_123',
      client_reference_id: 'user_456',
      payment_intent: 'pi_test_789',
      amount_total: 2999,
    };

    (db.orders.findFirst as jest.Mock).mockResolvedValue(null);
    (db.orders.create as jest.Mock).mockResolvedValue({ id: 'order_abc' });

    await handleCheckoutCompleted(mockSession as any);

    expect(db.orders.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeSessionId: 'cs_test_123',
        userId: 'user_456',
        status: 'confirmed',
      }),
    });
  });

  it('is idempotent — skips already-processed sessions', async () => {
    (db.orders.findFirst as jest.Mock).mockResolvedValue({ id: 'existing_order' });

    await handleCheckoutCompleted({ id: 'cs_test_123' } as any);

    expect(db.orders.create).not.toHaveBeenCalled();
  });
});
```

---

## Pre-Launch Stripe Checklist

```markdown
Before going live with Stripe payments:

- [ ] Live mode publishable key is pk_live_ (not pk_test_)
- [ ] Live mode secret key is sk_live_ (not sk_test_)
- [ ] verify-env.js confirms Stripe mode: live for production
- [ ] Webhook endpoint registered in Stripe Dashboard (live mode)
- [ ] STRIPE_WEBHOOK_SECRET is the live endpoint's secret (not CLI secret)
- [ ] Webhook events subscribed: checkout.session.completed, customer.subscription.updated,
      customer.subscription.deleted, invoice.payment_failed, charge.refunded
- [ ] Idempotency tested: same checkout event sent twice → only one order created
- [ ] Failed payment handler tested: user receives notification
- [ ] Billing portal tested: user can cancel, upgrade, update card
- [ ] Stripe Radar (fraud protection) enabled
- [ ] Tax configuration reviewed (VAT/GST if applicable)
- [ ] Stripe emails reviewed (receipts, failed payment notices)
- [ ] At least one real test transaction completed in live mode before launch
```
