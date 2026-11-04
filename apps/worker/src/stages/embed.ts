import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Embed chunks. Batched, with a retry on rate limit.
 * The dimension is pinned to 1536 to match the pgvector column.
 */
export async function embedChunks(chunks: { content: string }[]) {
  if (!chunks.length) return []
  const out: number[][] = []

  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100)
    let attempt = 0
    for (;;) {
      try {
        const res = await client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch.map((c) => c.content),
          dimensions: EMBEDDING_DIMENSIONS,
        })
        out.push(...res.data.map((d) => d.embedding))
        break
      } catch (err: any) {
        attempt++
        if (attempt > 4) throw err
        const wait = Math.min(20_000, 2 ** attempt * 1500)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  return out
}
