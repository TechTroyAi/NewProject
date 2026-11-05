import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { sourceChapters } from '@/lib/sources/providers/registry'
import { resolveConnected } from '@/lib/sources-data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Chapter list for a manga on a connected source. */
export async function GET(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const url = new URL(req.url)
  const key = url.searchParams.get('source') ?? ''
  const mangaId = url.searchParams.get('mangaId') ?? ''
  if (!key || !mangaId) return NextResponse.json({ error: 'source and mangaId required' }, { status: 400 })

  const source = await resolveConnected(key)
  if (!source) return NextResponse.json({ error: 'unknown source' }, { status: 404 })

  try {
    const result = await sourceChapters(source, mangaId)
    return NextResponse.json({ chapters: result.data, offline: result.offline, reason: result.reason ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
