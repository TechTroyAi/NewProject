import { NextResponse } from 'next/server'
import { getBacklinks, getNoteById, saveNote } from '@/lib/data'

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
  if (!body) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  const note = await saveNote({
    id: params.id,
    title: body.title ?? 'Untitled',
    body_md: body.body_md ?? '',
    item_id: body.item_id ?? null,
    page_ref: body.page_ref ?? null,
  })
  return NextResponse.json({ note })
}
