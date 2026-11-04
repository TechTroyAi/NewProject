/* ══════════════════════════════════════════════════════════════
   AI provider contract.

   Shelf is provider-agnostic. The first provider with a key wins:

     Gemini  →  OpenAI  →  Anthropic  →  Ollama

   This file holds the *pure* parts — detection, key extraction and
   model lists — so the web app and the worker always agree on
   which provider is live. The clients themselves live next to
   whoever needs them.

   Google AI Studio now issues *Auth keys* that start with `AQ.`
   instead of the legacy `AIza…` format. Auth keys must be sent in
   the `x-goog-api-key` header rather than as a bearer token.
   ══════════════════════════════════════════════════════════════ */

export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'ollama'

export const AI_PROVIDER_IDS: AiProviderId[] = ['gemini', 'openai', 'anthropic', 'ollama']

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (local)',
}

/** Gemini model ids, tried in order until one resolves on the account. */
export const GEMINI_MODEL_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash']

export const OPENAI_MODEL_FALLBACKS = ['gpt-4o-mini', 'gpt-4o']

export const ANTHROPIC_MODEL_FALLBACKS = ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest']

export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
export const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'

/** pgvector column width — every provider has to match it. */
export const EMBEDDING_DIMENSIONS = 1536

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export type Env = Record<string, string | undefined>

export function geminiApiKey(env: Env = process.env): string | undefined {
  return env.GEMINI_API_KEY?.trim() || env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || undefined
}

export function openaiApiKey(env: Env = process.env): string | undefined {
  return env.OPENAI_API_KEY?.trim() || undefined
}

export function anthropicApiKey(env: Env = process.env): string | undefined {
  return env.ANTHROPIC_API_KEY?.trim() || undefined
}

export function ollamaBaseUrl(env: Env = process.env): string | undefined {
  return env.OLLAMA_BASE_URL?.trim() || undefined
}

/** Which provider would be used, without building any client. */
export function detectAiProvider(env: Env = process.env): AiProviderId | null {
  if (geminiApiKey(env)) return 'gemini'
  if (openaiApiKey(env)) return 'openai'
  if (anthropicApiKey(env)) return 'anthropic'
  if (ollamaBaseUrl(env)) return 'ollama'
  return null
}

export function aiProviderConfigured(env: Env = process.env): boolean {
  return detectAiProvider(env) !== null
}

/** Candidate model ids for a provider, most-preferred first, no duplicates. */
export function modelIdsFor(id: AiProviderId, env: Env = process.env): string[] {
  const configured: string | undefined =
    id === 'gemini'
      ? env.GEMINI_MODEL
      : id === 'openai'
        ? env.OPENAI_MODEL
        : id === 'anthropic'
          ? env.ANTHROPIC_MODEL
          : env.OLLAMA_MODEL

  const fallbacks: string[] =
    id === 'gemini'
      ? GEMINI_MODEL_FALLBACKS
      : id === 'openai'
        ? OPENAI_MODEL_FALLBACKS
        : id === 'anthropic'
          ? ANTHROPIC_MODEL_FALLBACKS
          : ['llama3.1']

  const ordered = configured ? [configured, ...fallbacks] : fallbacks
  return Array.from(new Set(ordered))
}

/**
 * Is this the kind of failure that another model id would fix?
 *
 * Google retires model ids, so a key that worked yesterday can start
 * answering "model not found" today. Everything else (auth, quota,
 * network) is a real error and should surface.
 */
export function isModelUnavailable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const status =
    (err as { statusCode?: number })?.statusCode ?? (err as { status?: number })?.status ?? undefined
  if (status === 404) return true
  return /model .*not found|not found.*model|unsupported model|is not found for api version|invalid model/i.test(
    message,
  )
}

/**
 * Run `fn` with each candidate model id until one works.
 * Non-model errors are re-thrown immediately.
 */
export async function withModelFallback<T>(
  modelIds: string[],
  fn: (modelId: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown
  for (const id of modelIds) {
    try {
      return await fn(id)
    } catch (err) {
      lastError = err
      if (!isModelUnavailable(err)) throw err
      console.warn(`[shelf] model "${id}" unavailable, trying the next one`)
    }
  }
  throw lastError
}

/** Short description of the active provider, for the settings panel. */
export function describeAiProvider(env: Env = process.env): {
  id: AiProviderId | null
  label: string
  model: string | null
  embeddingModel: string | null
} {
  const id = detectAiProvider(env)
  if (!id) return { id: null, label: 'Offline mock model', model: null, embeddingModel: null }
  const embeddingModel =
    id === 'gemini'
      ? GEMINI_EMBEDDING_MODEL
      : id === 'openai'
        ? OPENAI_EMBEDDING_MODEL
        : id === 'ollama'
          ? 'nomic-embed-text'
          : null
  return {
    id,
    label: AI_PROVIDER_LABELS[id],
    model: modelIdsFor(id, env)[0],
    embeddingModel,
  }
}
