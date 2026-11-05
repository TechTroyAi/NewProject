import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Fuzzy-match a title against the user's existing series.
 *
 * Above 0.8 similarity we auto-group; below it the item goes to the
 * Inbox for a human decision.
 */
export async function matchSeries(
  sb: SupabaseClient,
  userId: string,
  title: string,
  kind: string,
): Promise<{ seriesId: string | null; confidence: number; candidates: { id: string; title: string; score: number }[] }> {
  const { data: series } = await sb.from('series').select('id, title, kind').eq('user_id', userId)

  // A book and a course can share a title; they belong in different
  // series, so only compare against the kind the item actually is.
  const wanted = kindOfItem(kind)

  const candidates = (series ?? [])
    .filter((s) => s.kind === wanted || s.kind === 'mixed')
    .map((s) => ({ id: s.id, title: s.title, score: similarity(s.title, title) }))
    .filter((c) => c.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (!candidates.length) return { seriesId: null, confidence: 0, candidates: [] }

  const best = candidates[0]
  if (best.score >= 0.8) return { seriesId: best.id, confidence: best.score, candidates }
  return { seriesId: null, confidence: best.score, candidates }
}

/** The series kind an item of this file type belongs to. */
export function kindOfItem(type: string): 'manga' | 'book' | 'course' {
  switch (type) {
    case 'cbz':
    case 'manga':
      return 'manga'
    case 'pptx':
    case 'docx':
    case 'course':
      return 'course'
    default:
      return 'book'
  }
}

/**
 * Cheap normalised similarity — token overlap plus prefix agreement.
 * (pg_trgm handles the SQL side; this mirrors it closely enough to
 * decide locally without a round trip.)
 */
export function similarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
  const at = new Set(norm(a))
  const bt = new Set(norm(b))
  if (!at.size || !bt.size) return 0

  let overlap = 0
  for (const t of at) if (bt.has(t)) overlap++
  const jaccard = overlap / (at.size + bt.size - overlap)

  const prefix = commonPrefix(norm(a).join(''), norm(b).join('')) / Math.max(norm(a).join('').length, 1)

  return Math.max(0, Math.min(1, jaccard * 0.6 + prefix * 0.4))
}

function commonPrefix(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}
