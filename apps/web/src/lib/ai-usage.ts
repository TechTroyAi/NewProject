import 'server-only'
import './env'
import { IS_DEMO } from './db'
import { getSessionClient, getUserId } from './session'
import { localDateKey } from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   AI spend.

   The assistant runs on somebody's money — either the server
   operator's key or the user's own. The daily budget is the ceiling
   that keeps a runaway loop from becoming a runaway bill.
   ══════════════════════════════════════════════════════════════ */

/** The default ceiling when the profile does not set one. */
export const DEFAULT_DAILY_TOKEN_BUDGET = 200_000

export interface AiBudget {
  ok: boolean
  used: number
  limit: number
}

/**
 * What has been spent today.
 *
 * `ai_usage.created_at` is a timestamp, so the day's rows are the
 * ones from the local midnight onwards — the same day the user sees.
 */
export async function aiUsageToday(): Promise<{ tokensIn: number; tokensOut: number }> {
  if (IS_DEMO) return { tokensIn: 0, tokensOut: 0 }
  const client = await getSessionClient()
  if (!client) return { tokensIn: 0, tokensOut: 0 }

  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const { data } = await client
    .from('ai_usage')
    .select('tokens_in, tokens_out')
    .gte('created_at', since.toISOString())
  const rows = (data ?? []) as { tokens_in: number; tokens_out: number }[]
  return {
    tokensIn: rows.reduce((n, r) => n + (r.tokens_in ?? 0), 0),
    tokensOut: rows.reduce((n, r) => n + (r.tokens_out ?? 0), 0),
  }
}

/**
 * Whether the assistant is still within its daily budget.
 *
 * `limit` of 0 or less means "no limit" — a user can turn the
 * ceiling off on purpose.
 */
export async function checkAiBudget(limit?: number): Promise<AiBudget> {
  const usage = await aiUsageToday()
  const used = usage.tokensIn + usage.tokensOut
  const ceiling = limit ?? DEFAULT_DAILY_TOKEN_BUDGET
  if (ceiling <= 0) return { ok: true, used, limit: 0 }
  return { ok: used < ceiling, used, limit: ceiling }
}

/**
 * Record what one call cost.
 *
 * A failure here must never fail the call the user asked for — the
 * usage row is bookkeeping, not the product.
 */
export async function recordAiUsage(
  kind: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  if (IS_DEMO) return
  const userId = await getUserId()
  if (!userId) return
  const client = await getSessionClient()
  if (!client) return
  try {
    await client.from('ai_usage').insert({
      user_id: userId,
      kind,
      tokens_in: Math.max(0, Math.round(tokensIn || 0)),
      tokens_out: Math.max(0, Math.round(tokensOut || 0)),
    })
  } catch {
    /* bookkeeping only */
  }
}

/** A friendly message for when the budget is spent. */
export function budgetMessage(budget: AiBudget): string {
  return `The assistant has used its daily budget (${budget.used.toLocaleString()} of ${budget.limit.toLocaleString()} tokens). It starts again tomorrow.`
}
