import 'server-only'
import './env'
import type { TrashEntityType } from '@shelf/shared'
import { TRASH_RETENTION_DAYS, trashDaysLeft } from '@shelf/shared'
import { getSupabaseAdmin, IS_DEMO } from './db'
import { getSessionClient } from './session'
import { demoCards, demoDecks, demoItems, demoNotes } from './demo'

/* ══════════════════════════════════════════════════════════════
   The trash.

   Deleting a note, an item, a deck, a card or a clip does not throw
   the row away — it is snapshotted into `trash` so it can be put
   back. Entries are purged after 30 days.
   ══════════════════════════════════════════════════════════════ */

export interface TrashEntry {
  id: string
  entityType: TrashEntityType
  entityId: string
  label: string
  deletedAt: string
  /** Days until the entry is purged for good. */
  daysLeft: number
}

const TABLE: Record<TrashEntityType, string> = {
  note: 'notes',
  item: 'items',
  deck: 'decks',
  card: 'cards',
  clip: 'clips',
}

/** The tables a snapshot can be restored into. */
const RESTORABLE = new Set<string>(Object.values(TABLE))

const client = async () => {
  const c = await getSessionClient()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

function labelFor(type: TrashEntityType, row: Record<string, unknown>): string {
  const title = row.title ?? row.question ?? row.label
  if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 300)
  if (type === 'clip') return `Clip on page ${Number(row.page_idx ?? 0) + 1}`
  return 'Untitled'
}

/**
 * A vector column comes back from PostgREST as a string; keep it in
 * the text form so it can be written straight back.
 */
function normaliseSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  if ('embedding' in out) {
    const emb = out.embedding
    if (Array.isArray(emb)) out.embedding = `[${emb.join(',')}]`
    else if (emb == null) delete out.embedding
  }
  return out
}

/* ─── demo mode ─────────────────────────────────────────────── */

/** Demo mode keeps the trash in memory for the life of the process. */
const demoTrash: (TrashEntry & { payload: Record<string, unknown> })[] = []

function demoTrashEntity(type: TrashEntityType, entityId: string): TrashEntry | null {
  const lists: Record<TrashEntityType, { id: string; title?: string; question?: string }[]> = {
    note: demoNotes as never,
    item: demoItems as never,
    deck: demoDecks as never,
    card: demoCards as never,
    clip: [],
  }
  const list = lists[type]
  const idx = list.findIndex((x) => x.id === entityId)
  if (idx === -1) return null
  const row = list[idx] as Record<string, unknown>
  const label = labelFor(type, row)
  list.splice(idx, 1)

  const deletedAt = new Date().toISOString()
  const id = `trash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  demoTrash.unshift({
    id,
    entityType: type,
    entityId,
    label,
    deletedAt,
    daysLeft: TRASH_RETENTION_DAYS,
    payload: { row: normaliseSnapshot(row) },
  })
  // The snapshot stays on the server — the client only needs to know
  // what was thrown away.
  return { id, entityType: type, entityId, label, deletedAt, daysLeft: TRASH_RETENTION_DAYS }
}

/* ─── live mode ─────────────────────────────────────────────── */

/**
 * Move a row into the trash.
 *
 * The row is snapshotted first, then deleted. If the delete fails the
 * snapshot is removed again, so a failed delete never leaves a ghost
 * entry in the trash.
 */
export async function trashEntity(type: TrashEntityType, entityId: string): Promise<TrashEntry | null> {
  if (!RESTORABLE.has(TABLE[type])) return null
  if (IS_DEMO) return demoTrashEntity(type, entityId)

  const c = await client()
  const table = TABLE[type]

  const { data: row, error: readErr } = await c.from(table).select('*').eq('id', entityId).maybeSingle()
  if (readErr) throw readErr
  if (!row) return null
  const raw = row as Record<string, unknown>

  const payload: Record<string, unknown> = { row: normaliseSnapshot(raw) }
  if (type === 'item') {
    // An item's pages belong to it; without them a restored item
    // would be an empty shell.
    const { data: pages } = await c.from('pages').select('*').eq('item_id', entityId)
    payload.pages = pages ?? []
  }

  const userId = raw.user_id
  if (typeof userId !== 'string') return null

  const { data: entry, error: insErr } = await (
    await c
      .from('trash')
      .insert({
        user_id: userId,
        entity_type: type,
        entity_id: entityId,
        label: labelFor(type, raw),
        payload,
      })
      .select('id, entity_type, entity_id, label, deleted_at')
      .single()
  )
  if (insErr) throw insErr

  const { error: delErr } = await c.from(table).delete().eq('id', entityId)
  if (delErr) {
    // The delete failed — take the snapshot back out again.
    await c.from('trash').delete().eq('id', entry.id)
    throw delErr
  }

  return {
    id: entry.id,
    entityType: entry.entity_type as TrashEntityType,
    entityId: entry.entity_id,
    label: entry.label,
    deletedAt: entry.deleted_at,
    daysLeft: trashDaysLeft(entry.deleted_at),
  }
}

/** Everything currently in the trash, newest first. */
export async function listTrash(): Promise<TrashEntry[]> {
  if (IS_DEMO) {
    return demoTrash.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      label: e.label,
      deletedAt: e.deletedAt,
      daysLeft: trashDaysLeft(e.deletedAt),
    }))
  }

  const c = await client()
  const { data, error } = await c
    .from('trash')
    .select('id, entity_type, entity_id, label, deleted_at')
    .order('deleted_at', { ascending: false })
    .limit(200)
  if (error) throw error

  return ((data ?? []) as { id: string; entity_type: string; entity_id: string; label: string; deleted_at: string }[])
    .filter((r) => RESTORABLE.has(TABLE[r.entity_type as TrashEntityType]))
    .map((r) => ({
      id: r.id,
      entityType: r.entity_type as TrashEntityType,
      entityId: r.entity_id,
      label: r.label,
      deletedAt: r.deleted_at,
      daysLeft: trashDaysLeft(r.deleted_at),
    }))
}

/** Put a trashed row back where it came from. */
export async function restoreTrashEntry(entryId: string): Promise<boolean> {
  if (IS_DEMO) {
    const idx = demoTrash.findIndex((e) => e.id === entryId)
    if (idx === -1) return false
    const entry = demoTrash[idx]
    demoTrash.splice(idx, 1)
    const list =
      entry.entityType === 'note'
        ? demoNotes
        : entry.entityType === 'item'
          ? demoItems
          : entry.entityType === 'deck'
            ? demoDecks
            : demoCards
    list.unshift(entry.payload.row as never)
    return true
  }

  const c = await client()
  const { data: found, error: readErr } = await c.from('trash').select('*').eq('id', entryId).maybeSingle()
  if (readErr) throw readErr
  if (!found) return false
  const entry = found as {
    entity_type: TrashEntityType
    entity_id: string
    payload: { row?: Record<string, unknown>; pages?: Record<string, unknown>[] }
  }
  const table = TABLE[entry.entity_type]
  if (!RESTORABLE.has(table) || !entry.payload?.row) return false

  const { error: insErr } = await c.from(table).insert(entry.payload.row)
  if (insErr) throw insErr

  if (Array.isArray(entry.payload.pages) && entry.payload.pages.length > 0) {
    const { error: pageErr } = await c.from('pages').insert(entry.payload.pages)
    if (pageErr) throw pageErr
  }

  await c.from('trash').delete().eq('id', entryId)
  return true
}

/** Throw an entry away for good. The row itself is already gone. */
export async function purgeTrashEntry(entryId: string): Promise<boolean> {
  if (IS_DEMO) {
    const idx = demoTrash.findIndex((e) => e.id === entryId)
    if (idx === -1) return false
    demoTrash.splice(idx, 1)
    return true
  }

  const c = await client()
  // An item's files are still in the bucket until the entry is purged
  // for good — that is what buys the 30 days to restore it.
  const { data: found } = await c
    .from('trash')
    .select('entity_type, payload')
    .eq('id', entryId)
    .maybeSingle()
  const paths = storedPaths(found as { entity_type?: string; payload?: unknown } | null)

  const { error } = await c.from('trash').delete().eq('id', entryId)
  if (error) throw error
  if (paths.length) await removeStoredFiles(paths)
  return true
}

/** The storage paths an item's snapshot still points at. */
function storedPaths(entry: { entity_type?: string; payload?: unknown } | null): string[] {
  if (!entry || entry.entity_type !== 'item') return []
  const payload = entry.payload as { row?: Record<string, unknown>; pages?: Record<string, unknown>[] } | undefined
  if (!payload) return []
  const paths = new Set<string>()
  const row = payload.row
  if (row) {
    if (typeof row.original_path === 'string') paths.add(row.original_path)
    if (typeof row.cover_path === 'string') paths.add(row.cover_path)
  }
  for (const page of payload.pages ?? []) {
    if (typeof page.image_path === 'string') paths.add(page.image_path)
  }
  return [...paths]
}

/** Best-effort removal of objects from the storage bucket. */
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
    // The trash entry is gone either way; a stray file must not turn a
    // successful purge into an error.
  }
}

/** Empty the whole trash. */
export async function emptyTrash(): Promise<number> {
  if (IS_DEMO) {
    const n = demoTrash.length
    demoTrash.length = 0
    return n
  }

  const c = await client()
  const { data, error } = await c
    .from('trash')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id')
  if (error) throw error
  return Array.isArray(data) ? data.length : 0
}

/**
 * Remove the entries that are past their retention window.
 *
 * Called whenever the trash is opened, so an abandoned trash cleans
 * itself up without a cron job.
 */
export async function purgeExpiredTrash(): Promise<number> {
  if (IS_DEMO) {
    const before = demoTrash.length
    for (let i = demoTrash.length - 1; i >= 0; i--) {
      if (trashDaysLeft(demoTrash[i].deletedAt) === 0) demoTrash.splice(i, 1)
    }
    return before - demoTrash.length
  }

  const c = await client()
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000).toISOString()
  const { data, error } = await c.from('trash').delete().lt('deleted_at', cutoff).select('id')
  if (error) throw error
  return Array.isArray(data) ? data.length : 0
}
