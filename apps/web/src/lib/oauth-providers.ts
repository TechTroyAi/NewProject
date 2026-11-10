/* ══════════════════════════════════════════════════════════════
   OAuth provider gating.

   Two gates decide whether a Google/GitHub button is shown:

   1. NEXT_PUBLIC_OAUTH_PROVIDERS (build-time, default both) — the set of
      providers the app intends to offer buttons for.
   2. Runtime detection from GET /auth/v1/settings (public endpoint) — the
      set of providers Supabase actually has client credentials for.

   A button renders only when the provider passes both gates. When a
   provider is wanted but not configured, a clear "not configured" hint is
   shown instead of a button that would fail at exchange time.
   ══════════════════════════════════════════════════════════════ */

export type OAuthProvider = 'google' | 'github'

export const DEFAULT_PROVIDERS: OAuthProvider[] = ['google', 'github']

/** Providers the app intends to offer, from the env var (default: both). */
export function envProviders(): OAuthProvider[] {
  const raw = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_OAUTH_PROVIDERS
  if (!raw) return [...DEFAULT_PROVIDERS]
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((p): p is OAuthProvider => p === 'google' || p === 'github')
}

/**
 * Providers Supabase has enabled, fetched from the public
 * /auth/v1/settings endpoint. Returns `{google, github}` with `false` for
 * anything it can't confirm (network down, missing keys, etc.) so the app
 * degrades gracefully rather than hiding everything.
 */
export async function runtimeProviders(): Promise<Record<OAuthProvider, boolean>> {
  const result: Record<OAuthProvider, boolean> = { google: false, github: false }
  const supabaseUrl =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : undefined
  if (!supabaseUrl) return result

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      cache: 'no-store',
      // 3s is plenty for a settings read; longer just delays the UI.
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return result
    const data = await res.json()
    const external = data?.external ?? {}
    if (external.google?.enabled) result.google = true
    if (external.github?.enabled) result.github = true
  } catch {
    // Swallow — the caller treats "unknown" as "don't show the button"
    // unless the env explicitly wants it and we can't confirm.
  }
  return result
}

/** Providers to show buttons for: env ∩ runtime. */
export async function visibleProviders(): Promise<OAuthProvider[]> {
  const wanted = new Set(envProviders())
  const enabled = await runtimeProviders()
  return DEFAULT_PROVIDERS.filter((p) => wanted.has(p) && enabled[p])
}

/** Human-readable label for a provider. */
export function providerLabel(provider: OAuthProvider): string {
  return provider === 'google' ? 'Google' : 'GitHub'
}

/** Guidance shown when a provider is wanted but not configured in Supabase. */
export function notConfiguredHint(provider: OAuthProvider): string {
  return `${providerLabel(provider)} sign-in is not configured yet — add the OAuth client in Supabase (Auth → Providers) to enable it.`
}
