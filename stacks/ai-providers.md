# stacks/ai-providers.md — AI Provider APIs

> Patterns for integrating Claude (Anthropic), GPT-4o/o1 (OpenAI), and Gemini (Google)
> into products built by this organisation.
> Covers: SDK setup, prompt engineering, streaming, tool use, cost control, safety.
> Last reviewed: See git log.

---

## Provider Selection Guide

| Use case | Recommended | Why |
|----------|------------|-----|
| General reasoning, writing, code | Claude 3.5 Sonnet | Best instruction-following, long context |
| High-volume, fast responses | Claude 3.5 Haiku | Fastest Claude, cost-effective |
| Complex multi-step reasoning | Claude 3.5 Sonnet / o1 | Chain of thought, accuracy |
| Multimodal (images + text) | Claude 3.5 Sonnet or GPT-4o | Both strong |
| Embeddings / semantic search | text-embedding-3-small (OpenAI) or text-embedding-004 (Google) | Cost and quality |
| Google Cloud-native features | Gemini via Vertex AI | ADC auth, data residency |
| Firebase Studio AI features | Gemini (built in) | Native integration |

**Rule:** Pick one primary provider per feature area. Do not mix Claude and GPT-4o
in the same feature — it creates maintenance burden with no benefit.

---

## Anthropic (Claude API)

### Setup

```typescript
// src/lib/claude.ts
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

export const claude = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// Approved models — pin explicitly, never use 'latest' aliases
export const CLAUDE_MODELS = {
  sonnet: 'claude-sonnet-4-5',  // Balanced: quality + speed
  haiku:  'claude-haiku-4-5',   // Fast + cheap: high-volume tasks
} as const;
```

### Text generation

```typescript
async function generateText(
  prompt: string,
  options: { model?: string; maxTokens?: number; system?: string } = {}
): Promise<string> {
  const message = await claude.messages.create({
    model:      options.model ?? CLAUDE_MODELS.sonnet,
    max_tokens: options.maxTokens ?? 1024,
    system:     options.system,
    messages:   [{ role: 'user', content: prompt }],
  });

  // Claude always returns content — check for stop reason
  if (message.stop_reason === 'max_tokens') {
    logger.warn({ model: message.model }, 'Claude response truncated — increase max_tokens');
  }

  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}
```

### Streaming

```typescript
// Next.js Route Handler — streaming response to browser
export async function POST(req: Request) {
  const { prompt } = await req.json();

  const stream = claude.messages.stream({
    model:      CLAUDE_MODELS.haiku,
    max_tokens: 2048,
    messages:   [{ role: 'user', content: prompt }],
  });

  // Convert Anthropic stream to Web ReadableStream
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta') {
          controller.enqueue(new TextEncoder().encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

### Tool use (function calling)

```typescript
import type { Tool, MessageParam } from '@anthropic-ai/sdk/resources/messages';

const tools: Tool[] = [
  {
    name: 'get_order_status',
    description: 'Get the current status of a customer order',
    input_schema: {
      type:     'object',
      properties: {
        order_id: { type: 'string', description: 'The order ID to look up' },
      },
      required: ['order_id'],
    },
  },
];

async function runWithTools(userMessage: string): Promise<string> {
  const messages: MessageParam[] = [{ role: 'user', content: userMessage }];

  while (true) {
    const response = await claude.messages.create({
      model:      CLAUDE_MODELS.sonnet,
      max_tokens: 4096,
      tools,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find(b => b.type === 'text');
      return text?.text ?? '';
    }

    if (response.stop_reason === 'tool_use') {
      // Add assistant response to history
      messages.push({ role: 'assistant', content: response.content });

      // Execute all tool calls
      const toolResults = await Promise.all(
        response.content
          .filter(b => b.type === 'tool_use')
          .map(async (b) => {
            if (b.type !== 'tool_use') return null;
            const result = await executeTool(b.name, b.input);
            return { type: 'tool_result' as const, tool_use_id: b.id, content: result };
          })
      );

      messages.push({ role: 'user', content: toolResults.filter(Boolean) as any });
    }
  }
}

async function executeTool(name: string, input: unknown): Promise<string> {
  switch (name) {
    case 'get_order_status': {
      const { order_id } = input as { order_id: string };
      const order = await db.orders.findById(order_id);
      return JSON.stringify({ status: order?.status ?? 'not_found' });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
```

### Structured output

```typescript
import { z } from 'zod';

const analysisSchema = z.object({
  sentiment:   z.enum(['positive', 'neutral', 'negative']),
  confidence:  z.number().min(0).max(1),
  topics:      z.array(z.string()),
  summary:     z.string().max(200),
});

async function analyseText(text: string) {
  const response = await claude.messages.create({
    model:      CLAUDE_MODELS.haiku,
    max_tokens: 512,
    system:     'Respond only with valid JSON matching the requested schema. No explanation.',
    messages: [{
      role:    'user',
      content: `Analyse this text and return JSON with fields: sentiment, confidence (0-1), topics (array), summary (max 200 chars).\n\nText: ${text}`,
    }],
  });

  const text_ = response.content.find(b => b.type === 'text')?.text ?? '{}';
  try {
    return analysisSchema.parse(JSON.parse(text_));
  } catch {
    throw new Error('Claude returned invalid JSON structure');
  }
}
```

### Cost tracking

```typescript
// Always log token usage for cost monitoring
const response = await claude.messages.create({ ... });

logger.info({
  model:        response.model,
  inputTokens:  response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  // Approximate cost (update when pricing changes)
  estimatedCostUsd: (
    response.usage.input_tokens  * 0.000003 +   // $3/MTok input  — Sonnet
    response.usage.output_tokens * 0.000015       // $15/MTok output — Sonnet
  ).toFixed(6),
}, 'Claude API call');
```

---

## OpenAI (GPT-4o / o1 / Embeddings)

### Setup

```typescript
// src/lib/openai.ts
import 'server-only';
import OpenAI from 'openai';
import { env } from './env';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const OPENAI_MODELS = {
  gpt4o:      'gpt-4o',           // Multimodal, strong reasoning
  gpt4oMini:  'gpt-4o-mini',      // Fast + cheap for simple tasks
  o1:         'o1',               // Deep reasoning (slow, expensive)
  o1Mini:     'o1-mini',          // Faster reasoning
  embed:      'text-embedding-3-small',  // Default embedding model
  embedLarge: 'text-embedding-3-large',  // Higher quality embeddings
} as const;
```

### Structured output (native JSON mode)

```typescript
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const reviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  pros:    z.array(z.string()),
  cons:    z.array(z.string()),
  verdict: z.string(),
});

async function generateReview(productDescription: string) {
  const completion = await openai.beta.chat.completions.parse({
    model:           OPENAI_MODELS.gpt4oMini,
    messages: [
      { role: 'system', content: 'You are a product reviewer. Be concise and fair.' },
      { role: 'user',   content: `Review this product: ${productDescription}` },
    ],
    response_format: zodResponseFormat(reviewSchema, 'review'),
  });

  const parsed = completion.choices[0].message.parsed;
  if (!parsed) throw new Error('OpenAI returned no parsed content');
  return parsed; // Already validated by Zod
}
```

### Streaming

```typescript
export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = openai.beta.chat.completions.stream({
    model:    OPENAI_MODELS.gpt4o,
    messages,
  });

  return new Response(stream.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

### Embeddings

```typescript
async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: OPENAI_MODELS.embed,
    input: text,
  });
  return response.data[0].embedding;
}

// Batch (more efficient — up to 2048 items)
async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: OPENAI_MODELS.embed,
    input: texts,
  });
  return response.data
    .sort((a, b) => a.index - b.index) // Preserve order
    .map(item => item.embedding);
}
```

---

## Vercel AI SDK (Multi-Provider Abstraction)

When a feature might need to switch between Claude, GPT-4o, and Gemini, use the
Vercel AI SDK as an abstraction layer. It normalises the APIs.

```bash
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
```

```typescript
// src/lib/ai.ts — provider-agnostic AI client
import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai }    from '@ai-sdk/openai';
import { google }    from '@ai-sdk/google';

type Provider = 'claude' | 'gpt4o' | 'gemini';

function getModel(provider: Provider) {
  switch (provider) {
    case 'claude':  return anthropic('claude-sonnet-4-5');
    case 'gpt4o':   return openai('gpt-4o');
    case 'gemini':  return google('gemini-2.0-flash');
  }
}

export async function generate(
  prompt: string,
  provider: Provider = 'claude'
): Promise<string> {
  const { text } = await generateText({
    model:  getModel(provider),
    prompt,
  });
  return text;
}

// Streaming with the Vercel AI SDK
export function stream(prompt: string, provider: Provider = 'claude') {
  return streamText({
    model:  getModel(provider),
    prompt,
  });
}
```

Use the Vercel AI SDK when: the provider choice is not decided yet, you want A/B
testing between models, or you need to fall back between providers.

Use the native SDKs directly when: you need provider-specific features (Claude tool
use schema, OpenAI structured output, Gemini multimodal) or maximum control.

---

## Prompt Engineering Rules

These apply to all three providers.

### Always use a system prompt for production features

```typescript
// ✅ Controlled, reproducible
await claude.messages.create({
  system: `You are a customer support agent for Acme.
           You have access to order information.
           Always be polite and concise.
           Never discuss competitor products.
           If you cannot help, say so and offer to escalate.`,
  messages: [{ role: 'user', content: userMessage }],
  ...
});

// ❌ No system prompt — model behaviour is inconsistent
await claude.messages.create({
  messages: [{ role: 'user', content: userMessage }],
  ...
});
```

### Set temperature deliberately

```typescript
const temperatureByUseCase = {
  factExtraction:   0.0,  // Deterministic — same answer every time
  summarisation:    0.3,  // Mostly deterministic, slight variation OK
  generalAssistant: 0.7,  // Balanced
  creativeWriting:  0.9,  // High variation intentional
};
```

### Always validate AI output

AI models hallucinate. Never trust raw AI output for data that goes into a database
or is presented to users as fact without validation.

```typescript
// ✅ Validate with Zod
const result = schema.safeParse(JSON.parse(aiResponse));
if (!result.success) {
  logger.warn({ errors: result.error }, 'AI returned invalid structure');
  // Fall back gracefully or retry
}

// ❌ Trust AI output directly
const data = JSON.parse(aiResponse); // Can throw, can have wrong shape
await db.insert(data);               // Risk of invalid data
```

### Never put PII in prompts

```typescript
// ❌ PII in prompt — violates data minimisation
const prompt = `Write a message for ${user.fullName} at ${user.email}`;

// ✅ Use placeholders
const prompt = `Write a message for the user`;
// Insert personalisation after — not in the AI prompt
const aiResponse = await generate(prompt);
const personalised = aiResponse.replace('[USER_NAME]', user.displayName);
```

---

## Rate Limiting and Resilience

```typescript
// Wrap all AI calls with retry and timeout
import pRetry from 'p-retry';

async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  return pRetry(fn, {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 8000,
    factor:  2,
    onFailedAttempt: (error) => {
      logger.warn({ attempt: error.attemptNumber, err: error }, 'AI call failed, retrying');
    },
    shouldRetry: (error) => {
      // Retry on rate limits and server errors, not on invalid requests
      const status = (error as any).status;
      return status === 429 || status >= 500;
    },
  });
}
```

---

## Key Documentation URLs

| Provider | Resource | URL |
|----------|---------|-----|
| Anthropic | API reference | https://docs.anthropic.com/en/api/getting-started |
| Anthropic | Release notes | https://docs.anthropic.com/en/release-notes/api |
| Anthropic | Models list | https://docs.anthropic.com/en/docs/about-claude/models |
| Anthropic | Prompt library | https://docs.anthropic.com/en/prompt-library |
| Anthropic | SDK npm | https://registry.npmjs.org/@anthropic-ai/sdk/latest |
| OpenAI | API reference | https://platform.openai.com/docs/api-reference |
| OpenAI | Changelog | https://platform.openai.com/docs/changelog |
| OpenAI | Models list | https://platform.openai.com/docs/models |
| OpenAI | SDK npm | https://registry.npmjs.org/openai/latest |
| Vercel AI SDK | Docs | https://sdk.vercel.ai/docs |
| Vercel AI SDK | npm | https://registry.npmjs.org/ai/latest |
