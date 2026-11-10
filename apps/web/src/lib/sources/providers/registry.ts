import 'server-only'
import type {
  BrowseOptions,
  RemoteChapter,
  RemoteManga,
  RemotePage,
  SourceAdapter,
  SourceDescriptor,
} from '@shelf/shared'
import { ADAPTERS } from '@shelf/sources'
import { demoAdapter } from './demo'

/* ══════════════════════════════════════════════════════════════
   Adapter registry.

   Resolves the right adapter for a catalog source and degrades
   gracefully: if the upstream site is unreachable, the offline
   sample provider answers instead so the UI never hard-fails.
   ══════════════════════════════════════════════════════════════ */

export function resolveAdapter(source: SourceDescriptor): SourceAdapter {
  return ADAPTERS.find((a) => a.supports(source)) ?? demoAdapter
}

export interface AdapterOutcome<T> {
  data: T
  /** True when the upstream provider could not be reached. */
  offline: boolean
  reason?: string
}

async function withFallback<T>(
  source: SourceDescriptor,
  run: (adapter: SourceAdapter) => Promise<T>,
  fallback: (adapter: SourceAdapter) => Promise<T>,
): Promise<AdapterOutcome<T>> {
  const adapter = resolveAdapter(source)
  try {
    return { data: await run(adapter), offline: false }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[shelf] source ${source.key} unreachable (${reason}) — serving offline sample`)
    return { data: await fallback(demoAdapter), offline: true, reason }
  }
}

export function browseSource(source: SourceDescriptor, opts: BrowseOptions = {}) {
  return withFallback(
    source,
    (a) => a.browse(source, opts),
    (a) => a.browse(source, opts),
  )
}

export function sourceChapters(source: SourceDescriptor, mangaId: string) {
  return withFallback(
    source,
    (a) => a.chapters(source, mangaId),
    (a) => a.chapters(source, mangaId),
  )
}

export function sourcePages(source: SourceDescriptor, chapterId: string) {
  return withFallback(
    source,
    (a) => a.pages(source, chapterId),
    (a) => a.pages(source, chapterId),
  )
}
