# stacks/firebase.md — Firebase Stack Addendum

> Firebase-specific rules and patterns. Always read alongside the base handbook.

---

## Firebase Project Setup Rules

1. **Always use the Firebase CLI** — never make configuration changes in the console alone
2. **All config is in code** — `firestore.indexes.json`, `firestore.rules`, `storage.rules`, `remoteconfig.template.json`
3. **Always develop against Firebase Emulator** — never against staging/production during development
4. **Emulator ports are standardised** — use these exact ports across all projects:

```json
// firebase.json (emulator configuration)
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

Start emulators: `firebase emulators:start --import ./emulator-data --export-on-exit`

---

## Firestore Data Modelling

### Subcollection Pattern (preferred)
```
users/{userId}/
  profile (document with user data)
  orders/{orderId} (subcollection — user-scoped, efficient queries)
  preferences (document)

products/{productId}/
  reviews/{reviewId} (subcollection)
```

### Avoid
- Deeply nested data (> 3 levels)
- Arrays of objects that need to be queried (use subcollections)
- Storing large blobs (use Storage instead)

### Indexing
```json
// firestore.indexes.json — all composite indexes defined here
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Cloud Functions (2nd Gen — Required for New Projects)

```typescript
// functions/src/index.ts
import { onRequest, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';

// Use Secret Manager for all secrets in Functions
const stripeSecret = defineSecret('STRIPE_SECRET_KEY');

// HTTP functions (for webhooks and APIs)
export const stripeWebhook = onRequest(
  { secrets: [stripeSecret], region: 'europe-west2' }, // ← Set region explicitly
  async (req, res) => {
    // Validate Stripe signature
    const sig = req.headers['stripe-signature'];
    // ... process webhook
  }
);

// Callable functions (for authenticated client calls)
export const createCheckoutSession = onCall(
  { secrets: [stripeSecret], region: 'europe-west2' },
  async (request) => {
    if (!request.auth) throw new Error('Unauthenticated');
    const userId = request.auth.uid;
    // ... create session
  }
);

// Firestore triggers
export const onOrderCreated = onDocumentCreated(
  'orders/{orderId}',
  async (event) => {
    const order = event.data?.data();
    if (!order) return;
    // ... handle new order
  }
);
```

**Function region:** Always set explicitly to `europe-west2` (London) for UK projects
or the region closest to your users. Unset region defaults to us-central1.

---

## Security Rules Patterns

```javascript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ==================
    // Helper functions
    // ==================
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             request.auth.token.admin == true;
    }
    
    function hasRequiredFields(fields) {
      return request.resource.data.keys().hasAll(fields);
    }
    
    function isValidTimestamp(field) {
      return request.resource.data[field] is timestamp;
    }
    
    // ==================
    // Collections
    // ==================
    
    // Deny all by default
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Users: own document only
    match /users/{userId} {
      allow get: if isOwner(userId);
      allow update: if isOwner(userId)
                    && !request.resource.data.diff(resource.data).affectedKeys()
                        .hasAny(['createdAt', 'email']); // Can't change immutable fields
      allow create: if isOwner(userId)
                    && hasRequiredFields(['email', 'displayName', 'createdAt'])
                    && request.resource.data.email == request.auth.token.email;
      allow delete: if false; // Soft delete via 'deleted' field
      
      // User's orders subcollection
      match /orders/{orderId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId)
                      && hasRequiredFields(['items', 'total', 'status'])
                      && request.resource.data.status == 'pending'
                      && request.resource.data.total is number
                      && request.resource.data.total > 0;
        allow update: if false; // Orders updated via Functions only
      }
    }
    
    // Products: public read, admin write
    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

---

## Firebase App Check

Required for all production apps. Prevents unauthorised API access.

```typescript
// Web: Add to Firebase client init
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});

// For development: enable debug mode
// self.FIREBASE_APPCHECK_DEBUG_TOKEN = 'your-debug-token'; // In browser console only
```

---

# stacks/supabase.md — Supabase Stack Addendum

## Supabase Project Setup Rules

1. **Supabase CLI for everything** — schema changes, migrations, type generation
2. **Never edit schema in the Supabase Dashboard** for production (use it for exploration only)
3. **RLS on every table, always** — there are no exceptions
4. **Generate TypeScript types after every migration**

```bash
# Development workflow
supabase start                          # Start local Supabase
supabase db diff -f migration_name      # Generate migration from schema changes
supabase db push                        # Apply migrations to remote
supabase gen types typescript \
  --project-id {{SUPABASE_PROJECT_REF}} \
  > src/types/database.ts              # Regenerate types
```

## Migration Pattern

```sql
-- supabase/migrations/20250101000000_create_orders.sql

-- Create orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  total_pence INTEGER NOT NULL CHECK (total_pence > 0),
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Only allow updates via service role (backend functions)
-- No UPDATE policy = users cannot update directly

-- Audit trigger
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for common query
CREATE INDEX idx_orders_user_id_created_at ON orders (user_id, created_at DESC);
```

## Edge Functions

```typescript
// supabase/functions/create-checkout/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req) => {
  // Verify user is authenticated via JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorised', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorised', { status: 401 });

  // ... create Stripe checkout session
});
```
