'use client'
import * as React from 'react'
import Link from 'next/link'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
} from 'd3-force'
import type { GraphEdge, GraphNode, NodeKind } from '@shelf/shared'
import { cn } from '@/lib/utils'

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

interface Sim {
  id: string
  x: number
  y: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export function GraphView({
  nodes,
  edges,
  height = 520,
  compact = false,
  focusId,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  height?: number
  compact?: boolean
  focusId?: string | null
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 900, h: height })
  const [positions, setPositions] = React.useState<Map<string, Sim>>(new Map())
  const [hover, setHover] = React.useState<string | null>(null)
  const simRef = React.useRef<Simulation<Sim, undefined> | null>(null)

  React.useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(320, r.width), h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [height])

  // The shape of the graph — not the array identity. A parent may hand
  // us a freshly built array on every render, and restarting the
  // simulation each time would leave it permanently unsettled.
  const graphSig = React.useMemo(
    () =>
      `${nodes.map((n) => n.id).join('|')}#${edges
        .map((e) => `${e.source}>${e.target}:${e.kind}`)
        .join('|')}`,
    [nodes, edges],
  )
  const nodesRef = React.useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = React.useRef(edges)
  edgesRef.current = edges
  const sizeRef = React.useRef(size)
  sizeRef.current = size

  React.useEffect(() => {
    const nodes = nodesRef.current
    const edges = edgesRef.current
    const { w, h } = sizeRef.current

    const sims: Sim[] = nodes.map((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2
      const radius = compact ? 70 : 130
      return {
        id: n.id,
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
      }
    })

    const ids = new Set(sims.map((s) => s.id))
    const links = edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, kind: e.kind }))

    const sim = forceSimulation(sims)
      .force(
        'link',
        forceLink<Sim, { source: string | Sim; target: string | Sim; kind: string }>(links)
          .id((d) => d.id)
          .distance(compact ? 55 : 92)
          .strength(compact ? 0.5 : 0.35),
      )
      .force('charge', forceManyBody().strength(compact ? -110 : -190))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide<Sim>().radius(compact ? 12 : 20))
      .alphaDecay(0.045)

    simRef.current = sim as unknown as Simulation<Sim, undefined>

    // One React update per animation frame, not per simulation tick.
    let raf = 0
    sim.on('tick', () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setPositions(new Map(sims.map((s) => [s.id, { ...s }])))
      })
    })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      sim.stop()
    }
  }, [graphSig, compact])

  // Resizing must not restart the layout — just re-centre it.
  React.useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    sim.force('center', forceCenter(size.w / 2, size.h / 2))
    sim.alpha(0.25).restart()
  }, [size.w, size.h])

  const nodeById = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const neighbours = React.useMemo(() => {
    if (!hover) return new Set<string>()
    const s = new Set<string>([hover])
    for (const e of edges) {
      if (e.source === hover) s.add(e.target)
      if (e.target === hover) s.add(e.source)
    }
    return s
  }, [hover, edges])

  const connected = hover ? neighbours : null

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      <svg width="100%" height={height} className="overflow-visible">
        <defs>
          <radialGradient id="nodeGlow">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity=".28" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* edges */}
        <g>
          {edges.map((e, i) => {
            const a = positions.get(e.source)
            const b = positions.get(e.target)
            if (!a || !b) return null
            const dim = connected ? !(connected.has(e.source) && connected.has(e.target)) : false
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={e.kind === 'ai_suggested' ? 'rgb(var(--accent))' : 'rgb(var(--fg) / .18)'}
                strokeWidth={e.kind === 'ai_suggested' ? 1.4 : 1}
                strokeDasharray={e.kind === 'ai_suggested' ? '4 3' : undefined}
                opacity={dim ? 0.08 : 1}
                className="transition-opacity duration-200"
              />
            )
          })}
        </g>

        {/* nodes */}
        <g>
          {nodes.map((n) => {
            const p = positions.get(n.id)
            if (!p) return null
            const r = (compact ? 4.5 : 6) + Math.min(9, n.degree * 1.4)
            const dim = connected ? !connected.has(n.id) : false
            const isFocus = focusId === n.id
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={dim ? 0.18 : 1}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
              >
                {isFocus && <circle r={r + 9} fill="url(#nodeGlow)" />}
                <circle
                  r={r}
                  fill={KIND_COLOR[n.kind]}
                  stroke="rgb(var(--bg))"
                  strokeWidth={2}
                  opacity={0.92}
                />
                {!compact && (
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    style={{
                      fontSize: 11,
                      fill: 'rgb(var(--muted))',
                      fontWeight: 500,
                    }}
                  >
                    {n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* hover card */}
      {hover && nodeById.get(hover) && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-line/12 bg-surface/95 px-3 py-2 shadow-pop backdrop-blur">
          <p className="text-[12.5px] font-semibold">{nodeById.get(hover)!.label}</p>
          <p className="mt-0.5 text-[11px] text-faint">
            {KIND_LABEL[nodeById.get(hover)!.kind]} · {nodeById.get(hover)!.degree} link
            {nodeById.get(hover)!.degree === 1 ? '' : 's'}
          </p>
        </div>
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
