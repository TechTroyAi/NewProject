import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { browseSource } from '@/lib/sources/providers/registry'
import { resolveConnected } from '@/lib/sources-data'
import { safeInt } from '@shelf/shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Browse/search a connected source. */
export async function GET(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const url = new URL(req.url)
  const key = url.searchParams.get('source') ?? ''
  if (!key) return NextResponse.json({ error: 'source required' }, { status: 400 })

  const source = await resolveConnected(key)
  if (!source) return NextResponse.json({ error: 'unknown source' }, { status: 404 })

  try {
    const result = await browseSource(source, {
      query: url.searchParams.get('q') ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      limit: Number(url.searchParams.get('limit') ?? 24),
    })
    return NextResponse.json({ manga: result.data, offline: result.offline, reason: result.reason ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
