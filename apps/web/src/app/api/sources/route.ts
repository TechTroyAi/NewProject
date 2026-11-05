import { NextResponse } from 'next/server'
import { languageLabel } from '@shelf/shared'
import { getSourceCatalog } from '@/lib/sources/catalog'
import { getConnectedSources } from '@/lib/sources-data'
import { safeInt } from '@shelf/shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The public source catalog.
 *
 * Shelf reads the same index Mihon uses — the keiyoushi/extensions
 * repository — and flattens it into one descriptor per
 * (extension, language) pair.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').toLowerCase().trim()
  const lang = url.searchParams.get('lang') ?? ''
  const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 60))
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))
  const includeNsfw = url.searchParams.get('nsfw') === '1'

  const catalog = await getSourceCatalog()
  const connected = await getConnectedSources()
  const connectedKeys = new Set(connected.map((c) => c.source_key))

  let list = catalog.sources
  if (!includeNsfw) list = list.filter((s) => !s.nsfw)
  if (lang) list = list.filter((s) => s.language === lang)
  if (q) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.extensionName.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q),
    )
  }

  // Group by extension so one extension with 60 languages is one card.
  const byExtension = new Map<string, { sources: typeof list; name: string }>()
  for (const s of list) {
    const entry = byExtension.get(s.packageName) ?? { sources: [], name: s.extensionName }
    entry.sources.push(s)
    byExtension.set(s.packageName, entry)
  }

  const languages = Array.from(new Set(catalog.sources.map((s) => s.language)))
    .map((code) => ({ code, label: languageLabel(code), count: catalog.sources.filter((s) => s.language === code).length }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    total: list.length,
    live: catalog.live,
    revision: catalog.revision,
    languages,
    // The extension groups are the unit of pagination — 1,400 of them
    // in one response would be megabytes of JSON the browser never
    // shows. The sources inside a group are small and stay whole, so
    // the "+N" count in the UI is right.
    extensions: Array.from(byExtension.entries())
      .slice(offset, offset + limit)
      .map(([pkg, e]) => ({
        packageName: pkg,
        name: e.name,
        iconPath: e.sources[0]?.iconPath ?? null,
        version: e.sources[0]?.version ?? null,
        nsfw: e.sources[0]?.nsfw ?? false,
        adapter: e.sources[0]?.adapter ?? null,
        sourceCount: e.sources.length,
        connected: e.sources.some((s) => connectedKeys.has(s.key)),
        sources: e.sources.map((s) => ({
          ...s,
          connected: connectedKeys.has(s.key),
        })),
      })),
  })
}
