import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  AI_PROVIDER_IDS,
  AI_PROVIDER_LABELS,
  EMBEDDING_DIMENSIONS,
  GEMINI_EMBEDDING_MODEL,
  GEMINI_MODEL_FALLBACKS,
  detectAiProvider,
  describeAiProvider,
  geminiApiKey,
  isModelUnavailable,
  modelIdsFor,
  withModelFallback,
} from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   AI provider contract.

   Shelf talks to whichever provider the user configured. The rules
   that matter: detection order, the model fallback chain, and the
   embedding width that has to match the pgvector column.
   ══════════════════════════════════════════════════════════════ */

test('provider detection prefers Gemini, then OpenAI, Anthropic, Ollama', () => {
  assert.equal(detectAiProvider({}), null)
  assert.equal(detectAiProvider({ OLLAMA_BASE_URL: 'http://localhost:11434/v1' }), 'ollama')
  assert.equal(detectAiProvider({ ANTHROPIC_API_KEY: 'x' }), 'anthropic')
  assert.equal(detectAiProvider({ OPENAI_API_KEY: 'x' }), 'openai')
  assert.equal(detectAiProvider({ OPENAI_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' }), 'openai')
  assert.equal(detectAiProvider({ GEMINI_API_KEY: 'x', OPENAI_API_KEY: 'y' }), 'gemini')
  assert.equal(detectAiProvider({ GEMINI_API_KEY: 'x', OLLAMA_BASE_URL: 'http://l' }), 'gemini')
})

test('the new Google Auth key format is recognised', () => {
  // Google AI Studio issues `AQ.…` keys now, not `AIza…`.
  const key = 'AQ.AbEXAMPLEfakeKEYfakeKEYfakeKEYfakeKEYfakeKEYfake'
  assert.equal(geminiApiKey({ GEMINI_API_KEY: key }), key)
  assert.equal(detectAiProvider({ GEMINI_API_KEY: key }), 'gemini')

  // Legacy keys keep working.
  assert.equal(detectAiProvider({ GEMINI_API_KEY: 'AIzaSyABC123' }), 'gemini')

  // The legacy env name is still honoured.
  assert.equal(geminiApiKey({ GOOGLE_GENERATIVE_AI_API_KEY: 'AQ.x' }), 'AQ.x')

  // Blank keys do not count as configured.
  assert.equal(geminiApiKey({ GEMINI_API_KEY: '   ' }), undefined)
  assert.equal(detectAiProvider({ GEMINI_API_KEY: '' }), null)
})

test('every provider has a label', () => {
  for (const id of AI_PROVIDER_IDS) {
    assert.ok(AI_PROVIDER_LABELS[id], `missing label for ${id}`)
  }
})

test('model lists put the configured model first', () => {
  assert.deepEqual(modelIdsFor('gemini', {}), GEMINI_MODEL_FALLBACKS)
  assert.deepEqual(modelIdsFor('gemini', { GEMINI_MODEL: 'gemini-9.9-ultra' })[0], 'gemini-9.9-ultra')
  assert.equal(modelIdsFor('gemini', { GEMINI_MODEL: 'gemini-9.9-ultra' }).length, GEMINI_MODEL_FALLBACKS.length + 1)
  assert.equal(modelIdsFor('openai', {})[0], 'gpt-4o-mini')
  assert.equal(modelIdsFor('ollama', {})[0], 'llama3.1')
})

test('embeddings are pinned to the pgvector column width', () => {
  assert.equal(EMBEDDING_DIMENSIONS, 1536)
  assert.equal(GEMINI_EMBEDDING_MODEL, 'gemini-embedding-001')
})

test('only model-unavailable errors trigger the fallback chain', () => {
  assert.equal(isModelUnavailable(new Error('model gemini-9.9-ultra is not found for api version')), true)
  assert.equal(isModelUnavailable(new Error('Model not found')), true)
  assert.equal(isModelUnavailable({ statusCode: 404, message: 'nope' }), true)
  assert.equal(isModelUnavailable(new Error('401 Unauthorized')), false)
  assert.equal(isModelUnavailable(new Error('quota exceeded')), false)
  assert.equal(isModelUnavailable(new Error('fetch failed')), false)
})

test('the fallback chain moves on only for unavailable models', async () => {
  const tried: string[] = []
  const result = await withModelFallback(['a', 'b', 'c'], async (id) => {
    tried.push(id)
    if (id === 'a') throw new Error('model a is not found')
    if (id === 'b') throw new Error('model b is not found')
    return `ok:${id}`
  })
  assert.equal(result, 'ok:c')
  assert.deepEqual(tried, ['a', 'b', 'c'])
})

test('a real error stops the fallback chain immediately', async () => {
  const tried: string[] = []
  await assert.rejects(
    () =>
      withModelFallback(['a', 'b'], async (id) => {
        tried.push(id)
        throw new Error('401 Unauthorized')
      }),
    /401 Unauthorized/,
  )
  assert.deepEqual(tried, ['a'])
})

test('the provider description never leaks a key', () => {
  const secret = 'AQ.AbEXAMPLEfakeKEYfakeKEYfakeKEYfakeKEYfakeKEYfake'
  const described = describeAiProvider({ GEMINI_API_KEY: secret })
  assert.equal(described.id, 'gemini')
  assert.equal(described.label, 'Google Gemini')
  assert.equal(described.model, GEMINI_MODEL_FALLBACKS[0])
  assert.equal(described.embeddingModel, GEMINI_EMBEDDING_MODEL)
  assert.ok(!JSON.stringify(described).includes(secret), 'the description must not contain the key')
})
