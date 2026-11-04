import { NextResponse } from 'next/server'
import { SearchQuerySchema } from '@shelf/shared'
import { searchVault } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = SearchQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    mode: url.searchParams.get('mode') ?? 'hybrid',
    limit: Number(url.searchParams.get('limit') ?? 20),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid query' }, { status: 400 })
  }
  const hits = await searchVault(parsed.data.q, parsed.data.limit)
  return NextResponse.json({ hits })
}
