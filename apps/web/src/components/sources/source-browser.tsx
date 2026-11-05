'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Download, Loader2, Search, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlay'
import { toast } from 'sonner'

interface RemoteManga {
  id: string
  title: string
  author: string | null
  description: string | null
  coverUrl: string | null
  genres: string[]
  year: number | null
}

interface RemoteChapter {
  id: string
  title: string
  number: number | null
  volume: number | null
  publishedAt: string | null
  pageCount: number | null
}

export function SourceBrowser({ sourceKey, sourceName, language }: { sourceKey: string; sourceName: string; language: string }) {
  const router = useRouter()
  const [q, setQ] = React.useState('')
  const [manga, setManga] = React.useState<RemoteManga[]>([])
  const [loading, setLoading] = React.useState(true)
  const [offline, setOffline] = React.useState<string | null>(null)

  const [picked, setPicked] = React.useState<RemoteManga | null>(null)
  const [chapters, setChapters] = React.useState<RemoteChapter[]>([])
  const [chaptersLoading, setChaptersLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [importing, setImporting] = React.useState(false)
  const [done, setDone] = React.useState<string | null>(null)
  const chaptersToken = React.useRef(0)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ source: sourceKey, limit: '30' })
        if (q) params.set('q', q)
        const res = await fetch(`/api/sources/browse?${params}`)
        const json = await res.json()
        if (cancelled) return
        setManga(json.manga ?? [])
        setOffline(json.offline ? (json.reason ?? 'upstream unreachable') : null)
      } catch {
        if (!cancelled) setManga([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, sourceKey])

  async function openManga(m: RemoteManga) {
    setPicked(m)
    setChapters([])
    setSelected(new Set())
    setChaptersLoading(true)
    // Token so a slow response for a previously opened title cannot
    // overwrite the one the user is looking at now.
    const token = ++chaptersToken.current
    try {
      const res = await fetch(
        `/api/sources/chapters?source=${encodeURIComponent(sourceKey)}&mangaId=${encodeURIComponent(m.id)}`,
      )
      const json = await res.json().catch(() => null)
      if (token !== chaptersToken.current) return
      if (!res.ok) {
        setChapters([])
        toast.error(json?.error ?? `Could not load chapters (${res.status})`)
        return
      }
      const list: RemoteChapter[] = json?.chapters ?? []
      setChapters(list)
      // Default to the newest 10.
      setSelected(new Set(list.slice(0, 10).map((c) => c.id)))
    } catch {
      if (token !== chaptersToken.current) return
      setChapters([])
      toast.error('Could not reach the source.')
    } finally {
      if (token === chaptersToken.current) setChaptersLoading(false)
    }
  }

  async function doImport() {
    if (!picked) return
    setImporting(true)
    try {
      const chosen = chapters.filter((c) => selected.has(c.id))
      const res = await fetch('/api/sources/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceKey,
          manga: {
            id: picked.id,
            title: picked.title,
            author: picked.author,
            description: picked.description,
            coverUrl: picked.coverUrl,
            genres: picked.genres,
          },
          chapters: chosen.map((c) => ({
            id: c.id,
            title: c.title,
            number: c.number,
            volume: c.volume,
            pageCount: c.pageCount,
          })),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? `import failed (${res.status})`)
      setDone(json.seriesId)
      toast.success(`${chosen.length} chapter${chosen.length === 1 ? '' : 's'} added to your shelf`)
    } catch (err) {
      setDone(null)
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {offline && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/8 px-3.5 py-2.5">
          <WifiOff className="mt-0.5 size-3.5 shrink-0 text-warn" />
          <p className="text-[12px] leading-relaxed text-warn/90">
            The upstream source could not be reached from this server ({offline}), so an offline sample catalogue is
            being shown. The adapter code is live and will hit the real site from a normal deployment.
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${sourceName} (${language})…`}
          className="pl-8"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[3/4.2] rounded-xl" />
          ))}
        </div>
      ) : manga.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="Nothing found"
          description="This source returned no results for that query."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {manga.map((m) => (
            <button key={m.id} onClick={() => void openManga(m)} className="group text-left">
              <div className="relative aspect-[3/4.2] overflow-hidden rounded-xl border border-line/8 transition duration-200 group-hover:-translate-y-1 group-hover:border-line/20">
                {m.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.coverUrl}
                    alt={m.title}
                    loading="lazy"
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="grid size-full place-items-center bg-raised text-faint">no cover</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2">
                  <p className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-white drop-shadow">
                    {m.title}
                  </p>
                  {m.author && <p className="mt-0.5 truncate text-[10px] text-white/60">{m.author}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── chapter picker ──────────────────────────────────── */}
      <Modal
        open={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.title}
        description={picked?.author ?? undefined}
        size="lg"
        footer={
          done ? (
            <Button onClick={() => router.push(`/app/library/${done}`)}>Open in library</Button>
          ) : (
            <>
              <span className="mr-auto text-[11.5px] text-faint">
                {selected.size} chapter{selected.size === 1 ? '' : 's'} selected
              </span>
              <Button variant="ghost" onClick={() => setPicked(null)}>
                Cancel
              </Button>
              <Button onClick={() => void doImport()} disabled={importing || selected.size === 0}>
                {importing ? <Loader2 className="animate-spin" /> : <Download />}
                Add to shelf
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-good/12 text-good">
              <Check className="size-5" />
            </div>
            <p className="mt-3 text-[14px] font-semibold">Added to your shelf</p>
            <p className="mt-1 text-[12.5px] text-muted">
              The chapters were queued for download and will be readable in a moment.
            </p>
          </div>
        ) : chaptersLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-faint">
            <Loader2 className="size-4 animate-spin" />
            Loading chapters…
          </div>
        ) : chapters.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-faint">No chapters available.</p>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set(chapters.map((c) => c.id)))}
              >
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <span className="flex-1" />
              <Badge tone="accent">{chapters.length} chapters</Badge>
            </div>
            <ul className="max-h-[45vh] space-y-1 overflow-y-auto">
              {chapters.map((c) => {
                const on = selected.has(c.id)
                return (
                  <li key={c.id}>
                    <button
                      onClick={() =>
                        setSelected((s) => {
                          const next = new Set(s)
                          if (next.has(c.id)) next.delete(c.id)
                          else next.add(c.id)
                          return next
                        })
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
                        on
                          ? 'border-accent/40 bg-accent/10'
                          : 'border-line/8 hover:border-line/18 hover:bg-raised/50',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-4 shrink-0 place-items-center rounded border transition',
                          on ? 'border-accent bg-accent text-accent-fg' : 'border-line/20',
                        )}
                      >
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{c.title}</span>
                      {c.pageCount ? (
                        <span className="shrink-0 text-[11px] text-faint">{c.pageCount}p</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Modal>
    </div>
  )
}
