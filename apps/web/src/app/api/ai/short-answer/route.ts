import { NextResponse } from 'next/server'
import { gradeShortAnswer } from '@/lib/ai'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => null)
  if (!body?.question || !body?.reference) {
    return NextResponse.json({ error: 'question and reference required' }, { status: 400 })
  }
  const grade = await gradeShortAnswer(body.question, body.reference, String(body.answer ?? ''))
  return NextResponse.json({ grade })
}
