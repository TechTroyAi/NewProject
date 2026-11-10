import 'server-only'
import './env'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { IS_DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from './db'
import { DEMO_USER_ID } from './demo'

/* ══════════════════════════════════════════════════════════════
   Session.

   The app talks to Supabase with the *anon* key and the caller's
   session cookies, never with the service-role key. That means the
   Row Level Security policies in the migration are the thing that
   actually decides which rows a request can see — application code
   cannot forget a `user_id` filter, because there is nothing to
   forget: RLS does it.

   The service-role key is still used where it legitimately belongs:
   the background worker, and the few `security definer` RPCs.
   ══════════════════════════════════════════════════════════════ */

/**
 * A Supabase client bound to the current request's cookies.
 *
 * `cache()` dedupes within a request, so a page that touches the
 * database a dozen times only builds one client.
 *
 * Uses the modern `getAll`/`setAll` cookie adapter. The deprecated
 * `{get,set,remove}` adapter only reads the key + 5 chunks, which is
 * hazardous for chunked sessions and for reading slotted PKCE verifier
 * cookies (they live under `${storageKey}-flow-<id>-code-verifier`).
 */
export const getSessionClient = cache(async (): Promise<SupabaseClient | null> => {
  if (IS_DEMO || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  const store = cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return store.getAll()
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            store.set({ name, value, ...options })
          })
        } catch {
          // Server Components cannot set cookies — the middleware
          // refreshes the session for us, so this is safe to ignore.
        }
      },
    },
  })
})

/**
 * The signed-in user's id, or null when there is no session.
 *
 * Demo mode always resolves to the seeded demo user, so the whole
 * app stays browsable with no infrastructure at all.
 */
export const getUserId = cache(async (): Promise<string | null> => {
  if (IS_DEMO) return DEMO_USER_ID
  const client = await getSessionClient()
  if (!client) return null
  const { data, error } = await client.auth.getUser()
  if (error) return null
  return data.user?.id ?? null
})

/** True when the request is authenticated (always true in demo mode). */
export async function isAuthenticated(): Promise<boolean> {
  return (await getUserId()) !== null
}
