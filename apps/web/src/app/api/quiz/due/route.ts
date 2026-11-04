import { NextResponse } from 'next/server'
import { getQuizQueue } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const cards = await getQuizQueue(limit)
  return NextResponse.json({ cards })
}
