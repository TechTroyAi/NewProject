'use client'
import * as React from 'react'
import Link from 'next/link'
import { Maximize2 } from 'lucide-react'
import type { GraphEdge, GraphNode } from '@shelf/shared'
import { GraphView } from '@/components/graph/graph-view'

export function GraphPreview({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  // Memoised so the mini-graph keeps its layout when the dashboard
  // re-renders — a new array would restart the simulation.
  const previewNodes = React.useMemo(() => nodes.slice(0, 40), [nodes])
  return (
    <div className="relative">
      <GraphView nodes={previewNodes} edges={edges} height={230} compact />
      <Link
        href="/app/graph"
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-line/12 bg-surface/90 px-2 py-1 text-[11px] text-muted backdrop-blur transition hover:text-fg"
      >
        <Maximize2 className="size-3" />
        Expand
      </Link>
    </div>
  )
}
