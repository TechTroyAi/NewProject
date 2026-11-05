'use client'
import * as React from 'react'
import { BookOpen, FileText, PanelRightClose, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScopeStore } from '@/lib/scope-store'
import { AssistantChat } from './assistant-chat'

export function RightPanel() {
  const { scope, context, setScope, panelOpen, setPanelOpen } = useScopeStore()

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
          <span className="text-[11.5px] text-faint">No scope — answering across your whole shelf</span>
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

      <AssistantChat />
    </aside>
  )
}
