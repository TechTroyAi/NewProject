import { NextResponse } from 'next/server'
import { getActivity, getStats } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [stats, activity] = await Promise.all([getStats(), getActivity()])
  return NextResponse.json({ stats, activity })
}
