import { NextResponse } from 'next/server'
import { QuizAnswerSchema } from '@shelf/shared'
import { getAllCards, saveCardReview } from '@/lib/data'
import { reviewCard } from '@/lib/fsrs'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Grade a card and schedule the next review with FSRS. */
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const parsed = QuizAnswerSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  const { cardId, rating, msTaken } = parsed.data
  const cards = await getAllCards()
  const card = cards.find((c) => c.id === cardId)
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })

  const { card: updated, log } = reviewCard(card, rating)
  const saved = await saveCardReview(cardId, updated as never, rating, msTaken)

  return NextResponse.json({ card: saved, log })
}
