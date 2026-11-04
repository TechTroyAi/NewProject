import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FilePlus2,
  FileText,
  Network,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatTile } from '@/components/dashboard/stat-tile'
import { AiSuggestStrip, ContinueReading } from '@/components/dashboard/continue-reading'
import { RecentNotes } from '@/components/dashboard/recent-notes'
import { GraphPreview } from '@/components/dashboard/graph-preview'
import { AiPicks } from '@/components/dashboard/ai-picks'
import { WidgetErrorBoundary } from '@/components/shell/widget-error-boundary'
import {
  getContinueReading,
  getDueCards,
  getGraph,
  getNotes,
  getProfile,
  getSeriesList,
  getStats,
} from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [profile, cont, notes, graph, stats, cards, series] = await Promise.all([
    getProfile(),
    getContinueReading(6),
    getNotes(6),
    getGraph(),
    getStats(),
    getDueCards(1),
    getSeriesList(),
  ])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = profile?.display_name ?? 'there'

  const continueItems = cont.map(({ item, progress }) => ({
    id: item.id,
    title: item.title,
    page: progress!.current_page,
    pageCount: item.page_count,
    percent: progress!.percent,
    seriesTitle: series.find((s) => s.id === item.series_id)?.title ?? null,
    kind: series.find((s) => s.id === item.series_id)?.kind ?? 'manga',
  }))

  const aiPicks = [
    {
      id: 'p1',
      kind: 'wiki' as const,
      title: 'Wiki draft',
      body: '3 character pages ready from Blue Lock c.184–186 — citations included.',
      cta: 'Review draft',
    },
    {
      id: 'p2',
      kind: 'link' as const,
      title: 'Connection found',
      body: 'Your notes "Denji’s smile" and "Egoist awakening" describe the same device. Link them?',
      cta: 'Create link',
    },
    {
      id: 'p3',
      kind: 'recap' as const,
      title: 'Weekly recap',
      body: '47 notes, 12 chapters, 21-day streak. Draft recap for Sunday’s review.',
      cta: 'Add to daily note',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4 pb-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold tracking-[-.02em]">
            {greeting},{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(110deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
            >
              {name}
            </span>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-faint" />
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <span className="text-faint">·</span>
            <span>{stats.notesThisWeek} notes this week</span>
            <span className="text-faint">·</span>
            <span>{cards.length > 0 ? `${stats.cardsDue} cards due` : 'nothing due'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/notes/new">
            <Button variant="secondary" size="sm">
              <Plus /> New note
            </Button>
          </Link>
          <Link href="/app/library">
            <Button size="sm">
              <Upload /> Add to shelf
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Notes this week"
          value={stats.notesThisWeek}
          unit={`/ ${stats.notesGoal} goal`}
          delta={`↑ ${Math.abs(stats.noteDelta)}% vs last week`}
          icon={<FileText />}
          tone="linear-gradient(135deg, rgb(var(--accent)), rgb(var(--note)))"
          spark={[3, 5, 4, 7, 6, 9, 8]}
        />
        <StatTile
          label="Chapters read"
          value={stats.chaptersRead}
          unit="this month"
          delta="↑ 4 vs last month"
          icon={<BookOpen />}
          tone="linear-gradient(135deg, rgb(var(--series)), rgb(var(--chapter)))"
          spark={[2, 4, 3, 5, 4, 6, 5]}
        />
        <StatTile
          label="Pages read"
          value={stats.pagesRead.toLocaleString()}
          unit="pages"
          delta="↑ 12% vs last month"
          icon={<TrendingUp />}
          tone="linear-gradient(135deg, rgb(var(--wiki)), rgb(var(--accent)))"
          spark={[10, 14, 12, 18, 16, 22, 20]}
        />
        <StatTile
          label="Due for review"
          value={stats.cardsDue}
          unit={`of ${stats.totalCards} cards`}
          delta="11-day streak"
          icon={<Target />}
          tone="linear-gradient(135deg, rgb(var(--good)), rgb(var(--accent)))"
          spark={[4, 2, 6, 3, 5, 2, 4]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {/* Continue reading */}
          <Card>
            <CardHeader>
              <Badge tone="series">Reader</Badge>
              <CardTitle>Continue reading</CardTitle>
              <span className="flex-1" />
              <Link href="/app/library" className="inline-flex items-center gap-1 text-[11.5px] text-muted transition hover:text-fg">
                Library <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <WidgetErrorBoundary label="Continue reading">
                <ContinueReading items={continueItems} />
              </WidgetErrorBoundary>
            </CardContent>
            <AiSuggestStrip text="You’re 4 chapters behind on Blue Lock — your theory note predicted ch. 190. Catch up before the arc resolves?" />
          </Card>

          {/* Graph */}
          <Card>
            <CardHeader>
              <Badge tone="note">Graph</Badge>
              <CardTitle>Knowledge graph — notes × manga</CardTitle>
              <span className="flex-1" />
              <Link href="/app/graph" className="inline-flex items-center gap-1 text-[11.5px] text-muted transition hover:text-fg">
                Open <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <WidgetErrorBoundary label="Knowledge graph">
                <GraphPreview nodes={graph.nodes} edges={graph.edges} />
              </WidgetErrorBoundary>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Recent notes */}
          <Card>
            <CardHeader>
              <Badge tone="accent">Vault</Badge>
              <CardTitle>Recent notes</CardTitle>
              <span className="flex-1" />
              <Link href="/app/notes" className="inline-flex items-center gap-1 text-[11.5px] text-muted transition hover:text-fg">
                All <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <WidgetErrorBoundary label="Recent notes">
                <RecentNotes
                notes={notes.map((n) => ({
                  id: n.id,
                  title: n.title,
                  updated_at: n.updated_at,
                  is_ai_draft: n.is_ai_draft,
                  excerpt: n.body_md.replace(/[#>*_`\[\]]/g, '').replace(/\n+/g, ' ').slice(0, 90),
                  }))}
                />
              </WidgetErrorBoundary>
            </CardContent>
          </Card>

          {/* AI picks */}
          <Card>
            <CardHeader>
              <Badge tone="wiki">AI</Badge>
              <CardTitle>Assistant picks</CardTitle>
              <span className="flex-1" />
              <Sparkles className="size-3.5 text-accent" />
            </CardHeader>
            <CardContent className="p-0">
              <WidgetErrorBoundary label="Assistant picks">
                <AiPicks picks={aiPicks} />
              </WidgetErrorBoundary>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <FilePlus2 className="size-4 text-faint" />
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { href: '/app/read/i-bl-184', label: 'Resume reader', icon: BookOpen },
                { href: '/app/notes/new', label: 'Daily note', icon: FileText },
                { href: '/app/quiz/session', label: 'Review cards', icon: Target },
                { href: '/app/graph', label: 'Explore graph', icon: Network },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-2 rounded-xl border border-line/8 bg-raised/40 px-3 py-2.5 text-[12px] transition hover:border-line/18 hover:bg-raised"
                >
                  <a.icon className="size-3.5 shrink-0 text-accent" />
                  {a.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
