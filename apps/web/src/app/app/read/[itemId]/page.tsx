import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Reader } from '@/components/reader/reader'
import {
  getItemById,
  getNoteById,
  getNotesForItem,
  getPagesForItem,
  getProfile,
  getProgressMap,
  getSeriesList,
} from '@/lib/data'
import { resolvePageImage } from '@/lib/ai'
import type { ProfileSettings } from '@shelf/shared'

export const dynamic = 'force-dynamic'

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: { itemId: string }
  searchParams: { p?: string; split?: string }
}) {
  const item = await getItemById(params.itemId)
  if (!item) notFound()

  const pages = await getPagesForItem(params.itemId)
  const series = (await getSeriesList()).find((s) => s.id === item.series_id)
  const progress = (await getProgressMap()).get(params.itemId)
  const linkedNotes = await getNotesForItem(params.itemId)
  // The reader's preferences live in the profile, so the shelf opens
  // the way the user left it.
  const profile = await getProfile()
  const readerPrefs = (profile?.settings as ProfileSettings | undefined)?.reader ?? {}

  const readerPages = pages.map((p) => ({
    idx: p.idx,
    src: resolvePageImage(item.id, p.idx, item.page_count, p.imagePath),
    text: p.text,
  }))

  // `?p=` is user input: `Number('abc')` is NaN, and a NaN page index
  // propagates into the virtualiser. Parse it as an integer and clamp
  // it to the pages that actually exist.
  const requested = Number.parseInt(String(searchParams.p ?? '0'), 10)
  const initialPage = Math.min(
    Number.isFinite(requested) ? Math.max(0, requested) : 0,
    Math.max(0, readerPages.length - 1),
  )

  // `?split=note:<id>` opens the note beside the page.
  const splitRaw = searchParams?.split ?? ''
  const splitId = splitRaw.startsWith('note:') ? splitRaw.slice(5).trim() : ''
  const splitNote = splitId ? await getNoteById(splitId) : null

  return (
    <Suspense fallback={<div className="h-full bg-bg" />}>
      <Reader
        item={{
          id: item.id,
          title: item.title,
          seriesTitle: series?.title ?? null,
          pageCount: item.page_count,
          type: item.type,
          pages: readerPages,
        }}
        initialPage={initialPage}
        savedMaxPageRead={progress?.max_page_read ?? 0}
        splitNote={
          splitNote
            ? { id: splitNote.id, title: splitNote.title, body_md: splitNote.body_md }
            : null
        }
        linkedNotes={linkedNotes.map((n) => ({ id: n.id, title: n.title, page_ref: n.page_ref }))}
        initialMode={readerPrefs.mode ?? 'strip'}
        initialRtl={readerPrefs.rtl ?? false}
        initialSpread={readerPrefs.spread ?? false}
        initialScale={readerPrefs.scale ?? 1}
      />
    </Suspense>
  )
}
