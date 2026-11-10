'use client'
import * as React from 'react'
import GridLayout, { type Layout } from 'react-grid-layout'

/** One widget's place on the grid. */
type GridLayoutItem = Layout
import { Check, GripVertical, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface DashboardWidget {
  id: string
  /** The card body. */
  children: React.ReactNode
  /** How tall the widget wants to be, in grid rows. */
  rows?: number
}

/** The grid the dashboard starts from. */
export const DEFAULT_LAYOUT: GridLayoutItem[] = [
  { i: 'stats', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: 'continue', x: 0, y: 2, w: 7, h: 4, minW: 4, minH: 3 },
  { i: 'graph', x: 7, y: 2, w: 5, h: 4, minW: 3, minH: 3 },
  { i: 'notes', x: 0, y: 6, w: 4, h: 4, minW: 3, minH: 3 },
  { i: 'picks', x: 4, y: 6, w: 4, h: 4, minW: 3, minH: 3 },
  { i: 'actions', x: 8, y: 6, w: 4, h: 3, minW: 3, minH: 2 },
]

const COLS = 12
const ROW_HEIGHT = 58

/**
 * The dashboard grid.
 *
 * Widgets can be dragged and resized, and the positions are saved to
 * `profiles.settings.dashboard` so the shelf looks the same the next
 * time it is opened.
 */
export function DashboardGrid({
  widgets,
  layout: savedLayout,
}: {
  widgets: DashboardWidget[]
  layout?: GridLayoutItem[]
}) {
  const [layout, setLayout] = React.useState<GridLayoutItem[]>(() =>
    savedLayout?.length ? normalise(savedLayout, widgets) : DEFAULT_LAYOUT,
  )
  const [editing, setEditing] = React.useState(false)
  const [width, setWidth] = React.useState(0)
  const [dirty, setDirty] = React.useState(false)
  const hostRef = React.useRef<HTMLDivElement>(null)

  // react-grid-layout needs the width of its container before it can
  // place anything.
  React.useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A widget that is new since the layout was saved still needs a
  // place on the grid.
  React.useEffect(() => {
    setLayout((current) => normalise(current, widgets))
  }, [widgets])

  async function save() {
    try {
      const res = await fetch('/api/settings/dashboard', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ layout }),
      })
      if (!res.ok) throw new Error(`could not save the layout (${res.status})`)
      setDirty(false)
      setEditing(false)
      toast.success('Dashboard layout saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  function reset() {
    setLayout(DEFAULT_LAYOUT)
    setDirty(true)
  }

  return (
    <div ref={hostRef} className="relative">
      {editing && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/6 px-3 py-2">
          <Pencil className="size-3.5 text-accent" />
          <p className="text-[12px] text-muted">
            Drag a card by its handle, or pull an edge to resize. The layout is saved to your profile.
          </p>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={reset}>
            Reset
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={!dirty}>
            <Check /> Save layout
          </Button>
        </div>
      )}

      <GridLayout
        className="layout"
        layout={layout}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={width || 1200}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".widget-drag"
        compactType="vertical"
        onLayoutChange={(next) => {
          setLayout(next)
          if (editing) setDirty(true)
        }}
      >
        {widgets.map((w) => (
          <div key={w.id} className="relative">
            {editing && (
              <span className="widget-drag absolute -top-2 left-1/2 z-10 -translate-x-1/2 cursor-grab rounded-full border border-line/12 bg-surface px-2 py-0.5 text-faint shadow-pop active:cursor-grabbing">
                <GripVertical className="size-3" />
              </span>
            )}
            <div className={cn('h-full', editing && 'pointer-events-none select-none')}>{w.children}</div>
          </div>
        ))}
      </GridLayout>

      {!editing && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => setEditing(true)}
          aria-label="Arrange the dashboard"
        >
          <Pencil /> Arrange
        </Button>
      )}
    </div>
  )
}

/**
 * Make sure every widget has an entry, and that no entry refers to a
 * widget that no longer exists.
 */
function normalise(layout: GridLayoutItem[], widgets: DashboardWidget[]): GridLayoutItem[] {
  const ids = new Set(widgets.map((w) => w.id))
  const kept = layout.filter((l) => ids.has(l.i))
  const missing = widgets.filter((w) => !kept.some((l) => l.i === w.id))
  if (!missing.length) return kept

  // Put the new widgets under everything else.
  let y = kept.reduce((max, l) => Math.max(max, l.y + l.h), 0)
  for (const w of missing) {
    kept.push({ i: w.id, x: 0, y, w: 4, h: w.rows ?? 4, minW: 3, minH: 2 })
    y += (w.rows ?? 4) + 1
  }
  return kept
}
