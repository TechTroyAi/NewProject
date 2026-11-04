import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Reader } from '@/components/reader/reader'
import { getItemById, getPagesForItem, getSeriesList } from '@/lib/data'
import { resolvePageImage } from '@/lib/ai'

export const dynamic = 'force-dynamic'

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: { itemId: string }
  searchParams: { p?: string }
}) {
  const item = await getItemById(params.itemId)
  if (!item) notFound()

  const pages = await getPagesForItem(params.itemId)
  const series = (await getSeriesList()).find((s) => s.id === item.series_id)

  const readerPages = pages.map((p) => ({
    idx: p.idx,
    src: resolvePageImage(item.id, p.idx, item.page_count, p.imagePath),
    text: p.text,
  }))

  const initialPage = Math.min(Math.max(0, Number(searchParams.p ?? 0)), Math.max(0, readerPages.length - 1))

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
      />
    </Suspense>
  )
}
