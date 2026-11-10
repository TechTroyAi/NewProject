import { NextResponse } from 'next/server'
import { PIPELINE_STAGES, UploadCompleteSchema, safeFileName } from '@shelf/shared'
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
  const { itemId, path, hash } = parsed.data

  // `items.file_hash` is NOT NULL, and the duplicate check depends on
  // it — a file without a hash is a client bug, not something to
  // paper over.
  if (!hash) {
    return NextResponse.json({ error: 'hash required' }, { status: 400 })
  }

  if (IS_DEMO) {
    return NextResponse.json({
      ok: true,
      itemId,
      queued: ['sniff', 'convert', 'ocr', 'chunk', 'embed', 'summarize', 'match'],
    })
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
    // The extension is noise in a title; the series, volume and
    // chapter are parsed out of the rest by the worker.
    title: fileName.replace(/\.[a-z0-9]{1,5}$/i, ''),
    original_path: path,
    // Persisted so `/api/upload/init` can recognise a re-uploaded file.
    file_hash: hash,
    status: 'uploaded',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enqueue the pipeline stages. The worker picks these up.
  // The order matters: the chunks have to exist before they can be
  // embedded, and the AI pass reads the OCR'd text.
  // The worker claims the oldest job first, so the stages have to be
  // queued in order. All seven rows would otherwise share one
  // timestamp and Postgres could hand them back in any order — which
  // is how `embed` ends up running before `chunk` and quietly leaves
  // the item without any embeddings.
  const base = Date.now()
  for (const [index, stage] of PIPELINE_STAGES.entries()) {
    const { error: jobError } = await sb
      .from('jobs')
      .insert({
        user_id: userId,
        item_id: itemId,
        stage,
        status: 'queued',
        created_at: new Date(base + index).toISOString(),
      })
    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, itemId })
}
