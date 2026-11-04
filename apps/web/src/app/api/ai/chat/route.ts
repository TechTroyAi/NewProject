import { ChatScopeSchema } from '@shelf/shared'
import { chatStream } from '@/lib/ai'
import { requireUser } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  let body: { question?: string; scope?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const question = (body.question ?? '').trim()
  if (!question) return new Response('question required', { status: 400 })

  const scope = ChatScopeSchema.parse(body.scope ?? { mode: 'vault' })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const evt of chatStream({ question, scope })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'text', text: `\n\n_Something went wrong: ${String(err)}_` })}\n\n`),
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
    },
  })
}
