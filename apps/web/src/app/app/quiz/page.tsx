import Link from 'next/link'
import { Layers, Play, Plus, Sparkles, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/dashboard/stat-tile'
import { getAllCards, getDecks, getNotes, getStats } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function QuizPage() {
  const [cards, decks, notes, stats] = await Promise.all([getAllCards(), getDecks(), getNotes(), getStats()])
  const now = new Date().toISOString()
  const due = cards.filter((c) => c.status === 'active' && c.due <= now)

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-3 pb-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-.02em]">Quiz</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            Cards are generated from your notes and scheduled with FSRS. A card only appears once you have read past
            the page it came from.
          </p>
        </div>
        <Link href="/app/quiz/session">
          <Button>
            <Play /> Start session{due.length ? ` · ${due.length}` : ''}
          </Button>
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Due now" value={due.length} unit="cards" icon={<Target />} tone="rgb(var(--accent))" />
        <StatTile label="Total cards" value={cards.length} unit="cards" icon={<Layers />} tone="rgb(var(--note))" />
        <StatTile
          label="Reviews today"
          value={stats.reviewsToday}
          unit="reviews"
          icon={<Sparkles />}
          tone="rgb(var(--good))"
        />
        <StatTile label="Decks" value={decks.length} unit="decks" icon={<Layers />} tone="rgb(var(--series))" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <Layers className="size-4 text-faint" />
            <CardTitle>Decks</CardTitle>
            <span className="flex-1" />
            <Link href="/app/notes">
              <Button size="sm" variant="secondary">
                <Plus /> New deck
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line/5">
              {decks.map((d) => {
                const deckCards = cards.filter((c) => c.deck_id === d.id)
                const deckDue = deckCards.filter((c) => c.due <= now && c.status === 'active')
                const note = notes.find((n) => n.id === d.note_id)
                return (
                  <li key={d.id}>
                    <Link
                      href={d.note_id ? `/app/notes/${d.note_id}` : '/app/quiz'}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/40"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
                        <Layers className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{d.title}</span>
                        <span className="block truncate text-[11.5px] text-faint">
                          {deckCards.length} cards
                          {note ? ` · from “${note.title}”` : ''}
                        </span>
                      </span>
                      {deckDue.length > 0 ? (
                        <Badge tone="accent">{deckDue.length} due</Badge>
                      ) : (
                        <Badge tone="good">clear</Badge>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Sparkles className="size-4 text-accent" />
            <CardTitle>Generate from a note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[12.5px] leading-relaxed text-muted">
              Pick a note and Shelf will write cards from your own wording, anchored to the pages you have read.
            </p>
            <ul className="mt-2 space-y-1.5">
              {notes.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/app/notes/${n.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line/8 bg-raised/40 px-3 py-2 text-[12.5px] transition hover:border-accent/30 hover:bg-raised"
                  >
                    <span className="min-w-0 truncate">{n.title}</span>
                    <span className="shrink-0 text-[11px] text-accent">Generate →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
