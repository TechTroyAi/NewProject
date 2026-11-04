import type { SourceAdapter, SourceDescriptor } from '@shelf/shared'
import { mangaDexAdapter } from './mangadex'
import { madaraAdapter } from './madara'

/**
 * Every adapter Shelf ships, in priority order.
 *
 * The Mihon catalogue describes 1,400+ sources, but each one is a
 * Kotlin extension. A web client can only talk to the ones that
 * expose an HTTP API, so adapters are added one provider at a time.
 */
export const ADAPTERS: SourceAdapter[] = [mangaDexAdapter, madaraAdapter]

export function resolveAdapter(source: SourceDescriptor): SourceAdapter | null {
  return ADAPTERS.find((a) => a.supports(source)) ?? null
}
