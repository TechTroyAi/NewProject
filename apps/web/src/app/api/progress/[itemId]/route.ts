import { NextResponse } from 'next/server'
import { ProgressUpdateSchema, isUuid } from '@shelf/shared'
import { saveProgress } from '@/lib/data'
import { requireUser } from '@/lib/api'
import { IS_DEMO } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Debounced progress ping from the reader. */
export async function PUT(req: Request, { params }: { params: { itemId: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  // The demo shelf uses readable slugs for its ids, so the uuid
  // check only applies to a real database.
  if (!IS_DEMO && !isUuid(params.itemId)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const parsed = ProgressUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  try {
    const progress = await saveProgress(
      params.itemId,
      parsed.data.page,
      parsed.data.maxPageRead,
      parsed.data.finished,
    )
    return NextResponse.json({ progress })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    )
  }
}
