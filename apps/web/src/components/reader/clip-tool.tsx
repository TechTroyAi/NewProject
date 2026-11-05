'use client'
import * as React from 'react'
import { Scissors } from 'lucide-react'
import { Tooltip } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface ClipRegion {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The clip tool.
 *
 * Drag a rectangle over the page and it is saved as a clip: a region
 * of a page, stored as fractions of the page's size (0–1) so it
 * survives any zoom level, any device and any re-render.
 */

/** The chrome button that turns the clip tool on and off. */
export function ClipToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <Tooltip label={active ? 'Cancel the clip' : 'Clip a region of the page'}>
      <button
        onClick={() => onToggle(!active)}
        className={cn(
          'grid size-7 place-items-center rounded-lg transition',
          active ? 'bg-accent/15 text-accent' : 'text-faint hover:bg-raised hover:text-fg',
        )}
        aria-pressed={active}
        aria-label="Clip a region of the page"
      >
        <Scissors className="size-3.5" />
      </button>
    </Tooltip>
  )
}

/** The drag surface that sits on top of the page image. */
export function ClipOverlay({
  itemId,
  pageIdx,
  active,
  onSaved,
}: {
  itemId: string
  pageIdx: number
  active: boolean
  onSaved?: (clip: { id: string; bbox: ClipRegion }) => void
}) {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const [drag, setDrag] = React.useState<{ x: number; y: number } | null>(null)
  const [region, setRegion] = React.useState<ClipRegion | null>(null)
  const [busy, setBusy] = React.useState(false)

  const toFraction = React.useCallback((clientX: number, clientY: number) => {
    const el = boxRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active) return
    const point = toFraction(e.clientX, e.clientY)
    if (!point) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDrag(point)
    setRegion(null)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active || !drag) return
    const point = toFraction(e.clientX, e.clientY)
    if (!point) return
    setRegion({
      x: Math.min(drag.x, point.x),
      y: Math.min(drag.y, point.y),
      w: Math.abs(point.x - drag.x),
      h: Math.abs(point.y - drag.y),
    })
  }

  const onPointerUp = React.useCallback(async () => {
    if (!active || !drag) return
    const picked = region
    setDrag(null)
    setRegion(null)
    if (!picked || picked.w < 0.02 || picked.h < 0.02) {
      toast.error('Drag a bigger box to clip something worth keeping.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itemId,
          pageIdx,
          bbox: {
            x: Number(picked.x.toFixed(4)),
            y: Number(picked.y.toFixed(4)),
            w: Number(picked.w.toFixed(4)),
            h: Number(picked.h.toFixed(4)),
          },
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `could not save the clip (${res.status})`)
      toast.success('Clip saved.')
      onSaved?.({ id: body?.clipId, bbox: picked })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [drag, region, active, itemId, pageIdx, onSaved])

  if (!active) return null

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 z-20 cursor-crosshair select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {region && (
        <div
          className="pointer-events-none absolute border-2 border-accent bg-accent/10"
          style={{
            left: `${region.x * 100}%`,
            top: `${region.y * 100}%`,
            width: `${region.w * 100}%`,
            height: `${region.h * 100}%`,
          }}
        />
      )}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-line/10 bg-bg/90 px-3 py-1 text-[11px] text-faint backdrop-blur-xl">
        {busy ? 'Saving the clip…' : 'Drag a box to clip this page'}
      </div>
    </div>
  )
}
