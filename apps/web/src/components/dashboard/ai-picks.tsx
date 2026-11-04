'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FilePlus2, Link2, Sparkles } from 'lucide-react'

export interface AiPick {
  id: string
  kind: 'wiki' | 'link' | 'recap'
  title: string
  body: string
  cta: string
}

export function AiPicks({ picks }: { picks: AiPick[] }) {
  const router = useRouter()
  const [done, setDone] = React.useState<string[]>([])

  const icon = { wiki: FilePlus2, link: Link2, recap: Sparkles }

  return (
    <div className="space-y-2 p-3">
      {picks.map((p) => {
        const Icon = icon[p.kind]
        const isDone = done.includes(p.id)
        return (
          <button
            key={p.id}
            onClick={() => {
              setDone((d) => [...d, p.id])
              if (p.kind === 'wiki') router.push('/app/notes/new')
            }}
            className={`group w-full rounded-xl border border-line/8 bg-raised/40 p-3 text-left transition duration-200 hover:border-line/18 hover:bg-raised ${
              isDone ? 'opacity-45' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="grid size-5 place-items-center rounded-md text-white"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--wiki)))' }}
              >
                <Icon className="size-3" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-faint">
                {p.kind === 'wiki' ? 'Wiki draft' : p.kind === 'link' ? 'Connection found' : 'Weekly recap'}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg/85">{p.body}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent">
              {isDone ? 'Queued' : p.cta}
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
