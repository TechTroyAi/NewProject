import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { emptyTrash, listTrash, purgeExpiredTrash, trashEntity } from '@/lib/trash'
import { TRASH_ENTITY_TYPES, type TrashEntityType } from '@shelf/shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Everything in the trash, newest first. Expired entries are swept away first. */
export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const purged = await purgeExpiredTrash().catch(() => 0)
  const entries = await listTrash()
  return NextResponse.json({ entries, purged })
}

/** Move something into the trash. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const type = body.entityType
  if (typeof type !== 'string' || !TRASH_ENTITY_TYPES.includes(type as TrashEntityType)) {
    return NextResponse.json({ error: 'unknown entity type' }, { status: 400 })
  }
  if (typeof body.entityId !== 'string' || !body.entityId.trim()) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }

  const entry = await trashEntity(type as TrashEntityType, body.entityId).catch(() => null)
  if (!entry) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, entry })
}

/** Empty the trash. */
export async function DELETE() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const removed = await emptyTrash()
  return NextResponse.json({ ok: true, removed })
}
