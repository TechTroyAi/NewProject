import { NextResponse } from 'next/server'
import { ProgressUpdateSchema } from '@shelf/shared'
import { saveProgress } from '@/lib/data'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Debounced progress ping from the reader. */
export async function PUT(req: Request, { params }: { params: { itemId: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const parsed = ProgressUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  const progress = await saveProgress(
    params.itemId,
    parsed.data.page,
    parsed.data.maxPageRead,
    parsed.data.finished,
  )
  return NextResponse.json({ progress })
}
