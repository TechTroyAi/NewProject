import Link from 'next/link'
import { BookOpen, FolderPlus, Grid3x3, Rows3, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/primitives'
import { getItems, getProgressMap, getSeriesList } from '@/lib/data'
import { mockCover } from '@/lib/demo'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; tag?: string; kind?: string }
}) {
  const [items, series, progress] = await Promise.all([
    getItems({ q: searchParams.q, tag: searchParams.tag, kind: searchParams.kind }),
    getSeriesList(),
    getProgressMap(),
  ])

  const bySeries = series.map((s) => ({
    series: s,
    items: items.filter((i) => i.series_id === s.id),
  }))

  const loose = items.filter((i) => !i.series_id)

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-3 pb-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-.02em]">Library</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {items.length} items across {series.length} collections
            {searchParams.tag ? ` · tagged #${searchParams.tag}` : ''}
          </p>
        </div>
        <form className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input name="q" defaultValue={searchParams.q ?? ''} placeholder="Filter…" className="w-44 pl-8" />
          </div>
          <Button variant="secondary" size="sm" type="submit">
            <Search /> Search
          </Button>
        </form>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="Your shelf is empty"
              description="Drop a CBZ, PDF, PPTX, DOCX or EPUB anywhere in the app. Folders are walked automatically."
              action={
                <Link href="/app">
                  <Button size="sm">Go to dashboard</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {bySeries
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.series.id}>
                <div className="mb-3 flex items-center gap-2.5">
                  <h2 className="text-[14px] font-semibold tracking-tight">{g.series.title}</h2>
                  <Badge tone={g.series.kind === 'manga' ? 'series' : g.series.kind === 'course' ? 'accent' : 'wiki'}>
                    {g.series.kind}
                  </Badge>
                  <span className="text-[11.5px] text-faint">{g.items.length} items</span>
                  <span className="flex-1" />
                  <Link
                    href={`/app/library/${g.series.id}`}
                    className="text-[11.5px] text-muted transition hover:text-fg"
                  >
                    Open series →
                  </Link>
                </div>
                <ItemGrid items={g.items} progress={progress} />
              </section>
            ))}

          {loose.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2.5">
                <h2 className="text-[14px] font-semibold tracking-tight">Unsorted</h2>
                <Badge>needs review</Badge>
              </div>
              <ItemGrid items={loose} progress={progress} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function ItemGrid({
  items,
  progress,
}: {
  items: Awaited<ReturnType<typeof getItems>>
  progress: Map<string, { percent: number; current_page: number; finished: boolean }>
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {items.map((item) => {
        const p = progress.get(item.id)
        return (
          <Link key={item.id} href={`/app/item/${item.id}`} className="group">
            <div className="relative aspect-[3/4.2] overflow-hidden rounded-xl border border-line/8 transition duration-200 group-hover:-translate-y-1 group-hover:border-line/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mockCover(item.title, item.type === 'cbz' ? 'manga' : 'book')}
                alt={item.title}
                className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
              {p && !p.finished && (
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
                  <div className="h-full bg-accent" style={{ width: `${p.percent}%` }} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-2">
                <p className="truncate text-[11.5px] font-semibold leading-tight text-white drop-shadow">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[10px] text-white/60">
                  {item.page_count} pages
                  {p && !p.finished ? ` · ${Math.round(p.percent)}%` : ''}
                </p>
              </div>
              {item.status !== 'ready' && (
                <span className="absolute right-1.5 top-1.5 rounded-md bg-warn/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                  {item.status}
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
