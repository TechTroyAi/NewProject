'use client'
import * as React from 'react'
import Link from 'next/link'
import { BookOpen, CornerDownLeft, FileText, Loader2, Paperclip, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/primitives'
import { useChatStore } from '@/lib/chat-store'

const STARTERS = [
  { icon: BookOpen, label: 'Summarise what I just read' },
  { icon: FileText, label: 'Find notes about this chapter' },
  { icon: Zap, label: 'Quiz me on my notes' },
]

/** The assistant's thread — the messages and the composer. */
export function AssistantChat({ className }: { className?: string }) {
  const { messages, busy, send } = useChatStore()
  const [input, setInput] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="animate-fade-up">
            <p className="text-[12.5px] leading-relaxed text-muted">
              I read your shelf the way you do — but only up to the pages you have actually read. Anything past your
              progress is filtered out server-side, so I can&apos;t spoil it even if asked.
            </p>
            <div className="mt-4 space-y-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => void send(s.label)}
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
                setInput('')
              }
            }}
            rows={2}
            placeholder="Ask about your shelf…"
            className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-fg outline-none placeholder:text-faint"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <Tooltip label="Attach a note, item or page">
              <button
                className="grid size-6 place-items-center rounded-lg text-faint transition hover:bg-surface hover:text-fg"
                aria-label="Attach a note, item or page"
              >
                <Paperclip className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Reasoning depth: fast / deep">
              <button
                className="grid size-6 place-items-center rounded-lg text-faint transition hover:bg-surface hover:text-fg"
                aria-label="Reasoning depth"
              >
                <Zap className="size-3.5" />
              </button>
            </Tooltip>
            <span className="flex-1" />
            <span className="text-[10.5px] text-faint">⏎ send</span>
            <button
              onClick={() => {
                void send(input)
                setInput('')
              }}
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
    </div>
  )
}

/** `**bold**`, `*italic*` and `` `code` `` — without pulling in a parser. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}
