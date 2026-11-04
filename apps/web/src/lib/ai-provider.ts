import 'server-only'
import './env'
import { embed, type LanguageModel } from 'ai'
import type { EmbeddingModelV1 } from '@ai-sdk/provider'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'

/* ══════════════════════════════════════════════════════════════
   AI provider resolution.

   Shelf is provider-agnostic. It picks the first provider that has
   a key, in this order:

     Gemini  →  OpenAI  →  Anthropic  →  Ollama

   Google AI Studio now issues *Auth keys* that start with `AQ.`
   instead of the legacy `AIza…` format. Auth keys must be sent in
   the `x-goog-api-key` header, which is exactly what the
   `@ai-sdk/google` provider does — so no special-casing is needed
   beyond choosing the right provider.
   ══════════════════════════════════════════════════════════════ */

import {
  AI_PROVIDER_IDS as PROVIDER_IDS,
  AI_PROVIDER_LABELS as PROVIDER_LABELS,
  ANTHROPIC_MODEL_FALLBACKS as ANTHROPIC_MODELS,
  EMBEDDING_DIMENSIONS,
  GEMINI_EMBEDDING_MODEL,
  GEMINI_MODEL_FALLBACKS as GEMINI_MODELS,
  OPENAI_EMBEDDING_MODEL,
  OPENAI_MODEL_FALLBACKS as OPENAI_MODELS,
  anthropicApiKey as anthropicKey,
  describeAiProvider,
  detectAiProvider,
  geminiApiKey as geminiKey,
  isModelUnavailable,
  modelIdsFor,
  ollamaBaseUrl as ollamaBase,
  openaiApiKey as openaiKey,
  withModelFallback,
  type AiProviderId as ProviderId,
} from '@shelf/shared'

export {
  describeAiProvider as describeProvider,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  GEMINI_MODELS,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_EMBEDDING_MODEL,
  OPENAI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  isModelUnavailable,
  withModelFallback,
}

export type { ProviderId }

export interface ProviderConfig {
  id: ProviderId
  label: string
  /** The default model. */
  model: LanguageModel
  /** Model ids to try in order — the first one that resolves wins. */
  modelIds: string[]
  /** Build the client for a specific model id (used by the fallback chain). */
  modelFor: (modelId: string) => LanguageModel
  embeddingModel: EmbeddingModelV1<string> | null
  embeddingModelId: string
  embeddingDimensions: number
}

type Env = Record<string, string | undefined>

export function providerConfigured(env: Env = process.env): boolean {
  return detectAiProvider(env) !== null
}

/**
 * Build the provider client. Returns null when nothing is configured,
 * in which case Shelf falls back to its deterministic offline model.
 */
export function resolveProvider(env: Env = process.env): ProviderConfig | null {
  const id = detectAiProvider(env)
  if (!id) return null

  if (id === 'gemini') {
    const key = geminiKey(env)!
    const google = createGoogleGenerativeAI({
      apiKey: key,
      ...(env.GEMINI_BASE_URL ? { baseURL: env.GEMINI_BASE_URL.replace(/\/$/, '') } : {}),
    })
    const modelIds = modelIdsFor('gemini', env)
    const primary = modelIds[0]
    return {
      id,
      label: PROVIDER_LABELS.gemini,
      model: google(modelIds[0]),
      modelIds,
      modelFor: (id: string) => google(id),
      embeddingModel: google.embedding(GEMINI_EMBEDDING_MODEL, {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
      embeddingModelId: GEMINI_EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
    }
  }

  if (id === 'openai') {
    const key = openaiKey(env)!
    const client = createOpenAI({ apiKey: key })
    const modelIds = modelIdsFor('openai', env)
    return {
      id,
      label: PROVIDER_LABELS.openai,
      model: client(modelIds[0]),
      modelIds,
      modelFor: (id: string) => client(id),
      embeddingModel: client.embedding(OPENAI_EMBEDDING_MODEL, { dimensions: EMBEDDING_DIMENSIONS }),
      embeddingModelId: OPENAI_EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
    }
  }

  if (id === 'anthropic') {
    const key = anthropicKey(env)!
    const client = createAnthropic({ apiKey: key })
    const modelIds = modelIdsFor('anthropic', env)
    return {
      id,
      label: PROVIDER_LABELS.anthropic,
      model: client(modelIds[0]),
      modelIds,
      modelFor: (id: string) => client(id),
      // Anthropic does not serve embeddings — the worker keeps using
      // whichever embedding provider is configured.
      embeddingModel: null,
      embeddingModelId: '',
      embeddingDimensions: EMBEDDING_DIMENSIONS,
    }
  }

  // Ollama — the OpenAI-compatible surface, pointed at a local server.
  const baseURL = ollamaBase(env)!
  const client = createOpenAI({ baseURL, apiKey: env.OLLAMA_API_KEY?.trim() || 'ollama' })
  const modelIds = modelIdsFor('ollama', env)
  return {
    id,
    label: PROVIDER_LABELS.ollama,
    model: client(modelIds[0]),
    modelIds,
    modelFor: (id: string) => client(id),
    embeddingModel: client.embedding('nomic-embed-text', { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingModelId: 'nomic-embed-text',
    embeddingDimensions: EMBEDDING_DIMENSIONS,
  }
}


/**
 * Embed a single string with the active provider's embedding model.
 *
 * Returns null when no embedding provider is configured (Anthropic
 * serves no embeddings) or when the call fails — callers fall back
 * to keyword ranking, so a flaky embedding service never breaks search.
 */
export async function embedText(value: string): Promise<number[] | null> {
  const provider = resolveProvider()
  if (!provider?.embeddingModel) return null
  try {
    const { embedding } = await embed({ model: provider.embeddingModel, value })
    return embedding
  } catch (err) {
    console.warn('[shelf] embedding failed:', err instanceof Error ? err.message : err)
    return null
  }
}
