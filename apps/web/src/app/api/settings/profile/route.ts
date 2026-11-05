import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api'
import { saveDisplayName, saveProfileSettings } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ReaderSchema = z.object({
  mode: z.enum(['strip', 'paged']).optional(),
  rtl: z.boolean().optional(),
  spread: z.boolean().optional(),
  background: z.string().max(40).optional(),
  scale: z.number().min(0.5).max(3).optional(),
})

const BodySchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
  settings: z
    .object({
      reader: ReaderSchema.optional(),
      notes: z.object({ dailyFormat: z.string().max(80).optional() }).optional(),
    })
    .optional(),
})

/**
 * The user's profile and settings.
 *
 * The settings are one JSON blob in `profiles.settings`, so a partial
 * update is merged into what is already there.
 */
export async function PUT(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  const { display_name, settings } = parsed.data
  try {
    if (display_name !== undefined) await saveDisplayName(display_name.trim())
    if (settings) {
      // The reader and the notes blocks are merged key by key, so
      // saving the reader settings does not drop the daily note
      // format.
      await saveProfileSettings(settings as Record<string, unknown>)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
