'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { renderMarkdown } from '@/lib/markdown'
import { clearDraft, loadDraft, saveDraft } from '@/lib/drafts'

/* ══════════════════════════════════════════════════════════════ */

export interface NoteTarget {
  id: string
  title: string
  kind: 'note' | 'item' | 'clip'
  /** What actually goes between the brackets — `clip:<id>` for clips. */
  linkText?: string
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
  mentions = [],
  onSaved,
}: {
  note: EditorNote
  targets: NoteTarget[]
  backlinks?: { id: string; title: string }[]
  /** Notes that mention this one without linking to it. */
  mentions?: { id: string; title: string; excerpt: string }[]
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
  /** The server's copy, when somebody else edited the note first. */
  const [conflict, setConflict] = React.useState<EditorNote | null>(null)
  const [mergeOpen, setMergeOpen] = React.useState(false)
  const [restored, setRestored] = React.useState(false)

  /* ── resolve wikilinks for the preview ─────────────────────── */
  const resolved: ResolvedLink[] = React.useMemo(
    () =>
      resolveWikilinks(body, {
        notes: targets.filter((t) => t.kind === 'note').map((t) => ({ id: t.id, title: t.title })),
        items: targets
          .filter((t) => t.kind === 'item')
          .map((t) => ({ id: t.id, title: t.title, seriesTitle: t.seriesTitle, chapter: t.chapter })),
        clips: targets
          .filter((t) => t.kind === 'clip')
          .map((t) => ({ id: t.id, label: t.title })),
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
  // The version of the note this editor is editing. Sent with every
  // save so the server can tell us that somebody else got there
  // first instead of silently overwriting them.
  const baseVersion = React.useRef(note.updated_at ?? null)
  const saving = React.useRef(false)

  const persist = React.useCallback(
    async (opts: { force?: boolean; bodyOverride?: string; titleOverride?: string } = {}) => {
      const nextBody = opts.bodyOverride ?? body
      const nextTitle = opts.titleOverride ?? title
      saving.current = true
      setStatus('saving')
      try {
        // A note that has never been saved has the placeholder id
        // "new"; it has to be created with POST, and cannot be
        // PATCHed (there is no uuid to address it by yet).
        const isNew = note.id === 'new'
        const res = await fetch(isNew ? '/api/notes' : `/api/notes/${note.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: nextTitle.trim() || 'Untitled',
            body_md: nextBody,
            item_id: note.item_id,
            page_ref: note.page_ref,
            base_updated_at: opts.force || isNew ? null : baseVersion.current,
          }),
        })
        if (res.status === 409) {
          const data = await res.json().catch(() => null)
          setConflict(data?.note ?? null)
          setStatus('idle')
          return
        }
        if (!res.ok) throw new Error('save failed')
        const data = await res.json()
        baseVersion.current = data.note?.updated_at ?? baseVersion.current
        onSaved?.({
          ...note,
          id: data.note?.id ?? note.id,
          title: data.note?.title ?? nextTitle,
          body_md: nextBody,
          updated_at: data.note?.updated_at,
        })
        setConflict(null)
        setStatus('saved')
        void clearDraft(note.id)
        if (isNew && data.note?.id) {
          // The note now has a real id — move to its permanent URL
          // and drop the placeholder draft.
          void clearDraft('new')
          router.replace(`/app/notes/${data.note.id}`)
        }
      } catch {
        setStatus('offline')
      } finally {
        saving.current = false
      }
    },
    [body, title, note, onSaved, router],
  )

  React.useEffect(() => {
    if (!dirty || conflict) return
    const t = setTimeout(() => {
      void persist()
    }, 800)
    return () => clearTimeout(t)
  }, [body, title, dirty, conflict, persist])

  /* ── local draft (IndexedDB) ───────────────────────────────── */
  // Restore the last local working copy when it is newer than the
  // server's version — the user closed the tab before the save landed.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const draft = await loadDraft(note.id)
      if (cancelled || !draft) return
      const serverAt = note.updated_at ? Date.parse(note.updated_at) : 0
      if (draft.savedAt <= serverAt) {
        void clearDraft(note.id)
        return
      }
      if (draft.body_md !== note.body_md || draft.title !== note.title) {
        setBody(draft.body_md)
        setTitle(draft.title)
        setRestored(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [note.id, note.body_md, note.title, note.updated_at])

  // Keep a copy locally every second while there is unsaved work.
  React.useEffect(() => {
    if (!dirty) return
    const t = setInterval(() => {
      void saveDraft({
        noteId: note.id,
        title,
        body_md: body,
        savedAt: Date.now(),
      })
    }, 1000)
    return () => clearInterval(t)
  }, [dirty, note.id, title, body])

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
    const link = t.linkText ?? t.title
    const next = `${before}[[${link}]]${after}`
    setBody(next)
    setSuggest(null)
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (!ta) return
      const caret = before.length + link.length + 4
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
          {restored && (
            <span
              className="rounded-md bg-accent/12 px-1.5 py-0.5 text-[10.5px] font-medium text-accent"
              title="An unsaved local draft was restored."
            >
              local draft restored
            </span>
          )}
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

      {/* ── conflict dialog ───────────────────────────────────── */}
      {conflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit conflict"
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg animate-scale-in rounded-2xl border border-line/12 bg-surface p-5 shadow-pop">
            <h2 className="text-[15px] font-semibold tracking-[-.01em]">This note changed elsewhere</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Somebody edited <span className="text-fg">{conflict.title}</span> while you were working on
              it. Nothing has been overwritten — choose which version to keep.
            </p>

            {mergeOpen ? (
              <div className="mt-4">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
                  Merge
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="md-source h-48 w-full rounded-xl border border-line/10 bg-raised/40 p-3 text-[13px]"
                />
                <p className="mt-2 text-[11.5px] text-faint">
                  The other version reads:
                  <span className="mt-1 block rounded-lg bg-raised/40 p-2 font-mono text-[11px] text-muted">
                    {conflict.body_md.slice(0, 400)}
                    {conflict.body_md.length > 400 ? '…' : ''}
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Button
                  variant="default"
                  onClick={() => {
                    setConflict(null)
                    void persist({ force: true })
                  }}
                >
                  Keep mine
                </Button>
                <Button
                  onClick={() => {
                    setTitle(conflict.title)
                    setBody(conflict.body_md)
                    baseVersion.current = conflict.updated_at ?? null
                    onSaved?.({ ...note, title: conflict.title, body_md: conflict.body_md, updated_at: conflict.updated_at })
                    setConflict(null)
                    setStatus('saved')
                  }}
                >
                  Keep theirs
                </Button>
                <Button onClick={() => setMergeOpen(true)}>Merge</Button>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {mergeOpen ? (
                <>
                  <Button variant="ghost" onClick={() => setMergeOpen(false)}>
                    Back
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => {
                      setMergeOpen(false)
                      setConflict(null)
                      void persist({ force: true })
                    }}
                  >
                    Save merged version
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setConflict(null)}>
                  Decide later
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── unlinked mentions ─────────────────────────────────── */}
      {mentions.length > 0 && (
        <div className="border-t border-line/8 bg-surface/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
              <Sparkles className="size-3" />
              Mentioned, not linked
            </span>
            {mentions.map((m) => (
              <Link
                key={m.id}
                href={`/app/notes/${m.id}`}
                title={m.excerpt}
                className="rounded-lg border border-dashed border-wiki/30 bg-wiki/6 px-2 py-0.5 text-[11.5px] text-muted transition hover:border-wiki/50 hover:text-fg"
              >
                {m.title}
              </Link>
            ))}
          </div>
        </div>
      )}

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
