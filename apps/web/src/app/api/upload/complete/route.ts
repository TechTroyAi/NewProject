import { NextResponse } from 'next/server'
import { UploadCompleteSchema, safeFileName } from '@shelf/shared'
import { IS_DEMO } from '@/lib/db'
import { getSessionClient, getUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** The upload finished — create the item row and enqueue the pipeline. */
export async function POST(req: Request) {
  const parsed = UploadCompleteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const { itemId, path } = parsed.data

  if (IS_DEMO) {
    return NextResponse.json({ ok: true, itemId, queued: ['sniff', 'convert', 'ocr', 'embed', 'summarize'] })
  }

  const sb = await getSessionClient()
  if (!sb) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // The path must be one this user was actually issued. Without this
  // check a caller could point their item at somebody else's original.
  const expectedPrefix = `originals/${userId}/${itemId}/`
  if (!path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'path does not belong to this upload' }, { status: 400 })
  }

  const fileName = safeFileName(path.slice(expectedPrefix.length))

  const { error } = await sb.from('items').upsert({
    id: itemId,
    user_id: userId,
    type: fileName.split('.').pop() ?? 'unknown',
    title: fileName,
    original_path: path,
    file_hash: null,
    status: 'uploaded',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enqueue the pipeline stages. The worker picks these up.
  for (const stage of ['sniff', 'convert', 'ocr', 'embed', 'summarize']) {
    const { error: jobError } = await sb
      .from('jobs')
      .insert({ user_id: userId, item_id: itemId, stage, status: 'queued' })
    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, itemId })
}
