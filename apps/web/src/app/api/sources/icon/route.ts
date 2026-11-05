import { NextResponse } from 'next/server'
import { fetchExtensionIcon } from '@/lib/sources/catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Proxy an extension icon through the GitHub contents API.
 *
 * The catalog points at a third-party CDN; routing through our own
 * API keeps the browser off it and means the icon still works when
 * the CDN is blocked.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  if (!/^src\/[a-z-]+\/[a-z0-9_-]+\/res\/mipmap-[a-z0-9]+\/ic_launcher\.png$/i.test(path)) {
    return new NextResponse('bad path', { status: 400 })
  }

  try {
    const icon = await fetchExtensionIcon(path)
    if (!icon) return new NextResponse('not found', { status: 404 })
    return new NextResponse(new Uint8Array(icon.body), {
      headers: {
        'content-type': icon.type,
        'cache-control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return new NextResponse('unavailable', { status: 502 })
  }
}
