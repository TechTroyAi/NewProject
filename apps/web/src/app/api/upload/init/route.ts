import { NextResponse } from 'next/server'
import { UploadInitSchema } from '@shelf/shared'
import { IS_DEMO } from '@/lib/db'
import { getSupabaseAdmin } from '@/lib/db'
import { randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Decide whether a file is new or a duplicate, and hand back a presigned
 * URL for the browser to upload to directly (files never proxy through
 * the app server).
 */
export async function POST(req: Request) {
  const parsed = UploadInitSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid upload payload' }, { status: 400 })
  }
  const { name, size, mime, hash } = parsed.data

  // Demo mode — no storage configured.
  if (IS_DEMO) {
    return NextResponse.json({
      itemId: randomUUID(),
      path: `originals/${hash.slice(0, 16)}/${name}`,
      uploadUrl: null,
      duplicate: false,
      demo: true,
    })
  }

  const sb = getSupabaseAdmin()!
  const { data: existing } = await sb
    .from('items')
    .select('id')
    .eq('file_hash', hash)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ duplicate: true, itemId: existing.id })
  }

  const itemId = randomUUID()
  const path = `originals/${itemId}/${name}`

  // In production this is an S3/R2 presigned PUT. The storage adapter is
  // intentionally thin so it can be swapped for Supabase Storage.
  const base = process.env.STORAGE_SIGNING_ENDPOINT
  const uploadUrl = base ? `${base}/${encodeURIComponent(path)}` : null

  return NextResponse.json({ itemId, path, uploadUrl })
}
