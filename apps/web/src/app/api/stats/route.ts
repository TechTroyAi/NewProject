import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { getActivity, getStats } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const [stats, activity] = await Promise.all([getStats(), getActivity()])
  return NextResponse.json({ stats, activity })
}
