'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowLeft,
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

export function Reader({
  item,
  initialPage,
  savedMaxPageRead = 0,
}: {
  item: ReaderItem
  initialPage: number
  savedMaxPageRead?: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = React.useState<Mode>('strip')
  const [rtl, setRtl] = React.useState(false)
  const [scale, setScale] = React.useState(1)
  const [page, setPage] = React.useState(initialPage)
  const [showNotes, setShowNotes] = React.useState(false)
  const [chrome, setChrome] = React.useState(true)
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

  const goTo = React.useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), pageCount - 1)
      setPage(clamped)
      maxRead.current = Math.max(maxRead.current, clamped)
      persist(clamped, clamped >= pageCount - 1)
      router.replace(`/app/read/${item.id}?p=${clamped}`, { scroll: false })
    },
    [pageCount, persist, router, item.id],
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

  /* ── virtualised long strip ────────────────────────────────── */
  const virtualizer = useVirtualizer({
    count: item.pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 720,
    overscan: 3,
  })

  React.useEffect(() => {
    if (mode !== 'strip') return
    const t = setTimeout(() => {
      virtualizer.scrollToIndex(current, { align: 'start' })
    }, 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, item.id])

  // Track the page currently in view (strip mode).
  React.useEffect(() => {
    if (mode !== 'strip') return
    const onScroll = () => {
      const idx = virtualizer.range?.startIndex ?? 0
      if (idx !== page) {
        setPage(idx)
        maxRead.current = Math.max(maxRead.current, idx)
        persist(idx)
      }
    }
    const el = scrollRef.current
    el?.addEventListener('scroll', onScroll, { passive: true })
    return () => el?.removeEventListener('scroll', onScroll)
  }, [mode, virtualizer, page, persist])

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
              onClick={() => setMode('strip')}
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
              onClick={() => setMode('paged')}
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
              onClick={() => setRtl((v) => !v)}
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
              onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg"
            >
              <Minus className="size-3.5" />
            </button>
          </Tooltip>
          <span className="w-9 text-center text-[11px] tabular-nums text-faint">{Math.round(scale * 100)}%</span>
          <Tooltip label="Zoom in">
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg"
            >
              <Plus className="size-3.5" />
            </button>
          </Tooltip>
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
        {/* ── pages ────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="relative min-w-0 flex-1 overflow-y-auto"
          onClick={() => setChrome((v) => !v)}
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
            <div className="grid h-full place-items-center px-4 py-4">
              <div className="relative max-h-full max-w-[860px] overflow-hidden rounded-lg border border-line/8 bg-raised shadow-pop">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.pages[current]?.src}
                  alt={`Page ${current + 1}`}
                  className="block max-h-[calc(100dvh-100px)] w-auto"
                />
              </div>
            </div>
          )}
        </div>

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
            <Button size="sm" className="mt-3 w-full">
              <Plus /> Note at p.{current + 1}
            </Button>
            <div className="mt-5 border-t border-line/8 pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.1em] text-faint">Linked notes</p>
              <p className="text-[12px] text-faint">None yet.</p>
            </div>
          </aside>
        )}
      </div>

      {/* ── click zones (paged mode) ──────────────────────────── */}
      {mode === 'paged' && (
        <>
          <button
            onClick={() => goTo(current + (rtl ? 1 : -1))}
            className={cn(
              'absolute bottom-0 top-[52px] w-[22%] cursor-w-resize transition hover:bg-fg/[.03]',
              rtl ? 'right-0' : 'left-0',
            )}
            aria-label="Previous page"
          />
          <button
            onClick={() => goTo(current + (rtl ? -1 : 1))}
            className={cn(
              'absolute bottom-0 top-[52px] w-[22%] cursor-e-resize transition hover:bg-fg/[.03]',
              rtl ? 'left-0' : 'right-0',
            )}
            aria-label="Next page"
          />
        </>
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
