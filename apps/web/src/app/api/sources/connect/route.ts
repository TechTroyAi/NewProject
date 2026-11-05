import { NextResponse } from 'next/server'
import { getSourceCatalog } from '@/lib/sources/catalog'
import { connectSource, disconnectSource } from '@/lib/sources-data'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Connect (or disconnect) a source. */
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => null)
  const key = body?.key
  if (typeof key !== 'string' || !key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 })
  }

  const catalog = await getSourceCatalog()
  const desc = catalog.sources.find((s) => s.key === key)
  if (!desc) return NextResponse.json({ error: 'unknown source' }, { status: 404 })

  try {
    if (body?.disconnect) {
      await disconnectSource(key)
      return NextResponse.json({ ok: true, connected: false })
    }
    const row = await connectSource(desc)
    return NextResponse.json({ ok: true, connected: true, source: row })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
