'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { marked } from 'marked'
import {
  ArrowLeft,
  Check,
  CloudOff,
  Eye,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Sparkles,
  Target,
} from 'lucide-react'
import { cn, relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/primitives'
import { resolveWikilinks, type ResolvedLink } from '@/lib/wikilinks'

/* ══════════════════════════════════════════════════════════════
   Markdown rendering with wikilinks.

   Wikilinks are substituted with opaque placeholders *before*
   marked runs, then swapped for anchors afterwards. That keeps
   marked's own escaping intact and stops us from injecting raw
   HTML into the pipeline. Fenced code blocks are left untouched.
   ══════════════════════════════════════════════════════════════ */

interface WikiToken {
  type: 'wikilink'
  raw: string
  target: string
  anchor: string | null
  alias: string | null
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const WIKI_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g

function renderMarkdown(body: string, resolvedMap: Map<string, ResolvedLink>): string {
  const anchors: string[] = []
  const lines = body.split('\n')
  const prepared: string[] = []
  let inCode = false

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode
      prepared.push(line)
      continue
    }
    if (inCode) {
      prepared.push(line)
      continue
    }
    prepared.push(
      line.replace(WIKI_RE, (raw) => {
        const hit = resolvedMap.get(raw)
        const label = escapeHtml(hit?.label ?? raw)
        const kind = hit?.kind ?? 'note'
        const resolved = hit?.resolved ?? false
        const href = escapeHtml(hit?.href ?? '#')
        const idx = anchors.length
        anchors.push(
          `<a href="${href}" class="wikilink" data-resolved="${resolved}" data-target="${kind}">${label}</a>`,
        )
        return `zWL${idx}zWL`
      }),
    )
  }

  let html = marked.parse(prepared.join('\n'), { async: false }) as string
  html = html.replace(/zWL(\d+)zWL/g, (_, n: string) => anchors[Number(n)] ?? '')
  return html
}

/* ══════════════════════════════════════════════════════════════ */

export interface NoteTarget {
  id: string
  title: string
  kind: 'note' | 'item'
  subtitle?: string | null
  /** For items: the parent series title, so [[Blue Lock]] resolves. */
  seriesTitle?: string | null
  /** For items: chapter number, so [[Blue Lock#Ch184]] picks the right one. */
  chapter?: number | null
}

export interface EditorNote {
  id: string
  title: string
  body_md: string
  item_id?: string | null
  page_ref?: number | null
  is_ai_draft?: boolean
  updated_at?: string
}

export function NoteEditor({
  note,
  targets,
  backlinks = [],
  onSaved,
}: {
  note: EditorNote
  targets: NoteTarget[]
  backlinks?: { id: string; title: string }[]
  onSaved?: (n: EditorNote) => void
}) {
  const router = useRouter()
  const [title, setTitle] = React.useState(note.title)
  const [body, setBody] = React.useState(note.body_md)
  const [view, setView] = React.useState<'write' | 'split' | 'read'>('split')
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'saved' | 'offline'>('idle')
  const [suggest, setSuggest] = React.useState<{ index: number; start: number } | null>(null)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const [cursor, setCursor] = React.useState(0)

  /* ── resolve wikilinks for the preview ─────────────────────── */
  const resolved: ResolvedLink[] = React.useMemo(
    () =>
      resolveWikilinks(body, {
        notes: targets.filter((t) => t.kind === 'note').map((t) => ({ id: t.id, title: t.title })),
        items: targets
          .filter((t) => t.kind === 'item')
          .map((t) => ({ id: t.id, title: t.title, seriesTitle: t.seriesTitle, chapter: t.chapter })),
      }),
    [body, targets],
  )

  const resolvedByRaw = React.useMemo(() => {
    const map = new Map<string, ResolvedLink>()
    for (const l of resolved) map.set(l.raw, l)
    return map
  }, [resolved])

  const html = React.useMemo(() => renderMarkdown(body, resolvedByRaw), [body, resolvedByRaw])

  /* ── autosave ──────────────────────────────────────────────── */
  const dirty = title !== note.title || body !== note.body_md

  React.useEffect(() => {
    if (!dirty) return
    setStatus('saving')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, body_md: body, item_id: note.item_id, page_ref: note.page_ref }),
        })
        if (!res.ok) throw new Error('save failed')
        const data = await res.json()
        onSaved?.({ ...note, title, body_md: body, updated_at: data.note?.updated_at })
        setStatus('saved')
      } catch {
        setStatus('offline')
      }
    }, 800)
    return () => clearTimeout(t)
  }, [body, title, dirty, note, onSaved])

  /* ── wikilink autocomplete ─────────────────────────────────── */
  const suggestions = React.useMemo(() => {
    if (!suggest) return []
    const query = body.slice(suggest.start, cursor).toLowerCase()
    return targets
      .filter((t) => t.title.toLowerCase().includes(query))
      .slice(0, 6)
  }, [suggest, body, cursor, targets])

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    const pos = e.target.selectionStart
    setBody(value)
    setCursor(pos)

    const before = value.slice(0, pos)
    const open = before.lastIndexOf('[[')
    const close = before.lastIndexOf(']]')
    if (open > close && open !== -1) {
      setSuggest({ index: open, start: open })
    } else {
      setSuggest(null)
    }
  }

  function insertSuggestion(t: NoteTarget) {
    if (!suggest) return
    const before = body.slice(0, suggest.index)
    const after = body.slice(cursor)
    const next = `${before}[[${t.title}]]${after}`
    setBody(next)
    setSuggest(null)
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (!ta) return
      const caret = before.length + t.title.length + 4
      ta.focus()
      ta.setSelectionRange(caret, caret)
      setCursor(caret)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggest && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggest((s) => (s ? { ...s, index: s.index } : s))
        setSuggestionCursor((c) => (c + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggestionCursor((c) => (c - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertSuggestion(suggestions[Math.min(suggestionCursor, suggestions.length - 1)])
        return
      }
      if (e.key === 'Escape') {
        setSuggest(null)
        return
      }
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const next = body.slice(0, start) + '  ' + body.slice(ta.selectionEnd)
      setBody(next)
      requestAnimationFrame(() => ta.setSelectionRange(start + 2, start + 2))
    }
  }

  const [suggestionCursor, setSuggestionCursor] = React.useState(0)
  React.useEffect(() => setSuggestionCursor(0), [suggest])

  return (
    <div className="flex h-full flex-col">
      {/* ── toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line/8 px-4 py-2">
        <Button size="icon-sm" variant="ghost" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft />
        </Button>
        <FileText className="size-4 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {title || 'Untitled'}
        </span>
        {note.is_ai_draft && (
          <Badge tone="wiki">
            <Sparkles className="size-2.5" /> AI draft
          </Badge>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] text-faint">
          {status === 'saving' && (
            <>
              <Loader2 className="size-3 animate-spin" /> Saving…
            </>
          )}
          {status === 'saved' && (
            <>
              <Check className="size-3 text-good" /> Saved
            </>
          )}
          {status === 'offline' && (
            <>
              <CloudOff className="size-3 text-warn" /> Offline — draft kept locally
            </>
          )}
          {status === 'idle' && note.updated_at && <>Edited {relativeTime(note.updated_at)}</>}
        </span>
        <div className="flex items-center gap-0.5 rounded-lg bg-raised/60 p-0.5">
          {(['write', 'split', 'read'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-2 py-1 text-[11.5px] font-medium capitalize transition',
                view === v ? 'bg-surface text-fg shadow-sm' : 'text-faint hover:text-fg',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── editor ──────────────────────────────────────────── */}
        {(view === 'write' || view === 'split') && (
          <div className={cn('relative min-w-0 flex-1', view === 'split' ? 'border-r border-line/8' : '')}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="w-full bg-transparent px-6 pb-2 pt-5 text-[22px] font-semibold tracking-[-.02em] outline-none placeholder:text-faint"
            />
            <div className="relative px-6 pb-6">
              <textarea
                ref={taRef}
                value={body}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
                placeholder={'Start writing…\n\nLink to a page with [[Blue Lock#Ch184 p12]]'}
                spellCheck={false}
                className="md-source min-h-[52vh]"
              />

              {/* wikilink autocomplete */}
              {suggest && suggestions.length > 0 && (
                <div className="absolute left-6 top-[168px] z-30 w-[300px] animate-scale-in overflow-hidden rounded-xl border border-line/12 bg-surface p-1 shadow-pop">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[.09em] text-faint">
                    Link to
                  </div>
                  {suggestions.map((t, i) => (
                    <button
                      key={t.id}
                      onMouseEnter={() => setSuggestionCursor(i)}
                      onClick={() => insertSuggestion(t)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition',
                        i === suggestionCursor ? 'bg-accent/12' : 'hover:bg-raised/60',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-md',
                          t.kind === 'note' ? 'bg-accent/12 text-accent' : 'bg-series/12 text-series',
                        )}
                      >
                        {t.kind === 'note' ? <FileText className="size-3" /> : <Target className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {t.subtitle && <span className="shrink-0 text-[10.5px] text-faint">{t.subtitle}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── preview ─────────────────────────────────────────── */}
        {view !== 'write' && (
          <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
            {view === 'read' && (
              <h1 className="mb-4 text-[26px] font-semibold tracking-[-.02em]">{title}</h1>
            )}
            <div className="prose-shelf" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>

      {/* ── backlinks ─────────────────────────────────────────── */}
      {backlinks.length > 0 && (
        <div className="border-t border-line/8 bg-surface/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
              <Link2 className="size-3" />
              Linked from
            </span>
            {backlinks.map((b) => (
              <Link
                key={b.id}
                href={`/app/notes/${b.id}`}
                className="rounded-lg border border-line/10 bg-raised/60 px-2 py-0.5 text-[11.5px] text-muted transition hover:border-accent/30 hover:text-fg"
              >
                {b.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
