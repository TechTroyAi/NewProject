import { NextResponse } from 'next/server'
import { getSessionClient, getUserId } from '@/lib/session'
import { IS_DEMO } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** How often the job table is polled. */
const POLL_MS = 700
/** Give up after this long — the tray falls back to a generic state. */
const MAX_MS = 5 * 60_000

const STAGES = ['sniff', 'convert', 'ocr', 'chunk', 'embed', 'summarize', 'match'] as const

function sse(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  try {
    controller.enqueue(new TextEncoder().encode(payload))
  } catch {
    /* the client went away */
  }
}

/**
 * Server-sent progress for an item's pipeline jobs.
 *
 * The worker writes `jobs.progress` / `jobs.status` as it works; this
 * turns that into a stream the upload tray can subscribe to.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const itemId = url.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 })

  // Demo mode has no worker, so replay a plausible pipeline.
  if (IS_DEMO) {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let i = 0; i < STAGES.length; i++) {
          sse(controller, 'progress', {
            itemId,
            stage: STAGES[i],
            progress: Math.round(((i + 1) / STAGES.length) * 100),
            status: 'running',
          })
          await new Promise((r) => setTimeout(r, 350))
        }
        sse(controller, 'done', { itemId, status: 'ready' })
        controller.close()
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

  const sb = await getSessionClient()
  const userId = await getUserId()
  if (!sb || !userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now()
      const seen = new Map<string, string>()
      try {
        // An immediate first tick so the client is not left in the dark.
        sse(controller, 'progress', { itemId, stage: 'queued', progress: 0, status: 'queued' })

        while (Date.now() - started < MAX_MS) {
          const { data } = await sb
            .from('jobs')
            .select('id, stage, status, progress, error')
            .eq('item_id', itemId)
            .order('created_at', { ascending: true })

          const jobs = data ?? []
          for (const job of jobs) {
            const key = `${job.stage}:${job.status}:${job.progress}`
            if (seen.get(job.stage) === key) continue
            seen.set(job.stage, key)
            sse(controller, 'progress', {
              itemId,
              jobId: job.id,
              stage: job.stage,
              status: job.status,
              progress: job.progress ?? 0,
              error: job.error ?? null,
            })
            if (job.status === 'failed') {
              sse(controller, 'error', { itemId, stage: job.stage, error: job.error ?? 'stage failed' })
            }
          }

          const allSettled = jobs.length > 0 && jobs.every((j) => j.status === 'done' || j.status === 'failed')
          const anyFailed = jobs.some((j) => j.status === 'failed')
          if (allSettled) {
            sse(controller, anyFailed ? 'error' : 'done', {
              itemId,
              status: anyFailed ? 'failed' : 'ready',
            })
            break
          }

          await new Promise((r) => setTimeout(r, POLL_MS))
        }
      } catch (err) {
        sse(controller, 'error', { itemId, error: err instanceof Error ? err.message : String(err) })
      } finally {
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      /* the browser closed the connection */
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
