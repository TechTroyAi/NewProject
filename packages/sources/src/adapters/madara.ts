import * as cheerio from 'cheerio'
import type {
  BrowseOptions,
  RemoteChapter,
  RemoteManga,
  RemotePage,
  SourceAdapter,
  SourceDescriptor,
} from '@shelf/shared'

/* ══════════════════════════════════════════════════════════════
   Madara adapter.

   Madara is the WordPress theme behind a large share of the Mihon
   extension catalog. One adapter therefore covers hundreds of
   sources, using the source's own home URL as the base.

   The theme has drifted over the years, so each selector below has
   a couple of fallbacks and the whole thing is best-effort.
   ══════════════════════════════════════════════════════════════ */

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function baseOf(source: SourceDescriptor): string | null {
  const url = source.homeUrl
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml',
      ...(referer ? { referer } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`madara ${res.status}`)
  return res.text()
}

function absolutise(src: string | undefined, base: string): string | null {
  if (!src) return null
  const s = src.trim()
  if (!s) return null
  if (s.startsWith('//')) return `https:${s}`
  try {
    return new URL(s, base).toString()
  } catch {
    return null
  }
}

export const madaraAdapter: SourceAdapter = {
  id: 'madara',
  label: 'Madara (generic)',

  supports(source) {
    return source.adapter === 'madara' && !!baseOf(source)
  },

  async browse(source: SourceDescriptor, opts: BrowseOptions = {}): Promise<RemoteManga[]> {
    const base = baseOf(source)
    if (!base) throw new Error('source has no home URL')

    const query = (opts.query ?? '').trim()
    const url = query
      ? `${base}/search/?s=${encodeURIComponent(query)}&post_type=wp-manga`
      : `${base}/manga/?status=new&type=manga`

    const html = await fetchHtml(url, base)
    const $ = cheerio.load(html)
    const out: RemoteManga[] = []
    const seen = new Set<string>()

    const cards = $('div.c-tabs-item__content, div.d-lg-flex, div.row.c-tabs-item__content, div.item-summary')
    cards.each((_i, el) => {
      const $el = $(el)
      const $a = $el.find('a.permalink, a.d-block, a[href*="/manga/"]').first()
      const href = $a.attr('href')
      if (!href) return

      const slug = href.split('?')[0].replace(/\/$/, '').split('/').pop()
      if (!slug || seen.has(slug)) return
      seen.add(slug)

      const title =
        $el.find('.post-title, .series-name, .item-title, h3, h4').first().text().trim() ||
        $a.attr('title')?.trim() ||
        slug.replace(/[-_]+/g, ' ')

      const coverSrc =
        $el.find('img').first().attr('data-src') ??
        $el.find('img').first().attr('src') ??
        $el.find('img').first().attr('data-lazy-src')

      out.push({
        id: slug,
        title,
        author: null,
        description: null,
        coverUrl: absolutise(coverSrc, base),
        genres: [],
        year: null,
      })
    })

    return out
  },

  async chapters(source: SourceDescriptor, mangaId: string): Promise<RemoteChapter[]> {
    const base = baseOf(source)
    if (!base) throw new Error('source has no home URL')

    const html = await fetchHtml(`${base}/manga/${mangaId}/`, base)
    const $ = cheerio.load(html)

    const title =
      $('.post-title h1, .series-title, h1.entry-title').first().text().trim() || mangaId

    const chapters: RemoteChapter[] = []
    const seen = new Set<string>()

    $('ul.main.version-chap li.chapter, ul.main.version-chap li, li.wp-manga-chapter').each((_i, el) => {
      const $el = $(el)
      const $a = $el.find('a.chapter-btn, a').first()
      const href = $a.attr('href')
      if (!href) return

      const text = ($a.attr('title') || $a.text() || '').trim()
      const m = text.match(/chapter\s*([\d.]+)/i)
      const number = m ? Number(m[1]) : null
      // Keep the absolute chapter URL: a bare slug cannot be resolved
      // back to the chapter page (the path is
      // /manga/<series>/<chapter>/), so `pages()` would 404 on it.
      const id = absolutise(href, base) ?? href.split('?')[0]
      if (seen.has(id)) return
      seen.add(id)

      const volMatch = text.match(/volume\s*(\d+)/i)

      chapters.push({
        id,
        title: text || `Chapter ${number ?? '?'}`,
        number,
        volume: volMatch ? Number(volMatch[1]) : null,
        publishedAt: $el.find('span.chapter-release-date').first().text().trim() || null,
        pageCount: null,
      })
    })

    return chapters.sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
  },

  async pages(source: SourceDescriptor, chapterId: string): Promise<RemotePage[]> {
    const base = baseOf(source)
    if (!base) throw new Error('source has no home URL')

    // The chapter id may already be a full path (we stored the slug).
    const url = chapterId.startsWith('http') ? chapterId : `${base}/manga/${chapterId}/`
    const html = await fetchHtml(url, base)
    const $ = cheerio.load(html)

    const urls: string[] = []
    $('div.reading-content img, div.page-break img, div.entry-content img').each((_i, el) => {
      const $img = $(el)
      const src = $img.attr('data-src') ?? $img.attr('data-lazy-src') ?? $img.attr('src')
      const abs = absolutise(src, base)
      if (abs) urls.push(abs)
    })

    return urls.map((u, index) => ({ index, url: u, width: null, height: null }))
  },
}

/** Exposed for tests: pull a title/cover out of a Madara listing card. */
export function parseMadaraSearch(html: string, base: string): RemoteManga[] {
  const $ = cheerio.load(html)
  const out: RemoteManga[] = []
  const seen = new Set<string>()
  $('div.c-tabs-item__content, div.d-lg-flex, div.item-summary').each((_i, el) => {
    const $el = $(el)
    const href = $el.find('a.permalink, a[href*="/manga/"]').first().attr('href')
    if (!href) return
    const slug = href.split('?')[0].replace(/\/$/, '').split('/').pop()!
    if (seen.has(slug)) return
    seen.add(slug)
    const title = $el.find('.post-title, .series-name, h3, h4').first().text().trim() || slug
    const coverSrc = $el.find('img').first().attr('data-src') ?? $el.find('img').first().attr('src')
    out.push({ id: slug, title, author: null, description: null, coverUrl: absolutise(coverSrc, base), genres: [], year: null })
  })
  return out
}
