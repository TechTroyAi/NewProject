import type {
  BrowseOptions,
  RemoteChapter,
  RemoteManga,
  RemotePage,
  SourceAdapter,
  SourceDescriptor,
} from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   MangaDex adapter — the public REST API.

   MangaDex is the one source in the catalog with a first-class
   public API, so it is the reference implementation for how a
   Shelf adapter behaves.
   ══════════════════════════════════════════════════════════════ */

const API = 'https://api.mangadex.org'

const UA = 'Shelf/0.1 (self-hosted reading shelf)'

/** Catalog language → MangaDex translated-language code. */
function toMangaDexLanguage(lang: string): string {
  const map: Record<string, string> = {
    'pt-BR': 'pt-br',
    'pt-PT': 'pt-pt',
    'zh-Hans': 'zh-hans',
    'zh-Hant': 'zh-hant',
    es: 'es-la',
    fr: 'fr',
    de: 'de',
    it: 'it',
    ru: 'ru',
    ja: 'ja',
    ko: 'ko',
    'ko-ro': 'ko-ro',
    ar: 'ar',
    en: 'en',
  }
  return map[lang] ?? lang.toLowerCase()
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': UA },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`mangadex ${res.status}`)
  return (await res.json()) as T
}

interface MdxManga {
  id: string
  attributes: {
    title: Record<string, string>
    altTitles: { en?: string }[]
    description: Record<string, string>
    year?: number
    tags: { id: string }[]
    status: string
  }
  relationships: { type: string; id: string }[]
}

interface MdxAggregate {
  volumes: Record<string, { chapters: Record<string, { chapterId: string; title: string; others: string[] }> }>
}

export const mangaDexAdapter: SourceAdapter = {
  id: 'mangadex',
  label: 'MangaDex',

  supports(source) {
    return source.adapter === 'mangadex'
  },

  async browse(source: SourceDescriptor, opts: BrowseOptions = {}): Promise<RemoteManga[]> {
    const limit = Math.min(25, opts.limit ?? 20)
    const offset = ((opts.page ?? 1) - 1) * limit
    const lang = toMangaDexLanguage(source.language)

    const params = new URLSearchParams()
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    params.append('includes[]', 'cover_art')
    params.append('includes[]', 'author')
    params.set('order[relevance]', 'desc')
    params.append('availableTranslatedLanguage[]', lang)
    if (opts.query) params.set('title', opts.query)

    const { data } = await getJSON<{ data: MdxManga[] }>(`${API}/manga?${params}`)
    return Promise.all(data.map((m) => toRemoteManga(m)))
  },

  async chapters(source: SourceDescriptor, mangaId: string): Promise<RemoteChapter[]> {
    const lang = toMangaDexLanguage(source.language)
    const params = new URLSearchParams()
    params.append('translatedLanguage[]', lang)

    const agg = await getJSON<MdxAggregate>(`${API}/manga/${mangaId}/aggregate?${params}`)
    const out: RemoteChapter[] = []

    for (const [volKey, vol] of Object.entries(agg.volumes ?? {})) {
      for (const [chKey, ch] of Object.entries(vol.chapters ?? {})) {
        out.push({
          id: ch.chapterId,
          title: ch.title?.trim() || `Chapter ${chKey}`,
          number: Number(chKey) || null,
          volume: Number(volKey) || null,
          publishedAt: null,
          pageCount: null,
        })
      }
    }

    return out.sort((a, b) => (b.number ?? 0) - (a.number ?? 0) || (b.volume ?? 0) - (a.volume ?? 0))
  },

  async pages(_source: SourceDescriptor, chapterId: string): Promise<RemotePage[]> {
    const data = await getJSON<{
      baseUrl: string
      chapter: { hash: string; data: string[] }
    }>(`${API}/at-home/server/${chapterId}`)

    return data.chapter.data.map((file, index) => ({
      index,
      url: `${data.baseUrl}/data/${data.chapter.hash}/${file}`,
      width: null,
      height: null,
    }))
  },
}

async function toRemoteManga(m: MdxManga): Promise<RemoteManga> {
  const title =
    m.attributes.title.en ??
    m.attributes.altTitles.find((t) => t.en)?.en ??
    Object.values(m.attributes.title)[0] ??
    'Untitled'

  const coverId = m.relationships.find((r) => r.type === 'cover_art')?.id
  let coverUrl: string | null = null
  if (coverId) {
    try {
      const cover = await getJSON<{ data: { attributes: { fileName: string } } }>(
        `${API}/cover/${coverId}?size=medium`,
      )
      coverUrl = `https://uploads.mangadex.org/covers/${coverId}/${cover.data.attributes.fileName}`
    } catch {
      coverUrl = null
    }
  }

  return {
    id: m.id,
    title,
    author: null,
    description: m.attributes.description.en ?? Object.values(m.attributes.description)[0] ?? null,
    coverUrl,
    genres: [],
    year: m.attributes.year ?? null,
  }
}
