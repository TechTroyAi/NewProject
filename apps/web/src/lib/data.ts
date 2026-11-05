import 'server-only'
import './env'
import type { Card, GraphEdge, GraphNode, Item, Note, Progress, Series } from '@shelf/shared'
import { interleaveBySeries, kindOfItem, localDateKey, similarity, toPgVector } from '@shelf/shared'
import { embedText } from './ai-provider'
import { getSupabaseAdmin, IS_DEMO } from './db'
import { getSessionClient, getUserId } from './session'
import { newFsrsCard } from './fsrs'
import { randomUUID } from 'node:crypto'
import {
  DEMO_USER_ID,
  demoActivity,
  demoCards,
  demoDecks,
  demoGraphEdges,
  demoGraphNodes,
  demoInbox,
  demoItems,
  demoLinks,
  demoNotes,
  demoProgress,
  demoSeries,
} from './demo'

/* ══════════════════════════════════════════════════════════════
   Data access layer.
   Demo mode → seeded in-memory dataset.
   Live mode → Supabase with RLS-scoped queries.
   ══════════════════════════════════════════════════════════════ */

const admin = () => getSupabaseAdmin()

/**
 * The request's Supabase client, bound to the caller's session.
 *
 * It uses the *anon* key, so the RLS policies in the migration are
 * what decide which rows this request can touch. Application code
 * cannot leak another user's data by forgetting a filter.
 */
const db = async () => {
  const client = await getSessionClient()
  if (!client) throw new Error('Supabase is not configured')
  return client
}

export interface SeriesWithItems extends Series {
  items: Item[]
}

export interface LibraryFilters {
  q?: string
  kind?: string
  tag?: string
  sort?: 'recent' | 'title' | 'progress' | 'added'
}

export interface SearchHit {
  id: string
  kind: 'note' | 'item' | 'page' | 'card'
  title: string
  snippet: string
  href: string
  meta?: string
}

/* ─── Profile ────────────────────────────────────────────────── */

export async function getProfile() {
  if (IS_DEMO) {
    return {
      id: DEMO_USER_ID,
      display_name: 'Troy',
      settings: {
        theme: 'midnight' as const,
        accent: '#7c6bf5',
        reader: { mode: 'strip' as const, rtl: false, spread: false, background: 'theme' as const, scale: 1 },
        ai: { model: 'openai/gpt-4o-mini', dailyTokenBudget: 200_000, spoilerGuard: true },
        quiz: { newPerDay: 10, enabled: true },
      },
      created_at: new Date().toISOString(),
    }
  }
  const { data } = await (await db()).from('profiles').select('*').maybeSingle()
  return data
}

/* ─── Series & items ─────────────────────────────────────────── */

export async function getSeriesList(): Promise<Series[]> {
  if (IS_DEMO) return demoSeries
  const { data } = await (await db()).from('series').select('*').order('title')
  return data ?? []
}

export async function getItems(filters: LibraryFilters = {}): Promise<Item[]> {
  if (IS_DEMO) {
    let items = [...demoItems]
    if (filters.kind && filters.kind !== 'all') {
      const ids = new Set(demoSeries.filter((s) => s.kind === filters.kind).map((s) => s.id))
      items = items.filter((i) => (i.series_id ? ids.has(i.series_id) : false))
    }
    if (filters.tag) {
      const tag = filters.tag
      items = items.filter((i) => i.ai_tags?.includes(tag) ?? false)
    }
    if (filters.q) {
      const q = filters.q.toLowerCase()
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.ai_tags?.some((t) => t.includes(q)))
    }
    return items
  }
  let q = (await db()).from('items').select('*')
  if (filters.q) q = q.ilike('title', `%${filters.q}%`)
  const { data } = await q.order('created_at', { ascending: false })
  return data ?? []
}

export async function getItemById(id: string): Promise<(Item & { series?: Series | null }) | null> {
  if (IS_DEMO) {
    const item = demoItems.find((i) => i.id === id)
    if (!item) return null
    return { ...item, series: demoSeries.find((s) => s.id === item.series_id) ?? null }
  }
  const { data } = await (await db()).from('items').select('*, series(*)').eq('id', id).maybeSingle()
  return data ?? null
}

export async function getSeriesWithItems(seriesId: string): Promise<SeriesWithItems | null> {
  const series = (await getSeriesList()).find((s) => s.id === seriesId)
  if (!series) return null
  const items = (await getItems()).filter((i) => i.series_id === seriesId)
  return { ...series, items }
}

export interface PageRow {
  idx: number
  imagePath: string | null
  text: string | null
  width: number | null
  height: number | null
}

export async function getPagesForItem(itemId: string): Promise<PageRow[]> {
  if (IS_DEMO) {
    const item = demoItems.find((i) => i.id === itemId)
    const count = item?.page_count ?? 0
    return Array.from({ length: count }, (_, idx) => ({
      idx,
      imagePath: null,
      text: item?.type === 'pdf' || item?.type === 'pptx' ? `Page ${idx + 1} text content placeholder.` : null,
      width: 1200,
      height: 1700,
    }))
  }
  const { data } = await (await db()).from('pages').select('*').eq('item_id', itemId).order('idx')
  return (data ?? []).map((p) => ({
    idx: p.idx,
    imagePath: p.image_path,
    text: p.text,
    width: p.width,
    height: p.height,
  }))
}

/* ─── Progress ───────────────────────────────────────────────── */

export async function getProgressMap(): Promise<Map<string, Progress>> {
  if (IS_DEMO) return new Map(demoProgress.map((p) => [p.item_id, p]))
  const { data } = await (await db()).from('progress').select('*')
  return new Map((data ?? []).map((p) => [p.item_id, p]))
}

export async function getContinueReading(limit = 6) {
  const [items, progress] = await Promise.all([getItems(), getProgressMap()])
  return items
    .map((i) => ({ item: i, progress: progress.get(i.id) }))
    .filter((x) => x.progress && !x.progress.finished)
    // Most recently read first — this is the "pick up where you left
    // off" list, so the oldest entry belongs at the bottom.
    .sort((a, b) => (a.progress!.updated_at < b.progress!.updated_at ? 1 : -1))
    .slice(0, limit)
}

export async function saveProgress(itemId: string, page: number, maxPageRead?: number, finished?: boolean) {
  if (IS_DEMO) {
    const p = demoProgress.find((x) => x.item_id === itemId)
    if (p) {
      p.current_page = page
      // `max_page_read` is the spoiler guard — it only ever grows.
      p.max_page_read = Math.max(p.max_page_read, maxPageRead ?? page)
      p.finished = (finished ?? false) || p.finished
      const pages = demoItems.find((i) => i.id === itemId)?.page_count ?? 0
      p.percent = pages > 0 ? Math.min(100, Math.round((page / pages) * 1000) / 10) : 0
      p.updated_at = new Date().toISOString()
    }
    return p
  }
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  // The RPC keeps `max_page_read` monotonic and recomputes `percent`.
  const { data, error } = await (await db()).rpc('save_progress', {
    p_item_id: itemId,
    p_page: page,
    p_max_page_read: maxPageRead ?? page,
    p_finished: finished ?? false,
  })
  if (error) throw error
  return data
}

/* ─── Notes ──────────────────────────────────────────────────── */

export async function getNotes(limit?: number): Promise<Note[]> {
  if (IS_DEMO) {
    const sorted = [...demoNotes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    return limit ? sorted.slice(0, limit) : sorted
  }
  let q = (await db()).from('notes').select('*').order('updated_at', { ascending: false })
  if (limit) q = q.limit(limit)
  const { data } = await q
  return data ?? []
}

export async function getNoteById(id: string): Promise<Note | null> {
  if (IS_DEMO) return demoNotes.find((n) => n.id === id) ?? null
  const { data } = await (await db()).from('notes').select('*').eq('id', id).maybeSingle()
  return data ?? null
}

export interface SaveNoteResult {
  note: Note
  /** True when somebody else changed the note since we last read it. */
  conflict: boolean
}

export async function saveNote(note: {
  id?: string
  title: string
  body_md: string
  item_id?: string | null
  page_ref?: number | null
  /** The `updated_at` the editor last saw; used for conflict detection. */
  base_updated_at?: string | null
}): Promise<SaveNoteResult> {
  if (IS_DEMO) {
    if (note.id) {
      const existing = demoNotes.find((n) => n.id === note.id)
      if (existing) {
        if (
          note.base_updated_at &&
          existing.updated_at !== note.base_updated_at
        ) {
          // Somebody else edited it first — hand back both versions.
          return { note: { ...existing }, conflict: true }
        }
        existing.title = note.title
        existing.body_md = note.body_md
        existing.updated_at = new Date().toISOString()
        return { note: existing, conflict: false }
      }
    }
    const created: Note = {
      id: `n-${Date.now().toString(36)}`,
      user_id: DEMO_USER_ID,
      title: note.title,
      body_md: note.body_md,
      item_id: note.item_id ?? null,
      page_ref: note.page_ref ?? null,
      is_ai_draft: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    demoNotes.unshift(created)
    return { note: created, conflict: false }
  }
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  // The RPC performs the conflict check and only then writes.
  const { data, error } = await (await db()).rpc('save_note', {
    p_id: note.id ?? null,
    p_title: note.title,
    p_body_md: note.body_md,
    p_item_id: note.item_id ?? null,
    p_page_ref: note.page_ref ?? null,
    p_base_updated_at: note.base_updated_at ?? null,
  })
  if (error) throw error
  const result = (data ?? {}) as { note?: Note; conflict?: boolean }
  if (!result.note) throw new Error('save_note returned no note')
  return { note: result.note, conflict: !!result.conflict }
}

/** Notes that point at an item (and the page they point at). */
export async function getNotesForItem(
  itemId: string,
): Promise<{ id: string; title: string; body_md: string; page_ref: number | null }[]> {
  if (IS_DEMO) {
    const ids = demoLinks.filter((l) => l.to_item === itemId).map((l) => l.from_note)
    return demoNotes
      .filter((n) => ids.includes(n.id))
      .map((n) => ({ id: n.id, title: n.title, body_md: n.body_md, page_ref: n.page_ref ?? null }))
  }
  const { data: links } = await (await db())
    .from('links')
    .select('from_note, to_page')
    .eq('to_item', itemId)
  const ids = [...new Set((links ?? []).map((l) => l.from_note).filter(Boolean))] as string[]
  if (!ids.length) return []
  const { data: notes } = await (await db()).from('notes').select('id, title, body_md, page_ref').in('id', ids)
  const pageOf = new Map((links ?? []).map((l) => [l.from_note, l.to_page]))
  return (notes ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body_md: n.body_md,
    page_ref: pageOf.get(n.id) ?? n.page_ref ?? null,
  }))
}

export async function getBacklinks(noteId: string) {
  if (IS_DEMO) {
    return demoNotes.filter((n) =>
      demoLinks.some((l) => l.from_note === n.id && l.to_note === noteId),
    )
  }
  const { data } = await (await db())
    .from('links')
    .select('from_note')
    .eq('to_note', noteId)
  const ids = (data ?? []).map((l) => l.from_note).filter(Boolean) as string[]
  if (!ids.length) return []
  const { data: notes } = await (await db()).from('notes').select('*').in('id', ids)
  return notes ?? []
}

export async function getLinks() {
  if (IS_DEMO) return demoLinks
  const { data } = await (await db()).from('links').select('*')
  return data ?? []
}

/* ─── Graph ──────────────────────────────────────────────────── */

export async function getGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  if (IS_DEMO) return { nodes: demoGraphNodes, edges: demoGraphEdges }
  const [notes, items, series, links] = await Promise.all([
    getNotes(),
    getItems(),
    getSeriesList(),
    getLinks(),
  ])
  const nodes: GraphNode[] = [
    ...notes.map((n) => ({ id: n.id, kind: 'note' as const, label: n.title, degree: 0 })),
    ...items.map((i) => ({ id: i.id, kind: 'item' as const, label: i.title, degree: 0 })),
    ...series.map((s) => ({ id: s.id, kind: 'series' as const, label: s.title, degree: 0 })),
  ]
  const deg = new Map<string, number>()
  const edges: GraphEdge[] = []
  for (const l of links) {
    if (!l.from_note) continue
    const target = l.to_note ?? l.to_item
    if (!target) continue
    edges.push({ source: l.from_note, target, kind: l.kind })
    deg.set(l.from_note, (deg.get(l.from_note) ?? 0) + 1)
    deg.set(target, (deg.get(target) ?? 0) + 1)
  }
  return { nodes: nodes.map((n) => ({ ...n, degree: deg.get(n.id) ?? 0 })), edges }
}

/* ─── Quiz ───────────────────────────────────────────────────── */

/**
 * Create a deck from generated cards.
 *
 * The cards are scheduled with FSRS starting today, so a brand new
 * card is due immediately but is still counted against the daily
 * "new cards" cap when the queue is built.
 */
export async function createDeckFromCards(opts: {
  title: string
  noteId?: string | null
  itemId?: string | null
  cards: {
    type: string
    question: string
    answer: string
    options?: string[] | null
    explanation?: string | null
    sourcePage?: number | null
  }[]
}): Promise<{ deckId: string; cardIds: string[] }> {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')

  if (IS_DEMO) {
    const deckId = `d-${Date.now().toString(36)}`
    demoDecks.push({
      id: deckId,
      user_id: userId,
      title: opts.title,
      item_id: opts.itemId ?? null,
      note_id: opts.noteId ?? null,
    })
    const now = new Date().toISOString()
    const cardIds: string[] = []
    opts.cards.forEach((c, i) => {
      const id = `c-${deckId}-${i}`
      cardIds.push(id)
      const empty = newFsrsCard()
      demoCards.push({
        id,
        user_id: userId,
        deck_id: deckId,
        type: c.type as Card['type'],
        question: c.question,
        answer: c.answer,
        options: c.options ?? null,
        explanation: c.explanation ?? null,
        source_note: opts.noteId ?? null,
        source_item: opts.itemId ?? null,
        source_page: c.sourcePage ?? null,
        spoiler_limit_page: c.sourcePage ?? 0,
        status: 'active',
        due: now,
        stability: empty.stability,
        difficulty: empty.difficulty,
        elapsed_days: empty.elapsed_days,
        scheduled_days: empty.scheduled_days,
        reps: empty.reps,
        lapses: empty.lapses,
        learning_steps: empty.learning_steps,
        state: empty.state,
        last_review: null,
      })
    })
    return { deckId, cardIds }
  }

  const sb = await db()
  const { data: deck, error: deckError } = await sb
    .from('decks')
    .insert({
      user_id: userId,
      title: opts.title,
      note_id: opts.noteId ?? null,
      item_id: opts.itemId ?? null,
    })
    .select('id')
    .single()
  if (deckError) throw deckError

  const now = new Date().toISOString()
  const rows = opts.cards.map((c) => {
    const empty = newFsrsCard()
    return {
      id: randomUUID(),
      user_id: userId,
      deck_id: deck.id,
      type: c.type,
      question: c.question,
      answer: c.answer,
      options: c.options ?? null,
      explanation: c.explanation ?? null,
      source_note: opts.noteId ?? null,
      source_item: opts.itemId ?? null,
      source_page: c.sourcePage ?? null,
      spoiler_limit_page: c.sourcePage ?? 0,
      status: 'active',
      due: now,
      stability: empty.stability,
      difficulty: empty.difficulty,
      elapsed_days: empty.elapsed_days,
      scheduled_days: empty.scheduled_days,
      reps: empty.reps,
      lapses: empty.lapses,
      learning_steps: empty.learning_steps,
      state: empty.state,
      last_review: null,
    }
  })

  const { error: cardError } = await sb.from('cards').insert(rows)
  if (cardError) throw cardError
  return { deckId: deck.id, cardIds: rows.map((r) => r.id) }
}

export async function getDecks() {
  if (IS_DEMO) return demoDecks
  const { data } = await (await db()).from('decks').select('*')
  return data ?? []
}

/* ─── Quiz queue ─────────────────────────────────────────────── */

const DEFAULT_NEW_PER_DAY = 10
const DEFAULT_DAILY_CAP = 50

/**
 * Build the session queue: due reviews first, then new cards up to the
 * daily "new per day" allowance, interleaved by series and clipped to
 * the daily cap.
 */
export { interleaveBySeries }

export async function getQuizQueue(limit = 20): Promise<Card[]> {
  const profile = await getProfile()
  const settings = profile?.settings?.quiz
  if (settings?.enabled === false) return []
  const newPerDay = Math.max(0, settings?.newPerDay ?? DEFAULT_NEW_PER_DAY)
  const dailyCap = Math.max(1, settings?.dailyCap ?? DEFAULT_DAILY_CAP)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  if (IS_DEMO) {
    const nowIso = new Date().toISOString()
    const active = demoCards.filter((c) => c.status === 'active')
    const due = active.filter((c) => c.due <= nowIso && c.state !== 0)
    const fresh = active.filter((c) => c.state === 0)
    const introducedToday = active.filter(
      (c) => c.reps <= 1 && c.last_review && c.last_review >= startOfDay.toISOString(),
    ).length
    const queue = [...due, ...fresh.slice(0, Math.max(0, newPerDay - introducedToday))]
    return interleaveBySeries(queue, new Map()).slice(0, Math.min(limit, dailyCap))
  }

  const sb = await db()
  const { data: rows } = await sb
    .from('cards')
    .select('*')
    .eq('status', 'active')
    .order('due')

  const all = (rows ?? []) as Card[]
  const due = all.filter((c) => c.state !== 0 && c.due <= new Date().toISOString())
  const fresh = all.filter((c) => c.state === 0)

  // How many new cards have already been introduced today?
  const introducedToday = all.filter(
    (c) => c.reps <= 1 && c.last_review && c.last_review >= startOfDay.toISOString(),
  ).length

  // How many reviews have already happened today (the daily cap)?
  // With `head: true` the row data is not returned — only the count.
  const { count: reviewedToday } = await sb
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .gte('reviewed_at', startOfDay.toISOString())
  const doneToday = reviewedToday ?? 0

  const room = Math.max(0, dailyCap - doneToday)
  if (room === 0) return []

  const queue = [...due, ...fresh.slice(0, Math.max(0, newPerDay - introducedToday))]

  // Map each card to its series so the queue can be interleaved.
  const itemIds = [...new Set(queue.map((c) => c.source_item).filter((v): v is string => !!v))]
  const seriesOf = new Map<string, string | null>()
  if (itemIds.length) {
    const { data: items } = await sb.from('items').select('id, series_id').in('id', itemIds)
    const byItem = new Map((items ?? []).map((i) => [i.id, i.series_id]))
    for (const card of queue) {
      seriesOf.set(card.id, card.source_item ? byItem.get(card.source_item) ?? null : null)
    }
  }

  return interleaveBySeries(queue, seriesOf).slice(0, Math.min(limit, room))
}

export async function getDueCards(limit = 20): Promise<Card[]> {
  if (IS_DEMO) {
    const nowIso = new Date().toISOString()
    return demoCards
      .filter((c) => c.status === 'active' && c.due <= nowIso)
      .sort((a, b) => (a.due < b.due ? -1 : 1))
      .slice(0, limit)
  }
  const { data } = await (await db())
    .from('cards')
    .select('*')
    .eq('status', 'active')
    .lte('due', new Date().toISOString())
    .order('due')
    .limit(limit)
  return data ?? []
}

export async function getAllCards(): Promise<Card[]> {
  if (IS_DEMO) return demoCards
  const { data } = await (await db()).from('cards').select('*')
  return data ?? []
}

/** A single card, scoped to the signed-in user by RLS. */
export async function getCard(cardId: string): Promise<Card | null> {
  if (IS_DEMO) return demoCards.find((c) => c.id === cardId) ?? null
  const { data, error } = await (await db()).from('cards').select('*').eq('id', cardId).maybeSingle()
  if (error) throw error
  return (data as Card) ?? null
}

/**
 * Flag, suspend or re-activate a card.
 *
 * `status` is one of 'active' | 'suspended' | 'flagged' — a flagged
 * card stays in the deck but is easier to find.
 */
export async function setCardStatus(
  cardId: string,
  status: 'active' | 'suspended' | 'flagged',
): Promise<Card | null> {
  if (IS_DEMO) {
    const c = demoCards.find((x) => x.id === cardId)
    if (!c) return null
    c.status = status
    return c
  }
  const { data, error } = await (await db())
    .from('cards')
    .update({ status })
    .eq('id', cardId)
    .select()
    .single()
  if (error) throw error
  return data as Card
}

export async function saveCardReview(cardId: string, row: Partial<Card>, rating: number, msTaken?: number) {
  if (IS_DEMO) {
    const c = demoCards.find((x) => x.id === cardId)
    if (c) Object.assign(c, row)
    return c
  }
  // Resolve the owner *before* mutating anything — otherwise a missing
  // session leaves the card rescheduled with no review log.
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await (await db())
    .from('cards')
    .update(row)
    .eq('id', cardId)
    .select()
    .single()
  if (error) throw error

  // The review log drives the daily cap and the activity heatmap, so a
  // failed insert must not pass silently.
  const { error: reviewError } = await (await db()).from('reviews').insert({
    card_id: cardId,
    user_id: userId,
    rating,
    ms_taken: msTaken ?? 0,
  })
  if (reviewError) throw reviewError
  return data
}

/* ─── Inbox ──────────────────────────────────────────────────── */

export async function getInbox() {
  if (IS_DEMO) return demoInbox
  const [{ data }, series] = await Promise.all([
    (await db()).from('items').select('*').eq('status', 'needs_review').order('created_at'),
    getSeriesList(),
  ])
  return (data ?? []).map((i: Item) => {
    // The worker could not place this one, so offer the closest series
    // as a suggestion — the same similarity it used to decide.
    const wanted = kindOfItem(i.type)
    const candidates = series
      .filter((s) => s.kind === wanted || s.kind === 'mixed')
      .map((s) => ({ id: s.id, title: s.title, score: similarity(s.title, i.title) }))
      .filter((c) => c.score > 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    return {
      id: i.id,
      title: i.title,
      type: i.type,
      reason: i.status_detail ?? 'Needs review',
      candidates,
      page_count: i.page_count,
      created_at: i.created_at,
    }
  })
}

/**
 * File an inbox item into a series, or start a new series for it.
 *
 * `seriesId` of `null` creates a series named after the item.
 */
export async function fileInboxItem(
  itemId: string,
  seriesId: string | null,
): Promise<{ seriesId: string }> {
  if (IS_DEMO) {
    const id = seriesId ?? `s-${itemId}`
    return { seriesId: id }
  }
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')

  const sb = await db()
  const { data: item, error: itemError } = await sb
    .from('items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle()
  if (itemError) throw itemError
  if (!item) throw new Error('item not found')

  let target: string
  if (seriesId) {
    target = seriesId
  } else {
    const { data: created, error } = await sb
      .from('series')
      .insert({ user_id: userId, title: item.title, kind: kindOfItem(item.type) })
      .select('id')
      .single()
    if (error) throw error
    target = created.id
  }

  const { error } = await sb
    .from('items')
    .update({ series_id: target, status: 'ready', status_detail: null })
    .eq('id', itemId)
  if (error) throw error
  return { seriesId: target }
}

/* ─── Activity & stats ───────────────────────────────────────── */

export async function getActivity(days = 120) {
  if (IS_DEMO) return demoActivity.slice(-days)
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const { data } = await (await db())
    .from('daily_activity')
    .select('*')
    .gte('date', since)
    .order('date')
  return data ?? []
}

export async function getStats() {
  const [notes, items, cards, activity, progress] = await Promise.all([
    getNotes(),
    getItems(),
    getAllCards(),
    getActivity(),
    getProgressMap(),
  ])
  const pagesRead = activity.reduce((a, d) => a + (d.pages ?? 0), 0)
  const reviews = activity.reduce((a, d) => a + (d.reviews ?? 0), 0)

  // Today's slice of the activity roll-up.
  const today = localDateKey()
  const reviewsToday = activity.find((d) => d.date === today)?.reviews ?? 0

  // Real note counts — the previous implementation invented the number
  // as "active days × 6".
  const now = Date.now()
  const weekAgo = now - 7 * 86_400_000
  const prevWeekAgo = now - 14 * 86_400_000
  const createdAt = (n: { created_at?: string | null }) =>
    n.created_at ? Date.parse(n.created_at) : 0
  const notesThisWeek = notes.filter((n) => createdAt(n) >= weekAgo).length
  const notesPrevWeek = notes.filter(
    (n) => createdAt(n) >= prevWeekAgo && createdAt(n) < weekAgo,
  ).length

  return {
    notesThisWeek,
    notesGoal: 60,
    noteDelta: Math.round(
      ((notesThisWeek - notesPrevWeek) / Math.max(1, notesPrevWeek)) * 100,
    ),
    reviewsToday,
    chaptersRead: items.filter((i) => progress.get(i.id)?.finished).length,
    pagesRead,
    reviews,
    // Compare as dates: Postgres hands back `+00:00` offsets while
    // `toISOString()` ends in `Z`, and a lexicographic comparison of
    // the two is only accidentally right.
    cardsDue: cards.filter(
      (c) => c.status === 'active' && Date.parse(c.due) <= Date.now(),
    ).length,
    totalCards: cards.length,
    items: items.length,
    notes: notes.length,
  }
}

/* ─── Search ─────────────────────────────────────────────────── */

export async function searchVault(
  query: string,
  limit = 20,
  mode: 'hybrid' | 'keyword' | 'semantic' = 'hybrid',
): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  if (IS_DEMO) {
    const hits: SearchHit[] = []
    for (const n of demoNotes) {
      if (n.title.toLowerCase().includes(q) || n.body_md.toLowerCase().includes(q)) {
        const idx = n.body_md.toLowerCase().indexOf(q)
        const snippet = idx >= 0 ? n.body_md.slice(Math.max(0, idx - 48), idx + 90).replace(/\n/g, ' ') : n.body_md.slice(0, 90)
        hits.push({ id: n.id, kind: 'note', title: n.title, snippet, href: `/app/notes/${n.id}` })
      }
    }
    for (const i of demoItems) {
      if (i.title.toLowerCase().includes(q) || i.ai_summary?.toLowerCase().includes(q)) {
        hits.push({ id: i.id, kind: 'item', title: i.title, snippet: i.ai_summary ?? '', href: `/app/item/${i.id}` })
      }
    }
    return hits.slice(0, limit)
  }

  // Hybrid search: keyword (ts_rank) + semantic (pgvector), merged with RRF.
  // The embedding is best-effort — without one the RPC ranks by keyword.
  const { data } = await (await db()).rpc('search_vault', {
    query_text: query,
    // Only embed when the semantic side can contribute.
    query_embedding: mode === 'keyword' ? null : toPgVector(await embedText(query)),
    match_limit: limit,
    search_mode: mode,
  })
  return (data ?? []) as SearchHit[]
}
