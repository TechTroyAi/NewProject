import { z } from 'zod'

/* ══════════════════════════════════════════════════════════════
   Public manga sources.

   Shelf reads the same extension catalog that Mihon / Tachiyomi
   use — the `keiyoushi/extensions` repository publishes an index
   of 1,400+ extensions, each exposing one source per language with
   a stable numeric id.

   That catalog is metadata: name, language, icon, home URL. The
   actual fetching is done by *adapters* (MangaDex, Madara, …),
   because an extension is Kotlin and Shelf is a web app.
   ══════════════════════════════════════════════════════════════ */

export const CATALOG_REPO = 'keiyoushi/extensions'
export const CATALOG_BRANCH = 'repo'

export const CatalogSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  homeUrl: z.string().nullable().optional(),
})
export type CatalogSource = z.infer<typeof CatalogSourceSchema>

export const CatalogExtensionSchema = z.object({
  name: z.string(),
  packageName: z.string(),
  versionName: z.string().nullable().optional(),
  contentWarning: z.string().nullable().optional(),
  homeUrl: z.string().nullable().optional(),
  iconPath: z.string().nullable().optional(),
  sources: z.array(CatalogSourceSchema),
})
export type CatalogExtension = z.infer<typeof CatalogExtensionSchema>

export const CatalogSchema = z.object({
  repo: z.string(),
  branch: z.string(),
  revision: z.string().nullable().optional(),
  extensions: z.array(CatalogExtensionSchema),
})
export type Catalog = z.infer<typeof CatalogSchema>

/** A source as Shelf sees it: one language of one extension. */
export interface SourceDescriptor {
  /** Stable id: `${packageName}#${catalogSourceId}` */
  key: string
  packageName: string
  extensionName: string
  catalogId: string
  name: string
  language: string
  homeUrl: string | null
  iconPath: string | null
  version: string | null
  nsfw: boolean
  /** Which adapter can actually fetch from this source. */
  adapter: AdapterId | null
}

export const ADAPTER_IDS = ['mangadex', 'madara'] as const
export type AdapterId = (typeof ADAPTER_IDS)[number]

/* ─── Content shapes returned by adapters ─────────────────────── */

export interface RemoteManga {
  id: string
  title: string
  author: string | null
  description: string | null
  coverUrl: string | null
  genres: string[]
  year: number | null
}

export interface RemoteChapter {
  id: string
  title: string
  number: number | null
  volume: number | null
  publishedAt: string | null
  pageCount: number | null
}

export interface RemotePage {
  index: number
  url: string
  width: number | null
  height: number | null
}

/* ─── Adapter contract ───────────────────────────────────────── */

export interface BrowseOptions {
  query?: string
  page?: number
  limit?: number
}

export interface SourceAdapter {
  id: AdapterId
  label: string
  /** Does this adapter handle the given catalog source? */
  supports(source: SourceDescriptor): boolean
  browse(source: SourceDescriptor, opts: BrowseOptions): Promise<RemoteManga[]>
  chapters(source: SourceDescriptor, mangaId: string): Promise<RemoteChapter[]>
  pages(source: SourceDescriptor, chapterId: string): Promise<RemotePage[]>
}

/* ─── API contracts ──────────────────────────────────────────── */

export const ConnectSourceSchema = z.object({
  packageName: z.string().min(1),
  catalogId: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  homeUrl: z.string().nullable().optional(),
  adapter: z.string().nullable().optional(),
})
export type ConnectSource = z.infer<typeof ConnectSourceSchema>

export const AddRemoteSchema = z.object({
  sourceKey: z.string().min(1),
  manga: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    author: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    coverUrl: z.string().nullable().optional(),
    genres: z.array(z.string()).optional(),
  }),
  /** Chapters to import. */
  chapters: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        number: z.number().nullable().optional(),
        volume: z.number().nullable().optional(),
        pageCount: z.number().int().nullable().optional(),
      }),
    )
    .max(500)
    .optional(),
})
export type AddRemote = z.infer<typeof AddRemoteSchema>

/* ─── Catalog normalisation ──────────────────────────────────── */

/**
 * Flatten the extension catalog into per-language source descriptors.
 * The catalog ships 1,454 extensions covering 150 languages; we keep
 * one descriptor per (extension, language) pair.
 */
export function normalizeCatalog(catalog: Catalog): SourceDescriptor[] {
  const out: SourceDescriptor[] = []

  for (const ext of catalog.extensions) {
    const nsfw = (ext.contentWarning ?? '').toUpperCase().includes('NSFW')
    for (const src of ext.sources) {
      out.push({
        key: `${ext.packageName}#${src.id}`,
        packageName: ext.packageName,
        extensionName: ext.name,
        catalogId: src.id,
        name: src.name,
        language: src.language,
        homeUrl: src.homeUrl ?? ext.homeUrl ?? null,
        iconPath: ext.iconPath ?? null,
        version: ext.versionName ?? null,
        nsfw,
        adapter: pickAdapter(ext.packageName, src.name, src.homeUrl ?? ext.homeUrl ?? null),
      })
    }
  }

  return out
}

/**
 * Choose an adapter for a catalog source.
 *
 * MangaDex has a public REST API and is matched exactly. Everything
 * else falls back to the generic Madara adapter, which is the engine
 * behind a large share of the catalog and is detected at runtime by
 * probing the site's structure.
 */
export function pickAdapter(packageName: string, sourceName: string, homeUrl: string | null): AdapterId | null {
  const p = packageName.toLowerCase()
  const n = sourceName.toLowerCase()

  if (p.includes('mangadex') || n === 'mangadex') return 'mangadex'
  if (p.includes('mangadexmulti') || n.includes('mangadex multi')) return 'mangadex'

  // Madara is the WordPress theme behind a large share of the catalog.
  // We cannot know from metadata alone, so we optimistically attach the
  // adapter and let it probe at request time.
  if (homeUrl) return 'madara'

  return null
}

/** Language codes we keep in the UI by default. */
export const POPULAR_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-Hans', label: 'Chinese (Simplified)' },
  { code: 'zh-Hant', label: 'Chinese (Traditional)' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
]

export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  POPULAR_LANGUAGES.map((l) => [l.code, l.label]),
)

export function languageLabel(code: string): string {
  if (LANGUAGE_LABELS[code]) return LANGUAGE_LABELS[code]
  if (code === 'all') return 'All languages'
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
