import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { purgeTrashEntry } from '@/lib/trash'
import { isUuid } from '@shelf/shared'
import { IS_DEMO } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Throw one entry away for good. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  // The demo shelf uses readable slugs for its ids, so the uuid check
  // only applies to a real database.
  if (!IS_DEMO && !isUuid(params.id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  const ok = await purgeTrashEntry(params.id).catch(() => false)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
