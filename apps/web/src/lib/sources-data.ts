import 'server-only'
import type { SourceDescriptor } from '@shelf/shared'
import { IS_DEMO, getSupabaseAdmin } from './db'
import { DEMO_USER_ID } from './demo'
import { getSourceCatalog } from './sources/catalog'

/* ══════════════════════════════════════════════════════════════
   Connected sources — the user's own list of sources they have
   enabled, plus the import flow that turns remote manga into
   regular series + items.
   ══════════════════════════════════════════════════════════════ */

export interface ConnectedSource {
  id: string
  user_id: string
  provider: string
  source_key: string
  package_name: string
  catalog_id: string
  name: string
  language: string
  home_url: string | null
  icon_path: string | null
  adapter: string | null
  nsfw: boolean
  enabled: boolean
  created_at: string
}

/* ─── Demo store ─────────────────────────────────────────────── */

const demoSources: ConnectedSource[] = [
  {
    id: 'src-mangadex-en',
    user_id: DEMO_USER_ID,
    provider: 'mangadex',
    source_key: 'eu.kanade.tachiyomi.extension.all.mangadex#2499283573021220255',
    package_name: 'eu.kanade.tachiyomi.extension.all.mangadex',
    catalog_id: '2499283573021220255',
    name: 'MangaDex',
    language: 'en',
    home_url: 'https://mangadex.org',
    icon_path: 'src/all/mangadex/res/mipmap-xhdpi/ic_launcher.png',
    adapter: 'mangadex',
    nsfw: false,
    enabled: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'src-mangadex-ja',
    user_id: DEMO_USER_ID,
    provider: 'mangadex',
    source_key: 'eu.kanade.tachiyomi.extension.all.mangadex#1411768577036936240',
    package_name: 'eu.kanade.tachiyomi.extension.all.mangadex',
    catalog_id: '1411768577036936240',
    name: 'MangaDex',
    language: 'ja',
    home_url: 'https://mangadex.org',
    icon_path: 'src/all/mangadex/res/mipmap-xhdpi/ic_launcher.png',
    adapter: 'mangadex',
    nsfw: false,
    enabled: true,
    created_at: new Date().toISOString(),
  },
]

/* ─── Connected sources ──────────────────────────────────────── */

export async function getConnectedSources(): Promise<ConnectedSource[]> {
  if (IS_DEMO) return demoSources
  const { data } = await getSupabaseAdmin()!
    .from('sources')
    .select('*')
    .eq('user_id', DEMO_USER_ID)
    .order('name')
  return (data ?? []) as ConnectedSource[]
}

export async function isSourceConnected(sourceKey: string): Promise<boolean> {
  if (IS_DEMO) return demoSources.some((s) => s.source_key === sourceKey)
  const { data } = await getSupabaseAdmin()!
    .from('sources')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .eq('source_key', sourceKey)
    .maybeSingle()
  return !!data
}

export async function connectSource(desc: SourceDescriptor): Promise<ConnectedSource> {
  if (IS_DEMO) {
    const existing = demoSources.find((s) => s.source_key === desc.key)
    if (existing) return existing
    const row: ConnectedSource = {
      id: `src-${Date.now().toString(36)}`,
      user_id: DEMO_USER_ID,
      provider: desc.adapter ?? 'catalog',
      source_key: desc.key,
      package_name: desc.packageName,
      catalog_id: desc.catalogId,
      name: desc.name,
      language: desc.language,
      home_url: desc.homeUrl,
      icon_path: desc.iconPath,
      adapter: desc.adapter,
      nsfw: desc.nsfw,
      enabled: true,
      created_at: new Date().toISOString(),
    }
    demoSources.push(row)
    return row
  }

  const { data, error } = await getSupabaseAdmin()!
    .rpc('connect_source', {
      p_user_id: DEMO_USER_ID,
      p_package_name: desc.packageName,
      p_catalog_id: desc.catalogId,
      p_name: desc.name,
      p_language: desc.language,
      p_home_url: desc.homeUrl ?? null,
      p_icon_path: desc.iconPath ?? null,
      p_adapter: desc.adapter ?? null,
      p_nsfw: desc.nsfw,
    })
    .single()
  if (error) throw error
  return data as ConnectedSource
}

export async function disconnectSource(sourceKey: string): Promise<void> {
  if (IS_DEMO) {
    const i = demoSources.findIndex((s) => s.source_key === sourceKey)
    if (i >= 0) demoSources.splice(i, 1)
    return
  }
  await getSupabaseAdmin()!
    .from('sources')
    .delete()
    .eq('user_id', DEMO_USER_ID)
    .eq('source_key', sourceKey)
}

/** Resolve a connected source back to a catalog descriptor. */
export async function resolveConnected(sourceKey: string) {
  const catalog = await getSourceCatalog()
  return catalog.sources.find((s) => s.key === sourceKey) ?? null
}

/* ─── Import ─────────────────────────────────────────────────── */

export interface ImportChapterInput {
  id: string
  title: string
  number?: number | null
  volume?: number | null
  pageCount?: number | null
}

export interface ImportResult {
  seriesId: string
  itemIds: string[]
  title: string
}

/**
 * Turn a remote manga into a series plus one item per chapter.
 * Everything downstream (reader, progress, notes, quiz) then works
 * exactly as it does for uploaded files.
 */
export async function importRemoteSeries(opts: {
  source: SourceDescriptor
  manga: { id: string; title: string; author?: string | null; description?: string | null; coverUrl?: string | null }
  chapters: ImportChapterInput[]
}): Promise<ImportResult> {
  const { source, manga, chapters } = opts

  if (IS_DEMO) {
    const seriesId = `s-remote-${Date.now().toString(36)}`
    const itemIds: string[] = []
    for (const ch of chapters) {
      itemIds.push(`i-remote-${Date.now().toString(36)}-${ch.id}`)
    }
    return { seriesId, itemIds, title: manga.title }
  }

  const { data: connected } = await getSupabaseAdmin()!
    .from('sources')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .eq('source_key', source.key)
    .maybeSingle()

  if (!connected) throw new Error('Source is not connected')

  const { data, error } = await getSupabaseAdmin()!
    .rpc('import_remote_series', {
      p_user_id: DEMO_USER_ID,
      p_source_id: connected.id,
      p_remote_id: manga.id,
      p_title: manga.title,
      p_author: manga.author ?? null,
      p_description: manga.description ?? null,
      p_cover_url: manga.coverUrl ?? null,
      p_chapters: chapters as unknown as Record<string, unknown>[],
    })
    .single()
  if (error) throw error

  const result = data as { seriesId: string; itemIds: string[] }
  return { seriesId: result.seriesId, itemIds: result.itemIds, title: manga.title }
}
