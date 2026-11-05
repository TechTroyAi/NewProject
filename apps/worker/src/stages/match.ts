import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { kindOfItem, similarity } from '@shelf/shared'

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

export { similarity, kindOfItem }
