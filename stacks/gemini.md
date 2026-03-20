# stacks/gemini.md — Google Gemini API and Vertex AI

> Google's AI services: Gemini API (via AI Studio), Vertex AI (enterprise GCP),
> and the Google Generative AI SDK.
> Last reviewed: See git log.

---

## Two Access Paths — Choose One

Google offers Gemini through two distinct products. Choose based on your context:

| | Gemini API (AI Studio) | Vertex AI |
|---|---|---|
| **Access** | API key | Google Cloud project + IAM |
| **Billing** | Google AI billing | GCP billing |
| **Models** | Gemini 1.5/2.0 Flash/Pro | Gemini + Claude + Llama + others |
| **Rate limits** | Lower (generous free tier) | Higher (enterprise) |
| **Location** | Global | Regional (data residency) |
| **Best for** | Prototyping, smaller apps | Production, data residency requirements, multi-model |
| **SDK** | `@google/generative-ai` | `@google-cloud/vertexai` |

**Rule:** Use Gemini API for new features. Migrate to Vertex AI if you hit rate limits
or need data residency. Do not use both simultaneously in one service.

---

## Approved npm Packages

```bash
# Gemini API (AI Studio path)
pnpm add @google/generative-ai

# Vertex AI (GCP path)
pnpm add @google-cloud/vertexai

# Never use both in the same service
```

---

## Models (as of handbook review — always check release notes)

| Model | Best for | Context window | Notes |
|-------|---------|---------------|-------|
| `gemini-2.0-flash` | Fast tasks, high volume | 1M tokens | Default choice |
| `gemini-2.0-flash-thinking` | Complex reasoning | 1M tokens | Slower, better for multi-step |
| `gemini-1.5-pro` | Long context, complex | 2M tokens | Longer context than Flash |
| `gemini-1.5-flash` | Balanced speed/quality | 1M tokens | Previous generation |

**Always pin the model name with the version suffix.** Never use `gemini-pro` without
a version — it resolves to different models over time and will silently change behaviour.

```typescript
// ✅ Pinned — predictable behaviour
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ❌ Unpinned — will silently change
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
```

---

## Gemini API Setup (AI Studio)

```typescript
// src/lib/gemini.ts — Gemini API via AI Studio
import 'server-only';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { env } from './env';

export const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// Standard safety settings — adjust per use case
export const DEFAULT_SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export function getModel(modelName = 'gemini-2.0-flash') {
  return genAI.getGenerativeModel({
    model: modelName,
    safetySettings: DEFAULT_SAFETY,
    generationConfig: {
      temperature:     0.7,
      topP:            0.95,
      maxOutputTokens: 8192,
    },
  });
}
```

### Text generation

```typescript
// Simple text generation
async function generateText(prompt: string): Promise<string> {
  const model  = getModel();
  const result = await model.generateContent(prompt);
  const text   = result.response.text();

  // Always check finish reason — SAFETY means the response was blocked
  const candidate = result.response.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY') {
    throw new Error('Response blocked by safety filters');
  }

  return text;
}

// With system instruction
async function generateWithSystem(system: string, userMessage: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model:           'gemini-2.0-flash',
    systemInstruction: system,
    safetySettings:  DEFAULT_SAFETY,
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}
```

### Streaming

```typescript
// Streaming response — better UX for long outputs
async function* streamText(prompt: string) {
  const model  = getModel();
  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

// In a Next.js Route Handler
export async function POST(req: Request) {
  const { prompt } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of streamText(prompt)) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

### Multimodal (image + text)

```typescript
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

async function analyseImage(imageBuffer: Buffer, mimeType: string, prompt: string) {
  const model = getModel('gemini-2.0-flash');

  const imagePart: Part = {
    inlineData: {
      data:     imageBuffer.toString('base64'),
      mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
    },
  };

  const result = await model.generateContent([imagePart, prompt]);
  return result.response.text();
}
```

### Structured output (JSON mode)

```typescript
import { z } from 'zod';

const extractedDataSchema = z.object({
  title:    z.string(),
  summary:  z.string(),
  topics:   z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

async function extractStructured(text: string) {
  const model = getModel();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          title:     { type: 'string' },
          summary:   { type: 'string' },
          topics:    { type: 'array', items: { type: 'string' } },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        },
        required: ['title', 'summary', 'topics', 'sentiment'],
      },
    },
  });

  const raw = JSON.parse(result.response.text());
  return extractedDataSchema.parse(raw); // Zod validates the AI output
}
```

---

## Vertex AI Setup (GCP Path)

Use when you need data residency, higher rate limits, or multi-model access.

```typescript
// src/lib/vertex.ts — Vertex AI
import 'server-only';
import { VertexAI } from '@google-cloud/vertexai';

const vertex = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: 'europe-west2', // Always set location explicitly for data residency
});

export function getVertexModel(modelName = 'gemini-2.0-flash') {
  return vertex.getGenerativeModel({
    model: modelName,
    generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
  });
}
```

Authentication uses Application Default Credentials (ADC) — no API key needed
when running on Cloud Run with the correct IAM service account.

```bash
# Grant the Cloud Run service account access to Vertex AI
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:acme-api@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# For local development
gcloud auth application-default login
```

---

## Embeddings

```typescript
// Text embeddings for semantic search, RAG, recommendations
async function embedText(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT', // or RETRIEVAL_QUERY, SEMANTIC_SIMILARITY
  });

  return result.embedding.values;
}

// Batch embedding (more efficient for large sets)
async function embedBatch(texts: string[]): Promise<number[][]> {
  const model  = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.batchEmbedContents({
    requests: texts.map(text => ({
      content:  { role: 'user', parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
    })),
  });

  return result.embeddings.map(e => e.values);
}
```

Store embeddings in Supabase using the `pgvector` extension:

```sql
-- Enable pgvector (Supabase has this built in)
CREATE EXTENSION IF NOT EXISTS vector;

-- Table with embedding column
CREATE TABLE documents (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content    TEXT NOT NULL,
  embedding  vector(768),  -- text-embedding-004 outputs 768 dimensions
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IVFFlat index for approximate nearest neighbour search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);  -- sqrt(row_count) is a good starting point

-- Semantic search query
SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity
FROM documents
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

---

## Rate Limiting and Error Handling

```typescript
// Gemini API rate limits: 15 RPM (free), 1500 RPM (paid)
// Always handle quota errors gracefully

async function generateWithRetry(
  prompt: string,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateText(prompt);
    } catch (err) {
      const isQuotaError = err instanceof Error &&
        (err.message.includes('429') || err.message.includes('quota'));

      if (isQuotaError && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Cost Control

```typescript
// Always set maxOutputTokens — unbounded generation is expensive
const generationConfig = {
  maxOutputTokens: 1024,  // Set based on expected output length
  temperature: 0.3,       // Lower = more deterministic = usually cheaper
};

// Count tokens before sending large prompts
const model  = getModel();
const tokens = await model.countTokens(longPrompt);
logger.info({ tokens: tokens.totalTokens }, 'Prompt token count');

if (tokens.totalTokens > 100_000) {
  throw new Error('Prompt too long — chunk or summarise first');
}
```

---

## Key Documentation URLs

| Resource | URL |
|----------|-----|
| Gemini API changelog | https://ai.google.dev/gemini-api/docs/changelog |
| Gemini models list | https://ai.google.dev/gemini-api/docs/models |
| Vertex AI release notes | https://cloud.google.com/vertex-ai/docs/release-notes |
| @google/generative-ai npm | https://registry.npmjs.org/@google/generative-ai/latest |
| @google-cloud/vertexai npm | https://registry.npmjs.org/@google-cloud/vertexai/latest |
| AI Studio | https://aistudio.google.com |
| Vertex AI console | https://console.cloud.google.com/vertex-ai |
| Pricing | https://ai.google.dev/pricing |
