import { NextResponse } from 'next/server'
import { getSessionClient } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** The exact shape Supabase appends to the OAuth redirect URL. */
const FLOW_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/

/**
 * Where an OAuth sign-in comes back to.
 *
 * Supabase uses the PKCE flow for browser clients, so the provider sends
 * the user back here with a `?code=`. auth-js 2.x writes the code verifier
 * into a *slotted* cookie keyed `${storageKey}-flow-${flowId}-code-verifier`
 * (the `sb_flow_id` query param tells us which slot), and on the server the
 * slot is the *only* key `exchangeCodeForSession` will consult when a
 * `flowId` is passed — so we must read `sb_flow_id` from the callback query
 * and forward it, else the exchange looks in the wrong slot and fails with
 * `invalid_grant`.
 *
 * On failure we redirect back with a provider-specific error code so the
 * login page can show an accurate message instead of a generic "oauth".
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  const flowId = url.searchParams.get('sb_flow_id')

  // Only same-origin paths are honoured — an open redirect here would hand
  // an attacker a link that looks like a sign-in.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'

  if (!code) {
    // `?error=access_denied|server_error|<code>` comes back from Supabase
    // when the user denied the provider or the provider itself errored.
    const providerError = url.searchParams.get('error')
    const search = providerError ? `?error=oauth_denied` : '?error=oauth_provider'
    return NextResponse.redirect(new URL(`/login${search}`, url.origin))
  }

  const sb = await getSessionClient()
  if (!sb) {
    return NextResponse.redirect(new URL('/login?error=oauth_provider', url.origin))
  }

  // Validate the flow id against Supabase's own pattern before forwarding
  // it — an attacker-controlled value must never reach the exchange.
  const opts = flowId && FLOW_ID_RE.test(flowId) ? { flowId } : undefined

  let { error } = await sb.auth.exchangeCodeForSession(code, opts)
  if (error) {
    // Slotted exchange failed (e.g. the verifier was never written into the
    // slot because the browser cleared cookies mid-flow). Fall back to the
    // plain call which consults the legacy fixed code-verifier key that
    // `storePKCEVerifier` dual-writes.
    const { error: fallbackError } = await sb.auth.exchangeCodeForSession(code)
    if (fallbackError) {
      return NextResponse.redirect(
        new URL(`/login?error=oauth_exchange`, url.origin),
      )
    }
  }

  return NextResponse.redirect(new URL(target, url.origin))
}
