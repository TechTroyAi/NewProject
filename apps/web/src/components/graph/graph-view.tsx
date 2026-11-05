'use client'
import * as React from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type ForceGraph2DType from 'react-force-graph-2d'
import type { GraphEdge, GraphNode, NodeKind } from '@shelf/shared'
import { cn } from '@/lib/utils'

/**
 * The graph.
 *
 * `react-force-graph-2d` draws on a canvas, so a vault with thousands
 * of notes still moves at 60fps — and it brings dragging, panning and
 * zooming with it, which the SVG version never had.
 *
 * It is loaded with `ssr: false` because the canvas and the force
 * simulation both need the browser.
 */
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false }) as typeof ForceGraph2DType

const KIND_COLOR: Record<NodeKind, string> = {
  note: 'rgb(var(--note))',
  series: 'rgb(var(--series))',
  item: 'rgb(var(--chapter))',
  chapter: 'rgb(var(--chapter))',
  wiki: 'rgb(var(--wiki))',
  image: 'rgb(var(--accent))',
  clip: 'rgb(var(--chapter))',
  card: 'rgb(var(--muted))',
}

const KIND_LABEL: Record<NodeKind, string> = {
  note: 'Note',
  series: 'Series',
  item: 'Item',
  chapter: 'Chapter',
  wiki: 'AI wiki',
  image: 'Image',
  clip: 'Clip',
  card: 'Card',
}

function hrefFor(node: GraphNode): string {
  if (node.kind === 'note' || node.kind === 'wiki') return `/app/notes/${node.id}`
  if (node.kind === 'series') return `/app/library/${node.id}`
  if (node.kind === 'item' || node.kind === 'chapter') return `/app/item/${node.id}`
  return '#'
}

interface GraphNodeShape {
  id: string
  label: string
  kind: NodeKind
  degree: number
}

interface GraphLinkShape {
  source: string
  target: string
  kind: string
}

export function GraphView({
  nodes,
  edges,
  height = 520,
  compact = false,
  focusId,
  onOpen,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  height?: number
  compact?: boolean
  focusId?: string | null
  /** Called with the node the user clicked. Defaults to navigating. */
  onOpen?: (node: GraphNode) => void
}) {
  const router = useRouter()
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 900, h: height })
  const [hover, setHover] = React.useState<string | null>(null)

  React.useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(320, r.width), h: height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [height])

  // The shape of the graph — not the array identity. A parent may hand
  // us a freshly built array on every render, and the simulation
  // mutates its data, so a new object every time would restart the
  // layout each frame.
  const graphSig = React.useMemo(
    () =>
      `${nodes.map((n) => n.id).join('|')}#${edges
        .map((e) => `${e.source}>${e.target}:${e.kind}`)
        .join('|')}`,
    [nodes, edges],
  )

  const nodeById = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const graphData = React.useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id))
    const shaped: GraphNodeShape[] = nodes.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      degree: n.degree,
    }))
    const links: GraphLinkShape[] = edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, kind: e.kind }))
    return { nodes: shaped, links }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphSig])

  const neighbours = React.useMemo(() => {
    if (!hover) return null
    const s = new Set<string>([hover])
    for (const e of edges) {
      if (e.source === hover) s.add(e.target)
      if (e.target === hover) s.add(e.source)
    }
    return s
  }, [hover, edges])

  const hovered = hover ? nodeById.get(hover) : null

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      <ForceGraph2D<GraphNodeShape, GraphLinkShape>
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={compact ? 4 : 6}
        nodeVal={(n) => 1 + Math.min(9, n.degree * 1.4)}
        nodeLabel={(n) => n.label}
        nodeColor={(n) => KIND_COLOR[n.kind] ?? 'rgb(var(--accent))'}
        linkColor={(l) => {
          const dim = neighbours ? !(neighbours.has(String(l.source)) && neighbours.has(String(l.target))) : false
          if (dim) return 'rgba(var(--fg), 0.05)'
          return l.kind === 'ai_suggested' ? 'rgb(var(--accent))' : 'rgba(var(--fg), 0.18)'
        }}
        linkWidth={(l) => (l.kind === 'ai_suggested' ? 1.4 : 1)}
        linkLineDash={(l) => (l.kind === 'ai_suggested' ? [4, 3] : null)}
        linkDirectionalArrowLength={0}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as unknown as GraphNodeShape & { x: number; y: number }
          const r = (compact ? 4.5 : 6) + Math.min(9, n.degree * 1.4)
          const dim = neighbours ? !neighbours.has(n.id) : false
          const isFocus = focusId === n.id

          if (isFocus) {
            ctx.beginPath()
            ctx.arc(n.x, n.y, r + 9, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(var(--accent), 0.16)'
            ctx.fill()
          }

          ctx.beginPath()
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
          ctx.fillStyle = KIND_COLOR[n.kind] ?? 'rgb(var(--accent))'
          ctx.globalAlpha = dim ? 0.2 : 0.92
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.lineWidth = 2 / globalScale
          ctx.strokeStyle = 'rgb(var(--bg))'
          ctx.stroke()

          if (compact) return
          // The label only appears when the graph is zoomed in enough
          // for it to be readable.
          const fontSize = 11 / globalScale
          if (fontSize < 4) return
          ctx.font = `500 ${fontSize}px system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = 'rgb(var(--muted))'
          ctx.globalAlpha = dim ? 0.25 : 1
          const label = n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label
          ctx.fillText(label, n.x, n.y + r + 3 / globalScale)
          ctx.globalAlpha = 1
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as unknown as GraphNodeShape & { x: number; y: number }
          const r = (compact ? 4.5 : 6) + Math.min(9, n.degree * 1.4)
          ctx.beginPath()
          ctx.arc(n.x, n.y, r + 2, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()
        }}
        onNodeHover={(node) => setHover(node ? (node as unknown as GraphNodeShape).id : null)}
        onNodeClick={(node) => {
          const n = node as unknown as GraphNodeShape
          const original = nodeById.get(n.id)
          if (!original) return
          if (onOpen) onOpen(original)
          else router.push(hrefFor(original))
        }}
        cooldownTicks={120}
        enableNodeDrag
        enablePanInteraction
        enableZoomInteraction
      />

      {/* hover card */}
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-line/12 bg-surface/95 px-3 py-2 shadow-pop backdrop-blur">
          <p className="text-[12.5px] font-semibold">{hovered.label}</p>
          <p className="mt-0.5 text-[11px] text-faint">
            {KIND_LABEL[hovered.kind]} · {hovered.degree} link{hovered.degree === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {!compact && (
        <p className="pointer-events-none absolute bottom-2 right-3 text-[10.5px] text-faint">
          drag to move · scroll to zoom
        </p>
      )}
    </div>
  )
}

export function GraphLegend({ kinds = ['note', 'series', 'item', 'wiki'] }: { kinds?: NodeKind[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="size-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
          {KIND_LABEL[k]}
        </span>
      ))}
    </div>
  )
}

export function GraphNodeLink({ node }: { node: GraphNode }) {
  return (
    <Link
      href={hrefFor(node)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-line/10 px-2 py-1 text-[12px] transition hover:border-line/20',
      )}
    >
      <span className="size-2 rounded-full" style={{ background: KIND_COLOR[node.kind] }} />
      {node.label}
    </Link>
  )
}
