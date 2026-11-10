import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api'
import { fileInboxItem } from '@/lib/data'
import { isUuid } from '@shelf/shared'
import { IS_DEMO } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  /** `null` starts a new series named after the item. */
  seriesId: z.string().uuid().nullable(),
})

/** File an inbox item into a series. */
export async function POST(req: Request, { params }: { params: { itemId: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  if (!IS_DEMO && !isUuid(params.itemId)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  try {
    const { seriesId } = await fileInboxItem(params.itemId, parsed.data.seriesId)
    return NextResponse.json({ ok: true, seriesId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
