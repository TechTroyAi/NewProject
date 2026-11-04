import { NextResponse } from 'next/server'
import { getDueCards } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const cards = await getDueCards(limit)
  return NextResponse.json({ cards })
}
