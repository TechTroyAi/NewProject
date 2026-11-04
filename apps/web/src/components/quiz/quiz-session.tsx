'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Flag,
  Keyboard,
  Lightbulb,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/primitives'
import { useHotkeys } from '@/lib/hotkeys'
import { RATING_LABELS } from '@/lib/fsrs'
import type { Card } from '@shelf/shared'

const TYPE_LABEL: Record<string, string> = {
  flashcard: 'Flashcard',
  mcq: 'Multiple choice',
  cloze: 'Cloze',
  tf: 'True / false',
  short: 'Short answer',
  clip: 'Clip',
  order: 'Ordering',
  match: 'Matching',
}

export function QuizSession({ cards }: { cards: Card[] }) {
  const router = useRouter()
  const [queue, setQueue] = React.useState(cards)
  const [index, setIndex] = React.useState(0)
  const [revealed, setRevealed] = React.useState(false)
  const [shortAnswer, setShortAnswer] = React.useState('')
  const [graded, setGraded] = React.useState<{ correct: boolean; feedback: string } | null>(null)
  const [selected, setSelected] = React.useState<number | null>(null)
  const [session, setSession] = React.useState({ again: 0, good: 0, hard: 0, easy: 0 })
  const [showKeys, setShowKeys] = React.useState(false)
  const [grading, setGrading] = React.useState(false)

  const card = queue[index]
  const total = cards.length
  const done = index >= queue.length

  /* ── rating ────────────────────────────────────────────────── */
  const rate = React.useCallback(
    async (rating: number) => {
      if (!card) return
      setSession((s) => ({ ...s, [rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy']: s[rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy'] + 1 }))

      // Optimistic: advance immediately, post in the background.
      const next = index + 1
      setIndex(next)
      setRevealed(false)
      setSelected(null)
      setGraded(null)
      setShortAnswer('')

      void fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, rating }),
      }).catch(() => {})

      if (rating === 1) {
        // Re-queue "Again" cards at the end of the session.
        setQueue((q) => [...q, card])
      }
    },
    [card, index],
  )

  useHotkeys(
    {
      ' ': () => {
        if (!revealed) setRevealed(true)
        else if (card?.type === 'mcq' && selected !== null) void rate(3)
      },
      '1': () => revealed && void rate(1),
      '2': () => revealed && void rate(2),
      '3': () => revealed && void rate(3),
      '4': () => revealed && void rate(4),
      f: () => setShowKeys((v) => !v),
      enter: () => setRevealed(true),
    },
    [revealed, card, selected, rate],
  )

  async function gradeShort() {
    if (!card || !shortAnswer.trim()) return
    setGrading(true)
    try {
      const res = await fetch('/api/ai/short-answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: card.question, reference: card.answer, answer: shortAnswer }),
      })
      const data = await res.json()
      setGraded(data.grade ?? { correct: false, feedback: 'Could not grade that one.' })
    } catch {
      setGraded({ correct: false, feedback: 'Could not reach the grader.' })
    } finally {
      setGrading(false)
    }
  }

  /* ── done ──────────────────────────────────────────────────── */
  if (done || !card) {
    const reviewed = total + session.again
    return (
      <div className="mx-auto grid min-h-full w-full max-w-lg place-items-center px-6 py-16">
        <div className="w-full text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-good/12 text-good">
            <Check className="size-5" />
          </div>
          <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Session complete</h1>
          <p className="mt-1 text-[13px] text-muted">{reviewed} cards reviewed</p>

          <div className="mt-6 grid grid-cols-4 gap-2">
            {[
              { k: 'Again', v: session.again, c: 'text-bad' },
              { k: 'Hard', v: session.hard, c: 'text-warn' },
              { k: 'Good', v: session.good, c: 'text-good' },
              { k: 'Easy', v: session.easy, c: 'text-accent' },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-line/8 bg-surface p-3">
                <p className={cn('text-[20px] font-semibold tabular-nums', s.c)}>{s.v}</p>
                <p className="mt-0.5 text-[11px] text-faint">{s.k}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => router.push('/app/quiz')}>
              Back to decks
            </Button>
            <Button onClick={() => router.push('/app')}>Dashboard</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-6">
      {/* ── header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button size="icon-sm" variant="ghost" onClick={() => router.push('/app/quiz')} aria-label="Exit">
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <Progress value={(index / total) * 100} />
        </div>
        <span className="shrink-0 text-[11.5px] tabular-nums text-faint">
          {index + 1} / {total}
        </span>
      </div>

      {/* ── card ───────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center py-8">
        <div className="w-full">
          <div className="mb-3 flex items-center gap-2">
            <Badge tone="accent">{TYPE_LABEL[card.type] ?? card.type}</Badge>
            {card.source_page !== null && (
              <Link
                href={`/app/read/${card.source_item}?p=${card.source_page}`}
                className="inline-flex items-center gap-1 text-[11px] text-faint transition hover:text-fg"
              >
                source p.{card.source_page + 1} →
              </Link>
            )}
            {card.spoiler_limit_page > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-good">
                <Lightbulb className="size-3" /> unlocked
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-line/10 bg-surface p-6 shadow-card">
            <p className="text-[17px] font-medium leading-relaxed tracking-[-.01em]">{card.question}</p>

            {/* MCQ */}
            {card.type === 'mcq' && card.options && (
              <div className="mt-5 space-y-2">
                {card.options.map((opt, i) => {
                  const isPicked = selected === i
                  const isCorrect = i === 0
                  return (
                    <button
                      key={i}
                      disabled={revealed}
                      onClick={() => setSelected(i)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition',
                        revealed && isCorrect && 'border-good/50 bg-good/10 text-good',
                        revealed && isPicked && !isCorrect && 'border-bad/50 bg-bad/10 text-bad',
                        !revealed && isPicked && 'border-accent/50 bg-accent/10',
                        !revealed && !isPicked && 'border-line/10 hover:border-line/20 hover:bg-raised/50',
                        revealed && !isCorrect && !isPicked && 'border-line/10 text-muted',
                      )}
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-md border border-line/15 text-[10.5px] font-bold">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                      {revealed && isCorrect && <Check className="ml-auto size-4" />}
                      {revealed && isPicked && !isCorrect && <X className="ml-auto size-4" />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Short answer */}
            {card.type === 'short' && (
              <div className="mt-5">
                <textarea
                  value={shortAnswer}
                  onChange={(e) => setShortAnswer(e.target.value)}
                  disabled={revealed}
                  rows={3}
                  placeholder="Answer in your own words…"
                  className="w-full resize-none rounded-xl border border-line/12 bg-raised/50 px-3 py-2.5 text-[13.5px] outline-none transition placeholder:text-faint focus:border-accent/60"
                />
                {!revealed && (
                  <Button size="sm" className="mt-2" onClick={gradeShort} disabled={grading || !shortAnswer.trim()}>
                    {grading ? 'Grading…' : 'Check answer'}
                  </Button>
                )}
              </div>
            )}

            {/* Reveal */}
            {revealed && card.type !== 'mcq' && (
              <div className="mt-5 rounded-xl border border-line/10 bg-raised/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.09em] text-faint">Answer</p>
                <p className="mt-1 text-[14px] leading-relaxed text-fg">{card.answer}</p>
                {graded && (
                  <div
                    className={cn(
                      'mt-3 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed',
                      graded.correct ? 'border-good/40 bg-good/10 text-good' : 'border-warn/40 bg-warn/10 text-warn',
                    )}
                  >
                    {graded.feedback}
                  </div>
                )}
                {card.explanation && (
                  <p className="mt-3 border-t border-line/8 pt-3 text-[12.5px] leading-relaxed text-muted">
                    {card.explanation}
                  </p>
                )}
              </div>
            )}

            {!revealed && card.type !== 'mcq' && card.type !== 'short' && (
              <p className="mt-6 text-[12px] text-faint">Press <span className="kbd">space</span> to reveal</p>
            )}
          </div>
        </div>
      </div>

      {/* ── grading bar ────────────────────────────────────────── */}
      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((r) => (
            <button
              key={r}
              onClick={() => void rate(r)}
              className={cn(
                'rounded-xl border border-line/10 bg-surface px-2 py-2.5 text-center transition hover:bg-raised',
                r === 1 && 'hover:border-bad/50',
                r === 2 && 'hover:border-warn/50',
                r === 3 && 'hover:border-good/50',
                r === 4 && 'hover:border-accent/50',
              )}
            >
              <span className="block text-[12.5px] font-medium">{RATING_LABELS[r].label}</span>
              <span className="mt-0.5 block text-[10.5px] text-faint">{RATING_LABELS[r].hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex justify-center">
          <Button onClick={() => setRevealed(true)}>
            {card.type === 'mcq' ? 'Reveal answer' : 'Show answer'}
          </Button>
        </div>
      )}

      {/* ── shortcut sheet ─────────────────────────────────────── */}
      {showKeys && (
        <div className="mt-4 rounded-xl border border-line/10 bg-surface p-4">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
            <Keyboard className="size-3.5 text-accent" /> Keyboard
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11.5px] text-muted">
            <span><span className="kbd">space</span> reveal</span>
            <span><span className="kbd">1</span>–<span className="kbd">4</span> rate</span>
            <span><span className="kbd">enter</span> reveal</span>
            <span><span className="kbd">F</span> this sheet</span>
          </div>
        </div>
      )}
    </div>
  )
}
