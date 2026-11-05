import 'server-only'
import './env'
import { IS_DEMO } from './db'
import { getSessionClient, getUserId } from './session'
import { encryptionKey, fingerprint, openSecret, sealSecret } from './crypto'

/**
 * A session-bound Supabase client.
 *
 * The anon key plus the caller's cookies: the RLS policies are what
 * decide which rows this can touch.
 */
const sb = async () => {
  const client = await getSessionClient()
  if (!client) throw new Error('Supabase is not configured')
  return client
}

/* ══════════════════════════════════════════════════════════════
   Bring-your-own provider key.

   A user may store their own AI provider key. It is sealed with
   AES-256-GCM before it is written and only ever opened on the
   server, for the request that needs it.

   This module deliberately does not import the main data layer — the
   provider module depends on it, and the data layer depends on the
   provider module.
   ══════════════════════════════════════════════════════════════ */

/* ─── Bring-your-own provider key ───────────────────────────── */

/**
 * The user's own provider key, decrypted.
 *
 * Returns null when the user has not stored one, when the server has
 * no encryption key configured, or when the stored blob cannot be
 * opened (a rotated server key, for instance).
 */
export async function getUserApiKey(
  provider: string,
): Promise<{ provider: string; key: string } | null> {
  if (IS_DEMO) return null
  const secretKey = encryptionKey()
  if (!secretKey) return null

  const { data } = await (await sb())
    .from('user_api_keys')
    .select('provider, ciphertext, iv, auth_tag')
    .eq('provider', provider)
    .maybeSingle()
  if (!data) return null

  try {
    const key = openSecret(
      { ciphertext: data.ciphertext, iv: data.iv, tag: data.auth_tag },
      secretKey,
    )
    return { provider: data.provider, key }
  } catch {
    // The stored secret was sealed with a different server key.
    return null
  }
}

/** Which providers the user has stored a key for (never the key itself). */
export async function listUserApiKeys(): Promise<
  { provider: string; fingerprint: string; updated_at: string }[]
> {
  if (IS_DEMO) return []
  const { data } = await (await sb())
    .from('user_api_keys')
    .select('provider, fingerprint, updated_at')
    .order('provider')
  return (data ?? []) as { provider: string; fingerprint: string; updated_at: string }[]
}

/** Store (or replace) the user's key for a provider. */
export async function saveUserApiKey(provider: string, plainKey: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const secretKey = encryptionKey()
  if (!secretKey) throw new Error('This server has no SHELF_ENCRYPTION_KEY configured')
  const sealed = sealSecret(plainKey, secretKey)

  const { error } = await (await sb()).from('user_api_keys').upsert(
    {
      user_id: userId,
      provider,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      auth_tag: sealed.tag,
      fingerprint: fingerprint(plainKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  )
  if (error) throw error
}

/** Forget the user's key for a provider. */
export async function deleteUserApiKey(provider: string): Promise<void> {
  const { error } = await (await sb())
    .from('user_api_keys')
    .delete()
    .eq('provider', provider)
  if (error) throw error
}


/**
 * The providers the user has a key for.
 *
 * A user can only have one key per provider; the list is tiny.
 */
export async function userApiKeyProviders(): Promise<string[]> {
  if (IS_DEMO) return []
  const client = await getSessionClient()
  if (!client) return []
  const { data } = await client.from('user_api_keys').select('provider')
  return (data ?? []).map((r: { provider: string }) => r.provider)
}
