import { NextResponse } from 'next/server'
import { getBacklinks, getNoteById, saveNote } from '@/lib/data'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const note = await getNoteById(params.id)
  if (!note) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const backlinks = await getBacklinks(params.id)
  return NextResponse.json({ note, backlinks })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null)
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  if (!body) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  const result = await saveNote({
    id: params.id,
    title: body.title ?? 'Untitled',
    body_md: body.body_md ?? '',
    item_id: body.item_id ?? null,
    page_ref: body.page_ref ?? null,
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
