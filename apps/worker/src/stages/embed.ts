import { EMBEDDING_DIMENSIONS } from '@shelf/shared'
import { embedTexts } from '../ai-provider.js'

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS_EXPORT = EMBEDDING_DIMENSIONS

/**
 * Embed chunks. Batched, with a retry on rate limit.
 *
 * The dimension is pinned to 1536 to match the pgvector column, for
 * every provider — Gemini's `gemini-embedding-001` is asked for
 * exactly that width.
 */
export async function embedChunks(chunks: { content: string }[]) {
  if (!chunks.length) return []
  const out: number[][] = []

  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100)
    let attempt = 0
    for (;;) {
      try {
        const vectors = await embedTexts(batch.map((c) => c.content), { taskType: 'RETRIEVAL_DOCUMENT' })
        out.push(...vectors)
        break
      } catch (err) {
        attempt++
        if (attempt > 4) throw err
        const wait = Math.min(20_000, 2 ** attempt * 1500)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  return out
}
