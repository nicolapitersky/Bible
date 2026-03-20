# stacks/node-api.md — Node.js API / Cloud Run Addendum

> For standalone API services deployed to Google Cloud Run, Firebase Functions,
> or as a standalone Node.js backend.

---

## Framework Selection

| Scenario | Framework | Why |
|----------|-----------|-----|
| REST API, simple | Express + Zod | Battle-tested, minimal overhead |
| REST API, complex | Fastify | 2× faster than Express, built-in schema validation |
| Full-stack Next.js | Next.js API Routes / tRPC | Co-located with frontend |
| GraphQL | Pothos + Yoga | Type-safe schema-first |
| Serverless | Firebase Functions v2 | For Firebase-native workloads |

**New projects default to Fastify unless there is a specific reason for another choice.**

---

## Fastify Setup (preferred)

```typescript
// src/index.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import { env } from './config/env';
import { routes } from './routes';
import { logger } from './utils/logger';

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// ── Security plugins ──────────────────────────────────────────────────────
await app.register(helmet, {
  contentSecurityPolicy: env.NODE_ENV === 'production',
});

await app.register(cors, {
  origin: env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please retry after one minute.',
  }),
});

// ── Utility plugins ───────────────────────────────────────────────────────
await app.register(sensible); // Adds reply.badRequest(), reply.notFound(), etc.

// ── Routes ────────────────────────────────────────────────────────────────
await app.register(routes, { prefix: '/api/v1' });

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version,
}));

// ── Start ─────────────────────────────────────────────────────────────────
const port = env.PORT ?? 8080;
try {
  await app.listen({ port, host: '0.0.0.0' }); // 0.0.0.0 required for Cloud Run
  logger.info(`Server running on port ${port}`);
} catch (err) {
  logger.error('Failed to start server', { err });
  process.exit(1);
}
```

---

## Environment Validation (mandatory)

```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),

  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Firebase Admin (if used)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Stripe (if used)
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
// Throws at startup with a clear message if any required variable is missing.
```

---

## Request Validation Pattern

Every route validates input with Zod. Never trust request data.

```typescript
// src/routes/orders/index.ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { authenticate } from '@/middleware/auth';
import { OrderService } from '@/services/order-service';

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(50),
  deliveryAddressId: z.string().uuid(),
});

const ordersPlugin: FastifyPluginAsync = async (fastify) => {
  // GET /orders — user's own orders
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orders = await OrderService.getUserOrders(request.user.id);
    return { orders };
  });

  // POST /orders — create new order
  fastify.post('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    // Validate input
    const result = createOrderSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(result.error.message);
    }

    const order = await OrderService.createOrder({
      userId: request.user.id,
      ...result.data,
    });

    return reply.status(201).send({ order });
  });
};

export default ordersPlugin;
```

---

## Structured Logging (Pino — required)

```typescript
// src/utils/logger.ts
import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  // Redact sensitive fields from all log output
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.cardNumber',
      'body.cvv',
    ],
    censor: '[REDACTED]',
  },
  // Standard fields on every log line
  base: {
    env: env.NODE_ENV,
    version: process.env.npm_package_version,
  },
});

// Usage:
// logger.info({ userId, orderId }, 'Order created');
// logger.error({ err, userId }, 'Failed to process payment');
// Never: logger.info('User password: ' + password);
```

---

## Error Handling (consistent across all routes)

```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class UnauthorisedError extends AppError {
  constructor(message = 'Unauthorised') {
    super(message, 'UNAUTHORISED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

// Fastify error handler
export function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // Unexpected errors — log full details, return generic message
  request.log.error({ err: error }, 'Unhandled error');
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
```

---

## Google Cloud Run Configuration

```dockerfile
# Dockerfile
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Build
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api
USER api

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Cloud Run listens on $PORT (default 8080)
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

```yaml
# cloudbuild.yaml — Google Cloud Build
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - '--no-cache'
      - '-t'
      - '$_IMAGE_NAME'
      - '.'

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '$_IMAGE_NAME']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - '$_SERVICE_NAME'
      - '--image=$_IMAGE_NAME'
      - '--region=$_REGION'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--min-instances=1'
      - '--max-instances=10'
      - '--memory=512Mi'
      - '--cpu=1'
      - '--set-env-vars=NODE_ENV=production'

substitutions:
  _REGION: europe-west2
  _SERVICE_NAME: api-service
  _IMAGE_NAME: gcr.io/$PROJECT_ID/$_SERVICE_NAME:$COMMIT_SHA

options:
  logging: CLOUD_LOGGING_ONLY
```

---

## Rate Limiting Configuration by Endpoint Type

```typescript
// Different limits for different endpoint types

// Auth endpoints (strict)
const authRateLimit = {
  max: 5,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip, // Per-IP
};

// Authenticated API (generous)
const apiRateLimit = {
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.user?.id ?? req.ip, // Per-user when authenticated
};

// Webhooks (no limit — validated by signature)
// Do NOT rate limit webhook endpoints — Stripe/Firebase may retry

// Public read endpoints (moderate)
const publicRateLimit = {
  max: 60,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
};
```
