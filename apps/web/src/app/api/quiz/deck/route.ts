import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api'
import { createDeckFromCards } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CardSchema = z.object({
  type: z.string().min(1),
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(4000),
  options: z.array(z.string()).nullish(),
  explanation: z.string().nullish(),
  sourcePage: z.number().int().nullish(),
})

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  noteId: z.string().nullish(),
  itemId: z.string().nullish(),
  cards: z.array(CardSchema).min(1).max(50),
})

/**
 * Save the cards the user approved into a deck.
 *
 * The assistant proposes; the user decides. Nothing is written until
 * this endpoint is called.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  try {
    const { deckId, cardIds } = await createDeckFromCards({
      title: parsed.data.title,
      noteId: parsed.data.noteId ?? null,
      itemId: parsed.data.itemId ?? null,
      cards: parsed.data.cards,
    })
    return NextResponse.json({ ok: true, deckId, cardIds })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
