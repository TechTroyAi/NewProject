import { NextResponse } from 'next/server'
import { getBacklinks, getNoteById, saveNote } from '@/lib/data'
import { requireUser } from '@/lib/api'
import { isUuid } from '@shelf/shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const note = await getNoteById(params.id)
  if (!note) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const backlinks = await getBacklinks(params.id)
  return NextResponse.json({ note, backlinks })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null)
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  if (typeof body.title !== 'undefined' && typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title must be a string' }, { status: 400 })
  }
  if (typeof body.body_md !== 'undefined' && typeof body.body_md !== 'string') {
    return NextResponse.json({ error: 'body_md must be a string' }, { status: 400 })
  }
  if (typeof body.page_ref !== 'undefined' && body.page_ref !== null && typeof body.page_ref !== 'number') {
    return NextResponse.json({ error: 'page_ref must be a number' }, { status: 400 })
  }
  if (
    typeof body.item_id !== 'undefined' &&
    body.item_id !== null &&
    (typeof body.item_id !== 'string' || !isUuid(body.item_id))
  ) {
    return NextResponse.json({ error: 'item_id must be a uuid' }, { status: 400 })
  }
  if (
    typeof body.base_updated_at !== 'undefined' &&
    body.base_updated_at !== null &&
    typeof body.base_updated_at !== 'string'
  ) {
    return NextResponse.json({ error: 'base_updated_at must be a string' }, { status: 400 })
  }

  // A partial PATCH must not blank the fields it does not mention —
  // otherwise saving only the body renames the note "Untitled".
  const existing = await getNoteById(params.id)
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const result = await saveNote({
    id: params.id,
    title: typeof body.title === 'string' ? body.title.slice(0, 300) : existing.title,
    body_md: typeof body.body_md === 'string' ? body.body_md : existing.body_md,
    item_id: body.item_id ?? existing.item_id ?? null,
    page_ref: body.page_ref ?? existing.page_ref ?? null,
    base_updated_at: body.base_updated_at ?? null,
  })
  if (result.conflict) {
    // 409 — the editor offers keep mine / keep theirs / merge.
    return NextResponse.json(
      { error: 'conflict', note: result.note, conflict: true },
      { status: 409 },
    )
  }
  return NextResponse.json({ note: result.note })
}
