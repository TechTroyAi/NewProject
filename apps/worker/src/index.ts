import { createClient } from '@supabase/supabase-js'
import { loadRootEnv } from './env.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sniff } from './stages/sniff.js'
import { convert, thumbnails, webp } from './stages/convert.js'
import { extractText } from './stages/ocr.js'
import { chunkPages } from './stages/chunk.js'
import { embedChunks } from './stages/embed.js'
import { summarize } from './stages/summarize.js'
import { matchSeries } from './stages/match.js'
import {
  descriptorFromRow,
  downloadRemoteImage,
  planRemotePages,
  sniffImageType,
} from './stages/remote.js'
import { resolveAdapter } from '@shelf/sources'
import type { Job, Stage } from './types.js'

/* ══════════════════════════════════════════════════════════════
   Shelf worker.

   Each stage is an independent job so a failure retries only that
   stage. The item flips to `ready` after conversion — the user can
   start reading while OCR, embeddings and the AI pass continue.
   ══════════════════════════════════════════════════════════════ */

loadRootEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? 'shelf'
const STORAGE_URL = process.env.STORAGE_PUBLIC_URL ?? ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 4000)

async function claimJob(): Promise<Job | null> {
  const { data } = await sb
    .from('jobs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('status', 'queued')
    .order('created_at')
    .limit(1)
    .select()
    .maybeSingle()
  return data ?? null
}

async function finishJob(job: Job, patch: Partial<Job>) {
  await sb
    .from('jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', job.id)
}

/**
 * A single long-lived Realtime channel. Broadcasts only work on a
 * subscribed channel, so we keep one around for the process lifetime.
 */
const progressChannel = sb.channel('shelf-progress')
let progressChannelReady = false

async function setProgress(job: Job, progress: number, status?: string) {
  await sb
    .from('jobs')
    .update({ progress, status: status ?? 'running', updated_at: new Date().toISOString() })
    .eq('id', job.id)

  if (progressChannelReady) {
    // The upload tray in the browser subscribes to these.
    await progressChannel.send({
      type: 'broadcast',
      event: 'progress',
      payload: { jobId: job.id, itemId: job.item_id, stage: job.stage, progress },
    })
  }
}

async function upload(path: string, body: Buffer, contentType: string) {
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) throw error
  return STORAGE_URL ? `${STORAGE_URL}/${path}` : path
}

/* ─── stage runners ──────────────────────────────────────────── */

async function runSniff(job: Job) {
  const { data: item } = await sb.from('items').select('*').eq('id', job.item_id).single()
  const local = await downloadToTemp(item.original_path)

  try {
    const result = await sniff(local, item.title)
    if (!result.safe) {
      await sb
        .from('items')
        .update({ status: 'needs_review', status_detail: result.reason ?? 'Unsupported file' })
        .eq('id', job.item_id)
      await finishJob(job, { status: 'done', progress: 100 })
      return
    }
    await sb
      .from('items')
      .update({ type: result.type, status: 'processing', status_detail: null })
      .eq('id', job.item_id)
    await finishJob(job, { status: 'done', progress: 100 })
  } finally {
    await rm(local, { recursive: true, force: true })
  }
}

async function runConvert(job: Job) {
  const { data: item } = await sb.from('items').select('*').eq('id', job.item_id).single()
  const local = await downloadToTemp(item.original_path)

  try {
    const sniffed = await sniff(local, item.title)
    const { pages, texts } = await convert(local, sniffed)
    if (!pages.length) {
      await sb.from('items').update({ status: 'needs_review', status_detail: 'No pages found' }).eq('id', job.item_id)
      await finishJob(job, { status: 'done', progress: 100 })
      return
    }

    await sb.from('pages').delete().eq('item_id', job.item_id)

    const rows: any[] = []
    for (const [i, page] of pages.entries()) {
      await setProgress(job, Math.round((i / pages.length) * 90))
      const img = await webp(page.buffer)
      const imagePath = await upload(`pages/${job.user_id}/${job.item_id}/${String(i).padStart(5, '0')}.webp`, img, 'image/webp')
      rows.push({
        item_id: job.item_id,
        idx: i,
        image_path: imagePath,
        width: page.width,
        height: page.height,
        text: texts[i] ?? null,
      })
    }

    // Cover = first page.
    const cover = await thumbnails(pages[0], true)
    const coverPath = await upload(`thumbs/${job.user_id}/${job.item_id}/cover.webp`, cover, 'image/webp')

    await sb.from('pages').insert(rows)
    await sb
      .from('items')
      .update({ page_count: pages.length, cover_path: coverPath, status: 'ready' })
      .eq('id', job.item_id)

    await finishJob(job, { status: 'done', progress: 100 })
  } finally {
    await rm(local, { recursive: true, force: true })
  }
}

async function runOcr(job: Job) {
  const { data: pages } = await sb
    .from('pages')
    .select('*')
    .eq('item_id', job.item_id)
    .order('idx')

  for (const [i, page] of (pages ?? []).entries()) {
    await setProgress(job, Math.round((i / (pages?.length || 1)) * 90))
    if (page.text && page.text.trim().length >= 20) continue
    const local = await downloadToTemp(page.image_path)
    try {
      const text = await extractText(local)
      if (text) await sb.from('pages').update({ text }).eq('id', page.id)
    } finally {
      await rm(local, { recursive: true, force: true })
    }
  }
  await finishJob(job, { status: 'done', progress: 100 })
}

async function runChunk(job: Job) {
  const { data: pages } = await sb.from('pages').select('*').eq('item_id', job.item_id).order('idx')
  const chunks = chunkPages(
    (pages ?? []).map((p) => ({ idx: p.idx, text: p.text ?? '' })),
  )
  if (!chunks.length) {
    await finishJob(job, { status: 'done', progress: 100 })
    return
  }

  await sb.from('chunks').delete().eq('item_id', job.item_id)
  await sb.from('chunks').insert(
    chunks.map((c) => ({
      item_id: job.item_id,
      user_id: job.user_id,
      page_start: c.page_start,
      page_end: c.page_end,
      content: c.content,
    })),
  )
  await finishJob(job, { status: 'done', progress: 100 })
}

async function runEmbed(job: Job) {
  const { data: chunks } = await sb.from('chunks').select('*').eq('item_id', job.item_id)
  if (!chunks?.length) {
    await finishJob(job, { status: 'done', progress: 100 })
    return
  }
  const embeddings = await embedChunks(chunks)
  for (const [i, emb] of embeddings.entries()) {
    await sb.from('chunks').update({ embedding: emb }).eq('id', chunks[i].id)
    await setProgress(job, Math.round(((i + 1) / embeddings.length) * 90))
  }
  await finishJob(job, { status: 'done', progress: 100 })
}

async function runSummarize(job: Job) {
  const { data: item } = await sb.from('items').select('*').eq('id', job.item_id).single()
  const { data: pages } = await sb
    .from('pages')
    .select('idx, text')
    .eq('item_id', job.item_id)
    .order('idx')
    .limit(30)

  // Sample, not the whole document — cost stays flat.
  const sample = [
    (pages ?? []).slice(0, 4).map((p) => p.text ?? '').join('\n'),
    (pages ?? []).slice(10, 16).map((p) => p.text ?? '').join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await summarize(sample, { title: item.title })

  await sb
    .from('items')
    .update({
      ai_summary: result.summary,
      ai_tags: result.tags,
      key_terms: result.keyTerms,
      volume: result.volume,
      chapter: result.chapter,
    })
    .eq('id', job.item_id)

  // A series named by the model is a strong hint — match it too.
  if (result.series) {
    const match = await matchSeries(sb, job.user_id, result.series, item.type)
    if (match.seriesId) {
      await sb.from('items').update({ series_id: match.seriesId }).eq('id', job.item_id)
    }
  }

  await finishJob(job, { status: 'done', progress: 100 })
}

async function runMatch(job: Job) {
  const { data: item } = await sb.from('items').select('*').eq('id', job.item_id).single()
  const match = await matchSeries(sb, job.user_id, item.title, item.type)

  if (match.seriesId) {
    await sb.from('items').update({ series_id: match.seriesId, status: 'ready' }).eq('id', job.item_id)
  } else {
    await sb
      .from('items')
      .update({
        status: 'needs_review',
        status_detail: match.candidates.length
          ? `No confident series match (best: ${match.candidates[0].title})`
          : 'No series match found',
      })
      .eq('id', job.item_id)
  }
  await finishJob(job, { status: 'done', progress: 100 })
}

/**
 * Fetch a chapter that was imported from a public source and store
 * its pages, so the item behaves exactly like an uploaded one.
 */
async function runRemote(job: Job) {
  const { data: item } = await sb.from('items').select('*').eq('id', job.item_id).single()
  if (!item?.source_id || !item.remote_chapter_id) {
    await finishJob(job, { status: 'done', progress: 100 })
    return
  }

  const { data: sourceRow } = await sb.from('sources').select('*').eq('id', item.source_id).single()
  if (!sourceRow) {
    await sb
      .from('items')
      .update({ status: 'needs_review', status_detail: 'Source no longer connected' })
      .eq('id', job.item_id)
    await finishJob(job, { status: 'done', progress: 100 })
    return
  }

  const source = descriptorFromRow(sourceRow as any)
  const adapter = resolveAdapter(source)
  if (!adapter) {
    await sb
      .from('items')
      .update({ status: 'needs_review', status_detail: 'No adapter for this source' })
      .eq('id', job.item_id)
    await finishJob(job, { status: 'done', progress: 100 })
    return
  }

  const plan = await planRemotePages(source, item.remote_chapter_id, adapter)
  if (!plan.length) {
    await sb
      .from('items')
      .update({ status: 'needs_review', status_detail: 'No pages returned by source' })
      .eq('id', job.item_id)
    await finishJob(job, { status: 'done', progress: 100 })
    return
  }

  await sb.from('pages').delete().eq('item_id', job.item_id)

  const rows: any[] = []
  for (const [i, page] of plan.entries()) {
    await setProgress(job, Math.round((i / plan.length) * 95))
    const raw = await downloadRemoteImage(page.url)
    const type = sniffImageType(raw)
    if (!type) throw new Error(`unsupported image type from ${page.url}`)

    const img = await webp(raw)
    const imagePath = await upload(
      `pages/${job.user_id}/${job.item_id}/${String(i).padStart(5, '0')}.webp`,
      img,
      'image/webp',
    )
    rows.push({ item_id: job.item_id, idx: i, image_path: imagePath, width: null, height: null, text: null })
  }

  if (rows.length) await sb.from('pages').insert(rows)

  const cover = await thumbnails({ buffer: await downloadRemoteImage(plan[0].url) }, true)
  const coverPath = await upload(`thumbs/${job.user_id}/${job.item_id}/cover.webp`, cover, 'image/webp')

  await sb
    .from('items')
    .update({ page_count: rows.length, cover_path: coverPath, status: 'ready' })
    .eq('id', job.item_id)

  await finishJob(job, { status: 'done', progress: 100 })
}

/* ─── storage helper ─────────────────────────────────────────── */

async function downloadToTemp(path: string) {
  const dir = await mkdtemp(join(tmpdir(), 'shelf-worker-'))
  // The file name comes from a storage path, so never let it escape
  // the temp directory.
  const raw = path.split('/').pop() ?? 'file'
  const safe = raw.replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'file'
  const local = join(dir, safe)
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(path)
  if (error) throw error
  await writeFile(local, Buffer.from(await data.arrayBuffer()))
  return local
}

/* ─── runner ─────────────────────────────────────────────────── */

/**
 * Stages whose failure makes the item unreadable. Everything else
 * (OCR, chunking, embeddings, the AI pass, card generation) only
 * degrades the item, it does not break it.
 */
const READABILITY_STAGES = new Set<Stage>(['sniff', 'convert', 'remote'])

const RUNNERS: Record<Stage, (job: Job) => Promise<void>> = {
  sniff: runSniff,
  remote: runRemote,
  convert: runConvert,
  ocr: runOcr,
  chunk: runChunk,
  embed: runEmbed,
  summarize: runSummarize,
  cards: async (job) => finishJob(job, { status: 'done', progress: 100 }),
  match: runMatch,
}

let running = false

async function tick() {
  if (running) return
  running = true
  try {
    const job = await claimJob()
    if (!job) return

    const runner = RUNNERS[job.stage]
    if (!runner) {
      await finishJob(job, { status: 'failed', error: `Unknown stage ${job.stage}` })
      return
    }

    console.log(`▶ ${job.stage} · item ${job.item_id}`)
    try {
      await runner(job)
      console.log(`✔ ${job.stage}`)
    } catch (err) {
      console.error(`✘ ${job.stage}:`, err)
      await finishJob(job, { status: 'failed', error: String(err) })
      // Only the stages that produce the *pages* decide whether an
      // item is readable. A failed OCR or AI pass must not take a
      // perfectly readable book out of the library.
      if (READABILITY_STAGES.has(job.stage)) {
        await sb
          .from('items')
          .update({ status: 'failed', status_detail: String(err).slice(0, 500) })
          .eq('id', job.item_id)
      } else {
        await sb
          .from('items')
          .update({ status_detail: `${job.stage} failed: ${String(err).slice(0, 300)}` })
          .eq('id', job.item_id)
      }
    }
  } finally {
    running = false
  }
}

async function main() {
  console.log('Shelf worker online. Polling every', POLL_INTERVAL_MS, 'ms')
  // Subscribe once so progress broadcasts have a live socket.
  progressChannel.subscribe((status) => {
    progressChannelReady = status === 'SUBSCRIBED'
  })

  for (;;) {
    await tick()
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
