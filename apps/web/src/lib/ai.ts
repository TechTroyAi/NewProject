import 'server-only'
import { generateObject, generateText, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import {
  IngestionSchema,
  QuizGenerationSchema,
  ShortAnswerGradeSchema,
  type ChatScope,
} from '@shelf/shared'
import { getSupabaseAdmin, IS_DEMO } from './db'
import { DEMO_USER_ID, demoCards, demoItems, demoNotes, demoProgress, mockPageImage } from './demo'

/* ══════════════════════════════════════════════════════════════
   AI layer.

   Two hard rules:
   1. The spoiler guard lives in SQL, not in the prompt. Unread
      chapters never reach the model, so it cannot leak them.
   2. Without an API key we fall back to a deterministic mock so
      the product is fully explorable offline.
   ══════════════════════════════════════════════════════════════ */

export interface RetrievedChunk {
  content: string
  item_id: string
  item_title: string
  page_start: number
  page_end: number
  score: number
}

export interface RetrievedNote {
  id: string
  title: string
  body_md: string
  score: number
}

const HAS_KEY = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)

export function aiConfigured() {
  return HAS_KEY
}

function model() {
  return openai(process.env.OPENAI_API_KEY || 'sk-demo-placeholder')
}

/* ─── The spoiler guard ──────────────────────────────────────── */

/**
 * Retrieve chunks the user is *allowed* to know about.
 *
 * The `max_page_read` predicate is applied inside SQL, so a chunk from
 * an unread page is never serialised into the prompt — the model
 * physically cannot leak it, no matter what it is asked.
 */
export async function retrieveWithSpoilerGuard(opts: {
  scope: ChatScope
  queryEmbedding?: number[] | null
  limit?: number
}): Promise<{ chunks: RetrievedChunk[]; notes: RetrievedNote[]; guard: string }> {
  const limit = opts.limit ?? 8

  if (IS_DEMO) {
    return demoRetrieve(opts.scope, limit)
  }

  const sb = getSupabaseAdmin()!
  const scopeIds = await resolveScopeItemIds(opts.scope)

  // ── chunks: keyword + vector, spoiler-filtered ──────────────
  const { data: chunks, error } = await sb.rpc('retrieve_guarded', {
    p_user_id: DEMO_USER_ID,
    p_item_ids: scopeIds,
    p_query: opts.scope.noteId ?? '',
    p_query_embedding: opts.queryEmbedding ?? null,
    p_limit: limit,
  })
  if (error) throw error

  // ── notes: the user's own writing, always in scope ──────────
  const { data: notes } = await sb.rpc('retrieve_notes', {
    p_user_id: DEMO_USER_ID,
    p_query: opts.scope.noteId ?? '',
    p_query_embedding: opts.queryEmbedding ?? null,
    p_limit: 6,
  })

  const guard = await describeGuard(opts.scope)
  return {
    chunks: (chunks ?? []) as RetrievedChunk[],
    notes: (notes ?? []) as RetrievedNote[],
    guard,
  }
}

async function resolveScopeItemIds(scope: ChatScope): Promise<string[]> {
  if (scope.mode === 'item' && scope.itemId) return [scope.itemId]
  if (scope.mode === 'series' && scope.seriesId) {
    const { data } = await getSupabaseAdmin()!
      .from('items')
      .select('id')
      .eq('series_id', scope.seriesId)
    return (data ?? []).map((i) => i.id)
  }
  const { data } = await getSupabaseAdmin()!.from('items').select('id')
  return (data ?? []).map((i) => i.id)
}

async function describeGuard(scope: ChatScope): Promise<string> {
  if (IS_DEMO) {
    if (scope.mode === 'item' && scope.itemId) {
      const p = demoProgress.find((x) => x.item_id === scope.itemId)
      const item = demoItems.find((i) => i.id === scope.itemId)
      return `${item?.title ?? 'item'} — you have read up to page ${(p?.max_page_read ?? 0) + 1} of ${item?.page_count ?? '?'}.`
    }
    return 'Your whole vault. Note that content beyond the pages you have read is excluded.'
  }
  const { data } = await getSupabaseAdmin()!.from('progress').select('*').eq('user_id', DEMO_USER_ID)
  return `Progress across ${data?.length ?? 0} items.`
}

/* ─── Demo retrieval (mirrors the SQL semantics) ─────────────── */

function demoRetrieve(scope: ChatScope, limit: number) {
  const chunks: RetrievedChunk[] = []
  const notes: RetrievedNote[] = []

  const allowed = demoItems.filter((item) => {
    if (scope.mode === 'item') return item.id === scope.itemId
    if (scope.mode === 'series') return item.series_id === scope.seriesId
    return true
  })

  for (const item of allowed) {
    const p = demoProgress.find((x) => x.item_id === item.id)
    const maxRead = p?.max_page_read ?? 0
    // Spoiler guard: only pages up to max_page_read are eligible.
    if (maxRead <= 0) continue
    const chunkEnd = Math.max(1, Math.min(maxRead, 8))
    chunks.push({
      content:
        item.ai_summary ??
        `Pages 1–${chunkEnd} of ${item.title}. Visual content: panel layouts, character staging, and narration pacing.`,
      item_id: item.id,
      item_title: item.title,
      page_start: 0,
      page_end: chunkEnd,
      score: 0.8,
    })
  }

  for (const n of demoNotes) {
    if (scope.mode === 'note' && n.id !== scope.noteId) continue
    notes.push({ id: n.id, title: n.title, body_md: n.body_md.slice(0, 900), score: 0.6 })
  }

  return {
    chunks: chunks.slice(0, limit),
    notes: notes.slice(0, 6),
    guard: describeGuardSync(scope),
  }
}

function describeGuardSync(scope: ChatScope): string {
  if (scope.mode === 'item' && scope.itemId) {
    const p = demoProgress.find((x) => x.item_id === scope.itemId)
    const item = demoItems.find((i) => i.id === scope.itemId)
    return `${item?.title ?? 'item'} — read up to page ${(p?.max_page_read ?? 0) + 1} of ${item?.page_count ?? '?'}.`
  }
  return 'Vault-wide. Content beyond the pages you have read is excluded from retrieval.'
}

/* ─── Prompting ──────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are Shelf's reading assistant.

Rules:
- Answer ONLY from the provided sources and the user's own notes.
- If the sources do not contain the answer, say so plainly and suggest where the user might look.
- Never use outside knowledge about later events in the story. The sources have already been filtered so that unread content is not available to you.
- Cite sources like [1], [2]. Citations refer to the numbered source list.
- Be concise. Prefer short paragraphs and tight bullets.
- If the user is in the middle of reading, bias toward what is on or near the page they are on.`

export interface ChatSource {
  n: number
  label: string
  href: string
  detail: string
}

export function buildSources(chunks: RetrievedChunk[], notes: RetrievedNote[]): ChatSource[] {
  const sources: ChatSource[] = []
  chunks.forEach((c, i) => {
    sources.push({
      n: i + 1,
      label: c.item_title,
      href: `/app/read/${c.item_id}?p=${c.page_start}`,
      detail: `p.${c.page_start + 1}–${c.page_end + 1}`,
    })
  })
  notes.forEach((n) => {
    sources.push({
      n: sources.length + 1,
      label: n.title,
      href: `/app/notes/${n.id}`,
      detail: 'your note',
    })
  })
  return sources
}

export function buildPrompt(question: string, chunks: RetrievedChunk[], notes: RetrievedNote[]) {
  const parts: string[] = []
  chunks.forEach((c, i) => {
    parts.push(`[${i + 1}] ${c.item_title} (pages ${c.page_start + 1}–${c.page_end + 1})\n${c.content}`)
  })
  notes.forEach((n, i) => {
    parts.push(`[${chunks.length + i + 1}] User's note: ${n.title}\n${n.body_md}`)
  })
  return `SOURCES\n${parts.join('\n\n')}\n\nQUESTION\n${question}`
}

/* ─── Streaming chat ─────────────────────────────────────────── */

export async function* chatStream(opts: {
  question: string
  scope: ChatScope
  mode?: 'fast' | 'reason'
}): AsyncGenerator<{ type: 'sources'; sources: ChatSource[] } | { type: 'text'; text: string } | { type: 'done' }> {
  const retrieved = await retrieveWithSpoilerGuard({ scope: opts.scope })
  const sources = buildSources(retrieved.chunks, retrieved.notes)

  yield { type: 'sources', sources }

  if (!HAS_KEY) {
    for (const chunk of mockAnswer(opts.question, retrieved, sources)) {
      yield { type: 'text', text: chunk }
      await new Promise((r) => setTimeout(r, 18))
    }
    yield { type: 'done' }
    return
  }

  const result = streamText({
    model: model(),
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(opts.question, retrieved.chunks, retrieved.notes),
    temperature: 0.3,
  })
  for await (const part of result.textStream) {
    yield { type: 'text', text: part }
  }
  yield { type: 'done' }
}

/** Deterministic offline answer that cites real sources. */
function mockAnswer(question: string, retrieved: { chunks: RetrievedChunk[]; notes: RetrievedNote[] }, sources: ChatSource[]) {
  const q = question.toLowerCase()
  const noteMatch = retrieved.notes.find((n) => {
    const words = q.split(/\W+/).filter((w) => w.length > 3)
    return words.some((w) => n.title.toLowerCase().includes(w) || n.body_md.toLowerCase().includes(w))
  })

  const lead = noteMatch
    ? `From your note **${noteMatch.title}**${sources.length ? ' and the pages below' : ''}:`
    : retrieved.chunks.length
      ? `Based on what you have read so far${sources.length ? ` (${sources[0].label})` : ''}:`
      : `I don't have anything on that yet.`

  const body =
    retrieved.chunks.length
      ? `Your reading history shows the material here is limited to the pages you have already passed — the spoiler guard filtered the rest out, so I genuinely can't see ahead.\n\n${
          retrieved.chunks[0].content
        }`
      : `Nothing in the allowed scope covers that. A couple of ways forward:\n\n- Read further and the retrieval window will open up\n- Write a note about it and the next retrieval will pick it up`

  const cites = sources.length
    ? `\n\nSources: ${sources.slice(0, 3).map((s) => `[${s.n}]`).join(' ')}`
    : ''

  return `${lead}\n\n${body}${cites}`
}

/* ─── Ingestion (structured output) ──────────────────────────── */

export async function ingestStructured(sample: string, hints: { title?: string } = {}) {
  if (!HAS_KEY) {
    return {
      title: hints.title ?? 'Untitled item',
      series: null as string | null,
      volume: null as number | null,
      chapter: null as number | null,
      summary: 'Summary would be generated here by the configured model.',
      tags: [] as string[],
      keyTerms: [] as { term: string; definition: string }[],
      language: 'en',
      contentKind: 'other' as const,
    }
  }
  const { object } = await generateObject({
    model: model(),
    schema: IngestionSchema,
    prompt: `Analyse this sample of a document. It may be a manga chapter, a lecture PDF, a slide deck, or a book chapter.

Return a title, the series it belongs to (if any), volume/chapter numbers, a 3-sentence summary, up to 8 tags, up to 15 key terms with short definitions, the language, and the content kind.

SAMPLE:
${sample.slice(0, 6000)}`,
  })
  return object
}

/* ─── Quiz generation ────────────────────────────────────────── */

export const QUIZ_PROMPT = `From the NOTE and SOURCE EXCERPTS below, write {n} quiz cards.

Rules:
- Test ONE fact per card. No trick questions.
- Prefer the user's own wording and claims from the note.
- Mix types: {types}.
- For mcq: 1 correct answer + 3 plausible distractors drawn from the same context. The first option must be the correct one.
- Include an "explanation" of 1-2 sentences and a "sourcePage" integer.
- Do not use any fact that is not present in the provided text.
- Skip trivia that is not worth remembering.
- Return JSON matching the schema.`

export async function generateQuizCards(opts: {
  note: { title: string; body_md: string }
  excerpts: { content: string; page: number }[]
  n: number
  types: string[]
}) {
  if (!HAS_KEY) {
    return {
      cards: demoCards.slice(0, opts.n).map((c) => ({
        type: c.type,
        question: c.question,
        answer: c.answer,
        options: c.options,
        explanation: c.explanation,
        sourcePage: c.source_page,
      })),
    }
  }
  const { object } = await generateObject({
    model: model(),
    schema: QuizGenerationSchema,
    prompt: QUIZ_PROMPT
      .replace('{n}', String(opts.n))
      .replace('{types}', opts.types.join(', '))
      .concat(
        `\n\nNOTE: ${opts.note.title}\n${opts.note.body_md.slice(0, 6000)}\n\nSOURCE EXCERPTS:\n${opts.excerpts
          .map((e) => `(page ${e.page}) ${e.content}`)
          .join('\n\n')
          .slice(0, 8000)}`,
      ),
  })
  return object
}

/* ─── Short-answer grading ───────────────────────────────────── */

export async function gradeShortAnswer(question: string, reference: string, answer: string) {
  if (!HAS_KEY) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    const correct = norm(answer).includes(norm(reference).split(' ')[0] ?? 'x')
    return {
      correct,
      feedback: correct
        ? 'Close enough — the key term is there.'
        : `The note points at "${reference.slice(0, 90)}". Your answer misses that specific detail.`,
    }
  }
  const { object } = await generateObject({
    model: model(),
    schema: ShortAnswerGradeSchema,
    prompt: `Grade the user's answer against the reference answer.

QUESTION: ${question}
REFERENCE: ${reference}
USER ANSWER: ${answer}

Return correct (boolean) and one sentence of feedback. Be fair: accept paraphrases and partial credit if the core claim is right.`,
  })
  return object
}

/* ─── Page image resolution ──────────────────────────────────── */

export function resolvePageImage(itemId: string, idx: number, pageCount: number, storedPath?: string | null) {
  if (storedPath) {
    const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL
    return base ? `${base.replace(/\/$/, '')}/${storedPath}` : `/${storedPath}`
  }
  return mockPageImage(itemId, idx, pageCount)
}
