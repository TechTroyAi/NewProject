import { z } from 'zod'

/* ══════════════════════════════════════════════════════════════
   Shared contracts between the web app, the worker, and the DB.
   ══════════════════════════════════════════════════════════════ */

/**
 * The upload pipeline, in the order the worker has to run it.
 *
 * The worker claims the oldest job first, so the stages have to be
 * queued in this order.
 */
export const PIPELINE_STAGES = [
  'sniff',
  'convert',
  'ocr',
  'chunk',
  'embed',
  'summarize',
  'match',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/**
 * Whether a string looks like a UUID.
 *
 * Route parameters that end up in a `uuid` column are checked with
 * this first, so a bad path gives a 404 instead of a Postgres error.
 */
export function isUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export const NODE_KINDS = ['note', 'series', 'item', 'chapter', 'wiki', 'image', 'clip', 'card'] as const
export type NodeKind = (typeof NODE_KINDS)[number]

export const CARD_TYPES = ['flashcard', 'mcq', 'cloze', 'tf', 'short', 'clip', 'order', 'match'] as const
export type CardType = (typeof CARD_TYPES)[number]

export const ITEM_TYPES = ['cbz', 'pdf', 'pptx', 'docx', 'epub', 'image', 'url', 'txt'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export const ITEM_STATUSES = ['uploaded', 'processing', 'ready', 'needs_review', 'failed'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const THEMES = ['paper', 'midnight', 'amoled'] as const
export type Theme = (typeof THEMES)[number]

export const JOB_STAGES = ['hash', 'sniff', 'convert', 'ocr', 'embed', 'summarize', 'cards', 'match'] as const
export type JobStage = (typeof JOB_STAGES)[number]

/* ─── Row shapes (mirror the Postgres schema) ─────────────────── */

export interface Profile {
  id: string
  display_name: string | null
  settings: ProfileSettings
  created_at: string
}

export interface ProfileSettings {
  theme?: Theme
  accent?: string
  reader?: {
    mode?: 'strip' | 'paged'
    rtl?: boolean
    spread?: boolean
    background?: string
    scale?: number
  }
  ai?: {
    model?: string
    dailyTokenBudget?: number
    spoilerGuard?: boolean
    byoKey?: boolean
  }
  quiz?: {
    /** Maximum number of *new* cards introduced per day. */
    newPerDay?: number
    /** Maximum number of reviews per day, new and due together. */
    dailyCap?: number
    enabled?: boolean
  }
}

export interface Series {
  id: string
  user_id: string
  title: string
  cover_path: string | null
  kind: 'manga' | 'course' | 'book' | 'mixed'
  created_at: string
}

export interface Item {
  id: string
  user_id: string
  series_id: string | null
  type: ItemType
  title: string
  volume: number | null
  chapter: number | null
  file_hash: string
  original_path: string
  cover_path: string | null
  page_count: number
  status: ItemStatus
  status_detail: string | null
  ai_summary: string | null
  ai_tags: string[]
  key_terms: KeyTerm[]
  /** Speaker notes, when the item is a slide deck. */
  speaker_notes?: string | null
  created_at: string
}

export interface KeyTerm {
  term: string
  definition: string
}

export interface Page {
  id: string
  item_id: string
  idx: number
  image_path: string | null
  width: number | null
  height: number | null
  text: string | null
  speaker_notes: string | null
}

export interface Progress {
  user_id: string
  item_id: string
  current_page: number
  max_page_read: number
  percent: number
  finished: boolean
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  body_md: string
  item_id: string | null
  page_ref: number | null
  is_ai_draft: boolean
  embedding?: number[] | null
  updated_at: string
  created_at: string
}

export interface ShelfLink {
  id: string
  user_id: string
  from_note: string | null
  to_note: string | null
  to_item: string | null
  to_page: number | null
  kind: 'wikilink' | 'ai_suggested' | 'mention'
}

export interface Clip {
  id: string
  user_id: string
  item_id: string
  page_idx: number
  bbox: { x: number; y: number; w: number; h: number }
  image_path: string | null
  note_id: string | null
}

export interface Deck {
  id: string
  user_id: string
  title: string
  item_id: string | null
  note_id: string | null
}

export interface Card {
  id: string
  user_id: string
  deck_id: string | null
  source_note: string | null
  source_item: string | null
  source_page: number | null
  spoiler_limit_page: number
  type: CardType
  question: string
  answer: string
  options: string[] | null
  explanation: string | null
  status: 'active' | 'suspended' | 'flagged'
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  /** ts-fsrs v5 learning-ladder position. */
  learning_steps: number
  state: number
  last_review: string | null
}

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  degree: number
  x?: number
  y?: number
}

export interface GraphEdge {
  source: string
  target: string
  kind: ShelfLink['kind']
}

/* ══════════════════════════════════════════════════════════════
   Zod schemas — request/response contracts + AI structured output
   ══════════════════════════════════════════════════════════════ */

export const UploadInitSchema = z.object({
  name: z.string().min(1).max(400),
  size: z.number().int().positive(),
  mime: z.string().default('application/octet-stream'),
  hash: z.string().regex(/^[a-f0-9]{64}$/i, 'expected a sha-256 hex digest'),
})
export type UploadInit = z.infer<typeof UploadInitSchema>

/** Hard ceiling on a single upload. */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024

/**
 * Strip a browser-supplied file name down to something safe to put in
 * a storage path: no directory components, no exotic characters, and
 * a bounded length.
 */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const cleaned = base
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180)
  return cleaned || 'file'
}

export const UploadCompleteSchema = z.object({
  itemId: z.string().uuid(),
  path: z.string().min(1),
  /**
   * The sha-256 the browser computed. It is persisted on the item so
   * the duplicate check in `/api/upload/init` keeps working.
   */
  hash: z.string().regex(/^[a-f0-9]{64}$/i, 'expected a sha-256 hex digest').optional(),
})
export type UploadComplete = z.infer<typeof UploadCompleteSchema>

export const ProgressUpdateSchema = z.object({
  page: z.number().int().min(0),
  maxPageRead: z.number().int().min(0).optional(),
  finished: z.boolean().optional(),
})
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>

/** Structured output from the ingestion AI pass. */
export const IngestionSchema = z.object({
  title: z.string(),
  series: z.string().nullable(),
  volume: z.number().nullable(),
  chapter: z.number().nullable(),
  summary: z.string().describe('3 sentences max'),
  tags: z.array(z.string()).max(8),
  keyTerms: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .max(15),
  language: z.string(),
  contentKind: z.enum(['manga', 'textbook', 'slides', 'article', 'fiction', 'other']),
})
export type Ingestion = z.infer<typeof IngestionSchema>

/** Structured output from the quiz generator. */
export const QuizCardSchema = z.object({
  type: z.enum(CARD_TYPES),
  question: z.string().min(1),
  answer: z.string().min(1),
  options: z.array(z.string()).nullable().optional(),
  explanation: z.string().nullable().optional(),
  sourcePage: z.number().int().nullable().optional(),
})
export type QuizCard = z.infer<typeof QuizCardSchema>

export const QuizGenerationSchema = z.object({
  cards: z.array(QuizCardSchema).min(1).max(30),
})
export type QuizGeneration = z.infer<typeof QuizGenerationSchema>

export const ShortAnswerGradeSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
})
export type ShortAnswerGrade = z.infer<typeof ShortAnswerGradeSchema>

export const ChatScopeSchema = z.object({
  mode: z.enum(['item', 'series', 'note', 'vault']).default('vault'),
  itemId: z.string().optional(),
  seriesId: z.string().optional(),
  noteId: z.string().optional(),
})
export type ChatScope = z.infer<typeof ChatScopeSchema>

export const SearchQuerySchema = z.object({
  q: z.string().default(''),
  mode: z.enum(['hybrid', 'keyword', 'semantic']).default('hybrid'),
  limit: z.number().int().min(1).max(100).default(20),
})
export type SearchQuery = z.infer<typeof SearchQuerySchema>

export const QuizAnswerSchema = z.object({
  // Not `.uuid()` — demo card ids are slugs like "c1". The database
  // column is still uuid and will reject a bad id with a clear error.
  cardId: z.string().min(1),
  rating: z.number().int().min(1).max(4),
  msTaken: z.number().int().min(0).optional(),
})
export type QuizAnswer = z.infer<typeof QuizAnswerSchema>

/* ─── Public sources ─────────────────────────────────────────── */
export * from './sources'

/* ─── AI provider contract ───────────────────────────────────── */
export * from './providers'

/* ─── Wikilink parsing ───────────────────────────────────────── */

/**
 * Round-robin the cards so that consecutive cards come from different
 * series. Without this a user with three chapters of one manga queued
 * would drill the same series for the whole session.
 */
export function interleaveBySeries(
  cards: Card[],
  seriesOf: Map<string, string | null>,
): Card[] {
  const buckets = new Map<string, Card[]>()
  for (const card of cards) {
    const key = seriesOf.get(card.id) ?? card.deck_id ?? 'other'
    const bucket = buckets.get(key)
    if (bucket) bucket.push(card)
    else buckets.set(key, [card])
  }
  const lists = [...buckets.values()]
  const out: Card[] = []
  for (let i = 0; out.length < cards.length; i++) {
    let progressed = false
    for (const list of lists) {
      if (i < list.length) {
        out.push(list[i])
        progressed = true
      }
    }
    if (!progressed) break
  }
  return out
}

/**
 * `YYYY-MM-DD` for a date in the local timezone.
 *
 * `toISOString()` converts to UTC, which shifts the day for anyone
 * east of Greenwich — the activity table stores plain calendar dates,
 * so every lookup has to use the local one.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g

export interface ParsedWikilink {
  raw: string
  target: string
  anchor: string | null
  alias: string | null
  /** `note` | `item` | `clip` | `unknown` — resolved at index time. */
  kind: 'note' | 'item' | 'clip' | 'unknown'
}

export function parseWikilinks(md: string): ParsedWikilink[] {
  const out: ParsedWikilink[] = []
  for (const m of md.matchAll(WIKILINK_RE)) {
    const target = m[1].trim()
    if (!target) continue
    let kind: ParsedWikilink['kind'] = 'unknown'
    if (/^clip:/i.test(target)) kind = 'clip'
    else if (/\bp?\d+\s*$/i.test(m[2] ?? '')) kind = 'item'
    out.push({
      raw: m[0],
      target: target.replace(/^clip:/i, ''),
      anchor: m[2]?.trim() ?? null,
      alias: m[3]?.trim() ?? null,
      kind,
    })
  }
  return out
}

/** `[[Berserk#Ch21 p14]]` → `{ itemHint: 'Berserk', chapter: 21, page: 14 }` */
export function parseAnchor(anchor: string | null) {
  if (!anchor) return { chapter: null as number | null, page: null as number | null }
  const page = anchor.match(/\bp?(\d+)\b/i)
  const chapter = anchor.match(/\b(?:ch|chapter|vol|v)[\s.]*(\d+)/i)
  return {
    chapter: chapter ? Number(chapter[1]) : null,
    page: page ? Number(page[1]) : null,
  }
}

/* ─── Filename intelligence (mirrors the worker stage) ────────── */

export interface ParsedFilename {
  series: string
  volume: number | null
  chapter: number | null
}

/**
 * Pull volume and chapter markers out of a filename.
 *
 * Scanned marker by marker rather than with one big regex, so
 * "Chapter 12.pdf" and "Blue_Lock.v01.c184.cbz" both parse cleanly.
 */
export function parseFilename(name: string): ParsedFilename {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').trim()
  let working = base
  let volume: number | null = null
  let chapter: number | null = null

  working = working.replace(/\b(?:volume|vol|v)\s*[._-]?(\d{1,4})\b/gi, (_m, n: string) => {
    if (volume === null) volume = Number(n)
    return ' '
  })

  working = working.replace(/\b(?:chapter|ch|c)\s*[._-]?(\d{1,4})\b/gi, (_m, n: string) => {
    if (chapter === null) chapter = Number(n)
    return ' '
  })

  // "#12" style.
  working = working.replace(/#\s*(\d{1,4})\b/g, (_m, n: string) => {
    if (chapter === null) chapter = Number(n)
    return ' '
  })

  const series = working
    .replace(/[._]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s._-]+$/, '')
    .trim()

  return { series: series || base, volume, chapter }
}


/* ══════════════════════════════════════════════════════════════
   Series matching
   ══════════════════════════════════════════════════════════════ */

/** The series kind an item of this file type belongs to. */
export function kindOfItem(type: string): 'manga' | 'book' | 'course' {
  switch (type) {
    case 'cbz':
    case 'manga':
      return 'manga'
    case 'pptx':
    case 'docx':
    case 'course':
      return 'course'
    default:
      return 'book'
  }
}

/**
 * Cheap normalised similarity — token overlap plus prefix agreement.
 * (pg_trgm handles the SQL side; this mirrors it closely enough to
 * decide locally without a round trip.)
 */
export function similarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
  const at = new Set(norm(a))
  const bt = new Set(norm(b))
  if (!at.size || !bt.size) return 0

  let overlap = 0
  for (const t of at) if (bt.has(t)) overlap++
  const jaccard = overlap / (at.size + bt.size - overlap)

  const prefix = commonPrefix(norm(a).join(''), norm(b).join('')) / Math.max(norm(a).join('').length, 1)

  return Math.max(0, Math.min(1, jaccard * 0.6 + prefix * 0.4))
}

function commonPrefix(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}


/**
 * Format an embedding as pgvector's text input: `[0.1,0.2]`.
 *
 * PostgREST casts a JSON array to `vector` inconsistently across
 * versions; the text form is always right.
 */
export function toPgVector(embedding: number[] | null | undefined): string | null {
  if (!embedding || !embedding.length) return null
  return `[${embedding.join(',')}]`
}
