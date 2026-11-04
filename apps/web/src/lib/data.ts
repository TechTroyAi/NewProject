import 'server-only'
import './env'
import type { Card, GraphEdge, GraphNode, Item, Note, Progress, Series } from '@shelf/shared'
import { embedText } from './ai-provider'
import { getSupabaseAdmin, IS_DEMO } from './db'
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
  const sb = admin()
  if (!sb) throw new Error('Supabase not configured')
  const { data } = await sb.from('profiles').select('*').eq('id', DEMO_USER_ID).maybeSingle()
  return data
}

/* ─── Series & items ─────────────────────────────────────────── */

export async function getSeriesList(): Promise<Series[]> {
  if (IS_DEMO) return demoSeries
  const { data } = await admin()!.from('series').select('*').order('title')
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
  let q = admin()!.from('items').select('*')
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
  const { data } = await admin()!.from('items').select('*, series(*)').eq('id', id).maybeSingle()
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
  const { data } = await admin()!.from('pages').select('*').eq('item_id', itemId).order('idx')
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
  const { data } = await admin()!.from('progress').select('*')
  return new Map((data ?? []).map((p) => [p.item_id, p]))
}

export async function getContinueReading(limit = 6) {
  const [items, progress] = await Promise.all([getItems(), getProgressMap()])
  return items
    .map((i) => ({ item: i, progress: progress.get(i.id) }))
    .filter((x) => x.progress && !x.progress.finished)
    .sort((a, b) => (b.progress!.updated_at > a.progress!.updated_at ? 1 : -1))
    .slice(0, limit)
}

export async function saveProgress(itemId: string, page: number, maxPageRead?: number, finished?: boolean) {
  if (IS_DEMO) {
    const p = demoProgress.find((x) => x.item_id === itemId)
    if (p) {
      p.current_page = page
      p.max_page_read = Math.max(p.max_page_read, maxPageRead ?? page)
      p.finished = finished ?? p.finished
      p.updated_at = new Date().toISOString()
    }
    return p
  }
  const { data, error } = await admin()!
    .from('progress')
    .upsert({
      user_id: DEMO_USER_ID,
      item_id: itemId,
      current_page: page,
      max_page_read: maxPageRead ?? page,
      finished: finished ?? false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/* ─── Notes ──────────────────────────────────────────────────── */

export async function getNotes(limit?: number): Promise<Note[]> {
  if (IS_DEMO) {
    const sorted = [...demoNotes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    return limit ? sorted.slice(0, limit) : sorted
  }
  let q = admin()!.from('notes').select('*').order('updated_at', { ascending: false })
  if (limit) q = q.limit(limit)
  const { data } = await q
  return data ?? []
}

export async function getNoteById(id: string): Promise<Note | null> {
  if (IS_DEMO) return demoNotes.find((n) => n.id === id) ?? null
  const { data } = await admin()!.from('notes').select('*').eq('id', id).maybeSingle()
  return data ?? null
}

export async function saveNote(note: {
  id?: string
  title: string
  body_md: string
  item_id?: string | null
  page_ref?: number | null
}) {
  if (IS_DEMO) {
    if (note.id) {
      const existing = demoNotes.find((n) => n.id === note.id)
      if (existing) {
        existing.title = note.title
        existing.body_md = note.body_md
        existing.updated_at = new Date().toISOString()
        return existing
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
    return created
  }
  const payload = {
    user_id: DEMO_USER_ID,
    title: note.title,
    body_md: note.body_md,
    item_id: note.item_id ?? null,
    page_ref: note.page_ref ?? null,
    updated_at: new Date().toISOString(),
  }
  if (note.id) {
    const { data, error } = await admin()!.from('notes').update(payload).eq('id', note.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await admin()!.from('notes').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function getBacklinks(noteId: string) {
  if (IS_DEMO) {
    return demoNotes.filter((n) =>
      demoLinks.some((l) => l.from_note === n.id && l.to_note === noteId),
    )
  }
  const { data } = await admin()!
    .from('links')
    .select('from_note')
    .eq('to_note', noteId)
  const ids = (data ?? []).map((l) => l.from_note).filter(Boolean) as string[]
  if (!ids.length) return []
  const { data: notes } = await admin()!.from('notes').select('*').in('id', ids)
  return notes ?? []
}

export async function getLinks() {
  if (IS_DEMO) return demoLinks
  const { data } = await admin()!.from('links').select('*')
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

export async function getDecks() {
  if (IS_DEMO) return demoDecks
  const { data } = await admin()!.from('decks').select('*')
  return data ?? []
}

export async function getDueCards(limit = 20): Promise<Card[]> {
  if (IS_DEMO) {
    const nowIso = new Date().toISOString()
    return demoCards
      .filter((c) => c.status === 'active' && c.due <= nowIso)
      .sort((a, b) => (a.due < b.due ? -1 : 1))
      .slice(0, limit)
  }
  const { data } = await admin()!
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
  const { data } = await admin()!.from('cards').select('*')
  return data ?? []
}

export async function saveCardReview(cardId: string, row: Partial<Card>, rating: number, msTaken?: number) {
  if (IS_DEMO) {
    const c = demoCards.find((x) => x.id === cardId)
    if (c) Object.assign(c, row)
    return c
  }
  const { data, error } = await admin()!
    .from('cards')
    .update(row)
    .eq('id', cardId)
    .select()
    .single()
  if (error) throw error
  await admin()!.from('reviews').insert({
    card_id: cardId,
    user_id: DEMO_USER_ID,
    rating,
    ms_taken: msTaken ?? 0,
  })
  return data
}

/* ─── Inbox ──────────────────────────────────────────────────── */

export async function getInbox() {
  if (IS_DEMO) return demoInbox
  const { data } = await admin()!.from('items').select('*').eq('status', 'needs_review').order('created_at')
  return (data ?? []).map((i: Item) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    reason: i.status_detail ?? 'Needs review',
    candidates: i.series_id ? [] : [],
    page_count: i.page_count,
    created_at: i.created_at,
  }))
}

/* ─── Activity & stats ───────────────────────────────────────── */

export async function getActivity() {
  if (IS_DEMO) return demoActivity
  const { data } = await admin()!.from('daily_activity').select('*').order('date')
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
  const week = activity.slice(-7)
  const prevWeek = activity.slice(-14, -7)
  const sum = (arr: { pages: number; reviews: number }[]) =>
    arr.reduce((a, d) => a + d.pages + d.reviews, 0)
  return {
    notesThisWeek: week.length * 6,
    notesGoal: 60,
    noteDelta: Math.round(((sum(week) - sum(prevWeek)) / Math.max(1, sum(prevWeek))) * 100),
    chaptersRead: items.filter((i) => progress.get(i.id)?.finished).length,
    pagesRead,
    reviews,
    cardsDue: cards.filter((c) => c.due <= new Date().toISOString() && c.status === 'active').length,
    totalCards: cards.length,
    items: items.length,
    notes: notes.length,
  }
}

/* ─── Search ─────────────────────────────────────────────────── */

export async function searchVault(query: string, limit = 20): Promise<SearchHit[]> {
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
  const { data } = await admin()!.rpc('search_vault', {
    query_text: query,
    query_embedding: await embedText(query),
    match_limit: limit,
  })
  return (data ?? []) as SearchHit[]
}
