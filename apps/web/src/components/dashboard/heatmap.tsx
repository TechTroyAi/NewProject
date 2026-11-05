'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { localDateKey } from '@shelf/shared'

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
    // Start on the Sunday of the week `weeks - 1` weeks back, so the
    // grid runs Sunday → Saturday and ends on the current week.
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7)

    for (let w = 0; w < weeks; w++) {
      const col: { date: string; value: number }[] = []
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start)
        cur.setDate(start.getDate() + w * 7 + d)
        // The activity table stores a plain calendar date, so the key
        // has to be the *local* date. `toISOString()` converts to UTC,
        // which shifts every cell by a day east of Greenwich.
        const key = localDateKey(cur)
        if (cur > today) {
          col.push({ date: key, value: -1 })
          continue
        }
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
