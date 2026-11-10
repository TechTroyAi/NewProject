import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { saveDisplayName, saveProfileSettings } from '@/lib/data'
import { ProfilePatchSchema } from '@/lib/settings-schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The user's profile and settings.
 *
 * The settings are one JSON blob in `profiles.settings`, so a partial
 * update is merged into what is already there.
 */
export async function PUT(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const parsed = ProfilePatchSchema.safeParse(await req.json().catch(() => null))
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
