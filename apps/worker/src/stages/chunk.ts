import type { ExtractedPage } from '../types.js'

export interface Chunk {
  page_start: number
  page_end: number
  content: string
}

/**
 * Split extracted text into ~500-token chunks with overlap.
 *
 * A chunk never spans two items, and the page range it covers is
 * recorded exactly — that range is what the spoiler guard compares
 * against `progress.max_page_read`.
 */
export function chunkPages(pages: ExtractedPage[], opts: { targetChars?: number; overlap?: number } = {}) {
  const target = opts.targetChars ?? 2000 // ~500 tokens for English prose
  const overlap = opts.overlap ?? 200
  const chunks: Chunk[] = []

  let buffer = ''
  let start = 0
  let end = 0

  const flush = () => {
    // Only skip chunks that are effectively empty. A short but real note
    // ("A short note about something.") must survive.
    if (buffer.trim().length < 10) return
    chunks.push({ page_start: start, page_end: end, content: buffer.trim() })
  }

  for (const page of pages) {
    const text = (page.text ?? '').trim()
    if (!text) {
      // A page with no text still advances the page cursor.
      end = page.idx
      continue
    }
    if (buffer.length === 0) start = page.idx
    buffer += (buffer ? '\n\n' : '') + text
    end = page.idx

    if (buffer.length >= target) {
      flush()
      // Carry the tail forward so a fact spanning the boundary survives.
      buffer = buffer.slice(Math.max(0, buffer.length - overlap))
      start = end
    }
  }
  flush()

  return chunks
}
