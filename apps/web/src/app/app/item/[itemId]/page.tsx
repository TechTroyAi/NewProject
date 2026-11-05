import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen, FileText, Play, Scissors, Sparkles, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getItemById, getNotes, getPagesForItem, getProgressMap, getSeriesList, listClips } from '@/lib/data'
import { mockCover } from '@/lib/demo'
import { mediaUrl } from '@/lib/media'
import { DeleteToTrashButton } from '@/components/trash/delete-button'

export const dynamic = 'force-dynamic'

export default async function ItemPage({ params }: { params: { itemId: string } }) {
  const item = await getItemById(params.itemId)
  if (!item) notFound()

  const [pages, progress, notes, series, clips] = await Promise.all([
    getPagesForItem(params.itemId),
    getProgressMap(),
    getNotes(),
    getSeriesList(),
    listClips(params.itemId),
  ])
  const p = progress.get(item.id)
  const linkedNotes = notes.filter((n) => n.item_id === item.id)
  const s = series.find((x) => x.id === item.series_id)

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6">
      <Link
        href={s ? `/app/library/${s.id}` : '/app/library'}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted transition hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> {s?.title ?? 'Library'}
      </Link>

      <div className="mb-6 flex flex-wrap gap-5">
        <div className="w-32 shrink-0 overflow-hidden rounded-xl border border-line/10 shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(item.cover_path) ?? mockCover(item.title, item.type === 'cbz' ? 'manga' : 'book')}
            alt={item.title}
            className="aspect-[3/4.2] w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-[-.02em]">{item.title}</h1>
            <Badge tone={item.type === 'cbz' ? 'series' : 'accent'}>{item.type}</Badge>
            {item.status !== 'ready' && <Badge tone="warn">{item.status}</Badge>}
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">
            {item.page_count} pages · {s?.title ?? 'Unsorted'}
            {p && !p.finished ? ` · ${Math.round(p.percent)}% read` : ''}
          </p>

          {item.speaker_notes && (
            <div className="mt-4 rounded-xl border border-line/10 bg-raised/40 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.1em] text-faint">
                Speaker notes
              </p>
              <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-muted">
                {item.speaker_notes}
              </pre>
            </div>
          )}

          {item.ai_summary && (
            <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-fg/85">{item.ai_summary}</p>
          )}

          {item.ai_tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.ai_tags.map((t) => (
                <Link
                  key={t}
                  href={`/app/library?tag=${encodeURIComponent(t)}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-line/10 bg-raised/60 px-2 py-0.5 text-[11.5px] text-muted transition hover:border-accent/30 hover:text-fg"
                >
                  <Tag className="size-2.5" />
                  {t}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <Link href={`/app/read/${item.id}?p=${p?.current_page ?? 0}`} className="inline-block">
              <Button>
                <Play /> {p && !p.finished ? `Resume — p.${p.current_page + 1}` : 'Start reading'}
              </Button>
            </Link>
            <DeleteToTrashButton
              entityType="item"
              entityId={item.id}
              title={item.title}
              redirectTo={s ? `/app/library/${s.id}` : '/app/library'}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <BookOpen className="size-4 text-faint" />
            <CardTitle>Key terms</CardTitle>
            <span className="flex-1" />
            <Badge tone="wiki">
              <Sparkles className="size-2.5" /> AI
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {item.key_terms.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-faint">
                No key terms extracted yet. They appear once OCR and the AI pass finish.
              </p>
            ) : (
              <ul className="divide-y divide-line/5">
                {item.key_terms.map((k) => (
                  <li key={k.term} className="px-4 py-3">
                    <p className="text-[13px] font-medium">{k.term}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{k.definition}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FileText className="size-4 text-faint" />
            <CardTitle>Linked notes</CardTitle>
            <span className="flex-1" />
            <span className="text-[11.5px] text-faint">{linkedNotes.length}</span>
          </CardHeader>
          <CardContent className="p-0">
            {linkedNotes.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-faint">
                No notes anchored to this item yet.
              </p>
            ) : (
              <ul className="divide-y divide-line/5">
                {linkedNotes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/app/notes/${n.id}`} className="block px-4 py-3 transition hover:bg-raised/40">
                      <p className="truncate text-[13px] font-medium">{n.title}</p>
                      {n.page_ref !== null && n.page_ref !== undefined && (
                        <p className="mt-0.5 text-[11.5px] text-series">anchored at p.{n.page_ref + 1}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {clips.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <Scissors className="size-4 text-faint" />
            <CardTitle>Clips</CardTitle>
            <span className="flex-1" />
            <span className="text-[11.5px] text-faint">{clips.length}</span>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line/5">
              {clips.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/app/notes?clip=${c.id}`}
                    className="flex items-center gap-2 px-4 py-3 transition hover:bg-raised/40"
                  >
                    <Scissors className="size-3 text-series" />
                    <span className="text-[12.5px] text-muted">Clip from page {c.page_idx + 1}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <span className="flex-1" />
          <span className="text-[11.5px] text-faint">{pages.length} rendered</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-6 gap-1.5 p-3 sm:grid-cols-10 lg:grid-cols-16">
            {pages.slice(0, 48).map((pg) => (
              <Link
                key={pg.idx}
                href={`/app/read/${item.id}?p=${pg.idx}`}
                className="grid aspect-[3/4] place-items-center rounded-md border border-line/8 bg-raised text-[10.5px] text-faint transition hover:border-accent/40 hover:text-fg"
              >
                {pg.idx + 1}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
