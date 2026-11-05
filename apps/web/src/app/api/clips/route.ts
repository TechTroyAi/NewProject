import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api'
import { createClip, listClips } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * A clip is a region of a page.
 *
 * The box is stored as fractions of the page (0–1) rather than pixels,
 * so it still lines up after a re-render, on another device, or when
 * the page image is served at a different size.
 */
const BboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().positive().max(1),
  h: z.number().positive().max(1),
})

const BodySchema = z.object({
  itemId: z.string().min(1),
  pageIdx: z.number().int().min(0),
  bbox: BboxSchema,
  noteId: z.string().min(1).optional(),
})

export async function GET(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  return NextResponse.json({ clips: await listClips(itemId) })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  // The box has to stay inside the page.
  const { x, y, w, h } = parsed.data.bbox
  if (x + w > 1.0001 || y + h > 1.0001) {
    return NextResponse.json({ error: 'the clip extends past the page' }, { status: 400 })
  }

  try {
    const clip = await createClip({
      itemId: parsed.data.itemId,
      pageIdx: parsed.data.pageIdx,
      bbox: parsed.data.bbox,
      noteId: parsed.data.noteId ?? null,
    })
    return NextResponse.json({ ok: true, clipId: clip.id, clip })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
