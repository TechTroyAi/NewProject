import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api'
import { setCardStatus } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  status: z.enum(['active', 'suspended', 'flagged']),
})

/** Flag, suspend or re-activate a card. */
export async function PATCH(req: Request, { params }: { params: { cardId: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  try {
    const card = await setCardStatus(params.cardId, parsed.data.status)
    if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })
    return NextResponse.json({ card })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
