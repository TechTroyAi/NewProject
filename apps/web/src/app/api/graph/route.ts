import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { getGraph } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const graph = await getGraph()
  return NextResponse.json(graph)
}
