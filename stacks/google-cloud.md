# stacks/google-cloud.md — Google Cloud Platform

> Google Cloud services used alongside Firebase in this organisation.
> Covers: Cloud Run, Secret Manager, Cloud Storage, IAM, Cloud Build, Cloud Scheduler.
> For Firebase-specific patterns, read `stacks/firebase.md` alongside this file.
> Last reviewed: See git log.

---

## Services We Use

| Service | Purpose | When to use |
|---------|---------|-------------|
| Cloud Run | Containerised API services | Stateless APIs, background workers, webhooks |
| Secret Manager | Secure credential storage | All production secrets — never env vars for secrets |
| Cloud Storage | Object storage | Large files, backups, exports (complement to Firebase Storage) |
| Cloud Scheduler | Cron jobs | Triggering Cloud Run or Firebase Functions on a schedule |
| Cloud Build | CI/CD pipelines | Building and deploying container images to Cloud Run |
| IAM | Access control | Service account permissions for GCP resources |
| Artifact Registry | Container image storage | Docker images for Cloud Run |
| Cloud Logging | Structured logs | Production log aggregation and alerting |

---

## Cloud Run

Cloud Run is the deployment target for Node.js APIs in this organisation.
See `stacks/node-api.md` for the application code patterns.
This section covers the GCP-specific deployment configuration.

### Region selection

Always set the region explicitly. Never deploy to `us-central1` by default.

```yaml
# cloudbuild.yaml
substitutions:
  _REGION: europe-west2    # London — closest to UK users
  _SERVICE: api-service
```

For services with global users, deploy to multiple regions behind a Global Load Balancer.
For single-region services, use the region closest to your Supabase/Firebase project.

### Service configuration

```yaml
# service.yaml — Cloud Run service configuration
# Apply with: gcloud run services replace service.yaml

apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: acme-api
  labels:
    cloud.googleapis.com/location: europe-west2
spec:
  template:
    metadata:
      annotations:
        # Scale to zero when idle (cost saving for low-traffic services)
        autoscaling.knative.dev/minScale: '0'
        autoscaling.knative.dev/maxScale: '10'
        # Startup CPU boost — reduces cold start latency
        run.googleapis.com/startup-cpu-boost: 'true'
        # CPU only allocated during request processing (default — cheaper)
        run.googleapis.com/cpu-throttling: 'true'
    spec:
      # Use a dedicated service account — not the default compute account
      serviceAccountName: acme-api@PROJECT_ID.iam.gserviceaccount.com
      containers:
        - image: europe-west2-docker.pkg.dev/PROJECT_ID/acme/api:latest
          resources:
            limits:
              cpu: '1'
              memory: 512Mi
          env:
            # Reference secrets — never hardcode values
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-url
                  key: latest
            - name: STRIPE_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: stripe-secret-key
                  key: latest
          ports:
            - containerPort: 8080
      timeoutSeconds: 60
```

### Service account principle of least privilege

```bash
# Create a dedicated service account for each Cloud Run service
gcloud iam service-accounts create acme-api \
  --display-name="Acme API Service Account" \
  --project=PROJECT_ID

# Grant only the permissions this service needs
# Example: read from Firestore, write to Cloud Storage
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:acme-api@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:acme-api@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"

# Access Secret Manager secrets
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:acme-api@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Rule:** Never use the default Compute Engine service account for Cloud Run.
It has far too many permissions. Create a dedicated account per service.

### Dockerfile for Cloud Run

```dockerfile
# Cloud Run requires: listens on $PORT (default 8080), runs as non-root
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api
USER api
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Cloud Run sets $PORT — always use it
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/index.js"]
```

### Health checks

Every Cloud Run service must have a health check endpoint:

```typescript
// src/routes/health.ts
app.get('/health', async (req, reply) => {
  // Check database connectivity
  try {
    await db.raw('SELECT 1');
    return reply.send({
      status:  'ok',
      version: process.env.npm_package_version,
      region:  process.env.K_SERVICE ? 'cloud-run' : 'local',
    });
  } catch (err) {
    return reply.status(503).send({ status: 'unhealthy', error: 'DB unavailable' });
  }
});
```

---

## Secret Manager

**Rule: All production secrets live in Secret Manager. Never in environment variables
set directly in the Cloud Run console, never in `.env` files committed to git.**

Secret Manager integrates natively with Cloud Run via `secretKeyRef` in the service
configuration (see above). The service account needs `secretmanager.secretAccessor`.

### Creating and managing secrets

```bash
# Create a secret
echo -n "sk_live_xxxx" | gcloud secrets create stripe-secret-key \
  --data-file=- \
  --project=PROJECT_ID \
  --replication-policy=automatic

# Update a secret (creates a new version, keeps old ones)
echo -n "sk_live_new_xxxx" | gcloud secrets versions add stripe-secret-key \
  --data-file=- \
  --project=PROJECT_ID

# List versions
gcloud secrets versions list stripe-secret-key --project=PROJECT_ID

# Disable an old version after confirming the new one works
gcloud secrets versions disable 1 \
  --secret=stripe-secret-key \
  --project=PROJECT_ID

# Access a secret in development (for local testing)
gcloud secrets versions access latest \
  --secret=stripe-secret-key \
  --project=PROJECT_ID
```

### Access from Node.js (when not using Cloud Run native integration)

```typescript
// Use the native Cloud Run secretKeyRef integration for deployed services.
// This pattern is for Cloud Functions or local development only.
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error(`Secret ${secretName} is empty`);
  return payload;
}
```

### Secret naming convention

```
# Pattern: [service]-[resource]-[environment]
# Examples:
database-url-prod
database-url-staging
stripe-secret-key          # No env suffix — one secret, two versions
firebase-admin-private-key
supabase-service-role-key
```

---

## Cloud Scheduler

For recurring tasks (weekly quality audits, data cleanups, scheduled reports):

```bash
# Create a job that calls a Cloud Run endpoint every Monday at 06:00 UTC
gcloud scheduler jobs create http weekly-quality \
  --location=europe-west2 \
  --schedule="0 6 * * 1" \
  --uri="https://api.acme.app/api/cron/weekly-quality" \
  --http-method=POST \
  --oidc-service-account-email=acme-api@PROJECT_ID.iam.gserviceaccount.com \
  --headers="Content-Type=application/json" \
  --message-body='{"trigger":"scheduler"}'
```

The `--oidc-service-account-email` flag generates an OIDC token that the Cloud Run
service can verify to confirm the request came from Cloud Scheduler, not the public internet.

```typescript
// In the Cloud Run endpoint — verify the scheduler token
import { OAuth2Client } from 'google-auth-library';

const oauthClient = new OAuth2Client();

async function verifySchedulerRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  try {
    const token = authHeader.slice(7);
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: 'https://api.acme.app/api/cron/weekly-quality',
    });
    const payload = ticket.getPayload();
    return payload?.email === `acme-api@${process.env.GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com`;
  } catch {
    return false;
  }
}
```

---

## Cloud Build (CI/CD)

```yaml
# cloudbuild.yaml — Build, test, and deploy to Cloud Run

steps:
  # 1. Install and test
  - name: 'node:22'
    entrypoint: pnpm
    args: ['install', '--frozen-lockfile']

  - name: 'node:22'
    entrypoint: pnpm
    args: ['test:unit']
    env:
      - 'NODE_ENV=test'

  # 2. Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - '--no-cache'
      - '--tag=$_IMAGE_NAME'
      - '.'

  # 3. Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '$_IMAGE_NAME']

  # 4. Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - '$_SERVICE_NAME'
      - '--image=$_IMAGE_NAME'
      - '--region=$_REGION'
      - '--service-account=$_SERVICE_ACCOUNT'
      - '--no-allow-unauthenticated'   # Require authentication for internal services
      # OR '--allow-unauthenticated'   # For public-facing APIs

substitutions:
  _REGION:          europe-west2
  _SERVICE_NAME:    acme-api
  _SERVICE_ACCOUNT: acme-api@PROJECT_ID.iam.gserviceaccount.com
  _IMAGE_NAME:      europe-west2-docker.pkg.dev/PROJECT_ID/acme/api:$COMMIT_SHA

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: E2_MEDIUM
```

---

## Environment Manifest Integration

The `.env.manifest` must include Cloud Run service details:

```json
"cloudRun": {
  "projectId":  "acme-prod",
  "region":     "europe-west2",
  "services": [
    { "name": "api-service",    "url": "https://api-service-xxx-ew.a.run.app" },
    { "name": "worker-service", "url": "https://worker-service-xxx-ew.a.run.app" }
  ]
}
```

The `verify-env.js` script checks these against runtime variables before any deployment.

---

## Key Documentation URLs

Always fetch these directly — do not search:

| Resource | URL |
|----------|-----|
| Cloud Run release notes | https://cloud.google.com/run/docs/release-notes |
| Secret Manager release notes | https://cloud.google.com/secret-manager/docs/release-notes |
| Cloud Build release notes | https://cloud.google.com/build/docs/release-notes |
| Cloud Scheduler release notes | https://cloud.google.com/scheduler/docs/release-notes |
| IAM release notes | https://cloud.google.com/iam/docs/release-notes |
| GCP Node.js client libraries | https://cloud.google.com/nodejs/docs/reference |
| firebase-admin npm | https://registry.npmjs.org/firebase-admin/latest |
| @google-cloud/secret-manager | https://registry.npmjs.org/@google-cloud/secret-manager/latest |
