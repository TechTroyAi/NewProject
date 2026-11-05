import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { getSessionClient } from '@/lib/session'
import { getSupabaseAdmin, IS_DEMO } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Delete the signed-in user's account and everything attached to it.
 *
 * The profile row cascades to every other table (each of them has
 * `user_id references profiles(id) on delete cascade`), so removing
 * the profile is enough. The stored files are removed as well —
 * leaving a user's manga in a bucket after they asked us to delete
 * their account would not be a deletion.
 *
 * `confirm` must be the literal string `DELETE` so this can never be
 * triggered by a stray request.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => null)
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'confirmation required' }, { status: 400 })
  }

  if (IS_DEMO) {
    return NextResponse.json(
      { error: 'there is no account to delete in demo mode' },
      { status: 409 },
    )
  }

  const sb = await getSessionClient()
  if (!sb) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  // Collect the storage paths before the rows disappear.
  const { data: items } = await sb.from('items').select('original_path, cover_path')
  const { data: pages } = await sb.from('pages').select('image_path')
  const paths = new Set<string>()
  for (const row of items ?? []) {
    if (row.original_path) paths.add(row.original_path)
    if (row.cover_path) paths.add(row.cover_path)
  }
  for (const row of pages ?? []) {
    if (row.image_path) paths.add(row.image_path)
  }

  // Deleting the profile cascades through every table that references
  // it. Supabase's storage bucket has to be pruned separately.
  const { error } = await sb.from('profiles').delete().eq('id', auth.userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await removeStoredFiles([...paths])

  // The auth user has to go too — otherwise they could still sign in
  // to an account with no profile behind it.
  let authUserRemoved = false
  try {
    const admin = getSupabaseAdmin()
    if (admin) {
      const { error } = await admin.auth.admin.deleteUser(auth.userId)
      authUserRemoved = !error
    }
  } catch {
    /* the profile cascade is the part that matters */
  }

  return NextResponse.json({ ok: true, deletedFiles: paths.size, authUserRemoved })
}

/** Best-effort removal of the user's objects from the storage bucket. */
async function removeStoredFiles(paths: string[]) {
  if (!paths.length) return
  const bucket = process.env.STORAGE_BUCKET ?? 'shelf'
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return
    for (const path of paths) {
      await admin.storage.from(bucket).remove([path])
    }
  } catch {
    // The rows are gone, which is what the account is; a stray file in
    // the bucket must not turn a successful deletion into an error.
  }
}
