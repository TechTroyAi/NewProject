import 'server-only'

/* ══════════════════════════════════════════════════════════════
   Rate limiting.

   The AI routes spend the user's own API key, so they need a ceiling
   even when the caller is signed in. Upstash Redis is used when it is
   configured (it works across serverless instances); otherwise an
   in-process counter is used, which is correct for a single long
   running server and good enough as a fallback.
   ══════════════════════════════════════════════════════════════ */

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Unix seconds at which the window resets. */
  reset: number
  limit: number
}

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Drop expired buckets so the map cannot grow without bound. */
function prune(now: number) {
  if (buckets.size < 500) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

function upstashConfigured(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
}

/**
 * Upstash REST, pipelined so it is a single round trip:
 *   INCR key · EXPIRE key <window> NX · TTL key
 */
async function upstashLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSeconds), 'NX'],
        ['TTL', key],
      ]),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = (await res.json()) as Array<{ result: unknown }>
    const count = Number(body?.[0]?.result ?? 0)
    const ttl = Number(body?.[2]?.result ?? windowSeconds)
    const reset = Math.floor(Date.now() / 1000) + (Number.isFinite(ttl) ? ttl : windowSeconds)
    return { ok: count <= limit, remaining: Math.max(0, limit - count), reset, limit }
  } catch {
    // Never let the limiter itself take the app down.
    return null
  }
}

/**
 * Count one request against `key`.
 *
 * `limit` is the number of requests allowed per `windowSeconds`.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now()

  if (upstashConfigured()) {
    const result = await upstashLimit(key, limit, windowSeconds)
    if (result) return result
  }

  prune(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowSeconds * 1000 }
    buckets.set(key, fresh)
    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      reset: Math.floor(fresh.resetAt / 1000),
      limit,
    }
  }

  bucket.count += 1
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: Math.floor(bucket.resetAt / 1000),
    limit,
  }
}

/**
 * The identity a limit should be charged to: the signed-in user when
 * there is one, otherwise the caller's address.
 */
export function rateLimitKey(req: Request, userId?: string | null, scope = 'default'): string {
  if (userId) return `shelf:${scope}:user:${userId}`
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return `shelf:${scope}:ip:${ip}`
}

/** Standard headers so a client can see where it stands. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'x-ratelimit-limit': String(result.limit),
    'x-ratelimit-remaining': String(result.remaining),
    'x-ratelimit-reset': String(result.reset),
  }
}
