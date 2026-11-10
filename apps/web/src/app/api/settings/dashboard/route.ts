import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api'
import { saveDashboardLayout } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ItemSchema = z.object({
  i: z.string().min(1).max(40),
  x: z.number().int().min(0).max(24),
  y: z.number().int().min(0).max(200),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(24),
  minW: z.number().int().min(1).max(12).optional(),
  minH: z.number().int().min(1).max(24).optional(),
})

const BodySchema = z.object({
  layout: z.array(ItemSchema).max(24),
})

/**
 * Where the dashboard widgets sit.
 *
 * The layout lives in `profiles.settings.dashboard`, so it follows the
 * user between devices.
 */
export async function PUT(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  try {
    await saveDashboardLayout(parsed.data.layout)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
