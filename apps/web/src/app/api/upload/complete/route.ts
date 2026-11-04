import { NextResponse } from 'next/server'
import { UploadCompleteSchema } from '@shelf/shared'
import { getSupabaseAdmin, IS_DEMO } from '@/lib/db'

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

  const sb = getSupabaseAdmin()!
  const userId = (await sb.auth.getUser()).data.user?.id
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { error } = await sb.from('items').upsert({
    id: itemId,
    user_id: userId,
    type: path.split('.').pop() ?? 'unknown',
    title: path.split('/').pop() ?? 'Untitled',
    original_path: path,
    status: 'uploaded',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enqueue the pipeline stages. Inngest/BullMQ picks these up.
  for (const stage of ['sniff', 'convert', 'ocr', 'embed', 'summarize']) {
    await sb.from('jobs').insert({ user_id: userId, item_id: itemId, stage, status: 'queued' })
  }

  return NextResponse.json({ ok: true, itemId })
}
