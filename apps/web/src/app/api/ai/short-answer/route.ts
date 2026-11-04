import { NextResponse } from 'next/server'
import { gradeShortAnswer } from '@/lib/ai'
import { requireUser } from '@/lib/api'
import { rateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AI_RATE_LIMIT = 60
const AI_RATE_WINDOW = 60

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const limited = await rateLimit(rateLimitKey(req, auth.userId, 'ai'), AI_RATE_LIMIT, AI_RATE_WINDOW)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'too many requests — give it a moment' },
      { status: 429, headers: rateLimitHeaders(limited) },
    )
  }
  const body = await req.json().catch(() => null)
  if (!body?.question || !body?.reference) {
    return NextResponse.json({ error: 'question and reference required' }, { status: 400 })
  }
  const grade = await gradeShortAnswer(body.question, body.reference, String(body.answer ?? ''))
  return NextResponse.json({ grade }, { headers: rateLimitHeaders(limited) })
}
