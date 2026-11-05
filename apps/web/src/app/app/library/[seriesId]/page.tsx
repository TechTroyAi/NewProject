import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getProgressMap, getSeriesWithItems } from '@/lib/data'
import { mockCover } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export default async function SeriesPage({ params }: { params: { seriesId: string } }) {
  const series = await getSeriesWithItems(params.seriesId)
  if (!series) notFound()
  const progress = await getProgressMap()

  const sorted = [...series.items].sort((a, b) => (a.chapter ?? 0) - (b.chapter ?? 0))
  const nextUp = sorted.find((i) => !progress.get(i.id)?.finished)

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6">
      <Link
        href="/app/library"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted transition hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> Library
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-5">
        <div className="w-32 shrink-0 overflow-hidden rounded-xl border border-line/10 shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mockCover(series.title, series.kind)} alt={series.title} className="aspect-[3/4.2] w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-semibold tracking-[-.02em]">{series.title}</h1>
            <Badge tone={series.kind === 'manga' ? 'series' : 'accent'}>{series.kind}</Badge>
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            {series.items.length} items · {sorted.length} chapters
          </p>
          {nextUp && (
            <Link href={`/app/read/${nextUp.id}?p=${progress.get(nextUp.id)?.current_page ?? 0}`} className="mt-4 inline-block">
              <Button>
                <Play /> Continue — {nextUp.title}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <BookOpen className="size-4 text-faint" />
          <CardTitle>Chapters</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-line/5">
            {sorted.map((item) => {
              const p = progress.get(item.id)
              return (
                <li key={item.id}>
                  <Link
                    href={`/app/read/${item.id}?p=${p?.current_page ?? 0}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/40"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-raised text-[12px] font-semibold text-muted">
                      {item.chapter ?? '–'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{item.title}</span>
                      <span className="block text-[11.5px] text-faint">
                        {item.page_count} pages
                        {item.ai_tags?.length ? ` · ${item.ai_tags.slice(0, 3).join(', ')}` : ''}
                      </span>
                    </span>
                    {p && (
                      <span className="shrink-0">
                        {p.finished ? (
                          <Badge tone="good">read</Badge>
                        ) : (
                          <span className="text-[11px] tabular-nums text-faint">{Math.round(p.percent)}%</span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
