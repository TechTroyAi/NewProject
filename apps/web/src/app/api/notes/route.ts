import { NextResponse } from 'next/server'
import { getNotes, saveNote } from '@/lib/data'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const notes = await getNotes()
  return NextResponse.json({ notes })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  if (typeof body?.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }
  const result = await saveNote({
    title: body.title,
    body_md: body.body_md ?? '',
    item_id: body.item_id ?? null,
    page_ref: body.page_ref ?? null,
  })
  return NextResponse.json({ note: result.note })
}
