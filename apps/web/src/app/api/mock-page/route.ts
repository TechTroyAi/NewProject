import { NextResponse } from 'next/server'
import { mockPageImage } from '@/lib/demo'

export const dynamic = 'force-dynamic'

/** Deterministic placeholder page used by the offline sample provider. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const chapter = url.searchParams.get('c') ?? 'page'
  const i = Number(url.searchParams.get('i') ?? 0)
  const svg = mockPageImage(chapter.split('-').slice(0, 3).join('-') || 'sample', i, 24)
  return new NextResponse(svg, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
