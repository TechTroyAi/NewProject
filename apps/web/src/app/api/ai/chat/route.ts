import { NextResponse } from 'next/server'
import { ChatScopeSchema } from '@shelf/shared'
import { chatStream } from '@/lib/ai'
import { requireUser } from '@/lib/api'
import { rateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** The assistant spends the user's own key, so it needs a ceiling. */
const AI_RATE_LIMIT = 30
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
  let body: { question?: string; scope?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const question = (body.question ?? '').trim()
  if (!question) return new Response('question required', { status: 400 })
  // A prompt is a bill. Anything longer than this is a paste accident.
  if (question.length > 4000) {
    return new Response('question is too long', { status: 400 })
  }

  const parsedScope = ChatScopeSchema.safeParse(body.scope ?? { mode: 'vault' })
  if (!parsedScope.success) {
    return new Response('invalid scope', { status: 400 })
  }
  const scope = parsedScope.data

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const evt of chatStream({ question, scope })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
        }
      } catch (err) {
        console.error('chat stream failed:', err)
        // The detail is trimmed: an error can carry an upstream URL,
        // and this text goes straight into the user's screen.
        const detail = String(err).slice(0, 300)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'text', text: `\n\n_Something went wrong: ${detail}_` })}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      ...rateLimitHeaders(limited),
    },
  })
}
