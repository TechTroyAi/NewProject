import {
  CATALOG_BRANCH,
  CATALOG_REPO,
  CatalogSchema,
  normalizeCatalog,
  type Catalog,
  type SourceDescriptor,
} from '@shelf/shared'
import snapshot from './catalog-snapshot.json'

/* ══════════════════════════════════════════════════════════════
   The public source catalog.

   Shelf reads the same index Mihon does: the `keiyoushi/extensions`
   repository publishes `index.json` on its `repo` branch, describing
   every extension and every per-language source it exposes.

   We fetch it through the GitHub contents API (works from a server
   without CORS concerns, and honours GITHUB_TOKEN if provided), and
   fall back to a bundled snapshot when the network is unavailable.
   ══════════════════════════════════════════════════════════════ */

const API = 'https://api.github.com'

/** `next` is a Next.js extension to RequestInit; the worker does not have it. */
type FetchInit = RequestInit & { next?: { revalidate?: number } }
const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

interface CacheEntry {
  at: number
  sources: SourceDescriptor[]
  live: boolean
  revision: string | null
}

let cache: CacheEntry | null = null

const SNAPSHOT = snapshot as unknown as Catalog

/* ─── Live fetch ─────────────────────────────────────────────── */

async function fetchLiveCatalog(): Promise<Catalog | null> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'shelf-app',
  }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  // 1. Locate the blob (the file is >1 MB, so the contents API omits
  //    the payload and hands back the git blob URL instead).
  const metaRes = await fetch(`${API}/repos/${CATALOG_REPO}/contents/index.json?ref=${CATALOG_BRANCH}`, {
    headers,
    next: { revalidate: 3600 },
  } as FetchInit)
  if (!metaRes.ok) throw new Error(`catalog metadata ${metaRes.status}`)

  const meta = (await metaRes.json()) as { sha?: string; git_url?: string }
  if (!meta.git_url && !meta.sha) throw new Error('catalog metadata missing blob url')

  const blobUrl = meta.git_url ?? `${API}/repos/${CATALOG_REPO}/git/blobs/${meta.sha}`
  const blobRes = await fetch(blobUrl, { headers, next: { revalidate: 3600 } } as FetchInit)
  if (!blobRes.ok) throw new Error(`catalog blob ${blobRes.status}`)

  const blob = (await blobRes.json()) as { content?: string; encoding?: string }
  const raw = blob.encoding === 'base64' ? Buffer.from(blob.content ?? '', 'base64').toString('utf8') : (blob.content ?? '')
  if (!raw) throw new Error('catalog blob empty')

  const parsed = JSON.parse(raw) as {
    extensionList?: { extensions?: unknown[] }
    [k: string]: unknown
  }

  // The live index uses a slightly different shape than our snapshot:
  //   { extensionList: { extensions: [ { name, packageName, sources: [...] } ] } }
  const extensions = (parsed.extensionList?.extensions ?? []) as any[]

  return {
    repo: CATALOG_REPO,
    branch: CATALOG_BRANCH,
    revision: meta.sha ?? null,
    extensions: extensions.map((e) => ({
      name: e.name,
      packageName: e.packageName,
      versionName: e.versionName ?? null,
      contentWarning: e.contentWarning ?? null,
      homeUrl: e.homeUrl ?? null,
      iconPath: iconPathFrom(e.resources?.iconUrl),
      sources: (e.sources ?? []).map((s: any) => ({
        id: String(s.id),
        name: s.name,
        language: s.language,
        homeUrl: s.homeUrl ?? null,
      })),
    })),
  } satisfies Catalog
}

/** jsdelivr URL → repo-relative path, so icons can be proxied via the API. */
function iconPathFrom(iconUrl?: string): string | null {
  if (!iconUrl) return null
  const marker = '/extensions-source@main/'
  const i = iconUrl.indexOf(marker)
  return i >= 0 ? iconUrl.slice(i + marker.length) : null
}

/* ─── Public API ─────────────────────────────────────────────── */

export interface CatalogResult {
  sources: SourceDescriptor[]
  /** True when the catalog came from the live public repository. */
  live: boolean
  revision: string | null
  fetchedAt: number
}

export async function getSourceCatalog(opts: { refresh?: boolean } = {}): Promise<CatalogResult> {
  if (!opts.refresh && cache && Date.now() - cache.at < TTL_MS) {
    return {
      sources: cache.sources,
      live: cache.live,
      revision: cache.revision,
      fetchedAt: cache.at,
    }
  }

  try {
    const catalog = await fetchLiveCatalog()
    const parsed = CatalogSchema.parse(catalog)
    const sources = normalizeCatalog(parsed)
    cache = { at: Date.now(), sources, live: true, revision: parsed.revision ?? null }
    return { sources, live: true, revision: parsed.revision ?? null, fetchedAt: cache.at }
  } catch (err) {
    console.warn('[shelf] live catalog unavailable, using bundled snapshot:', (err as Error).message)
    const parsed = CatalogSchema.parse(SNAPSHOT)
    const sources = normalizeCatalog(parsed)
    cache = { at: Date.now(), sources, live: false, revision: parsed.revision ?? null }
    return { sources, live: false, revision: parsed.revision ?? null, fetchedAt: cache.at }
  }
}

/**
 * Proxy an extension icon through the GitHub contents API so the
 * browser never depends on a third-party CDN.
 */
export async function fetchExtensionIcon(iconPath: string): Promise<{ body: Buffer; type: string } | null> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'shelf-app',
  }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  const res = await fetch(
    `${API}/repos/keiyoushi/extensions-source/contents/${iconPath}?ref=main`,
    { headers, next: { revalidate: 86400 } } as FetchInit,
  )
  if (!res.ok) return null

  const json = (await res.json()) as { content?: string; encoding?: string; type?: string }
  if (!json.content) return null
  const body = Buffer.from(json.content, json.encoding === 'base64' ? 'base64' : 'utf8')
  // `type` is the git object kind ("file"), not a MIME type — derive it
  // from the path instead.
  return { body, type: contentTypeFor(iconPath) }
}

/** MIME type from a file extension. */
export function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'svg':
      return 'image/svg+xml'
    case 'ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

export function findSource(key: string, sources: SourceDescriptor[]) {
  return sources.find((s) => s.key === key) ?? null
}
