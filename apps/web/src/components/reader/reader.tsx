'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVirtualizer, type ReactVirtualizer } from '@tanstack/react-virtual'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Columns2,
  FileText,
  Grid2x2,
  List,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  ScrollText,
  Sparkles,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/primitives'
import { useHotkeys } from '@/lib/hotkeys'
import { ClipOverlay, ClipToggle } from './clip-tool'
import { useScopeStore } from '@/lib/scope-store'

export interface ReaderPage {
  idx: number
  src: string
  text?: string | null
}

export interface ReaderItem {
  id: string
  title: string
  seriesTitle?: string | null
  pageCount: number
  pages: ReaderPage[]
  type: string
}

type Mode = 'strip' | 'paged'

/** A note shown beside the page — the `?split=note:<id>` view. */
export interface SplitNote {
  id: string
  title: string
  body_md: string
}

export function Reader({
  item,
  initialPage,
  savedMaxPageRead = 0,
  splitNote = null,
  linkedNotes = [],
  initialMode = 'strip',
  initialRtl = false,
  initialSpread = false,
  initialScale = 1,
}: {
  item: ReaderItem
  initialPage: number
  savedMaxPageRead?: number
  splitNote?: SplitNote | null
  linkedNotes?: { id: string; title: string; page_ref: number | null }[]
  initialMode?: Mode
  initialRtl?: boolean
  initialSpread?: boolean
  initialScale?: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = React.useState<Mode>(initialMode)
  const [rtl, setRtl] = React.useState(initialRtl)
  const [scale, setScale] = React.useState(initialScale)
  const [spread, setSpread] = React.useState(initialSpread)
  const [page, setPage] = React.useState(initialPage)
  const [showNotes, setShowNotes] = React.useState(false)
  const [chrome, setChrome] = React.useState(true)
  const [clipMode, setClipMode] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const setScope = useScopeStore((s) => s.setScope)
  const setContext = useScopeStore((s) => s.setContext)

  const pageCount = item.pageCount || item.pages.length || 1
  const current = Math.min(Math.max(0, page), pageCount - 1)

  /* ── scope: tell the assistant what we are reading ─────────── */
  React.useEffect(() => {
    setScope({ mode: 'item', itemId: item.id })
    setContext([
      { label: item.seriesTitle ?? item.title, kind: 'item' },
    ])
    return () => setScope({ mode: 'vault' })
  }, [item.id, item.seriesTitle, item.title, setScope, setContext])

  /* ── progress persistence (debounced) ──────────────────────── */
  const saveTimer = React.useRef<ReturnType<typeof setTimeout>>()
  // `max_page_read` is the spoiler guard and must never go backwards.
  // Seed it from the value the server already has, not from the page
  // we happen to be on, otherwise re-opening an item would quietly
  // lower the guard.
  const maxRead = React.useRef(Math.max(0, savedMaxPageRead))

  const persist = React.useCallback(
    (nextPage: number, finished = false) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/progress/${item.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            page: nextPage,
            maxPageRead: Math.max(maxRead.current, nextPage),
            finished,
          }),
        })
      }, 900)
    },
    [item.id],
  )

  // The virtualizer lives below, but `goTo` needs it to scroll the
  // long strip when the reader jumps to a page with the keyboard.
  const virtualizerRef = React.useRef<ReactVirtualizer<HTMLDivElement, Element> | null>(null)

  const goTo = React.useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), pageCount - 1)
      setPage(clamped)
      maxRead.current = Math.max(maxRead.current, clamped)
      persist(clamped, clamped >= pageCount - 1)
      // In the strip the page is wherever the reader scrolled to, so
      // jumping to a page has to move the scroll as well — otherwise
      // the arrow keys change the page number but not the view.
      if (mode === 'strip') {
        virtualizerRef.current?.scrollToIndex(clamped, { align: 'start' })
      }
      router.replace(`/app/read/${item.id}?p=${clamped}`, { scroll: false })
    },
    [pageCount, persist, router, item.id, mode],
  )

  /* ── remember the reader preferences ────────────────────────── */
  // The mode, the direction, the spread and the zoom are the user's
  // reading preferences, so they are written back to the profile.
  const savePrefs = React.useRef<ReturnType<typeof setTimeout>>()
  const rememberPrefs = React.useCallback(
    (next: { mode?: Mode; rtl?: boolean; spread?: boolean; scale?: number }) => {
      clearTimeout(savePrefs.current)
      savePrefs.current = setTimeout(() => {
        void fetch('/api/settings/profile', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            settings: {
              reader: {
                mode: next.mode ?? mode,
                rtl: next.rtl ?? rtl,
                spread: next.spread ?? spread,
                scale: next.scale ?? scale,
              },
            },
          }),
        }).catch(() => {
          /* a preference that did not save is not worth interrupting for */
        })
      }, 800)
    },
    [mode, rtl, spread, scale],
  )

  /* ── hotkeys ───────────────────────────────────────────────── */
  useHotkeys(
    {
      ' ': (e) => {
        if (mode === 'strip') {
          scrollRef.current?.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })
        } else {
          goTo(current + 1)
        }
      },
      arrowright: () => goTo(current + (rtl ? -1 : 1)),
      arrowleft: () => goTo(current + (rtl ? 1 : -1)),
      arrowdown: () => goTo(current + 1),
      arrowup: () => goTo(current - 1),
      home: () => goTo(0),
      end: () => goTo(pageCount - 1),
      n: () => setShowNotes((v) => !v),
    },
    [mode, current, pageCount, rtl, goTo],
  )

  // The clip tool only makes sense on a single page.
  React.useEffect(() => {
    if (mode !== 'paged' || spread) setClipMode(false)
  }, [mode, spread])

  /* ── preload the next pages ───────────────────────────────── */
  // Paged mode jumps instantly, so the images that are about to be
  // shown are fetched before they are asked for.
  React.useEffect(() => {
    const urls: string[] = []
    for (let i = 1; i <= 3; i++) {
      const page = item.pages[current + i]
      if (page?.src) urls.push(page.src)
    }
    if (!urls.length) return
    const images = urls.map((src) => {
      const img = new window.Image()
      img.src = src
      return img
    })
    return () => {
      for (const img of images) {
        img.src = ''
      }
    }
  }, [current, item.pages])

  /* ── pinch to zoom ─────────────────────────────────────────── */
  const pinch = React.useRef<{ distance: number; scale: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    pinch.current = {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      scale,
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const start = pinch.current
    if (!start || e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (!start.distance) return
    const next = Math.min(3, Math.max(0.5, start.scale * (distance / start.distance)))
    setScale(next)
  }

  const onTouchEnd = () => {
    pinch.current = null
  }

  /* ── click thirds ──────────────────────────────────────────── */
  const pageAreaRef = React.useRef<HTMLDivElement>(null)

  const onPageClick = (e: React.MouseEvent) => {
    // The clip tool owns the pointer while it is on.
    if (clipMode) return
    if (mode === 'strip') {
      setChrome((v) => !v)
      return
    }
    const el = pageAreaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    // A spread shows two pages at a time, so it turns by two.
    const step = spread ? 2 : 1
    if (ratio < 1 / 3) goTo(current - (rtl ? -step : step))
    else if (ratio > 2 / 3) goTo(current + (rtl ? -step : step))
    else setChrome((v) => !v)
  }

  /* ── virtualised long strip ────────────────────────────────── */
  const virtualizer = useVirtualizer({
    count: item.pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 720,
    overscan: 3,
  })

  React.useEffect(() => {
    virtualizerRef.current = virtualizer
  }, [virtualizer])

  React.useEffect(() => {
    if (mode !== 'strip') return
    const t = setTimeout(() => {
      virtualizer.scrollToIndex(current, { align: 'start' })
    }, 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, item.id])

  // Track the page currently in view (strip mode).
  // The current page is read through a ref so the listener does not
  // have to be torn down and re-attached on every page change.
  const pageRef = React.useRef(page)
  pageRef.current = page
  React.useEffect(() => {
    if (mode !== 'strip') return
    const onScroll = () => {
      const idx = virtualizer.range?.startIndex ?? 0
      if (idx !== pageRef.current) {
        setPage(idx)
        maxRead.current = Math.max(maxRead.current, idx)
        persist(idx)
      }
    }
    const el = scrollRef.current
    el?.addEventListener('scroll', onScroll, { passive: true })
    return () => el?.removeEventListener('scroll', onScroll)
  }, [mode, virtualizer, persist])

  /* ── the page surface, shared by the plain and split layouts ── */
  const pageArea = (
      <div
        ref={scrollRef}
        className="relative min-w-0 flex-1 overflow-y-auto"
        onClick={onPageClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {mode === 'strip' ? (
          <div className="mx-auto w-full max-w-[900px] px-3 py-4">
            <div
              style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
              className="relative"
            >
              {virtualizer.getVirtualItems().map((v) => {
                const p = item.pages[v.index]
                if (!p) return null
                return (
                  <div
                    key={v.key}
                    data-index={v.index}
                    ref={virtualizer.measureElement}
                    className="absolute inset-x-0 flex justify-center pb-3"
                    style={{ transform: `translateY(${v.start}px)` }}
                  >
                    <div
                      className="relative overflow-hidden rounded-lg border border-line/8 bg-raised shadow-card"
                      style={{ width: `${100 * scale}%`, maxWidth: '100%' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.src}
                        alt={`Page ${p.idx + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="block w-full"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div ref={pageAreaRef} className="grid h-full place-items-center px-4 py-4">
            {spread ? (
              <div className="flex max-h-full max-w-[1400px] items-stretch justify-center gap-2">
                {[current, current + 1].map((idx) =>
                  item.pages[idx] ? (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-lg border border-line/8 bg-raised shadow-pop"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.pages[idx].src}
                        alt={`Page ${idx + 1}`}
                        className="block max-h-[calc(100dvh-100px)] w-auto"
                      />
                    </div>
                  ) : null,
                )}
              </div>
            ) : (
              <div className="relative max-h-full max-w-[860px] overflow-hidden rounded-lg border border-line/8 bg-raised shadow-pop">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.pages[current]?.src}
                  alt={`Page ${current + 1}`}
                  className="block max-h-[calc(100dvh-100px)] w-auto"
                />
                <ClipOverlay
                  itemId={item.id}
                  pageIdx={current}
                  active={clipMode}
                  onSaved={() => setClipMode(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
  )

  return (
    <div className="relative h-full w-full bg-bg">
      {/* ── top chrome ────────────────────────────────────────── */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-line/8 bg-bg/85 px-3 py-2 backdrop-blur-xl transition-transform duration-200',
          chrome ? 'translate-y-0' : '-translate-y-full',
        )}
      >
        <Button size="icon-sm" variant="ghost" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight">{item.title}</p>
          {item.seriesTitle && (
            <p className="truncate text-[11px] leading-tight text-faint">{item.seriesTitle}</p>
          )}
        </div>

        <Badge tone="chapter" className="hidden sm:inline-flex">
          p.{current + 1} / {pageCount}
        </Badge>

        <div className="flex items-center gap-1">
          <Tooltip label="Long strip">
            <button
              onClick={() => {
                setMode('strip')
                rememberPrefs({ mode: 'strip' })
              }}
              className={cn(
                'grid size-7 place-items-center rounded-lg transition',
                mode === 'strip' ? 'bg-accent/15 text-accent' : 'text-faint hover:bg-raised hover:text-fg',
              )}
            >
              <ScrollText className="size-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Single page">
            <button
              onClick={() => {
                setMode('paged')
                rememberPrefs({ mode: 'paged' })
              }}
              className={cn(
                'grid size-7 place-items-center rounded-lg transition',
                mode === 'paged' ? 'bg-accent/15 text-accent' : 'text-faint hover:bg-raised hover:text-fg',
              )}
            >
              <Grid2x2 className="size-3.5" />
            </button>
          </Tooltip>
          <Tooltip label={rtl ? 'Right to left' : 'Left to right'}>
            <button
              onClick={() => {
                setRtl((v) => {
                  rememberPrefs({ rtl: !v })
                  return !v
                })
              }}
              className={cn(
                'grid size-7 place-items-center rounded-lg transition',
                rtl ? 'bg-accent/15 text-accent' : 'text-faint hover:bg-raised hover:text-fg',
              )}
            >
              <Columns2 className="size-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Zoom out">
            <button
              onClick={() => {
              setScale((s) => {
                const next = Math.max(0.5, s - 0.15)
                rememberPrefs({ scale: next })
                return next
              })
            }}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg"
            >
              <Minus className="size-3.5" />
            </button>
          </Tooltip>
          <span className="w-9 text-center text-[11px] tabular-nums text-faint">{Math.round(scale * 100)}%</span>
          <Tooltip label="Zoom in">
            <button
              onClick={() => {
              setScale((s) => {
                const next = Math.min(2.5, s + 0.15)
                rememberPrefs({ scale: next })
                return next
              })
            }}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg"
            >
              <Plus className="size-3.5" />
            </button>
          </Tooltip>
          {mode === 'paged' && !spread && (
            <ClipToggle active={clipMode} onToggle={setClipMode} />
          )}
          <Tooltip label="Notes for this item">
            <button
              onClick={() => setShowNotes((v) => !v)}
              className={cn(
                'grid size-7 place-items-center rounded-lg transition',
                showNotes ? 'bg-accent/15 text-accent' : 'text-faint hover:bg-raised hover:text-fg',
              )}
            >
              <FileText className="size-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ── progress bar ──────────────────────────────────────── */}
      <div className="absolute inset-x-0 top-[52px] z-30 h-[2px] bg-line/8">
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${((current + 1) / pageCount) * 100}%` }}
        />
      </div>

      <div className="flex h-full pt-[52px]">
        {splitNote ? (
          <PanelGroup direction="horizontal" className="h-full w-full">
            <Panel defaultSize={62} minSize={30} className="min-w-0">
              {pageArea}
            </Panel>
            <PanelResizeHandle className="group relative w-1 shrink-0 bg-line/8 transition hover:bg-accent/40" />
            <Panel defaultSize={38} minSize={20} className="min-w-0 overflow-y-auto border-l border-line/8 bg-surface/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="size-4 text-accent" />
                <p className="text-[13px] font-semibold">{splitNote.title}</p>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-muted">
                {splitNote.body_md}
              </pre>
              <Link
                href={`/app/notes/${splitNote.id}`}
                className="mt-4 inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline"
              >
                Open the note <ArrowRight className="size-3" />
              </Link>
            </Panel>
          </PanelGroup>
        ) : (
          <>
        {pageArea}


        {/* ── side panel ──────────────────────────────────────── */}
        {showNotes && (
          <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-line/8 bg-surface/40 p-4 md:block">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <p className="text-[13px] font-semibold">Notes on this item</p>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              Write a note and anchor it to the page you are on. It becomes a link the graph can follow.
            </p>
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={() =>
                router.push(
                  `/app/notes/new?title=${encodeURIComponent(item.title)}&item=${encodeURIComponent(
                    item.id,
                  )}&page=${current}`,
                )
              }
            >
              <Plus /> Note at p.{current + 1}
            </Button>
            <div className="mt-5 border-t border-line/8 pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.1em] text-faint">Linked notes</p>
              {linkedNotes.length ? (
                <ul className="space-y-1">
                  {linkedNotes.map((n) => (
                    <li key={n.id} className="flex items-center gap-1.5">
                      <Link
                        href={`/app/notes/${n.id}`}
                        className="min-w-0 flex-1 truncate text-[12px] text-muted transition hover:text-fg"
                      >
                        {n.title}
                        {n.page_ref !== null && (
                          <span className="ml-1 text-[10.5px] text-faint">p.{n.page_ref + 1}</span>
                        )}
                      </Link>
                      <button
                        onClick={() =>
                          router.push(`/app/read/${item.id}?p=${current}&split=note:${n.id}`)
                        }
                        className="shrink-0 rounded-md border border-line/10 px-1.5 py-0.5 text-[10.5px] text-faint transition hover:border-accent/30 hover:text-accent"
                        title="Open the note beside the page"
                      >
                        Split
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-faint">None yet.</p>
              )}
            </div>
          </aside>
        )}
          </>
        )}
      </div>

      {/* ── spread toggle ─────────────────────────────────────── */}
      {mode === 'paged' && (
        <Tooltip label={spread ? 'Single page' : 'Two pages side by side'}>
          <button
            onClick={() => {
              setSpread((v) => {
                rememberPrefs({ spread: !v })
                return !v
              })
            }}
            className={cn(
              'absolute bottom-3 right-3 z-20 grid size-8 place-items-center rounded-lg border border-line/10 bg-bg/85 text-faint backdrop-blur-xl transition hover:text-fg',
              spread && 'border-accent/40 text-accent',
            )}
            aria-label={spread ? 'Single page' : 'Two pages side by side'}
          >
            <BookOpen className="size-3.5" />
          </button>
        </Tooltip>
      )}

      {/* ── footer status ─────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-line/10 bg-bg/85 px-3 py-1.5 text-[11px] text-faint backdrop-blur-xl">
          <MousePointer2 className="size-3" />
          <span>← → to turn</span>
          <span className="text-line/20">·</span>
          <span>space to scroll</span>
          <span className="text-line/20">·</span>
          <span className="tabular-nums">
            {current + 1}/{pageCount}
          </span>
        </div>
      </div>
    </div>
  )
}
