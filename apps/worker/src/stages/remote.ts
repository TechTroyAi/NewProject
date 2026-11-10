import { getSourceCatalog } from '@shelf/sources'
import type { SourceDescriptor } from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   Remote stage.

   Pulls the pages of a chapter that was imported from a public
   source (MangaDex, a Madara site, …) and writes them into
   storage, so the item becomes an ordinary readable item.

   The adapter comes from the shared `@shelf/sources` package — the
   same code the web app uses to browse the catalogue.
   ══════════════════════════════════════════════════════════════ */

export interface RemoteTarget {
  /** `packageName#catalogId` — the key used across the app. */
  sourceKey: string
  chapterId: string
}

export interface RemotePagePlan {
  url: string
  index: number
}

/**
 * Work out the page list for a chapter without downloading it.
 * Kept separate from the download so it can be unit tested.
 */
export async function planRemotePages(
  source: SourceDescriptor,
  chapterId: string,
  adapter: { pages: (s: SourceDescriptor, c: string) => Promise<{ index: number; url: string }[]> },
): Promise<RemotePagePlan[]> {
  const pages = await adapter.pages(source, chapterId)
  return pages
    .filter((p) => !!p.url)
    .sort((a, b) => a.index - b.index)
    .map((p, i) => ({ url: p.url, index: p.index ?? i }))
}

/**
 * Download a page image with a size ceiling. A remote server can
 * hand back anything, so the same guards as the upload path apply.
 */
export async function downloadRemoteImage(url: string, maxBytes = 40 * 1024 * 1024): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Shelf/0.1 (self-hosted reading shelf)',
      accept: 'image/*,*/*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`remote page ${res.status}`)

  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared && declared > maxBytes) throw new Error('remote page too large')

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) throw new Error('remote page too large')
  if (!buf.length) throw new Error('remote page empty')
  return buf
}

/** Images we are willing to store. Anything else is rejected. */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif'
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'image/avif'
  return null
}

/**
 * Turn a stored `sources` row into the descriptor the adapters want.
 */
export function descriptorFromRow(row: {
  source_key: string
  package_name: string
  catalog_id: string
  name: string
  language: string
  home_url: string | null
  icon_path: string | null
  adapter: string | null
  nsfw: boolean
}): SourceDescriptor {
  return {
    key: row.source_key,
    packageName: row.package_name,
    extensionName: row.name,
    catalogId: row.catalog_id,
    name: row.name,
    language: row.language,
    homeUrl: row.home_url,
    iconPath: row.icon_path,
    version: null,
    nsfw: row.nsfw,
    adapter: row.adapter as SourceDescriptor['adapter'],
  }
}

/** Look a source up in the live/bundled catalogue. */
export async function lookupSource(sourceKey: string): Promise<SourceDescriptor | null> {
  const catalog = await getSourceCatalog()
  return catalog.sources.find((s) => s.key === sourceKey) ?? null
}
