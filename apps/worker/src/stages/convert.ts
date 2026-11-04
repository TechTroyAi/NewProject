import AdmZip from 'adm-zip'
import sharp from 'sharp'
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ConvertedPage, SniffResult } from '../types.js'

const exec = promisify(execFile)

/* ─── zip bomb guard ─────────────────────────────────────────── */

const MAX_ENTRIES = 10_000
const MAX_DECOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

export function guardArchive(zip: AdmZip): { ok: boolean; reason?: string } {
  const entries = zip.getEntries()
  if (entries.length > MAX_ENTRIES) {
    return { ok: false, reason: `Archive has ${entries.length} entries (limit ${MAX_ENTRIES})` }
  }
  let total = 0
  for (const e of entries) {
    total += e.header.size
    if (total > MAX_DECOMPRESSED_BYTES) {
      return { ok: false, reason: 'Archive expands beyond the 2 GB limit' }
    }
  }
  return { ok: true }
}

/* ─── natural sort ───────────────────────────────────────────── */

/** `page2` sorts before `page10`. Numeric-aware, case-insensitive. */
export function naturalCompare(a: string, b: string): number {
  const ax: (string | number)[] = []
  const bx: (string | number)[] = []
  a.replace(/(\d+)|(\D+)/g, (_, d, s) => {
    ax.push(d ? Number(d) : s.toLowerCase())
    return ''
  })
  b.replace(/(\d+)|(\D+)/g, (_, d, s) => {
    bx.push(d ? Number(d) : s.toLowerCase())
    return ''
  })
  while (ax.length && bx.length) {
    const x = ax.shift()!
    const y = bx.shift()!
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y
    } else {
      const sx = String(x)
      const sy = String(y)
      if (sx !== sy) return sx < sy ? -1 : 1
    }
  }
  return ax.length - bx.length
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i

/* ─── converters ─────────────────────────────────────────────── */

export async function convert(
  path: string,
  sniffResult: SniffResult,
): Promise<{ pages: ConvertedPage[]; texts: string[] }> {
  switch (sniffResult.type) {
    case 'cbz':
      return convertArchive(path)
    case 'pdf':
      return convertPdf(path)
    case 'pptx':
    case 'docx':
      return convertOffice(path)
    case 'epub':
      return convertEpub(path)
    case 'image':
      return convertImage(path)
    case 'txt':
      return convertText(path)
    default:
      throw new Error(`Cannot convert ${sniffResult.type}`)
  }
}

async function convertArchive(path: string) {
  const zip = new AdmZip(path)
  const guard = guardArchive(zip)
  if (!guard.ok) throw new Error(guard.reason)

  const files = zip
    .getEntries()
    .filter((e) => !e.isDirectory && IMAGE_EXT.test(e.entryName) && !e.entryName.startsWith('__MACOSX'))
    .sort((a, b) => naturalCompare(a.entryName, b.entryName))

  const pages: ConvertedPage[] = []
  for (const [idx, entry] of files.entries()) {
    const buffer = entry.getData()
    const img = sharp(buffer, { limitInputPixels: 100_000_000 })
    const meta = await img.metadata()
    pages.push({
      idx,
      buffer,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    })
  }
  return { pages, texts: pages.map(() => '') }
}

async function convertPdf(path: string) {
  const dir = await mkdtemp(join(tmpdir(), 'shelf-pdf-'))
  try {
    // pdftoppm renders each page to PPM; we then transcode to WebP.
    await exec('pdftoppm', ['-r', '150', '-png', path, join(dir, 'page')], { timeout: 120_000 })
    const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort((a, b) => naturalCompare(a, b))
    const pages: ConvertedPage[] = []
    for (const [idx, f] of files.entries()) {
      const buffer = await readFile(join(dir, f))
      const meta = await sharp(buffer).metadata()
      pages.push({ idx, buffer, width: meta.width ?? 0, height: meta.height ?? 0 })
    }
    return { pages, texts: pages.map(() => '') }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function convertOffice(path: string) {
  const dir = await mkdtemp(join(tmpdir(), 'shelf-office-'))
  try {
    // LibreOffice is flaky under concurrency — one process per job, with a
    // hard timeout and a private user profile.
    await exec(
      'soffice',
      [
        '--headless',
        '--norestore',
        `-env:UserInstallation=file://${dir}/profile`,
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        path,
      ],
      { timeout: 180_000 },
    )
    const pdf = (await readdir(dir)).find((f) => f.endsWith('.pdf'))
    if (!pdf) throw new Error('LibreOffice produced no PDF')
    return convertPdf(join(dir, pdf))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function convertEpub(path: string) {
  const zip = new AdmZip(path)
  const guard = guardArchive(zip)
  if (!guard.ok) throw new Error(guard.reason)

  const html = zip
    .getEntries()
    .filter((e) => /\.x?html?$/i.test(e.entryName))
    .sort((a, b) => naturalCompare(a.entryName, b.entryName))

  const pages: ConvertedPage[] = []
  const texts: string[] = []
  for (const [idx, entry] of html.entries()) {
    const raw = entry.getData().toString('utf8')
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    texts.push(text)

    // Render the chapter as a page image so it reads like every other item.
    const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:Georgia,serif;max-width:720px;margin:0 auto;padding:48px;line-height:1.7;font-size:17px}
      h1,h2,h3{line-height:1.25;margin:1.4em 0 .6em}p{margin:0 0 1em}</style></head><body>${raw}</body></html>`
    const tmp = join(tmpdir(), `shelf-epub-${idx}.html`)
    await writeFile(tmp, htmlDoc)
    const dir = await mkdtemp(join(tmpdir(), 'shelf-epubout-'))
    try {
      await exec('soffice', [
        '--headless',
        '--norestore',
        `-env:UserInstallation=file://${dir}/profile`,
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        tmp,
      ], { timeout: 120_000 })
      const pdf = (await readdir(dir)).find((f) => f.endsWith('.pdf'))
      if (!pdf) continue
      const rendered = await convertPdf(join(dir, pdf))
      for (const p of rendered.pages) pages.push({ ...p, idx: pages.length })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
  return { pages, texts }
}

async function convertImage(path: string) {
  const buffer = await readFile(path)
  const meta = await sharp(buffer).metadata()
  return {
    pages: [{ idx: 0, buffer, width: meta.width ?? 0, height: meta.height ?? 0 }],
    texts: [''],
  }
}

async function convertText(path: string) {
  const raw = await readFile(path, 'utf8')
  const CHARS = 2600
  const pages: ConvertedPage[] = []
  const texts: string[] = []
  for (let i = 0, p = 0; i < raw.length; i += CHARS, p++) {
    const slice = raw.slice(i, i + CHARS)
    texts.push(slice)
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:Georgia,serif;padding:56px;line-height:1.7;font-size:17px;white-space:pre-wrap}
      </style></head><body>${escapeHtml(slice)}</body></html>`
    const dir = await mkdtemp(join(tmpdir(), 'shelf-txt-'))
    const tmp = join(dir, 'page.html')
    try {
      await writeFile(tmp, html)
      await exec('soffice', [
        '--headless', '--norestore',
        `-env:UserInstallation=file://${dir}/profile`,
        '--convert-to', 'pdf', '--outdir', dir, tmp,
      ], { timeout: 120_000 })
      const pdf = (await readdir(dir)).find((f) => f.endsWith('.pdf'))
      if (!pdf) continue
      const rendered = await convertPdf(join(dir, pdf))
      for (const rp of rendered.pages) pages.push({ ...rp, idx: pages.length })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
  return { pages, texts }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ─── thumbnails ─────────────────────────────────────────────── */

export async function thumbnails(page: { buffer: Buffer }, cover = false) {
  return sharp(page.buffer, { limitInputPixels: 100_000_000 })
    .resize({ width: cover ? 400 : 320, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()
}

export async function webp(buffer: Buffer) {
  return sharp(buffer, { limitInputPixels: 100_000_000 })
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer()
}
