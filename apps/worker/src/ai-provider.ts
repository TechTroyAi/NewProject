import OpenAI from 'openai'
import {
  EMBEDDING_DIMENSIONS,
  GEMINI_BASE_URL,
  GEMINI_EMBEDDING_MODEL,
  detectAiProvider,
  geminiApiKey,
  modelIdsFor,
  openaiApiKey,
  withModelFallback,
  type AiProviderId,
} from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   Worker-side AI calls.

   The worker talks to the provider directly over HTTP rather than
   through the Vercel AI SDK, so it stays a small container with two
   dependencies. It speaks the same provider contract as the web
   app (see `@shelf/shared`), so the two never disagree about which
   model is live.
   ══════════════════════════════════════════════════════════════ */

/* ─── Gemini ─────────────────────────────────────────────────── */

/**
 * Gemini Auth keys (`AQ.…`) must be sent in the `x-goog-api-key`
 * header — they are not bearer tokens.
 */
function geminiHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-goog-api-key': geminiApiKey() ?? '',
  }
}

interface GeminiGenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  error?: { message?: string }
}

async function geminiGenerate(model: string, system: string, user: string, temperature: number): Promise<string> {
  const res = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
    method: 'POST',
    headers: geminiHeaders(),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(120_000),
  })

  const json = (await res.json()) as GeminiGenerateResponse
  if (!res.ok) {
    const err = new Error(json.error?.message ?? `gemini ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
}

interface GeminiEmbedResponse {
  embeddings?: { values?: number[] }[]
  error?: { message?: string }
}

async function geminiEmbed(texts: string[], taskType: string): Promise<number[][]> {
  const res = await fetch(`${GEMINI_BASE_URL}/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`, {
    method: 'POST',
    headers: geminiHeaders(),
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType,
      })),
    }),
    signal: AbortSignal.timeout(120_000),
  })

  const json = (await res.json()) as GeminiEmbedResponse
  if (!res.ok) {
    const err = new Error(json.error?.message ?? `gemini embed ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (json.embeddings ?? []).map((e) => e.values ?? [])
}

/* ─── OpenAI ─────────────────────────────────────────────────── */

async function openaiChatJson(system: string, user: string, temperature: number): Promise<string> {
  const client = new OpenAI({ apiKey: openaiApiKey() ?? 'sk-placeholder' })
  const model = process.env.INGEST_MODEL ?? 'gpt-4o-mini'
  const res = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  return res.choices[0]?.message?.content ?? '{}'
}

async function openaiEmbed(texts: string[]): Promise<number[][]> {
  const client = new OpenAI({ apiKey: openaiApiKey() ?? 'sk-placeholder' })
  const res = await client.embeddings.create({
    model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return res.data.map((d) => d.embedding)
}

/* ─── Public API ─────────────────────────────────────────────── */

export function workerProvider(): AiProviderId | null {
  return detectAiProvider()
}

/**
 * One structured (JSON) completion.
 *
 * Gemini gets `responseMimeType: application/json`, OpenAI gets
 * `response_format: json_object` — same contract, different wire.
 */
export async function chatJson(opts: {
  system: string
  user: string
  temperature?: number
  modelIds?: string[]
}): Promise<string> {
  const id = detectAiProvider()
  const temperature = opts.temperature ?? 0.2

  if (id === 'gemini') {
    const ids = opts.modelIds ?? modelIdsFor('gemini')
    return withModelFallback(ids, (model) => geminiGenerate(model, opts.system, opts.user, temperature))
  }

  if (id === 'openai') {
    return openaiChatJson(opts.system, opts.user, temperature)
  }

  throw new Error('No AI provider configured for the worker')
}

/**
 * Embed texts into the 1536-dimension space the pgvector column
 * expects. Gemini's `gemini-embedding-001` can be asked for exactly
 * 1536 dimensions, so both providers land in the same space width.
 */
export async function embedTexts(
  texts: string[],
  opts: { taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' } = {},
): Promise<number[][]> {
  if (!texts.length) return []

  const id = detectAiProvider()
  if (id === 'gemini') return geminiEmbed(texts, opts.taskType ?? 'RETRIEVAL_DOCUMENT')
  if (id === 'openai') return openaiEmbed(texts)

  throw new Error('No embedding provider configured')
}
