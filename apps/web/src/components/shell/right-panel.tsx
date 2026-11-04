'use client'
import * as React from 'react'
import Link from 'next/link'
import {
  BookOpen,
  CornerDownLeft,
  FileText,
  Loader2,
  Paperclip,
  PanelRightClose,
  Sparkles,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScopeStore } from '@/lib/scope-store'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/primitives'

interface Source {
  n: number
  label: string
  href: string
  detail: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  pending?: boolean
}

const STARTERS = [
  { icon: BookOpen, label: 'Summarise what I just read' },
  { icon: FileText, label: 'Find notes about this chapter' },
  { icon: Zap, label: 'Quiz me on my notes' },
]

export function RightPanel() {
  const { scope, context, setScope, panelOpen, setPanelOpen } = useScopeStore()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  if (!panelOpen) {
    return (
      <button
        onClick={() => setPanelOpen(true)}
        className="fixed right-4 top-4 z-40 hidden items-center gap-2 rounded-full border border-line/12 bg-surface px-3 py-2 text-[12px] shadow-pop transition hover:scale-[1.02] lg:flex"
      >
        <Sparkles className="size-3.5 text-accent" />
        Assistant
      </button>
    )
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return
    setInput('')
    setBusy(true)

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: question }
    const botMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, userMsg, botMsg])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, scope }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ?? `assistant returned ${res.status}`)
      }
      if (!res.body) throw new Error('no stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const handle = (line: string) => {
        if (!line.startsWith('data: ')) return
        try {
          const evt = JSON.parse(line.slice(6))
          if (evt.type === 'sources') {
            setMessages((m) =>
              m.map((x) => (x.id === botMsg.id ? { ...x, sources: evt.sources } : x)),
            )
          } else if (evt.type === 'text') {
            setMessages((m) =>
              m.map((x) => (x.id === botMsg.id ? { ...x, content: x.content + evt.text } : x)),
            )
          }
        } catch {
          /* ignore malformed frame */
        }
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) handle(line)
      }
      // The last frame may not have been newline-terminated.
      buffer += decoder.decode()
      if (buffer.trim()) handle(buffer.trim())
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setMessages((m) =>
        m.map((x) =>
          x.id === botMsg.id
            ? {
                ...x,
                content: x.content
                  ? `${x.content}\n\n_Something went wrong: ${detail}_`
                  : `Something went wrong reaching the assistant: ${detail}`,
              }
            : x,
        ),
      )
    } finally {
      setBusy(false)
      setMessages((m) => m.map((x) => (x.id === botMsg.id ? { ...x, pending: false } : x)))
    }
  }

  return (
    <aside className="hidden w-[336px] shrink-0 flex-col border-l border-line/8 bg-surface/30 lg:flex">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-line/8 px-4 py-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[10px] text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight">Assistant</p>
          <p className="flex items-center gap-1.5 text-[10.5px] leading-tight text-faint">
            <span className="size-1.5 rounded-full bg-good shadow-[0_0_6px_rgb(var(--good))]" />
            spoiler-guarded · vault-aware
          </p>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg"
          aria-label="Close assistant"
        >
          <PanelRightClose className="size-4" />
        </button>
      </div>

      {/* Context chips */}
      <div className="flex flex-wrap gap-1.5 border-b border-line/8 px-4 py-2.5">
        {context.length === 0 ? (
          <span className="text-[11.5px] text-faint">
            No scope — answering across your whole shelf
          </span>
        ) : (
          context.map((c, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px]',
                c.kind === 'note'
                  ? 'border-accent/30 bg-accent/12 text-accent'
                  : c.kind === 'item'
                    ? 'border-series/30 bg-series/12 text-series'
                    : 'border-line/12 bg-raised text-muted',
              )}
            >
              {c.kind === 'note' ? <FileText className="size-3" /> : <BookOpen className="size-3" />}
              {c.label}
            </span>
          ))
        )}
        {scope.mode !== 'vault' && (
          <button
            onClick={() => setScope({ mode: 'vault' })}
            className="rounded-lg border border-line/12 px-1.5 py-0.5 text-[11px] text-faint transition hover:text-fg"
          >
            clear scope
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="animate-fade-up">
            <p className="text-[12.5px] leading-relaxed text-muted">
              I read your shelf the way you do — but only up to the pages you have actually read. Anything past
              your progress is filtered out server-side, so I can&apos;t spoil it even if asked.
            </p>
            <div className="mt-4 space-y-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.label)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-line/8 bg-raised/40 px-3 py-2.5 text-left text-[12.5px] text-muted transition hover:border-accent/30 hover:bg-accent/8 hover:text-fg"
                >
                  <s.icon className="size-3.5 shrink-0 text-accent" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/14 px-3.5 py-2.5 text-[13px] leading-relaxed text-fg">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <span
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
              >
                <Sparkles className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                {m.pending && !m.content ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <Loader2 className="size-3.5 animate-spin text-faint" />
                    <span className="text-[12px] text-faint">reading your shelf…</span>
                  </div>
                ) : (
                  <div className="text-[13px] leading-relaxed text-fg/90 [&_code]:rounded [&_code]:bg-raised [&_code]:px-1 [&_code]:font-mono [&_code]:text-[11.5px] [&_em]:italic [&_strong]:font-semibold [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-4">
                    {m.content.split('\n').map((line, i) => (
                      <p key={i} className="mb-1.5 last:mb-0">
                        {renderInline(line)}
                      </p>
                    ))}
                  </div>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.sources.map((s) => (
                      <Link
                        key={s.n}
                        href={s.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line/10 bg-raised/70 px-1.5 py-0.5 text-[11px] text-muted transition hover:border-accent/35 hover:text-fg"
                      >
                        <span className="grid size-3.5 place-items-center rounded bg-accent/20 text-[9px] font-bold text-accent">
                          {s.n}
                        </span>
                        <span className="max-w-[150px] truncate">{s.label}</span>
                        <span className="text-faint">{s.detail}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line/8 p-3">
        <div className="rounded-2xl border border-line/10 bg-raised/50 p-2.5 transition focus-within:border-accent/50 focus-within:bg-raised">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={2}
            placeholder="Ask about your shelf…"
            className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-fg outline-none placeholder:text-faint"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <Tooltip label="Attach a note, item or page">
              <button className="grid size-6 place-items-center rounded-lg text-faint transition hover:bg-surface hover:text-fg">
                <Paperclip className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Reasoning depth: fast / deep">
              <button className="grid size-6 place-items-center rounded-lg text-faint transition hover:bg-surface hover:text-fg">
                <Zap className="size-3.5" />
              </button>
            </Tooltip>
            <span className="flex-1" />
            <span className="text-[10.5px] text-faint">⏎ send</span>
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              className="grid size-7 place-items-center rounded-xl text-white transition disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
              aria-label="Send"
            >
              <CornerDownLeft className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

/** Minimal inline markdown: **bold**, *italic*, `code`. */
function renderInline(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}
