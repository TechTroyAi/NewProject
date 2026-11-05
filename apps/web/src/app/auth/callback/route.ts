import { NextResponse } from 'next/server'
import { getSessionClient } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Where an OAuth sign-in comes back to.
 *
 * Supabase uses the PKCE flow for browser clients, so the provider
 * sends the user back here with a `?code=`. The code is exchanged for
 * a session, the session cookies are set, and the user continues to
 * wherever they were headed.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  // Only same-origin paths are honoured — an open redirect here would
  // hand an attacker a link that looks like a sign-in.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth', url.origin))
  }

  const sb = await getSessionClient()
  if (!sb) {
    return NextResponse.redirect(new URL('/login?error=oauth', url.origin))
  }

  const { error } = await sb.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login?error=oauth', url.origin))
  }

  return NextResponse.redirect(new URL(target, url.origin))
}
