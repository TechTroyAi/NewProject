'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Heatmap({
  data,
  weeks = 17,
}: {
  data: { date: string; pages: number; reviews: number }[]
  weeks?: number
}) {
  const byDate = React.useMemo(() => new Map(data.map((d) => [d.date, d])), [data])

  const columns = React.useMemo(() => {
    const out: { date: string; value: number }[][] = []
    const today = new Date()
    const end = new Date(today)
    end.setDate(end.getDate() - end.getDay() + 6) // end of current week (Saturday)
    const start = new Date(end)
    start.setDate(start.getDate() - (weeks * 7 - 1))

    for (let w = 0; w < weeks; w++) {
      const col: { date: string; value: number }[] = []
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start)
        cur.setDate(start.getDate() + w * 7 + d)
        if (cur > today) {
          col.push({ date: cur.toISOString().slice(0, 10), value: -1 })
          continue
        }
        const key = cur.toISOString().slice(0, 10)
        const rec = byDate.get(key)
        col.push({ date: key, value: (rec?.pages ?? 0) + (rec?.reviews ?? 0) })
      }
      out.push(col)
    }
    return out
  }, [byDate, weeks])

  const level = (v: number) => {
    if (v <= 0) return 0
    if (v < 5) return 1
    if (v < 12) return 2
    if (v < 25) return 3
    return 4
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]">
        {columns.map((col, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {col.map((c) => (
              <div
                key={c.date}
                title={c.value < 0 ? '' : `${c.date}: ${c.value}`}
                className={cn(
                  'size-[11px] rounded-[2px] transition-colors',
                  c.value < 0 && 'bg-transparent',
                  level(c.value) === 0 && 'bg-line/8',
                  level(c.value) === 1 && 'bg-accent/25',
                  level(c.value) === 2 && 'bg-accent/45',
                  level(c.value) === 3 && 'bg-accent/70',
                  level(c.value) === 4 && 'bg-accent',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
