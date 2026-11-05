import { NextResponse } from 'next/server'
import { AddRemoteSchema } from '@shelf/shared'
import { resolveConnected, importRemoteSeries } from '@/lib/sources-data'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Import a remote manga into the shelf.
 *
 * It becomes a regular series with one item per chapter, so the
 * reader, progress tracking, notes and quiz all work unchanged.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const parsed = AddRemoteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload', detail: parsed.error.flatten() }, { status: 400 })
  }

  const source = await resolveConnected(parsed.data.sourceKey)
  if (!source) return NextResponse.json({ error: 'unknown source' }, { status: 404 })

  try {
    const result = await importRemoteSeries({
      source,
      manga: parsed.data.manga,
      chapters: parsed.data.chapters ?? [],
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
