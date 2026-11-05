'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { BookOpen, FileText, CornerDownLeft, Search, Sparkles, Target, Network } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Hit {
  id: string
  kind: 'note' | 'item' | 'page' | 'card'
  title: string
  snippet: string
  href: string
  meta?: string
}

interface Command {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
  group: string
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [hits, setHits] = React.useState<Hit[]>([])
  const [cursor, setCursor] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  const commands: Command[] = React.useMemo(
    () => [
      {
        id: 'new-note',
        label: 'New note',
        hint: 'N',
        icon: <FileText className="size-3.5" />,
        group: 'Actions',
        run: () => router.push('/app/notes/new'),
      },
      {
        id: 'quiz',
        label: 'Start a quiz session',
        hint: 'Q',
        icon: <Target className="size-3.5" />,
        group: 'Actions',
        run: () => router.push('/app/quiz/session'),
      },
      {
        id: 'graph',
        label: 'Open graph view',
        hint: 'G',
        icon: <Network className="size-3.5" />,
        group: 'Actions',
        run: () => router.push('/app/graph'),
      },
      {
        id: 'ask-ai',
        label: 'Ask AI: “summarise today’s notes”',
        icon: <Sparkles className="size-3.5" />,
        group: 'AI',
        run: () => {
          router.push('/app')
          setTimeout(() => window.dispatchEvent(new CustomEvent('shelf:ask', { detail: 'summarise today’s notes' })), 300)
        },
      },
    ],
    [router],
  )

  const filteredCommands = React.useMemo(() => {
    const q = query.replace(/^>\s*/, '').toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  React.useEffect(() => {
    if (!open) {
      setQuery('')
      setHits([])
      setCursor(0)
      return
    }
    const q = query.trim()
    if (!q || q.startsWith('>')) {
      setHits([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=12`)
        const data = await res.json()
        if (!cancelled) setHits(data.hits ?? [])
      } catch {
        if (!cancelled) setHits([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 140)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, open])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  React.useEffect(() => {
    if (!open) return
    const el = document.getElementById('palette-input')
    el?.focus()
  }, [open])

  const total = filteredCommands.length + hits.length

  // The list can shrink under the cursor (the search returns fewer
  // hits), which would leave Enter pointing at nothing.
  React.useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, total - 1)))
  }, [total])

  // Keep the highlighted row in sight — with a dozen results the
  // cursor can move past the bottom of the list.
  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [cursor, hits, filteredCommands])

  function go(href: string) {
    router.push(href)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (c + 1) % Math.max(1, total))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (c - 1 + total) % Math.max(1, total))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (cursor < filteredCommands.length) {
        filteredCommands[cursor].run()
        onClose()
      } else {
        const hit = hits[cursor - filteredCommands.length]
        if (hit) go(hit.href)
      }
    }
  }

  if (!open) return null

  let index = -1

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-[620px] animate-scale-in overflow-hidden rounded-2xl border border-line/12 bg-surface shadow-pop"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-line/8 px-4 py-3">
          <Search className="size-4 shrink-0 text-faint" />
          <input
            id="palette-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            placeholder="Search everything…  (  > for commands  )"
            className="flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
          />
          {loading && <span className="size-1.5 animate-pulse rounded-full bg-accent" />}
        </div>

        <div ref={listRef} className="max-h-[54vh] overflow-y-auto p-2">
          {filteredCommands.length > 0 && (
            <>
              <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.1em] text-faint">
                Commands
              </div>
              {filteredCommands.map((c) => {
                index++
                const active = index === cursor
                return (
                  <button
                    key={c.id}
                    data-active={active ? 'true' : undefined}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => {
                      c.run()
                      onClose()
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition',
                      active ? 'bg-accent/12 text-fg' : 'text-muted hover:bg-raised/60',
                    )}
                  >
                    <span className="text-faint">{c.icon}</span>
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && <span className="kbd">{c.hint}</span>}
                  </button>
                )
              })}
            </>
          )}

          {hits.length > 0 && (
            <>
              <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.1em] text-faint">
                Results
              </div>
              {hits.map((h) => {
                index++
                const active = index === cursor
                return (
                  <button
                    key={`${h.kind}-${h.id}`}
                    data-active={active ? 'true' : undefined}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(h.href)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition',
                      active ? 'bg-accent/12' : 'hover:bg-raised/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg',
                        h.kind === 'note' ? 'bg-accent/15 text-accent' : 'bg-series/15 text-series',
                      )}
                    >
                      {h.kind === 'note' ? <FileText className="size-3.5" /> : <BookOpen className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{h.title}</span>
                      {h.snippet && (
                        <span className="mt-0.5 line-clamp-1 block text-[11.5px] text-faint">{h.snippet}</span>
                      )}
                    </span>
                    {h.meta && <span className="mt-0.5 shrink-0 text-[11px] text-faint">{h.meta}</span>}
                    {active && <CornerDownLeft className="mt-1 size-3 shrink-0 text-faint" />}
                  </button>
                )
              })}
            </>
          )}

          {total === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-[13px] font-medium">No matches</p>
              <p className="mt-1 text-[12px] text-faint">Try a title, a phrase from inside a file, or a command.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line/8 px-4 py-2 text-[10.5px] text-faint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="flex-1" />
          <span>Hybrid search · keyword + semantic</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
