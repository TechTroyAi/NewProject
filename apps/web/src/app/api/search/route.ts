import { NextResponse } from 'next/server'
import { SearchQuerySchema } from '@shelf/shared'
import { searchVault } from '@/lib/data'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // A hybrid search embeds the query — that is a paid model call, so
  // it must not be reachable without a session.
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const url = new URL(req.url)
  const parsed = SearchQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    mode: url.searchParams.get('mode') ?? 'hybrid',
    limit: Number(url.searchParams.get('limit') ?? 20),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid query' }, { status: 400 })
  }
  const hits = await searchVault(parsed.data.q, parsed.data.limit, parsed.data.mode)
  return NextResponse.json({ hits })
}
