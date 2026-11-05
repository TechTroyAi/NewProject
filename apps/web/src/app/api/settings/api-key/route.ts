import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api'
import { deleteUserApiKey, listUserApiKeys, saveUserApiKey } from '@/lib/user-keys'
import { encryptionConfigured } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  provider: z.enum(['gemini', 'openai', 'anthropic']),
  key: z.string().min(8).max(400),
})

/**
 * The user's own provider key.
 *
 * The key is encrypted with AES-256-GCM before it is stored and is
 * never returned — only a fingerprint, so the user can tell which key
 * is in use.
 */
export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  return NextResponse.json({
    keys: await listUserApiKeys(),
    canStore: encryptionConfigured(),
  })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  if (!encryptionConfigured()) {
    return NextResponse.json(
      { error: 'this server has no SHELF_ENCRYPTION_KEY configured, so keys cannot be stored' },
      { status: 501 },
    )
  }

  try {
    await saveUserApiKey(parsed.data.provider, parsed.data.key)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const provider = new URL(req.url).searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  try {
    await deleteUserApiKey(provider)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
