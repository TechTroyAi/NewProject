import { createBrowserClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** True when no database is configured — the app runs on seeded demo data. */
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY

let browser: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient | null {
  if (IS_DEMO) return null
  if (!browser) browser = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return browser
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (IS_DEMO) return null
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
}
