# stacks/nextjs.md — Next.js Stack Addendum

> Extends the base handbook for Next.js (App Router) projects.
> Read after the base handbook files during bootstrap.

---

## Approved Next.js Versions

- Next.js: 15.x (latest stable)
- React: 19.x
- Node.js: 22.x LTS (lock with `.nvmrc`)
- TypeScript: 5.x strict mode

Always check the [Next.js changelog](https://nextjs.org/blog) monthly for breaking changes.

---

## App Router — Mandatory Patterns

### Server vs Client Components

```typescript
// Default: Server Component (no directive needed)
// Can: fetch data, access server-only resources, use server env vars
// Cannot: useState, useEffect, browser APIs, event handlers
export default async function ProductPage({ params }) {
  const product = await fetchProduct(params.id); // Direct DB/API call
  return <ProductView product={product} />;
}

// Client Component — only when needed
'use client';
// Can: useState, useEffect, event handlers, browser APIs
// Cannot: async/await at component level, server env vars
export function AddToCartButton({ productId }) {
  const [loading, setLoading] = useState(false);
  // ...
}
```

**Rule:** Default to Server Components. Add `'use client'` only when you need interactivity.
Do not `'use client'` a layout file — it forces all children to be client components.

### Data Fetching Patterns

```typescript
// ✅ Parallel fetching (when data is independent)
const [product, reviews] = await Promise.all([
  fetchProduct(id),
  fetchReviews(id),
]);

// ✅ Streaming with Suspense (when some data is slow)
export default function ProductPage({ params }) {
  return (
    <>
      <ProductInfo id={params.id} /> {/* loads immediately */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews id={params.id} /> {/* streams in */}
      </Suspense>
    </>
  );
}

// ✅ Server Actions for mutations
'use server';
export async function addToCart(productId: string, quantity: number) {
  const session = await getServerSession();
  if (!session) throw new Error('Unauthorised');
  // ... mutation logic
  revalidatePath('/cart');
}
```

### Caching Strategy

```typescript
// Next.js 15 defaults to no caching — be explicit
// Static: cache indefinitely (only for truly static data)
const data = await fetch(url, { cache: 'force-cache' });

// Dynamic: always fresh (user-specific data, real-time data)
const data = await fetch(url, { cache: 'no-store' });

// Revalidate: refresh every N seconds (product listings, blog posts)
const data = await fetch(url, { next: { revalidate: 3600 } }); // 1 hour

// Tag-based revalidation (precise cache invalidation)
const data = await fetch(url, { next: { tags: ['products'] } });
// Then in a Server Action:
revalidateTag('products');
```

---

## Firebase + Next.js Integration

### Client Initialisation
```typescript
// src/lib/firebase.ts — Client SDK, safe to import in client components
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { env } from './env';

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### Admin Initialisation (Server Only)
```typescript
// src/lib/firebase-admin.ts — Server SDK, NEVER import in client components
// Add 'server-only' package import to enforce this
import 'server-only';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env';

const adminApp = getApps().length === 0
  ? initializeApp({
      credential: cert({
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
  : getApps()[0];

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
```

---

## Supabase + Next.js Integration

Use `@supabase/ssr` for all server-side Supabase access.

```typescript
// src/lib/supabase/server.ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '../env';
import type { Database } from '@/types/database'; // Generated types

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

Always generate TypeScript types from your Supabase schema:
```bash
pnpm supabase gen types typescript --project-id {{SUPABASE_PROJECT_REF}} > src/types/database.ts
```

---

## Stripe + Next.js Integration

```typescript
// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const body = await req.text(); // Must be raw text, not JSON
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook error: ${err}`, { status: 400 });
  }

  // Process event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object);
      break;
    // ... handle other events
  }

  return new Response(null, { status: 200 });
}
```

---

## Image Optimisation

```typescript
// ✅ Always use next/image
import Image from 'next/image';

// For known dimensions (preferred)
<Image
  src="/hero.jpg"
  alt="Descriptive alt text"
  width={1200}
  height={630}
  priority  // Add for above-the-fold images
/>

// For responsive images that fill container
<div style={{ position: 'relative', height: '400px' }}>
  <Image
    src="/background.jpg"
    alt="Descriptive alt text"
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    style={{ objectFit: 'cover' }}
  />
</div>

// ❌ Never use plain <img>
<img src="/hero.jpg" />  // No lazy loading, no optimisation, no WebP
```

---

## Error Handling Pattern

```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorisedError extends AppError {
  constructor() {
    super('Unauthorised', 'UNAUTHORISED', 401);
  }
}
```

```typescript
// src/app/api/[...route]/route.ts — Consistent API error responses
import { NextResponse } from 'next/server';
import { AppError } from '@/utils/errors';
import { logger } from '@/lib/logger';

export function apiHandler(handler: Function) {
  return async (req: Request, context: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }
      logger.error('Unhandled API error', { error });
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}
```

---

## Deployment (Vercel)

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_ENV": "production"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-DNS-Prefetch-Control", "value": "on" }
      ]
    }
  ]
}
```

Always run `node scripts/verify-env.js production` in the pre-deployment step.
