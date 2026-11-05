'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Sparkles, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface GeneratedCard {
  type: string
  question: string
  answer: string
  options?: string[] | null
  explanation?: string | null
  sourcePage?: number | null
}

/**
 * Turn a note into flashcards.
 *
 * The model proposes; the user approves. Nothing reaches the deck
 * until the user picks the cards they want and saves them.
 */
export function QuizGenerator({
  noteId,
  noteTitle,
  itemId,
}: {
  noteId: string
  noteTitle: string
  itemId?: string | null
}) {
  const router = useRouter()
  const [phase, setPhase] = React.useState<'idle' | 'generating' | 'review' | 'saved'>('idle')
  const [cards, setCards] = React.useState<GeneratedCard[]>([])
  const [picked, setPicked] = React.useState<Set<number>>(new Set())
  const [busy, setBusy] = React.useState(false)

  async function generate() {
    setPhase('generating')
    setBusy(true)
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ noteId, n: 8 }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `generation failed (${res.status})`)
      const list: GeneratedCard[] = body?.cards ?? []
      if (!list.length) throw new Error('The model did not produce any usable cards.')
      setCards(list)
      setPicked(new Set(list.map((_, i) => i)))
      setPhase('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setPhase('idle')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const chosen = cards.filter((_, i) => picked.has(i))
    if (!chosen.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/quiz/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${noteTitle} · quiz`,
          noteId,
          itemId: itemId ?? null,
          cards: chosen,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `could not save the deck (${res.status})`)
      setPhase('saved')
      toast.success(`${chosen.length} card${chosen.length === 1 ? '' : 's'} added to your deck.`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'idle') {
    return (
      <button
        onClick={() => void generate()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line/12 bg-raised/60 px-2.5 py-1.5 text-[11.5px] text-muted transition hover:border-accent/30 hover:text-fg disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Target className="size-3 text-accent" />}
        Quiz this note
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-line/10 bg-surface/70 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-accent" />
        <p className="text-[12px] font-semibold">
          {phase === 'saved' ? 'Cards added' : `${cards.length} cards proposed`}
        </p>
        <span className="flex-1" />
        {phase === 'review' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(cards.map((_, i) => i)))}>
              All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
              None
            </Button>
          </>
        )}
      </div>

      {phase === 'review' && (
        <>
          <ul className="mt-2 space-y-1">
            {cards.map((c, i) => {
              const on = picked.has(i)
              return (
                <li key={i}>
                  <button
                    onClick={() =>
                      setPicked((s) => {
                        const next = new Set(s)
                        if (next.has(i)) next.delete(i)
                        else next.add(i)
                        return next
                      })
                    }
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition',
                      on ? 'border-accent/35 bg-accent/8' : 'border-line/8 hover:border-line/18',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition',
                        on ? 'border-accent bg-accent text-accent-fg' : 'border-line/20',
                      )}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] leading-snug">{c.question}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-faint">{c.answer}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-raised/70 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[.06em] text-faint">
                      {c.type}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-2.5 flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPhase('idle')}>
              Discard
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={busy || picked.size === 0}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Add {picked.size} card{picked.size === 1 ? '' : 's'}
            </Button>
          </div>
        </>
      )}

      {phase === 'saved' && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11.5px] text-muted">
            They are scheduled with FSRS and will appear as they come due.
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCards([])
              setPhase('idle')
            }}
          >
            <Trash2 /> Clear
          </Button>
        </div>
      )}
    </div>
  )
}
