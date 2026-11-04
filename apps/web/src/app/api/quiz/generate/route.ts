import { NextResponse } from 'next/server'
import { generateQuizCards } from '@/lib/ai'
import { getNoteById, getPagesForItem } from '@/lib/data'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Generate cards from a note. `spoiler_limit_page` is set to the source
 * page so a card can only surface after the reader has passed it.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => null)
  const noteId = body?.noteId
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  const note = await getNoteById(noteId)
  if (!note) return NextResponse.json({ error: 'note not found' }, { status: 404 })

  const excerpts = note.item_id
    ? (await getPagesForItem(note.item_id)).slice(0, 12).map((p) => ({
        content: p.text ?? `Page ${p.idx + 1} of ${note.title}.`,
        page: p.idx,
      }))
    : []

  const result = await generateQuizCards({
    note: { title: note.title, body_md: note.body_md },
    excerpts,
    n: Math.min(30, Math.max(1, Number(body?.n ?? 6))),
    types: body?.types ?? ['flashcard', 'mcq', 'cloze', 'tf', 'short'],
  })

  // Validate before returning — the model gets it wrong sometimes.
  const cards = result.cards
    .filter((c) => c.question.trim().length > 0 && c.answer.trim().length > 0)
    .filter((c) => c.type !== 'mcq' || (c.options?.length ?? 0) >= 2)
    .map((c) => ({
      ...c,
      spoiler_limit_page: c.sourcePage ?? 0,
    }))

  return NextResponse.json({ cards })
}
