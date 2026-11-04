import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GraphView, GraphLegend } from '@/components/graph/graph-view'
import { getGraph } from '@/lib/data'
import type { NodeKind } from '@shelf/shared'

export const dynamic = 'force-dynamic'

const KINDS: NodeKind[] = ['note', 'series', 'item', 'wiki']

export default async function GraphPage() {
  const { nodes, edges } = await getGraph()
  const counts = KINDS.map((k) => ({ k, n: nodes.filter((x) => x.kind === k).length }))

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
      <div className="pb-4">
        <h1 className="text-[22px] font-semibold tracking-[-.02em]">Graph</h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Notes, series and chapters in one space. Hover a node to see its neighbourhood; click to open it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge graph</CardTitle>
          <span className="flex-1" />
          <GraphLegend kinds={KINDS} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid-paper">
            <GraphView nodes={nodes} edges={edges} height={560} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {counts.map((c) => (
          <span
            key={c.k}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line/8 bg-surface px-2 py-1 text-[11.5px] text-muted"
          >
            <Badge
              tone={
                c.k === 'note' ? 'note' : c.k === 'series' ? 'series' : c.k === 'wiki' ? 'wiki' : 'chapter'
              }
            >
              {c.k}
            </Badge>
            {c.n}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/8 bg-surface px-2 py-1 text-[11.5px] text-muted">
          <Badge tone="accent">ai suggested</Badge>
          {edges.filter((e) => e.kind === 'ai_suggested').length}
        </span>
      </div>
    </div>
  )
}
