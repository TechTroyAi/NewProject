import * as React from 'react'
import { cn } from '@/lib/utils'

export function StatTile({
  label,
  value,
  unit,
  delta,
  icon,
  tone = 'rgb(var(--accent))',
  spark,
}: {
  label: string
  value: string | number
  unit?: string
  delta?: string
  icon: React.ReactNode
  tone?: string
  spark?: number[]
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line/8 bg-surface p-4 transition duration-200 hover:border-line/15 hover:bg-surface/80">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg text-white transition-transform group-hover:scale-105"
          style={{ background: tone }}
        >
          {icon}
        </span>
        <span className="text-[11.5px] font-medium text-muted">{label}</span>
      </div>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-[-.02em] tabular-nums">{value}</span>
        {unit && <span className="pb-0.5 text-[11.5px] text-faint">{unit}</span>}
      </div>
      {delta && <p className="mt-1.5 text-[11px] text-good">{delta}</p>}
      {spark && <Sparkline values={spark} tone={tone} />}
    </div>
  )
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${34 - ((v - min) / span) * 30}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 right-0 h-10 w-2/5 opacity-35">
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
