import { z } from 'zod'
import { chatJson } from '../ai-provider.js'

export const IngestionSchema = z.object({
  title: z.string(),
  series: z.string().nullable(),
  volume: z.number().nullable(),
  chapter: z.number().nullable(),
  summary: z.string().describe('3 sentences max'),
  tags: z.array(z.string()).max(8),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })).max(15),
  language: z.string(),
  contentKind: z.enum(['manga', 'textbook', 'slides', 'article', 'fiction', 'other']),
})

export type Ingestion = z.infer<typeof IngestionSchema>

/**
 * One structured call over a *sample* of the document — never the whole
 * thing. Cost stays flat regardless of file size.
 */
export async function summarize(sample: string, hints: { title?: string } = {}): Promise<Ingestion> {
  const raw = await chatJson({
    system:
      'You catalogue documents. Return JSON with: title, series, volume, chapter, summary (3 sentences max), ' +
      'tags (max 8), keyTerms (max 15, each {term, definition}), language, contentKind ' +
      '(manga|textbook|slides|article|fiction|other).',
    user: `Filename hint: ${hints.title ?? 'unknown'}\n\nDOCUMENT SAMPLE:\n${sample.slice(0, 6000)}`,
    temperature: 0.2,
  })

  let json: unknown = {}
  try {
    json = JSON.parse(raw)
  } catch {
    json = {}
  }
  const parsed = IngestionSchema.safeParse(json)
  if (!parsed.success) {
    // Never fail the whole item over a malformed AI response.
    return {
      title: hints.title ?? 'Untitled',
      series: null,
      volume: null,
      chapter: null,
      summary: 'Summary unavailable.',
      tags: [],
      keyTerms: [],
      language: 'en',
      contentKind: 'other',
    }
  }
  return parsed.data
}
