import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatTile } from '@/components/dashboard/stat-tile'
import { Heatmap } from '@/components/dashboard/heatmap'
import { getActivity, getStats } from '@/lib/data'
import { BookOpen, FileText, Flame, Target } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function StatsPage() {
  const [stats, activity] = await Promise.all([getStats(), getActivity()])

  const best = activity.reduce((a, d) => Math.max(a, d.pages + d.reviews), 0)
  const activeDays = activity.filter((d) => d.pages + d.reviews > 0).length

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6">
      <div className="pb-5">
        <h1 className="text-[22px] font-semibold tracking-[-.02em]">Stats</h1>
        <p className="mt-1 text-[12.5px] text-muted">Reading and review activity, rolled up daily.</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Pages read" value={stats.pagesRead.toLocaleString()} icon={<BookOpen />} tone="rgb(var(--series))" />
        <StatTile label="Reviews" value={stats.reviews.toLocaleString()} icon={<Target />} tone="rgb(var(--good))" />
        <StatTile label="Notes" value={stats.notes} icon={<FileText />} tone="rgb(var(--accent))" />
        <StatTile label="Active days" value={activeDays} unit={`of ${activity.length}`} icon={<Flame />} tone="rgb(var(--chapter))" />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <span className="flex-1" />
          <span className="text-[11.5px] text-faint">best day: {best}</span>
        </CardHeader>
        <CardContent>
          <Heatmap data={activity} />
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10.5px] text-faint">
            less
            {[0, 1, 2, 3, 4].map((l) => (
              <span
                key={l}
                className={`size-[10px] rounded-[2px] ${
                  l === 0
                    ? 'bg-line/8'
                    : l === 1
                      ? 'bg-accent/25'
                      : l === 2
                        ? 'bg-accent/45'
                        : l === 3
                          ? 'bg-accent/70'
                          : 'bg-accent'
                }`}
              />
            ))}
            more
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Items on shelf', value: stats.items },
              { label: 'Notes written', value: stats.notes },
              { label: 'Cards in rotation', value: stats.totalCards },
              { label: 'Due right now', value: stats.cardsDue },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-[12.5px] text-muted">{r.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, (r.value / Math.max(1, stats.items)) * 100)}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-[12.5px] tabular-nums">{r.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weak spots</CardTitle>
            <span className="flex-1" />
            <span className="text-[11.5px] text-faint">lowest accuracy · 30d</span>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line/5">
              {[
                { label: 'Fault models — omission vs crash-stop', acc: 58 },
                { label: 'The Smile as a device — panel budget', acc: 71 },
                { label: 'Visual hierarchy — the three levers', acc: 79 },
              ].map((w) => (
                <li key={w.label} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{w.label}</span>
                  <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full bg-warn"
                      style={{ width: `${w.acc}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right text-[11.5px] tabular-nums text-faint">{w.acc}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
