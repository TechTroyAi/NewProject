import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { getSessionClient } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** How long a signed media link stays usable. */
const SIGNED_URL_TTL_SECONDS = 120

/**
 * Serve a stored file through a short-lived signed URL.
 *
 * The storage bucket is private. Rather than making it public — which
 * would put every user's pages behind a guessable path — the browser
 * asks for `/api/media?path=…`, we check that the path really belongs
 * to the caller (the queries below run with the caller's JWT, so Row
 * Level Security decides what they can see), and then hand back a
 * redirect to a signed URL that expires in a couple of minutes.
 */
export async function GET(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  if (!path || path.length > 500) {
    return NextResponse.json({ error: 'path required' }, { status: 400 })
  }

  const sb = await getSessionClient()
  if (!sb) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  // Ownership: the file has to be one of the caller's own pages,
  // covers or originals. RLS scopes all three queries.
  const [page, item, original] = await Promise.all([
    sb.from('pages').select('id').eq('image_path', path).maybeSingle(),
    sb.from('items').select('id').eq('cover_path', path).maybeSingle(),
    sb.from('items').select('id').eq('original_path', path).maybeSingle(),
  ])

  if (!page.data && !item.data && !original.data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const bucket = process.env.STORAGE_BUCKET ?? 'shelf'
  const { data: signed, error } = await sb.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'could not sign the file' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: {
      // The signed URL itself is private to the browser that fetched
      // it; the redirect must not be cached by a shared proxy.
      'cache-control': 'private, no-store',
    },
  })
}
