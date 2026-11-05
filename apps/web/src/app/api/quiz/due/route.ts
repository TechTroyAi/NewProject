import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { getQuizQueue } from '@/lib/data'
import { safeInt } from '@shelf/shared'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const cards = await getQuizQueue(limit)
  return NextResponse.json({ cards })
}
